export interface RakeConfig {
  /** Fraction of each entry diverted to the bonanza jackpot pool. Player money. */
  bonanza: number;
  /** Fraction retained by the house. The only true edge. */
  house: number;
  /** Fraction streamed back to holders of permanent revenue-share tickets. Player money. */
  revShare: number;
}

export interface HazardConfig {
  /** Base per-player elimination chance per tick at a completely full field. */
  q0: number;
  /** Convexity of the crowding curve. Higher = risk falls off faster as the field empties. */
  alpha: number;
  /** Per-tick additive pressure, so a stalled round still resolves. */
  creep: number;
  /**
   * Curvature of the creep ramp. At 1 the pressure grows linearly and is
   * already significant mid-round, where headcount should be what matters.
   * Above 1 it stays negligible early and bites late, killing the endgame tail
   * without dulling the crowding signal while the shaft is still busy.
   */
  creepPower: number;
  /** How much of the creep applies regardless of crowding, in [0, 1]. */
  creepBlend: number;
  qMin: number;
  qMax: number;
  /**
   * Opening ticks during which nobody can be eliminated. Players still see the
   * hazard rate they are about to face and still accrue bonanza tickets, so the
   * grace period costs nothing but gives everyone a chance to read the field
   * before the shaft turns on them.
   */
  graceTicks: number;
  /**
   * If true, a tick can never eliminate the entire remaining field — one
   * player is always spared. This removes the only leak in the redistribution
   * loop and makes in-game return exactly independent of when a player walks
   * out. It also removes the "everybody loses" round.
   */
  guaranteeSurvivor: boolean;
}

export interface BonanzaConfig {
  /** Per-round chance the jackpot fires, independent of pool size. */
  fireProb: number;
  /** Tickets granted on entry, before any tick survival. */
  ticketBase: number;
  /** Tickets per tick, scaled by the live hazard rate. */
  ticketPerRisk: number;
  /** If true, being eliminated forfeits the tickets earned this round. */
  forfeitOnDeath: boolean;
}

export interface RevShareConfig {
  /** Permanent tickets granted per entry. Entry is fixed, so this is per round played. */
  ticketsPerEntry: number;
  /** Half-life of ticket weight in days. Zero or below disables decay. */
  halfLifeDays: number;
}

export interface TimingConfig {
  lobbyMs: number;
  tickMs: number;
  resultMs: number;
}

export interface GameConfig {
  entry: number;
  rake: RakeConfig;
  hazard: HazardConfig;
  bonanza: BonanzaConfig;
  revShare: RevShareConfig;
  timing: TimingConfig;
}

/**
 * Proposed model: 7% total rake, of which only 2% is genuine house edge.
 * Headline RTP is 98% — 93% returned inside the game, 3% via the bonanza,
 * 2% via the revenue-share stream.
 */
export const DEFAULT_CONFIG: GameConfig = {
  entry: 0.1,
  rake: { bonanza: 0.03, house: 0.02, revShare: 0.02 },
  hazard: {
    q0: 0.075,
    // Crowding stays steep: this is the "fewer people, more oxygen" signal the
    // whole game reads on, so pacing is bought from creep instead.
    alpha: 2.4,
    // Curved rather than linear: near-silent while the shaft is busy so
    // headcount stays the thing that matters, then sharp once it empties.
    // Measured against linear creep this holds the crowding signal longer
    // (crossover t23 vs t18) *and* cuts the long-round tail (p90 77 vs 93).
    creep: 2.2e-5,
    creepPower: 2,
    creepBlend: 0.44,
    qMin: 0.004,
    qMax: 0.42,
    graceTicks: 2,
    guaranteeSurvivor: true,
  },
  bonanza: {
    fireProb: 1 / 1500,
    // Flat: one ticket per entry, matching the revenue-share tickets. Risk-
    // weighted accrual was measured to hand late-stayers ~1.5pts of RTP over
    // cautious players, and it rewarded never leaving — the opposite of a
    // lively round. The climbing multiplier is already all the incentive
    // anyone needs to stay, so this makes every strategy land on exactly 98%.
    ticketBase: 1,
    ticketPerRisk: 0,
    forfeitOnDeath: false,
  },
  revShare: {
    ticketsPerEntry: 1,
    halfLifeDays: 75,
  },
  // tickMs is a pure clock knob: it changes wall-clock pacing without touching
  // a single probability, so game feel can be tuned independently of economics.
  timing: { lobbyMs: 7000, tickMs: 500, resultMs: 4500 },
};

/** The original demo's split: 4% house, 3% bonanza, no revenue share. 96% RTP. */
export const LEGACY_CONFIG: GameConfig = {
  ...DEFAULT_CONFIG,
  rake: { bonanza: 0.03, house: 0.04, revShare: 0 },
  revShare: { ticketsPerEntry: 0, halfLifeDays: 0 },
};

export function totalRake(c: GameConfig): number {
  return c.rake.bonanza + c.rake.house + c.rake.revShare;
}
