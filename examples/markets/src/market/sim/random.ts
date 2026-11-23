/** Seeded randomness, so the same seed always gives the same market (and tests can say what it does). */

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Standard normal. */
  gauss(): number;
  /** An integer in [min, max]. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** How many events happen in a window where `mean` are expected. */
  poisson(mean: number): number;
}

/** mulberry32: small, fast and good enough for a simulation. */
export function createRandom(seed: number): Random {
  let a = seed >>> 0 || 0x9e3779b9;
  let spare: number | null = null;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    // Box–Muller: two uniforms give two independent normals; keep the second for the next call.
    const u = 1 - next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return {
    next,
    gauss,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    poisson(mean) {
      // Knuth's method; the means here are small (a few events a tick).
      const limit = Math.exp(-mean);
      let k = 0;
      for (let p = next(); p > limit; p *= next()) k++;
      return k;
    },
  };
}

/** A stable 32-bit hash of a string, to give each instrument its own stream. */
export function hash(text: string, seed = 0): number {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A number in [0, 1) fixed by its inputs: the same price level keeps the same size until `bucket` moves on. */
export function noise(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h ^= Math.floor(p) + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}
