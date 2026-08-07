import { DEFAULT_CONFIG, type RoundRecord } from "@zinc/engine";
import { verifyEntry, type AutoSettings, type HistoryEntry, type Snapshot } from "./client";
import {
  sfxBonanza,
  sfxExtract,
  sfxJoin,
  sfxSeal,
  sfxShatter,
  sfxTick,
  sfxYouDied,
} from "../audio/sound";

/**
 * The networked client.
 *
 * In this mode the browser decides nothing. It sends intents ("I want in",
 * "get me out") and renders whatever the server says is true. Everything that
 * used to be simulated locally — the rounds, the rolls, the balances, the
 * ledgers — now lives on the server, and this class exists only to turn the
 * wire format back into the exact same `Snapshot` the UI already renders.
 *
 * That is the whole point of having built the UI against a snapshot: not one
 * component knows or cares which of the two clients produced it.
 */

interface NetStats {
  roundsPlayed: number;
  roundsWon: number;
  wagered: number;
  returned: number;
  bestMultiple: number;
  revEarned: number;
}

/** Extra fields the local demo client has no equivalent for. */
export interface NetExtras {
  connected: boolean;
  online: number;
  guest: boolean;
  address: string;
  stats: NetStats;
}

const EMPTY_STATS: NetStats = {
  roundsPlayed: 0,
  roundsWon: 0,
  wagered: 0,
  returned: 0,
  bestMultiple: 0,
  revEarned: 0,
};

/**
 * A stable local id so a guest keeps their balance across refreshes.
 *
 * Storage can throw outright — blocked cookies, private-mode webviews — and an
 * exception here used to escape into the message handler's floating promise
 * and leave the client permanently unauthenticated with no retry. A session
 * that loses its balance on refresh is a far better failure than one that
 * never connects.
 */
let memoryGuestId = "";
function guestId(): string {
  const KEY = "zinc.guest.v1";
  const fresh = (): string => {
    const b = new Uint8Array(12);
    crypto.getRandomValues(b);
    return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
    const id = fresh();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    if (!memoryGuestId) memoryGuestId = fresh();
    return memoryGuestId;
  }
}

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signMessage(msg: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
};

function phantom(): PhantomProvider | null {
  const w = window as unknown as {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  };
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

const IDLE: Snapshot = {
  phase: "lobby",
  roundId: 0,
  tick: 0,
  multiplier: 1,
  hazard: 0,
  grace: false,
  graceRemaining: 0,
  msToPhaseEnd: 0,
  players: [],
  liveCount: 0,
  totalCount: 0,
  deadCount: 0,
  cashedCount: 0,
  potInPlay: 0,
  entry: DEFAULT_CONFIG.entry,
  you: { joined: false, outcome: "out", balance: 0, multiple: 0, lockedMultiple: null },
  wallet: 0,
  session: 0,
  bonanzaPool: 0,
  bonanzaTickets: 0,
  revShareTickets: 0,
  bonanza: null,
  charId: "chad",
  winner: null,
  teamWins: {},
  tickets: { bonYours: 0, bonTotal: 0, bonShare: 0, revShare: 0, revStreamed: 0 },
  log: [],
  history: [],
  nextCommit: "",
  auto: { enabled: false, target: 2 },
  stats: EMPTY_STATS,
  online: 0,
  connected: false,
  dev: {
    fieldSize: null,
    speed: 1,
    bonanzaOdds: null,
    hazardOverride: null,
    immortal: false,
  },
};

export class NetClient {
  readonly isLocal = false;
  private ws: WebSocket | null = null;
  private snap: Snapshot = IDLE;
  private listeners = new Set<(s: Snapshot) => void>();
  private history: HistoryEntry[] = [];
  private extras: NetExtras = {
    connected: false,
    online: 0,
    guest: true,
    address: "",
    stats: EMPTY_STATS,
  };
  private retry = 0;
  private reconnectTimer: number | null = null;
  private closed = false;
  /** Local deadline for the current phase, so countdowns run between pushes. */
  private phaseEndAt = 0;
  private clock: number | null = null;

  constructor(private url: string) {
    this.connect();
    // The server pushes state on its own cadence; without a local clock the
    // "seals in 7s" countdown sits frozen between pushes and the game looks
    // hung. Purely cosmetic interpolation — the server still owns the clock.
    this.clock = window.setInterval(() => {
      if (this.snap.phase === undefined || !this.snap.connected) return;
      const left = Math.max(0, this.phaseEndAt - Date.now());
      if (Math.abs(left - this.snap.msToPhaseEnd) < 100) return;
      this.snap = { ...this.snap, msToPhaseEnd: left };
      this.emit();
    }, 250);
  }

  private connect(): void {
    if (this.closed) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
    };

    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        return;
      }
      void this.handle(m);
    };

    ws.onclose = () => {
      this.extras = { ...this.extras, connected: false };
      // Into the snapshot too — the snapshot is the only thing the UI reads,
      // and a stale `connected: true` there means the player is never told
      // their cash-out button stopped doing anything.
      this.snap = { ...this.snap, connected: false };
      this.emit();
      // Exponential backoff, capped: a server restart should be a blip, and a
      // server that is down should not become a denial of service against it.
      if (this.closed) return;
      const wait = Math.min(8000, 500 * 2 ** this.retry++);
      this.reconnectTimer = window.setTimeout(() => this.connect(), wait);
    };

    ws.onerror = () => ws.close();
  }

  private async handle(m: Record<string, unknown>): Promise<void> {
    switch (m.t) {
      case "challenge":
        await this.authenticate(String(m.nonce));
        return;

      case "ready":
        this.extras = {
          ...this.extras,
          connected: true,
          guest: Boolean(m.guest),
          address: String(m.wallet),
        };
        this.emit();
        return;

      case "state": {
        const s = m.state as Record<string, unknown> & Snapshot & { stats: NetStats };
        this.extras = { ...this.extras, online: Number(s.online ?? 0), stats: s.stats };
        const prev = this.snap;
        this.phaseEndAt = Date.now() + Number(s.msToPhaseEnd ?? 0);
        this.snap = {
          ...IDLE,
          ...s,
          log: [],
          history: this.history,
          connected: true,
        };
        this.cue(prev, this.snap);
        this.emit();
        return;
      }

      case "history": {
        const rows = (m.history ?? []) as Record<string, unknown>[];
        this.history = rows.map((r) => this.toHistory(r));
        this.snap = { ...this.snap, history: this.history };
        this.emit();
        return;
      }

      case "error":
        console.warn("server:", m.message);
        return;
    }
  }

  /**
   * Prove who you are, if you can. A connected Phantom signs the server's
   * nonce, which is what stops anyone from simply claiming to be an address
   * and spending its balance. Without a wallet you play as a local guest.
   */
  private async authenticate(nonce: string): Promise<void> {
    const p = phantom();
    if (p) {
      try {
        const res = await p.connect({ onlyIfTrusted: true }).catch(() => null);
        const pubkey = res?.publicKey ?? p.publicKey;
        if (pubkey) {
          const msg = new TextEncoder().encode(`THIN ICE login\nnonce: ${nonce}`);
          const { signature } = await p.signMessage(msg, "utf8");
          const sig = btoa(String.fromCharCode(...signature));
          this.send({ t: "auth", wallet: pubkey.toString(), sig });
          return;
        }
      } catch {
        // Declined or unavailable: fall through to guest.
      }
    }
    this.send({ t: "guest", id: guestId() });
  }

  /**
   * Sound, driven by what changed between two server states.
   *
   * The local client fires its cues from inside the functions that cause them.
   * Nothing here causes anything, so the cues have to be recovered by diffing
   * successive snapshots instead — otherwise pointing the build at a server
   * ships a completely silent game with a fully working volume control, which
   * is exactly the state this was in.
   */
  private cue(a: Snapshot, b: Snapshot): void {
    if (b.roundId !== a.roundId) return; // fresh round, nothing to compare
    if (a.phase === "lobby" && b.phase === "live") sfxSeal();
    if (!a.you.joined && b.you.joined && b.phase === "lobby") sfxJoin();

    if (b.phase === "live" && b.tick > a.tick) {
      const shattered = b.deadCount - a.deadCount;
      if (shattered > 0) sfxShatter(shattered);
      sfxTick(b.hazard);
    }

    if (a.you.outcome === "in" && b.you.outcome === "dead") sfxYouDied();
    if (a.you.outcome === "in" && b.you.outcome === "cashed") sfxExtract();

    // `at` is the server's fire timestamp, so it identifies the event even
    // when two fires land in consecutive rounds.
    if (b.bonanza && b.bonanza.at !== a.bonanza?.at) sfxBonanza();
  }

  private toHistory(r: Record<string, unknown>): HistoryEntry {
    let record: RoundRecord = { entrantIds: [], cashOuts: [] };
    try {
      record = JSON.parse(String(r.record ?? "")) as RoundRecord;
    } catch {
      /* an unreplayable row simply cannot be verified */
    }
    return {
      roundId: Number(r.roundId),
      entrants: Number(r.entrants),
      ticks: Number(r.ticks),
      joined: true,
      yourOutcome: r.yourOutcome as HistoryEntry["yourOutcome"],
      yourMultiple: r.yourMultiple === null ? null : Number(r.yourMultiple),
      bestMultiple: Number(r.bestMultiple),
      commit: String(r.commit ?? ""),
      seedHex: String(r.seedHex ?? ""),
      verified: null,
      seedOk: null,
      replayOk: null,
      rulesOk: null,
      record,
      immortal: false,
      digest: String(r.digest ?? ""),
      winnerChar: (r.winnerChar as string | null) ?? null,
      winnerYou: Boolean(r.winnerYou),
    };
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.snap);
  }

  // ------------------------------------------------------------------ public

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  snapshot(): Snapshot {
    return this.snap;
  }

  net(): NetExtras {
    return this.extras;
  }

  join(): void {
    this.send({ t: "join" });
  }

  walkOut(): void {
    this.send({ t: "cashout" });
  }

  /**
   * Re-runs the login handshake on the live server connection. The HUD calls
   * this after the player connects or disconnects Phantom: authentication
   * happens at socket open, so without a fresh handshake the player who just
   * approved their wallet would remain seated as a guest until they reloaded.
   */
  reauth(): void {
    this.retry = 0;
    this.ws?.close();
  }

  setAuto(patch: Partial<AutoSettings>): void {
    const next = { ...this.snap.auto, ...patch };
    if (!Number.isFinite(next.target) || next.target < 1.05) next.target = 1.05;
    if (next.target > 1000) next.target = 1000;
    // Optimistic locally so the control answers instantly; the server's next
    // state message is what actually settles it.
    this.snap = { ...this.snap, auto: next };
    this.emit();
    this.send({ t: "setAuto", enabled: next.enabled, target: next.target });
  }

  setCharacter(id: string): void {
    this.snap = { ...this.snap, charId: id };
    this.emit();
    this.send({ t: "setChar", charId: id });
  }

  /**
   * Re-runs a finished round from its revealed seed, right here, and checks
   * the replay, the commitment, and the rules it was played under. The server
   * is not asked to confirm anything — that is the entire point. Identical
   * code to the local client's check, deliberately.
   */
  async verifyRound(roundId: number): Promise<void> {
    const h = this.history.find((x) => x.roundId === roundId);
    if (!h) return;
    await verifyEntry(h, DEFAULT_CONFIG);
    this.snap = { ...this.snap, history: [...this.history] };
    this.emit();
  }

  destroy(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.clock !== null) clearInterval(this.clock);
    this.ws?.close();
    this.listeners.clear();
  }
}
