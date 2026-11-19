/** Today's path in a row: a small line against yesterday's close. It redraws every few seconds, not every tick. */
import { useEffect, useState } from "react";
import { useMarket } from "../market/react";
import type { Bar } from "../market/types";

const W = 64;
const H = 18;
const EVERY_MS = 5000;

export function Sparkline({
  symbol,
  prevClose,
  paused,
}: {
  symbol: string;
  prevClose: number;
  paused: boolean;
}) {
  const market = useMarket();
  const [bars, setBars] = useState<readonly Bar[]>(() =>
    market.snapshot({ channel: "bars", symbol, range: "1D" }),
  );
  useEffect(() => {
    if (paused) return;
    const read = () => setBars(market.snapshot({ channel: "bars", symbol, range: "1D" }));
    read();
    const timer = setInterval(read, EVERY_MS);
    return () => clearInterval(timer);
  }, [market, symbol, paused]);

  if (bars.length < 2) return null;
  const closes = bars.map((b) => b.close);
  const lo = Math.min(prevClose, ...closes);
  const hi = Math.max(prevClose, ...closes);
  const y = (v: number) => (hi === lo ? H / 2 : H - 1 - ((v - lo) / (hi - lo)) * (H - 2));
  // The session is 390 minutes: the line fills the cell as the day goes on.
  const x = (i: number) => (i / 389) * W;
  const points = closes.map((c, i) => `${x(i).toFixed(1)},${y(c).toFixed(1)}`).join(" ");
  const up = closes[closes.length - 1]! >= prevClose;
  return (
    <svg
      className="spark"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden
      data-dir={up ? "up" : "down"}
    >
      <line x1={0} x2={W} y1={y(prevClose)} y2={y(prevClose)} className="spark-base" />
      <polyline points={points} className="spark-line" />
    </svg>
  );
}
