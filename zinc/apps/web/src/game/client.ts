import {
  DEFAULT_CONFIG,
  Round,
  mulberry32,
  type Entrant,
  type GameConfig,
  type Player,
  type Strategy,
} from "@zinc/engine";
import { NAMES, shuffled } from "./names";
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
 * against genuine round dynamics rather than hand-waved animation. In
 * production this class is replaced by a websocket client consuming
 * server-authoritative round state; everything downstream of `Snapshot` stays
 * exactly as it is.
 */

export type Phase = "lobby" | "live" | "result";

export interface PlayerView {
  id: number;
  name: string;
  you: boolean;
  outcome: "in" | "cashed" | "dead";
  /** Multiple of the 0.1 entry paid. 1.00 is break-even. */
  multiple: number;
  balance: number;
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
  /** Forces the field size instead of the usual 18-34 random draw. */
  fieldSize: number | null;
  /** Multiplies tick speed. 2 = double time. */
  speed: number;
  /** Overrides the per-round jackpot chance so it can be seen firing. */
  bonanzaOdds: number | null;
}

export interface Snapshot {
  phase: Phase;
  roundId: number;
  tick: number;
  /** Shared by everyone still inside: balance / entry. */
  multiplier: number;
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
  log: LogEntry[];
  dev: DevSettings;
}

const YOU_ID = 9999;

export class GameClient {
  private config: GameConfig = DEFAULT_CONFIG;
  private rng = mulberry32((Date.now() & 0xffffffff) >>> 0);
  private round: Round | null = null;
  private phase: Phase = "lobby";
  private phaseEnd = 0;
  private roundId = 1041;
  private names = new Map<number, string>();
  private joined = false;
  private lobbyEntrants: Entrant[] = [];
  /** Wall-clock time each bot walks into the lobby, so the room fills visibly. */
  private arrivals = new Map<number, number>();
  private log: LogEntry[] = [];
  private logSeq = 0;
  private loopTimer: number | null = null;
  private lastTickAt = 0;

  wallet = 5;
  session = 0;
  bonanzaPool = 412.7;
  bonanzaTickets = 0;
  revShareTickets = 0;

  private bonanza: BonanzaEvent | null = null;
  private forceBonanza = false;
  dev: DevSettings = { fieldSize: null, speed: 1, bonanzaOdds: null };

  private listeners = new Set<(s: Snapshot) => void>();

  constructor() {
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
    this.loopTimer = window.setInterval(() => this.loop(), 80);
  }

  private loop(): void {
    const now = Date.now();

    if (this.phase === "lobby") {
      if (now >= this.phaseEnd) {
        this.seal();
        return;
      }
    } else if (this.phase === "live") {
      if (now - this.lastTickAt >= this.config.timing.tickMs / this.dev.speed) {
        this.lastTickAt = now;
        this.tick();
        return;
      }
    } else if (now >= this.phaseEnd) {
      this.openLobby();
      return;
    }

    this.emit();
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
    const panicAt = 0.055 + this.rng.next() * 0.04;
    // Balances are quoted against the post-rake starting stake, so break-even
    // on the entry actually paid sits just above 1.
    const breakEven = 1 / (1 - 0.07);

    return (ctx) => {
      // Nobody bails while the air still holds — there is nothing to flee.
      if (ctx.tick <= this.config.hazard.graceTicks) return false;
      // And nobody locks in a certain loss out of nerves.
      if (ctx.multiple < breakEven) return false;
      if (ctx.multiple >= target) return true;
      return ctx.q > panicAt && ctx.rng.next() < nerve * 0.16;
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

    const pool = shuffled(NAMES, () => this.rng.next());
    const n = this.dev.fieldSize ?? 18 + Math.floor(this.rng.next() * 17);
    const now = Date.now();
    this.bonanza = null;
    this.lobbyEntrants = [];
    this.arrivals.clear();
    for (let i = 0; i < n; i++) {
      // Names repeat past the pool size; suffix them so a big test field stays
      // readable in the roster.
      const base = pool[i % pool.length]!;
      this.names.set(i, i < pool.length ? base : `${base}_${Math.floor(i / pool.length) + 1}`);
      this.lobbyEntrants.push({
        id: i,
        strategyId: "bot",
        strategy: this.makeBotStrategy(),
      });
      // Spread arrivals across most of the lobby so the shaft visibly fills
      // rather than blinking into existence fully populated.
      this.arrivals.set(i, now + this.rng.next() * this.config.timing.lobbyMs * 0.82);
    }
    this.say("info", `Round ${this.roundId} — lattice forming`, `${this.config.entry} ◎`);
    this.emit();
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
    this.round = new Round(this.config, this.rng, this.lobbyEntrants);
    this.phase = "live";
    this.lastTickAt = Date.now();
    this.say("seal", `Lattice sealed — ${this.lobbyEntrants.length} plates`);
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
          this.say("you", "Your plate shattered", "—");
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
      sfxTick(round.hazard);
    }
    if (youDied) sfxYouDied();

    if (round.finished) {
      this.finish();
      return;
    }
    this.emit();
  }

  private currentMultiplier(): number {
    const round = this.round;
    if (!round) return 1 - 0.07;
    const live = round.players.find((p) => p.outcome === "in");
    if (live) return live.balance / this.config.entry;
    // Round is over: report the highest multiple anyone reached.
    let best = 0;
    for (const p of round.players) best = Math.max(best, p.cashedOut / this.config.entry);
    return best || 1 - 0.07;
  }

  private finish(): void {
    const round = this.round;
    if (round) {
      const you = round.players.find((p) => p.id === YOU_ID);
      if (you) {
        this.wallet += you.cashedOut;
        this.session += you.cashedOut - this.config.entry;
        this.bonanzaTickets += this.config.bonanza.ticketBase;
        this.revShareTickets += this.config.revShare.ticketsPerEntry;
      }
      this.bonanzaPool += round.grossHandle * this.config.rake.bonanza;
    }
    this.phase = "result";
    this.phaseEnd = Date.now() + this.config.timing.resultMs;
    this.say("info", "Lattice cleared");
    this.rollBonanza();
    this.emit();
  }

  /**
   * The jackpot draw. Fires on a fixed per-round chance regardless of pool
   * size, then wipes every ticket — each cycle is a fresh raffle.
   */
  private rollBonanza(): void {
    const odds = this.dev.bonanzaOdds ?? this.config.bonanza.fireProb;
    if (!this.forceBonanza && this.rng.next() >= odds) return;
    this.forceBonanza = false;

    const round = this.round;
    const field = round?.players ?? [];
    if (field.length === 0 || this.bonanzaPool <= 0) return;

    // Tickets are flat per entry, so within a round every player is equally
    // likely. Across cycles it is weighted by how much each has played.
    const winner = field[Math.floor(this.rng.next() * field.length)]!;
    const youWon = winner.id === YOU_ID;
    const amount = this.bonanzaPool;

    if (youWon) {
      this.wallet += amount;
      this.session += amount;
    }
    this.bonanza = {
      amount,
      winner: this.names.get(winner.id) ?? "a ticket holder",
      youWon,
      at: Date.now(),
    };
    this.say(
      "bonanza",
      youWon ? "★ YOU TOOK THE BONANZA ★" : `★ BONANZA — ${this.bonanza.winner} ★`,
      `${amount.toFixed(2)} ◎`,
    );

    this.bonanzaPool = 0;
    this.bonanzaTickets = 0;
    sfxBonanza();
    // The jackpot sequence needs room to play out before the next lobby.
    this.phaseEnd = Date.now() + 7000;
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

  private viewOf(p: Player): PlayerView {
    return {
      id: p.id,
      name: this.names.get(p.id) ?? "player",
      you: p.id === YOU_ID,
      outcome: p.outcome,
      multiple: (p.outcome === "in" ? p.balance : p.cashedOut) / this.config.entry,
      balance: p.outcome === "in" ? p.balance : p.cashedOut,
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
              outcome: "in" as const,
              multiple: 1 - 0.07,
              balance: cfg.entry * (1 - 0.07),
            })),
            ...(this.joined
              ? [
                  {
                    id: YOU_ID,
                    name: "YOU",
                    you: true,
                    outcome: "in" as const,
                    multiple: 1 - 0.07,
                    balance: cfg.entry * (1 - 0.07),
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

    return {
      phase: this.phase,
      roundId: this.roundId,
      tick: round?.currentTick ?? 0,
      multiplier: this.currentMultiplier(),
      hazard: round && this.phase === "live" ? round.hazard : 0,
      grace: this.phase === "live" && graceLeft > 0,
      graceRemaining: graceLeft,
      msToPhaseEnd: Math.max(0, this.phaseEnd - Date.now()),
      players,
      liveCount: live,
      totalCount: players.length,
      deadCount: dead,
      cashedCount: cashed,
      potInPlay: round ? round.pot : 0,
      you: {
        joined: this.joined,
        outcome: !this.joined
          ? "out"
          : !you
            ? "in"
            : you.outcome === "in"
              ? "in"
              : you.outcome === "cashed"
                ? "cashed"
                : "dead",
        balance: you ? (you.outcome === "in" ? you.balance : you.cashedOut) : 0,
        multiple: you
          ? (you.outcome === "in" ? you.balance : you.cashedOut) / cfg.entry
          : 0,
        lockedMultiple:
          you && you.outcome === "cashed" ? you.cashedOut / cfg.entry : null,
      },
      wallet: this.wallet,
      session: this.session,
      bonanzaPool: this.bonanzaPool,
      bonanzaTickets: this.bonanzaTickets,
      revShareTickets: this.revShareTickets,
      bonanza: this.bonanza,
      log: this.log,
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
