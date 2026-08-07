import {
  BonanzaPool,
  DEFAULT_CONFIG,
  RevShareLedger,
  Round,
  canonicalConfig,
  drawFieldSize,
  hazardAt,
  mulberry32,
  outcomeDigest,
  replayRound,
  rngFromSeedHex,
  totalRake,
  type Entrant,
  type GameConfig,
  type Player,
  type Rng,
  type RoundRecord,
  type Strategy,
} from "@zinc/engine";
import { fakeAddress, shortAddress } from "./names";
import { CHARACTERS, charById } from "./chars";
import { riskScale } from "./risk";
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
 * Local game driver for the prototype.
 *
 * Runs the real engine against bots on a wall clock, so the UI is developed
 * against genuine round dynamics rather than hand-waved animation. The whole
 * economy runs through the engine's own ledgers — the jackpot draw is
 * ticket-weighted across rounds via `BonanzaPool`, and the rakeback stream
 * accrues and pays through `RevShareLedger` — so the client's numbers cannot
 * drift from what the simulator certifies.
 *
 * In production this class is replaced by a websocket client consuming
 * server-authoritative round state; everything downstream of `Snapshot` stays
 * exactly as it is. NOTE the RNG seeding here is prototype-only: a live
 * deployment derives round seeds from a commit-reveal scheme on the server,
 * never from wall-clock time in the browser.
 */

export type Phase = "lobby" | "live" | "result";

export interface PlayerView {
  id: number;
  name: string;
  you: boolean;
  charId: string;
  outcome: "in" | "cashed" | "dead";
  /** Multiple of the entry paid. 1.00 is break-even. */
  multiple: number;
  balance: number;
  /** Ticks spent standing on the ice. Still climbing while they are alive. */
  ticksSurvived: number;
}

/** Who the winner scene celebrates once a round ends. */
export interface WinnerInfo {
  name: string;
  charId: string;
  you: boolean;
  multiple: number;
  amount: number;
  /** True: outlasted everyone. False: nobody survived, best extraction shown. */
  lastStanding: boolean;
}

export interface LogEntry {
  id: number;
  kind: "join" | "seal" | "death" | "cash" | "you" | "bonanza" | "info";
  text: string;
  value?: string;
}

export interface BonanzaEvent {
  amount: number;
  winner: string;
  youWon: boolean;
  /** When it fired, so the overlay knows how far through the sequence it is. */
  at: number;
}

/** Knobs exposed for testing. Not shipped to players. */
export interface DevSettings {
  /** Forces the field size instead of the configured random draw. */
  fieldSize: number | null;
  /** Multiplies tick speed. 2 = double time. */
  speed: number;
  /** Overrides the per-round jackpot chance so it can be seen firing. */
  bonanzaOdds: number | null;
  /**
   * Forces the DISPLAYED danger — ring, seam glow, cracking, trembling, tick
   * audio — without touching the actual elimination rolls. High-risk visuals
   * are otherwise near-impossible to audition, because the states that
   * produce them mostly occur with two players left in a p99 round.
   */
  hazardOverride: number | null;
  /** Rounds seal with zero hazard: nobody can die. A visual test chamber. */
  immortal: boolean;
}

export interface AutoSettings {
  /** Enters every round automatically while the wallet covers the entry. */
  enabled: boolean;
  /**
   * Extracts the first tick the shared multiplier reaches this. Steps are
   * discrete, so the exit banks whatever the multiple actually is when it
   * crosses: never below the target, sometimes above it.
   */
  target: number;
}

export interface Snapshot {
  phase: Phase;
  roundId: number;
  tick: number;
  /** Shared by everyone still inside: balance / entry. */
  multiplier: number;
  /**
   * The rate the NEXT roll will run at, given the field as it stands now.
   * The engine's own `hazard` is backward-looking (the tick that already
   * resolved), which left the meter showing the pre-shatter rate for a full
   * tick after a mass death — the exact unresponsiveness the hazard curve was
   * tuned to avoid.
   */
  hazard: number;
  grace: boolean;
  graceRemaining: number;
  msToPhaseEnd: number;
  players: PlayerView[];
  liveCount: number;
  totalCount: number;
  deadCount: number;
  cashedCount: number;
  potInPlay: number;
  entry: number;
  you: {
    joined: boolean;
    outcome: "out" | "in" | "cashed" | "dead";
    balance: number;
    multiple: number;
    lockedMultiple: number | null;
  };
  wallet: number;
  session: number;
  bonanzaPool: number;
  bonanzaTickets: number;
  revShareTickets: number;
  /** Set for a few seconds after the jackpot fires, then cleared. */
  bonanza: BonanzaEvent | null;
  /** Your chosen character. */
  charId: string;
  /** Set through the result phase, null once the next lobby opens. */
  winner: WinnerInfo | null;
  /** All-time wins per character, the team dominance record. */
  teamWins: Record<string, number>;
  /** Your standing in both ticket economies, ready to display. */
  tickets: {
    /** Bonanza: your tickets over everything circulating since the last fire. */
    bonYours: number;
    bonTotal: number;
    /** Your odds of taking the next fire, 0-1. */
    bonShare: number;
    /** Rev share: your slice of the stream as it stands right now, 0-1. */
    revShare: number;
    /** Everything the stream has ever paid you. */
    revStreamed: number;
  };
  log: LogEntry[];
  /** Finished rounds, newest first, each replayable and verifiable. */
  history: HistoryEntry[];
  /** Fairness commitment for the round currently forming or running. */
  nextCommit: string;
  auto: AutoSettings;
  /** Lifetime record. Server-authoritative in net play, local in the demo. */
  stats: PlayerStats;
  /** Humans connected right now. Always 1 offline. */
  online: number;
  /** False while the socket is down, so the UI can say so instead of freezing. */
  connected: boolean;
  dev: DevSettings;
}

export interface PlayerStats {
  roundsPlayed: number;
  /** Rounds that came back at or above the entry. */
  roundsWon: number;
  /** Everything ever staked. */
  wagered: number;
  /** Everything ever paid back. */
  returned: number;
  bestMultiple: number;
  /** Lifetime rakeback received. */
  revEarned: number;
}

const YOU_ID = 9999;

/**
 * sha256 as lowercase hex, or null where the browser will not provide it.
 *
 * `crypto.subtle` does not exist on an insecure origin — testing over a LAN
 * IP, for instance. Returning null rather than "" matters: an empty string
 * compares unequal to the commitment and would brand every honest round a
 * mismatch, which is the single worst thing this panel could say.
 */
export async function sha256Hex(s: string): Promise<string | null> {
  if (!crypto?.subtle) return null;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function commitPreimage(roundId: number, seedHex: string, rulesHash: string): string {
  return `thinice:${roundId}:${seedHex}:${rulesHash}`;
}

const SAVE_KEY = "zinc.save.v1";

interface SaveState {
  wallet: number;
  session: number;
  pool: number;
  bTickets: number;
  revLifetime: number;
  revWeight: number;
  autoEnabled?: boolean;
  autoTarget?: number;
  charId?: string;
  revStreamed?: number;
  teamWins?: Record<string, number>;
  roundId?: number;
  stats?: PlayerStats;
}

function loadSave(): SaveState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveState;
    if (!Number.isFinite(s.wallet)) return null;
    // Every numeric field is scrubbed, not just the wallet. A save from an
    // older schema (or an edited one) carries undefined where a number is
    // expected, and feeding that into the rev-share ledger poisons the weight
    // totals with NaN — after which every percentage in the HUD reads "NaN%"
    // and no reload fixes it, because the bad value is what got persisted.
    const num = (v: unknown, fallback = 0): number =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return {
      ...s,
      wallet: num(s.wallet),
      session: num(s.session),
      pool: num(s.pool),
      bTickets: num(s.bTickets),
      revLifetime: num(s.revLifetime),
      revWeight: num(s.revWeight),
      revStreamed: num(s.revStreamed),
      autoTarget: num(s.autoTarget, 2),
      roundId: num(s.roundId),
    };
  } catch {
    return null;
  }
}

/**
 * The verification both clients run. One implementation on purpose: the local
 * demo and the networked build must reach a verdict the same way, or the demo
 * proves nothing about the thing players will actually be paid by.
 *
 * Mutates the entry in place with its three receipts.
 */
export async function verifyEntry(h: HistoryEntry, expected: GameConfig): Promise<void> {
  try {
    // Replay under the rules recorded with the round, not the ones this build
    // ships: a round played before a config change is still an honest round.
    const rules = h.record.config ?? expected;
    const replay = replayRound(rules, h.record);
    h.replayOk = outcomeDigest(replay) === h.digest;

    const canonical = canonicalConfig(rules);
    const rulesHash = await sha256Hex(canonical);
    if (rulesHash === null) {
      // No hashing available (insecure origin). Refuse to render a verdict
      // rather than report a mismatch we have not actually found.
      h.unavailable = true;
      h.seedOk = null;
      h.rulesOk = null;
      h.verified = null;
      return;
    }

    if (h.record.seedHex === undefined) {
      // A round from before the rules were folded into the commitment. Check
      // it against the ceremony it was actually played under rather than
      // calling it a mismatch: the old commitment covered the seed alone, so
      // that is exactly — and only — what can honestly be verified about it.
      h.seedOk = h.commit !== "" && (await sha256Hex(`thinice:${h.roundId}:${h.seedHex}`)) === h.commit;
      h.rulesOk = null;
      h.verified = h.replayOk === true && h.seedOk === true;
      return;
    }

    const hash = await sha256Hex(commitPreimage(h.roundId, h.seedHex, rulesHash));
    h.seedOk = h.commit !== "" && hash === h.commit;
    h.rulesOk = canonical === canonicalConfig(expected);
    h.verified = h.replayOk === true && h.seedOk === true && h.rulesOk === true;
  } catch {
    h.verified = false;
    h.seedOk = h.seedOk ?? false;
    h.replayOk = h.replayOk ?? false;
    h.rulesOk = h.rulesOk ?? false;
  }
}

/** One finished round, carrying everything needed to re-verify it in-browser. */
export interface HistoryEntry {
  roundId: number;
  entrants: number;
  ticks: number;
  joined: boolean;
  yourOutcome: "none" | "cashed" | "dead";
  yourMultiple: number | null;
  bestMultiple: number;
  /** Published before the round sealed. */
  commit: string;
  /** Revealed once the round ends. */
  seedHex: string;
  /** null = not yet checked; then the verdict of the in-browser replay. */
  verified: boolean | null;
  /** Receipt: does the revealed seed hash to the pre-published commitment? */
  seedOk: boolean | null;
  /** Receipt: did the replay reproduce every tick and every balance? */
  replayOk: boolean | null;
  /**
   * Receipt: were the rules this round ran under the same rules this build
   * advertises? A round can replay perfectly under rigged numbers, so without
   * this check the other two prove only internal consistency.
   */
  rulesOk: boolean | null;
  /** True when the browser cannot hash at all, so no verdict is honest. */
  unavailable?: boolean;
  record: RoundRecord;
  immortal: boolean;
  digest: string;
  /** Who took the round, for the champions strip and the team tally. */
  winnerChar: string | null;
  winnerYou: boolean;
}

export class GameClient {
  /** Discriminant: the dev tools only make sense against the local driver. */
  readonly isLocal = true;
  private config: GameConfig = DEFAULT_CONFIG;
  private stats: PlayerStats = {
    roundsPlayed: 0,
    roundsWon: 0,
    wagered: 0,
    returned: 0,
    bestMultiple: 0,
    revEarned: 0,
  };
  /** Presentation-side randomness only: bot personalities, names, arrivals. */
  private rng = mulberry32((Date.now() & 0xffffffff) >>> 0);
  /**
   * The round's own seed, drawn from the platform CSPRNG and committed to via
   * sha256 before the round seals. Bots never touch this stream — the round
   * consumes it in a fixed pattern, which is what makes replay verification
   * possible. In production the server runs this same ceremony and the
   * client only checks it.
   */
  private roundSeedHex = "";
  private roundCommit = "";
  /** Hash of the rules each round is committed under, alongside the seed. */
  private rulesHash = "";
  /** The exact rules the sealed round is running, recorded for replay. */
  private roundRules: GameConfig | null = null;
  private history: HistoryEntry[] = [];
  private round: Round | null = null;
  private phase: Phase = "lobby";
  private phaseEnd = 0;
  // openLobby increments first, so the first round players see is #1.
  private roundId = 0;
  private names = new Map<number, string>();
  private joined = false;
  private lobbyEntrants: Entrant[] = [];
  /** Wall-clock time each bot walks into the lobby, so the room fills visibly. */
  private arrivals = new Map<number, number>();
  private log: LogEntry[] = [];
  private logSeq = 0;
  private loopTimer: number | null = null;
  /** Absolute time the next tick fires. Advanced by the interval on each fire,
   * so the realised period averages exactly tickMs instead of quantising up to
   * the driver interval and drifting ~12% slow. */
  private nextTickAt = 0;
  private lastSig = "";

  wallet = 5;
  session = 0;

  /** The real jackpot: cross-round ticket-weighted, funded per round. */
  private jackpot: BonanzaPool;
  /** The real rakeback stream. Your earnings are auto-claimed into the wallet. */
  private revShare: RevShareLedger;
  private rakebackClaimed = 0;
  /** Everything the stream has ever paid you, across sessions. Display only. */
  private revStreamedLifetime = 0;

  private bonanza: BonanzaEvent | null = null;
  private forceBonanza = false;
  private roundImmortal = false;
  private winner: WinnerInfo | null = null;
  private teamWins: Record<string, number> = {};
  /**
   * Your character. Drawn at random on a first visit rather than defaulting
   * everyone to the same face, then remembered; bots get theirs per lobby in
   * `charMap`.
   */
  charId: string = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]!.id;
  private charMap = new Map<number, string>();
  auto: AutoSettings = { enabled: false, target: 2 };
  dev: DevSettings = {
    fieldSize: null,
    speed: 1,
    bonanzaOdds: null,
    hazardOverride: null,
    immortal: false,
  };

  private listeners = new Set<(s: Snapshot) => void>();

  constructor() {
    // Restore the player's standing from the last visit. In production this
    // state lives on the server and on-chain; locally it just means a refresh
    // doesn't wipe your wallet, tickets, and the jackpot pool.
    const save = loadSave();
    this.jackpot = new BonanzaPool(DEFAULT_CONFIG.bonanza, save?.pool ?? 412.7);
    this.revShare = new RevShareLedger(DEFAULT_CONFIG.revShare);
    if (save) {
      this.wallet = save.wallet;
      this.session = save.session;
      if (save.bTickets > 0) this.jackpot.credit(YOU_ID, save.bTickets);
      this.revShare.restore(YOU_ID, save.revLifetime, save.revWeight, Date.now());
      if (typeof save.autoTarget === "number" && save.autoTarget >= 1.05) {
        this.auto.target = save.autoTarget;
      }
      this.auto.enabled = save.autoEnabled === true;
      // charById falls back to the default character on any unknown slug.
      if (save.charId) this.charId = charById(save.charId).id;
      // Display lifetime only. The claim marker (rakebackClaimed) must NOT be
      // restored: the ledger's earnings counter restarts at zero each session,
      // and a restored marker would sit above it, silently blocking claims.
      this.revStreamedLifetime = save.revStreamed ?? 0;
      if (save.teamWins) this.teamWins = save.teamWins;
      if (save.stats) this.stats = save.stats;
      // The round counter keeps climbing across refreshes instead of the
      // site appearing to reset to round one every visit.
      if (typeof save.roundId === "number" && save.roundId > 0) {
        this.roundId = save.roundId;
      }
    }

    this.openLobby();
    this.startLoop();
  }

  /**
   * One wall-clock loop drives everything: phase changes, ticks and repaints.
   *
   * An earlier version chained setTimeout per phase and cleared them on
   * teardown, which meant a single stray cleanup — React StrictMode's
   * mount/unmount/remount, for one — permanently stopped the clock. Deriving
   * every transition from Date.now() means the game cannot get stuck, and a
   * paused or backgrounded tab catches straight back up.
   */
  private startLoop(): void {
    if (this.loopTimer !== null) return;
    this.loopTimer = window.setInterval(() => this.loop(), 50);
  }

  private loop(): void {
    const now = Date.now();

    if (this.phase === "lobby") {
      if (now >= this.phaseEnd) {
        this.seal();
        return;
      }
    } else if (this.phase === "live") {
      if (now >= this.nextTickAt) {
        this.nextTickAt = Math.max(
          now + 20,
          this.nextTickAt + this.config.timing.tickMs / this.dev.speed,
        );
        this.tick();
        return;
      }
    } else if (now >= this.phaseEnd) {
      this.openLobby();
      return;
    }

    // Repaint only when something visible changed: the countdown second, a
    // lobby arrival, a tick. The previous unconditional emit re-rendered the
    // entire React tree 12.5 times a second for a game that advances twice.
    const secs = Math.ceil(Math.max(0, this.phaseEnd - now) / 1000);
    const arrived = this.phase === "lobby" ? this.arrived().length : 0;
    const sig = `${this.phase}:${this.round?.currentTick ?? 0}:${secs}:${arrived}`;
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.emit();
    }
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    const s = this.snapshot();
    for (const fn of this.listeners) fn(s);
  }

  private say(kind: LogEntry["kind"], text: string, value?: string): void {
    this.log.unshift({ id: this.logSeq++, kind, text, value });
    if (this.log.length > 60) this.log.pop();
  }

  /** Bots aim for a target multiple, with nerve deciding who bails when it gets hot. */
  private makeBotStrategy(): Strategy {
    const r = this.rng.next();
    const target =
      r < 0.32
        ? 1.15 + this.rng.next() * 0.35
        : r < 0.8
          ? 1.5 + -Math.log(Math.max(1e-9, this.rng.next())) * 1.0
          : 2.6 + -Math.log(Math.max(1e-9, this.rng.next())) * 3.2;
    const nerve = Math.pow(this.rng.next(), 1.3);
    // Expressed on the shared risk scale rather than as a raw rate. On the
    // knee scale these cover the same real-world hazards as always
    // (~1.7% to ~4.2%).
    const panicAt = 0.43 + this.rng.next() * 0.25;
    // Balances are quoted against the post-rake starting stake, so break-even
    // on the entry actually paid sits just above 1. Derived from the config,
    // not hardcoded — this was pinned at 0.07 and would have silently gone
    // stale the moment the rake moved.
    const breakEven = 1 / (1 - totalRake(this.config));

    return (ctx) => {
      // Nobody bails while the air still holds — there is nothing to flee.
      if (ctx.tick <= this.config.hazard.graceTicks) return false;
      // And nobody locks in a certain loss out of nerves.
      if (ctx.multiple < breakEven) return false;
      if (ctx.multiple >= target) return true;
      // Bot nerves roll on the CLIENT stream, never the round's. A strategy
      // that drew from the round RNG would shift the elimination sequence and
      // break replay verification.
      return riskScale(ctx.q) > panicAt && this.rng.next() < nerve * 0.16;
    };
  }

  private openLobby(): void {
    this.phase = "lobby";
    this.roundId++;
    this.joined = false;
    this.round = null;
    this.log = [];
    this.names.clear();
    this.phaseEnd = Date.now() + this.config.timing.lobbyMs;

    // Commit-reveal: draw the round's seed from the CSPRNG and publish its
    // hash before anyone is even sealed in.
    // 128 bits. A 32-bit seed is enumerable against the published commitment
    // inside a lobby, which would turn the fairness proof into the exploit.
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    this.roundSeedHex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
    this.roundCommit = "";
    const seedHex = this.roundSeedHex;
    const roundId = this.roundId;
    void (async () => {
      if (!this.rulesHash) this.rulesHash = (await sha256Hex(canonicalConfig(this.config))) ?? "";
      const h = await sha256Hex(commitPreimage(roundId, seedHex, this.rulesHash));
      // A late hash from a round that has already rolled must not overwrite
      // the current one.
      if (this.roundSeedHex !== seedHex) return;
      this.roundCommit = h ?? "";
      this.emit();
    })();

    const n = this.dev.fieldSize ?? drawFieldSize(this.config, this.rng.next());
    const now = Date.now();
    this.bonanza = null;
    this.winner = null;
    this.lobbyEntrants = [];
    this.arrivals.clear();
    this.charMap.clear();
    for (let i = 0; i < n; i++) {
      // Every player is a wallet, shown ends-only like any on-chain platform.
      this.names.set(i, shortAddress(fakeAddress(() => this.rng.next())));
      this.charMap.set(i, CHARACTERS[Math.floor(this.rng.next() * CHARACTERS.length)]!.id);
      this.lobbyEntrants.push({
        id: i,
        strategyId: "bot",
        strategy: this.makeBotStrategy(),
      });
      // Spread arrivals across most of the lobby so the shaft visibly fills
      // rather than blinking into existence fully populated.
      this.arrivals.set(i, now + this.rng.next() * this.config.timing.lobbyMs * 0.82);
    }
    this.say("info", `Round ${this.roundId}, lattice forming`, `${this.config.entry} ◎`);
    // Auto-entry walks in the moment the lobby opens, wallet permitting.
    if (this.auto.enabled) this.join();
    this.emit();
  }

  /**
   * The rate the NEXT roll runs at, given the field as it stands right now.
   * Every risk channel — ring, seams, cracking, audio — reads this one number,
   * so they cannot disagree with each other.
   */
  private forwardHazard(): number {
    const round = this.round;
    if (!round || this.phase !== "live" || round.finished) return 0;
    const live = round.players.filter((p) => p.outcome === "in").length;
    if (live <= 0) return 0;
    // The round's own config, not the client's: an immortal test round runs
    // with the hazard zeroed, and reading the global config would show danger
    // on a lattice where nobody can actually fall through.
    return hazardAt(
      round.config.hazard,
      round.currentTick + 1,
      live,
      round.players.length,
    );
  }

  /** Bots that have walked in so far this lobby. */
  private arrived(): Entrant[] {
    const now = Date.now();
    return this.lobbyEntrants.filter((e) => (this.arrivals.get(e.id) ?? 0) <= now);
  }

  private seal(): void {
    if (this.joined) {
      this.names.set(YOU_ID, "YOU");
      this.lobbyEntrants.push({ id: YOU_ID, strategyId: "you", strategy: () => false });
    }
    // Immortal test chamber: no crowding, no creep, no floor. A round in
    // which nobody can be eliminated, ended via skip or extraction.
    const cfg = this.dev.immortal
      ? {
          ...this.config,
          hazard: { ...this.config.hazard, q0: 0, creep: 0, qMin: 0 },
        }
      : this.config;
    this.roundImmortal = this.dev.immortal;
    this.roundRules = cfg;
    this.round = new Round(cfg, rngFromSeedHex(this.roundSeedHex), this.lobbyEntrants);
    this.phase = "live";
    this.nextTickAt = Date.now() + this.config.timing.tickMs / this.dev.speed;
    this.say("seal", `Lattice sealed: ${this.lobbyEntrants.length} plates`);
    sfxSeal();
    this.emit();
  }

  private tick(): void {
    const round = this.round;
    if (!round || round.finished) {
      this.finish();
      return;
    }
    const before = new Map(round.players.map((p) => [p.id, p.outcome]));
    round.step();

    let deaths = 0;
    let youDied = false;
    for (const p of round.players) {
      const was = before.get(p.id);
      if (was === p.outcome) continue;
      if (p.outcome === "dead") {
        deaths++;
        if (p.id === YOU_ID) {
          youDied = true;
          this.say("you", "Your plate shattered", "0.00×");
        }
      } else if (p.outcome === "cashed") {
        const m = p.cashedOut / this.config.entry;
        this.say(
          p.id === YOU_ID ? "you" : "cash",
          `${this.names.get(p.id) ?? "player"} extracted`,
          `${m.toFixed(2)}×`,
        );
      }
    }
    if (deaths > 0) {
      this.say("death", `${deaths} shattered`, `${this.currentMultiplier().toFixed(2)}×`);
      sfxShatter(deaths);
    } else {
      // The forward-looking rate, matching every visual. `round.hazard` is the
      // tick that already resolved, so after a mass shatter the ring and the
      // seams cool instantly while the next tick still *sounds* like the
      // pre-shatter danger — the two channels riskScale exists to unify,
      // disagreeing for one tick after every death wave.
      sfxTick(this.dev.hazardOverride ?? this.forwardHazard());
    }
    if (youDied) sfxYouDied();

    // Auto-exit fires the first tick the multiple crosses the target. The
    // steps are discrete, so this banks the actual crossing value: never
    // under the target, sometimes above it.
    if (this.auto.enabled && !round.finished) {
      const you = round.players.find((p) => p.id === YOU_ID);
      if (you?.outcome === "in" && you.balance / this.config.entry >= this.auto.target) {
        this.walkOut();
        if (this.round?.finished) return;
      }
    }

    if (round.finished) {
      this.finish();
      return;
    }
    this.emit();
  }

  private currentMultiplier(): number {
    const round = this.round;
    if (!round) return 1 - totalRake(this.config);
    const live = round.players.find((p) => p.outcome === "in");
    if (live) return live.balance / this.config.entry;
    // Round is over: report the highest multiple anyone reached.
    let best = 0;
    for (const p of round.players) best = Math.max(best, p.cashedOut / this.config.entry);
    return best || 1 - totalRake(this.config);
  }

  private finish(): void {
    const round = this.round;
    if (round) {
      const res = round.result();
      const nowMs = Date.now();

      // The engine's accounting, not a parallel copy of it. Tickets credited
      // are the tickets the engine actually awarded (so risk-weighted accrual
      // or forfeit-on-death would flow through untouched), and the jackpot is
      // funded with the wipe leak included — the sim counts that money as
      // player money, so the client must not destroy it.
      for (const p of res.players) {
        this.jackpot.credit(p.id, p.bonanzaTickets);
        this.revShare.credit(p.id, nowMs);
      }
      this.jackpot.fund(res.toBonanza + res.wipeLeak);
      this.revShare.distribute(res.toRevShare, nowMs);

      const you = res.players.find((p) => p.id === YOU_ID);
      if (you) {
        this.wallet += you.cashedOut;
        this.session += you.cashedOut - this.config.entry;
        const mult = you.cashedOut / this.config.entry;
        this.stats.returned += you.cashedOut;
        this.stats.bestMultiple = Math.max(this.stats.bestMultiple, mult);
        if (mult >= 1) this.stats.roundsWon++;
      }

      // Rakeback auto-claims into the wallet. Without this the client charges
      // the 2% rev-share rake and never returns it: a build that displays
      // "98% RTP" while actually paying 96%.
      const owed = this.revShare.earningsOf(YOU_ID);
      const delta = owed - this.rakebackClaimed;
      if (delta > 0) {
        this.wallet += delta;
        this.session += delta;
        this.rakebackClaimed = owed;
        this.revStreamedLifetime += delta;
        this.stats.revEarned = this.revStreamedLifetime;
        this.say("info", "Rakeback streamed", `+${delta.toFixed(4)} ◎`);
      }

      // The winner scene's subject: the last one standing, or when the ice
      // took everyone before a sole survivor emerged, the best extraction.
      // A total wipe (nobody banked anything) leaves no winner at all.
      const champ =
        res.players.find((p) => p.lastStanding) ??
        [...res.players]
          .filter((p) => p.outcome === "cashed")
          .sort((a, b) => b.cashedOut - a.cashedOut)[0];
      this.winner = champ
        ? {
            name: this.names.get(champ.id) ?? "player",
            charId: this.charOf(champ.id),
            you: champ.id === YOU_ID,
            multiple: champ.cashedOut / this.config.entry,
            amount: champ.cashedOut,
            lastStanding: champ.lastStanding === true,
          }
        : null;
      if (this.winner) {
        const t = this.winner.charId;
        this.teamWins[t] = (this.teamWins[t] ?? 0) + 1;
      }

      // The round's fairness record: enough to replay and verify it locally.
      let best = 0;
      for (const p of res.players) best = Math.max(best, p.cashedOut / this.config.entry);
      this.history.unshift({
        roundId: this.roundId,
        entrants: res.players.length,
        ticks: res.ticks,
        joined: this.joined,
        yourOutcome: !you ? "none" : you.outcome === "cashed" ? "cashed" : "dead",
        yourMultiple: you ? you.cashedOut / this.config.entry : null,
        bestMultiple: best,
        commit: this.roundCommit,
        seedHex: this.roundSeedHex,
        verified: null,
        seedOk: null,
        replayOk: null,
        rulesOk: null,
        record: {
          seedHex: this.roundSeedHex,
          config: this.roundRules ?? this.config,
          entrantIds: res.players.map((p) => p.id),
          cashOuts: res.cashOuts,
        },
        immortal: this.roundImmortal,
        digest: outcomeDigest(res),
        winnerChar: this.winner?.charId ?? null,
        winnerYou: this.winner?.you ?? false,
      });
      if (this.history.length > 40) this.history.pop();
    }
    this.phase = "result";
    this.phaseEnd = Date.now() + this.config.timing.resultMs;
    this.say("info", "Lattice cleared");
    this.rollBonanza();
    this.saveState();
    this.emit();
  }

  private saveState(): void {
    try {
      const now = Date.now();
      const s: SaveState = {
        wallet: this.wallet,
        session: this.session,
        pool: this.jackpot.pool,
        bTickets: this.jackpot.ticketsOf(YOU_ID),
        revLifetime: this.revShare.lifetimeOf(YOU_ID),
        revWeight: this.revShare.weightOf(YOU_ID, now),
        autoEnabled: this.auto.enabled,
        autoTarget: this.auto.target,
        charId: this.charId,
        revStreamed: this.revStreamedLifetime,
        teamWins: this.teamWins,
        roundId: this.roundId,
        stats: this.stats,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {
      /* refresh simply starts fresh */
    }
  }

  /**
   * The jackpot draw, through the engine's pool: fires on the per-round
   * chance, picks the winner weighted by every ticket accrued since the last
   * fire — including players sitting this round out — then wipes all tickets.
   * The dev overrides rig only the fire check, never the winner selection.
   */
  private rollBonanza(): void {
    const odds = this.dev.bonanzaOdds ?? this.config.bonanza.fireProb;
    const force = this.forceBonanza;
    this.forceBonanza = false;

    let firstDraw = true;
    const rig: Rng = {
      next: () => {
        if (firstDraw) {
          firstDraw = false;
          if (force) return 0;
          // Map the override odds onto the pool's own fireProb comparison.
          return this.rng.next() < odds ? 0 : 0.9999999;
        }
        return this.rng.next();
      },
    };

    const fire = this.jackpot.roll(rig);
    if (!fire) return;

    const youWon = fire.winnerId === YOU_ID;
    if (youWon) {
      this.wallet += fire.amount;
      this.session += fire.amount;
    }
    this.bonanza = {
      amount: fire.amount,
      winner: this.names.get(fire.winnerId) ?? "a ticket holder",
      youWon,
      at: Date.now(),
    };
    this.say(
      "bonanza",
      youWon ? "★ YOU TOOK THE BONANZA ★" : `★ BONANZA: ${this.bonanza.winner} ★`,
      `${fire.amount.toFixed(2)} ◎`,
    );

    sfxBonanza();
    // The jackpot sequence needs room to play out before the next lobby.
    this.phaseEnd = Date.now() + this.config.timing.bonanzaMs;
  }

  /**
   * Re-runs a finished round from its revealed seed and exit schedule, then
   * checks three things: the outcome matches what was watched live, the
   * revealed seed hashes to the commitment published before the round sealed,
   * and the rules it ran under are the rules this build advertises. All three
   * must hold — a round can replay perfectly under rigged numbers, so the
   * first two alone prove only that the operator is self-consistent.
   */
  async verifyRound(roundId: number): Promise<void> {
    const h = this.history.find((x) => x.roundId === roundId);
    if (!h) return;
    await verifyEntry(h, this.config);
    this.emit();
  }

  /** Testing hooks. */
  triggerBonanza(): void {
    this.forceBonanza = true;
    if (this.phase === "result") this.rollBonanza();
    this.emit();
  }

  setDev(patch: Partial<DevSettings>): void {
    this.dev = { ...this.dev, ...patch };
    this.emit();
  }

  setCharacter(id: string): void {
    this.charId = charById(id).id;
    this.saveState();
    this.emit();
  }

  setAuto(patch: Partial<AutoSettings>): void {
    this.auto = { ...this.auto, ...patch };
    if (!Number.isFinite(this.auto.target) || this.auto.target < 1.05) {
      this.auto.target = 1.05;
    }
    // Flipping auto on mid-lobby should not miss the current round.
    if (this.auto.enabled && this.phase === "lobby" && !this.joined) this.join();
    this.saveState();
    this.emit();
  }

  skipPhase(): void {
    this.phaseEnd = Date.now();
    if (this.phase === "live") {
      // Collapse the round by settling everyone still inside.
      const round = this.round;
      if (round) {
        for (const p of round.players) {
          if (p.outcome === "in") round.cashOut(p.id);
        }
        this.finish();
      }
    }
    this.emit();
  }

  join(): void {
    if (this.phase !== "lobby" || this.joined) return;
    if (this.wallet < this.config.entry) return;
    this.wallet -= this.config.entry;
    this.joined = true;
    this.stats.roundsPlayed++;
    this.stats.wagered += this.config.entry;
    this.say("you", "You bonded into the lattice", `-${this.config.entry} ◎`);
    sfxJoin();
    this.emit();
  }

  walkOut(): void {
    const round = this.round;
    if (!round || this.phase !== "live") return;
    const got = round.cashOut(YOU_ID);
    if (got === null) return;
    this.say("you", "You extracted", `${(got / this.config.entry).toFixed(2)}×`);
    sfxExtract();
    if (round.finished) this.finish();
    else this.emit();
  }

  destroy(): void {
    if (this.loopTimer !== null) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /**
   * Your standing in both ticket economies. The engine ledgers are the source:
   * bonanza odds are exactly tickets over the circulating total (wiped each
   * fire), and the rev-share slice is decayed weight over total decayed weight,
   * which is precisely the fraction of the next distribution you receive —
   * whether or not you are in the round it comes from.
   */
  private ticketStandings(): Snapshot["tickets"] {
    const now = Date.now();
    const bonYours = this.jackpot.ticketsOf(YOU_ID);
    const bonTotal = this.jackpot.totalTickets;
    const revTotal = this.revShare.totalWeight(now);
    return {
      bonYours,
      bonTotal,
      bonShare: bonTotal > 0 ? bonYours / bonTotal : 0,
      revShare: revTotal > 0 ? this.revShare.weightOf(YOU_ID, now) / revTotal : 0,
      revStreamed: this.revStreamedLifetime,
    };
  }

  /** Yours is read live so a mid-lobby switch shows everywhere instantly. */
  private charOf(id: number): string {
    return id === YOU_ID ? this.charId : (this.charMap.get(id) ?? CHARACTERS[0]!.id);
  }

  private viewOf(p: Player): PlayerView {
    return {
      id: p.id,
      name: this.names.get(p.id) ?? "player",
      you: p.id === YOU_ID,
      charId: this.charOf(p.id),
      outcome: p.outcome,
      multiple: (p.outcome === "in" ? p.balance : p.cashedOut) / this.config.entry,
      balance: p.outcome === "in" ? p.balance : p.cashedOut,
      ticksSurvived: p.ticksSurvived,
    };
  }

  snapshot(): Snapshot {
    const round = this.round;
    const cfg = this.config;

    // Before the seal there is no Round yet, so the waiting crowd is built from
    // whoever has arrived. Without this the shaft sits empty through the whole
    // lobby and the countdown looks broken.
    const players: PlayerView[] = round
      ? round.players.map((p) => this.viewOf(p))
      : this.phase === "lobby"
        ? [
            ...this.arrived().map((e) => ({
              id: e.id,
              name: this.names.get(e.id) ?? "player",
              you: false,
              charId: this.charOf(e.id),
              outcome: "in" as const,
              multiple: 1 - totalRake(cfg),
              balance: cfg.entry * (1 - totalRake(cfg)),
              ticksSurvived: 0,
            })),
            ...(this.joined
              ? [
                  {
                    id: YOU_ID,
                    name: "YOU",
                    you: true,
                    charId: this.charId,
                    outcome: "in" as const,
                    multiple: 1 - totalRake(cfg),
                    balance: cfg.entry * (1 - totalRake(cfg)),
                    ticksSurvived: 0,
                  },
                ]
              : []),
          ]
        : [];
    const live = players.filter((p) => p.outcome === "in").length;
    const dead = players.filter((p) => p.outcome === "dead").length;
    const cashed = players.filter((p) => p.outcome === "cashed").length;
    const you = round?.players.find((p) => p.id === YOU_ID);

    const graceLeft = round
      ? Math.max(0, cfg.hazard.graceTicks - round.currentTick)
      : cfg.hazard.graceTicks;

    const realHazard = this.forwardHazard();
    // Dev override rigs only the display; the actual rolls are untouched.
    const hazard =
      this.phase === "live" ? (this.dev.hazardOverride ?? realHazard) : realHazard;

    return {
      phase: this.phase,
      roundId: this.roundId,
      tick: round?.currentTick ?? 0,
      multiplier: this.currentMultiplier(),
      hazard,
      grace: this.phase === "live" && graceLeft > 0,
      graceRemaining: graceLeft,
      msToPhaseEnd: Math.max(0, this.phaseEnd - Date.now()),
      players,
      liveCount: live,
      totalCount: players.length,
      deadCount: dead,
      cashedCount: cashed,
      potInPlay: round ? round.pot : 0,
      entry: cfg.entry,
      you: {
        joined: this.joined,
        outcome: !this.joined ? "out" : (you?.outcome ?? "in"),
        balance: you ? (you.outcome === "in" ? you.balance : you.cashedOut) : 0,
        multiple: you
          ? (you.outcome === "in" ? you.balance : you.cashedOut) / cfg.entry
          : 0,
        lockedMultiple:
          you && you.outcome === "cashed" ? you.cashedOut / cfg.entry : null,
      },
      wallet: this.wallet,
      session: this.session,
      bonanzaPool: this.jackpot.pool,
      bonanzaTickets: this.jackpot.ticketsOf(YOU_ID),
      revShareTickets: this.revShare.lifetimeOf(YOU_ID),
      bonanza: this.bonanza,
      charId: this.charId,
      winner: this.winner,
      teamWins: this.teamWins,
      tickets: this.ticketStandings(),
      log: this.log,
      history: this.history,
      nextCommit: this.roundCommit,
      auto: this.auto,
      stats: this.stats,
      online: 1,
      connected: true,
      dev: this.dev,
    };
  }
}

/**
 * Single shared instance. React StrictMode mounts, unmounts and remounts every
 * component in development, so a per-component client would be thrown away and
 * rebuilt mid-round, resetting the wallet and the round in the process.
 */
let instance: GameClient | null = null;

export function getGameClient(): GameClient {
  if (!instance) instance = new GameClient();
  return instance;
}

// Without this a hot reload strands the previous client's interval and two
// game loops run at once, double-ticking every round.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    instance?.destroy();
    instance = null;
  });
}
