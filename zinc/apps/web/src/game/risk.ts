import { DEFAULT_CONFIG } from "@zinc/engine";

/**
 * The shared risk scale.
 *
 * Hazard is a probability with a very lopsided distribution: it opens around
 * 7.5%, collapses within a few ticks, then lives between roughly 0.5% and 3%
 * for almost the whole round. Anything that presents it on a linear 0-to-max
 * axis therefore spends the entire round pinned near the bottom and reads as
 * dead — which is exactly what both the tick audio and the risk meter were
 * doing, each with its own privately hardcoded thresholds.
 *
 * So there is one mapping, defined here, derived from the engine config, and
 * used by everything that displays risk. It is logarithmic for the same reason
 * hearing and vision are: what registers is the ratio between two values, not
 * their difference. Going from 1% to 2% doubles your chance of dying and
 * should look and sound like a real change; 6% to 7% is a sixth more and
 * should barely register.
 */

/** Bottom of the scale: the configured hazard floor. */
const FLOOR = DEFAULT_CONFIG.hazard.qMin;
/** Top of the scale: the opening rate at a full lattice, which is the worst it gets. */
const CEIL = DEFAULT_CONFIG.hazard.q0;
const SPAN = Math.log(CEIL / FLOOR);

/** Maps a hazard rate to 0-1 across the range players actually experience. */
export function riskScale(hazard: number): number {
  return Math.max(0, Math.min(1, Math.log(Math.max(FLOOR, hazard) / FLOOR) / SPAN));
}

export type RiskBand = "holding" | "stable" | "stressed" | "critical";

/**
 * Thresholds are on the scale, not on the raw rate, so they stay meaningful if
 * the hazard curve is retuned. The previous fixed cutoffs called anything under
 * 2% "stable" and only said "critical" above 5.5% — a level the shaft touches
 * for about three ticks at the start of a round and never again, so the meter
 * showed "stable" through almost the entire game including the endgame.
 */
export function riskBand(hazard: number, grace: boolean): RiskBand {
  if (grace) return "holding";
  const s = riskScale(hazard);
  return s > 0.7 ? "critical" : s > 0.35 ? "stressed" : "stable";
}

export function bandColor(band: RiskBand): string {
  switch (band) {
    case "holding":
      return "var(--color-cyan)";
    case "critical":
      return "var(--color-danger)";
    case "stressed":
      return "var(--color-warn)";
    default:
      return "var(--color-cyan)";
  }
}

export function bandLabel(band: RiskBand): string {
  return band === "holding" ? "LATTICE HOLDING" : band.toUpperCase();
}
