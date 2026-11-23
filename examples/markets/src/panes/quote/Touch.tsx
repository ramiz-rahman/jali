/** Bid and ask with their sizes, and the spread between them in the units traders use. */
import type { Instrument, Quote } from "../../market/types";
import * as f from "../../ui/format";

export function Touch({ inst, q }: { inst: Instrument; q: Quote }) {
  return (
    <div className="touch">
      <div className="touch-side" data-side="bid">
        <span className="touch-label">Bid</span>
        <span className="touch-price">{f.price(inst, q.bid)}</span>
        <span className="touch-size">{f.size(q.bidSize)}</span>
      </div>
      <div className="touch-spread">
        <span className="touch-label">Spread</span>
        <span>{f.spread(inst, q.bid, q.ask)}</span>
      </div>
      <div className="touch-side" data-side="ask">
        <span className="touch-label">Ask</span>
        <span className="touch-price">{f.price(inst, q.ask)}</span>
        <span className="touch-size">{f.size(q.askSize)}</span>
      </div>
    </div>
  );
}
