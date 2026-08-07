import type { GameConfig } from "./config.js";
import { mulberry32 } from "./rng.js";
import { Round, type CashOutRecord, type Entrant, type RoundResult } from "./round.js";

/**
 * Provably-fair replay.
 *
 * A round is fully determined by (config, seed, entrant order, cash-out
 * schedule): the elimination stream consumes exactly one RNG draw per live
 * player per tick plus one for the spared-survivor pick, so replaying the
 * same seed against the same exit schedule reproduces every event and every
 * balance bit-for-bit.
 *
 * The one requirement this places on live play: player decision strategies
 * must NOT draw from the round's RNG (give bots their own stream), or the
 * draw count diverges and replay breaks. The engine's `DecisionContext.rng`
 * exists for simulations, where replays are not needed.
 *
 * The commit-reveal ceremony built on top of this:
 *   1. before a round seals, publish sha256(tag : roundId : seedHex)
 *   2. run the round
 *   3. reveal the seed; anyone recomputes the hash and replays the round
 */
export interface RoundRecord {
  seed: number;
  /** Entrants in seal order. Order matters: it fixes RNG draw order. */
  entrantIds: number[];
  cashOuts: CashOutRecord[];
}

export function replayRound(config: GameConfig, rec: RoundRecord): RoundResult {
  // In-tick exits replay as scripted strategy decisions; between-tick manual
  // exits replay as cashOut() calls after the same tick, so the event stream
  // is reproduced exactly, not just the final balances.
  const strategyExitAt = new Map<number, number>();
  const manualByTick = new Map<number, number[]>();
  for (const c of rec.cashOuts) {
    if (c.manual) {
      const list = manualByTick.get(c.tick) ?? [];
      list.push(c.id);
      manualByTick.set(c.tick, list);
    } else {
      strategyExitAt.set(c.id, c.tick);
    }
  }

  const entrants: Entrant[] = rec.entrantIds.map((id) => ({
    id,
    strategyId: "replay",
    strategy: (ctx) => {
      const t = strategyExitAt.get(id);
      return t !== undefined && ctx.tick >= t;
    },
  }));

  const round = new Round(config, mulberry32(rec.seed), entrants);
  for (const id of manualByTick.get(0) ?? []) round.cashOut(id);
  while (!round.finished) {
    round.step();
    for (const id of manualByTick.get(round.currentTick) ?? []) round.cashOut(id);
  }
  return round.result();
}

/**
 * Canonical digest of a round's outcome, for comparing a live round against
 * its replay. Balances are rounded to a lamport-scale grid so float noise
 * can never produce a spurious mismatch.
 */
export function outcomeDigest(res: RoundResult): string {
  const players = res.players
    .map((p) => `${p.id}:${p.outcome}:${Math.round(p.cashedOut * 1e9)}`)
    .join("|");
  const events = res.events
    .map((e) => `${e.tick}:${e.killed}:${e.cashedOut}:${Math.round(e.q * 1e9)}`)
    .join("|");
  return `${res.ticks};${players};${events}`;
}
