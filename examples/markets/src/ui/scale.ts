/** Scales for the app's SVG charts (the price chart, the yield curve). */

/** Round values for an axis: steps of 1, 2, 2.5 or 5 times a power of ten, about `count` of them from `lo` to `hi`. */
export function niceTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Number(t.toFixed(10)));
  return out;
}
