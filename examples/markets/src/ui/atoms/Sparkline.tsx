/** A path in a row: a small line of `values` against `base` (yesterday's close), filling `slots` as the day goes on. */
const W = 64;
const H = 18;

export function Sparkline({
  values,
  base,
  slots,
}: {
  values: readonly number[];
  base: number;
  slots: number;
}) {
  if (values.length < 2) return null;
  const lo = Math.min(base, ...values);
  const hi = Math.max(base, ...values);
  const y = (v: number) => (hi === lo ? H / 2 : H - 1 - ((v - lo) / (hi - lo)) * (H - 2));
  const x = (i: number) => (i / Math.max(1, slots - 1)) * W;
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = (values.at(-1) ?? base) >= base;
  return (
    <svg
      className="spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      data-dir={up ? "up" : "down"}
    >
      <line x1={0} x2={W} y1={y(base)} y2={y(base)} className="spark-base" />
      <polyline points={points} className="spark-line" />
    </svg>
  );
}
