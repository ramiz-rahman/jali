/** A few levels across the top bar, at widths with room for them. The crypto levels are live, and marked so. */
import { useMarket, useQuotes } from "../market/react";
import * as f from "../ui/format";
import { Delta } from "../ui/molecules/Delta";

// In order of priority: narrower windows show the first few.
const STRIP = ["MX40", "BTCUSD", "GOV10Y", "EURUSD", "ETHUSD", "MXTEC"];

export function Strip() {
  const market = useMarket();
  const quotes = useQuotes(STRIP);
  return (
    <ul className="strip" aria-label="Market levels">
      {STRIP.map((s) => {
        const q = quotes.get(s);
        const inst = market.instrument(s);
        if (!q || !inst) return null;
        const level = f.level(inst, q);
        return (
          <li key={s}>
            <span className="strip-sym">
              {inst.source ? (
                <span className="live-dot" title={`Live from ${inst.source}`} aria-hidden />
              ) : null}
              {s}
            </span>
            <span className="strip-last">{level.text}</span>
            <Delta value={level.change}>{level.changeText}</Delta>
          </li>
        );
      })}
    </ul>
  );
}
