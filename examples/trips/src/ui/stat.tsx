import type { ReactNode } from "react";
import "./stat.css";

/** A labelled figure, with an optional line under it: "Travel 1h 17m, $0.40 in fares". */
export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "over";
}) {
  return (
    <div className="stat" data-tone={tone}>
      <dt>{label}</dt>
      <dd>
        <span className="stat-value num">{value}</span>
        {sub ? <span className="stat-sub">{sub}</span> : null}
      </dd>
    </div>
  );
}
