import type { BonanzaConfig, RevShareConfig } from "./config.js";
import type { Rng } from "./rng.js";

export interface BonanzaFire {
  amount: number;
  winnerId: number;
  roundsSinceLast: number;
  totalTickets: number;
}

/**
 * Winner-take-all jackpot. Tickets are earned by playing and are wiped for
 * everyone the moment it fires, so each cycle is a fresh raffle.
 */
export class BonanzaPool {
  pool = 0;
  roundsSinceFire = 0;
  private tickets = new Map<number, number>();
  private ticketTotal = 0;

  constructor(private readonly config: BonanzaConfig, seedPool = 0) {
    this.pool = seedPool;
  }

  fund(amount: number): void {
    this.pool += amount;
  }

  credit(playerId: number, tickets: number): void {
    if (tickets <= 0) return;
    this.tickets.set(playerId, (this.tickets.get(playerId) ?? 0) + tickets);
    this.ticketTotal += tickets;
  }

  ticketsOf(playerId: number): number {
    return this.tickets.get(playerId) ?? 0;
  }

  get totalTickets(): number {
    return this.ticketTotal;
  }

  /** Rolls the per-round fire chance. Returns the payout, or null if it held. */
  roll(rng: Rng): BonanzaFire | null {
    this.roundsSinceFire++;
    if (rng.next() >= this.config.fireProb) return null;
    if (this.ticketTotal <= 0 || this.pool <= 0) return null;

    let target = rng.next() * this.ticketTotal;
    let winnerId = -1;
    for (const [id, count] of this.tickets) {
      target -= count;
      if (target <= 0) {
        winnerId = id;
        break;
      }
    }
    if (winnerId === -1) return null;

    const fire: BonanzaFire = {
      amount: this.pool,
      winnerId,
      roundsSinceLast: this.roundsSinceFire,
      totalTickets: this.ticketTotal,
    };
    this.pool = 0;
    this.roundsSinceFire = 0;
    this.tickets.clear();
    this.ticketTotal = 0;
    return fire;
  }
}

/**
 * Permanent revenue-share tickets.
 *
 * Weight decays continuously so the stream tracks recent volume rather than
 * lifetime volume. Without decay, total weight grows without bound and yield
 * per ticket falls as 1/t; with a half-life the total converges to
 * volume/lambda and yield per ticket settles at a constant. Lifetime tickets
 * are tracked separately and never decay, so a player's rank is permanent even
 * though their claim on the stream is not.
 */
export class RevShareLedger {
  private readonly lambda: number;
  /**
   * Decay-normalised weights. A grant of `n` tickets at time `t` is stored as
   * `n * e^(lambda*t)`, so a holder's live weight is always `norm * e^(-lambda*now)`.
   * That common factor cancels out of every share calculation, which means
   * decay never has to be applied by sweeping the holder set — shares depend
   * only on these monotonically increasing values.
   */
  private norm = new Map<number, number>();
  private normTotal = 0;
  private lifetime = new Map<number, number>();
  /** Running sum of payout per unit of normalised weight. */
  private accPerWeight = 0;
  private debt = new Map<number, number>();
  private settled = new Map<number, number>();
  private epochMs = 0;
  /** Revenue that arrived while nobody held weight. */
  unallocated = 0;
  distributed = 0;

  constructor(private readonly config: RevShareConfig) {
    this.lambda =
      config.halfLifeDays > 0 ? Math.LN2 / (config.halfLifeDays * 86_400_000) : 0;
  }

  private settle(playerId: number): void {
    const owed = (this.norm.get(playerId) ?? 0) * this.accPerWeight;
    const pending = owed - (this.debt.get(playerId) ?? 0);
    if (pending > 0) {
      this.settled.set(playerId, (this.settled.get(playerId) ?? 0) + pending);
    }
    this.debt.set(playerId, owed);
  }

  /** Grants tickets for an entry paid at the given simulated time. */
  credit(playerId: number, nowMs: number, tickets = this.config.ticketsPerEntry): void {
    if (tickets <= 0) return;
    this.settle(playerId);
    const scaled = tickets * Math.exp(this.lambda * (nowMs - this.epochMs));
    const next = (this.norm.get(playerId) ?? 0) + scaled;
    this.norm.set(playerId, next);
    this.normTotal += scaled;
    this.lifetime.set(playerId, (this.lifetime.get(playerId) ?? 0) + tickets);
    this.debt.set(playerId, next * this.accPerWeight);
  }

  /** Streams house revenue to current weight holders. O(1). */
  distribute(amount: number, _nowMs: number): void {
    if (amount <= 0) return;
    if (this.normTotal <= 0) {
      this.unallocated += amount;
      return;
    }
    this.accPerWeight += amount / this.normTotal;
    this.distributed += amount;
  }

  /** Live, decayed weight — the number a player sees in the UI. */
  weightOf(playerId: number, nowMs: number): number {
    const n = this.norm.get(playerId) ?? 0;
    return n * Math.exp(-this.lambda * (nowMs - this.epochMs));
  }

  totalWeight(nowMs: number): number {
    return this.normTotal * Math.exp(-this.lambda * (nowMs - this.epochMs));
  }

  /** Never decays. This is the permanent "tickets earned" rank. */
  lifetimeOf(playerId: number): number {
    return this.lifetime.get(playerId) ?? 0;
  }

  /**
   * Reinstates a holder from persisted state: their permanent lifetime count
   * and their current decayed weight, both as previously read back out via
   * `lifetimeOf`/`weightOf`. Restoring weight as a fresh grant of its decayed
   * value is exact, because decay only ever depends on time since the grant.
   */
  restore(playerId: number, lifetimeTickets: number, weight: number, nowMs: number): void {
    if (weight > 0) {
      this.settle(playerId);
      const scaled = weight * Math.exp(this.lambda * (nowMs - this.epochMs));
      const next = (this.norm.get(playerId) ?? 0) + scaled;
      this.norm.set(playerId, next);
      this.normTotal += scaled;
      this.debt.set(playerId, next * this.accPerWeight);
    }
    if (lifetimeTickets > 0) {
      this.lifetime.set(playerId, (this.lifetime.get(playerId) ?? 0) + lifetimeTickets);
    }
  }

  earningsOf(playerId: number): number {
    const owed = (this.norm.get(playerId) ?? 0) * this.accPerWeight;
    const pending = owed - (this.debt.get(playerId) ?? 0);
    return (this.settled.get(playerId) ?? 0) + Math.max(0, pending);
  }

  holders(): Iterable<number> {
    return this.norm.keys();
  }
}
