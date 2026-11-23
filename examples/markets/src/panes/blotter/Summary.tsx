/** The book's totals above its tables: open and realised P&L, and gross exposure, in dollars. */
import { useStore } from "@jali-examples/shared/store";
import { useQuotes } from "../../market/react";
import { totals } from "../../model/ledger";
import { useServices } from "../../services";
import * as f from "../../ui/format";
import { Delta } from "../../ui/molecules/Delta";

export function Summary({ paused }: { paused: boolean }) {
  const { trading, market } = useServices();
  const positions = useStore(trading, (b) => b.positions);
  const quotes = useQuotes(
    positions.map((p) => p.symbol),
    paused,
  );
  const { open, realized, gross } = totals(positions, quotes, market.instrument);
  return (
    <div className="summary">
      <div>
        <span>Open P&amp;L</span>
        <Delta value={open}>{f.money(open)}</Delta>
      </div>
      <div>
        <span>Realised</span>
        <Delta value={realized}>{f.money(realized)}</Delta>
      </div>
      <div>
        <span>Gross exposure</span>
        <b>{f.size(gross)}</b>
      </div>
    </div>
  );
}
