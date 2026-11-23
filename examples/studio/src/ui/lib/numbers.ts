/** `n`, held between `lo` and `hi`. */
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
