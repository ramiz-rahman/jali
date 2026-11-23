/** Today's low to high (a coin's last 24 hours), with the open and the last price marked on it. */
import { facts } from "../../market/classes";
import type { Instrument, Quote } from "../../market/types";
import * as f from "../../ui/format";

export function DayRange({ inst, q }: { inst: Instrument; q: Quote }) {
  const span = q.high - q.low || 1;
  const at = (p: number) => `${((p - q.low) / span) * 100}%`;
  const continuous = facts(inst).continuous;
  return (
    <div className="range">
      <div className="range-labels">
        <span>Low {f.price(inst, q.low)}</span>
        <span>{continuous ? "24h range" : "Day range"}</span>
        <span>High {f.price(inst, q.high)}</span>
      </div>
      <div
        className="range-bar"
        role="img"
        aria-label={`Last ${f.price(inst, q.last)}, between ${continuous ? "the last 24 hours'" : "today's"} low and high`}
      >
        <span
          className="range-open"
          style={{ left: at(q.open) }}
          title={`Open ${f.price(inst, q.open)}`}
        />
        <span className="range-last" style={{ left: at(q.last) }} />
      </div>
    </div>
  );
}
