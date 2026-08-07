/**
 * Deterministic randomness. Every draw the game makes flows through this
 * interface so that a round can be replayed byte-identically by the server,
 * the client, and the simulator from the same seed.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

/** Fast non-cryptographic PRNG. Used for bulk simulation, never for live rounds. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Derives a stable 32-bit seed from a string, for naming simulation runs. */
export function seedFromString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
