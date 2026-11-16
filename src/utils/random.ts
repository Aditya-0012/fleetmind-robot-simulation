/**
 * Mulberry32 — a tiny, fast, seedable PRNG. The same seed always yields the same sequence,
 * which makes random scenarios reproducible.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rnd: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rnd() * (maxInclusive - min + 1));
}

/** Fisher–Yates shuffle (in place). */
export function shuffle<T>(rnd: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
