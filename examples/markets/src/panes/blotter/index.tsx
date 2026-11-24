/**
 * Positions and P&L, with an order ticket (Ticket.tsx). The ticket is the pane's work; the book beneath it is the
 * paper book's (model/trading.ts): its totals (Summary.tsx) and its tables (Tables.tsx).
 */
import { BriefcaseIcon } from "@phosphor-icons/react";
import { definePane, usePaneState, type PaneProps } from "jali-layout/react";
import { oneOf, useStore } from "@jali-examples/shared/store";
import { useServices } from "../../services";
import { Segmented } from "../../ui/molecules/Segmented";
import { quote } from "../quote";
import { Summary } from "./Summary";
import { Fills, Orders, Positions } from "./Tables";
import { Ticket } from "./Ticket";

type Tab = "positions" | "orders" | "fills";
const tabOf = oneOf<Tab>(["positions", "orders", "fills"]);

function Blotter({ paused, openBeside }: PaneProps) {
  const { trading } = useServices();
  const [tab, setTab] = usePaneState<Tab>("tab", "positions", { parse: tabOf });
  const ledger = useStore(trading, (b) => b);
  const positions = ledger.positions.filter((p) => p.qty).length;
  const working = ledger.orders.filter((o) => o.status === "working").length;

  return (
    <div className="pane-body blotter">
      <Ticket />
      <section className="blotter-book" aria-label="Book">
        <Summary paused={paused} />
        <div className="toolbar">
          <Segmented
            label="Show"
            value={tab}
            onChange={setTab}
            options={[
              { value: "positions", label: `Positions ${positions}` },
              { value: "orders", label: `Working ${working}` },
              { value: "fills", label: `Fills ${ledger.fills.length}` },
            ]}
          />
        </div>
        {tab === "positions" ? (
          <Positions paused={paused} onOpen={(symbol) => openBeside(quote({ symbol }))} />
        ) : tab === "orders" ? (
          <Orders />
        ) : (
          <Fills />
        )}
      </section>
    </div>
  );
}

export const blotter = definePane("blotter", {
  title: "Blotter",
  icon: BriefcaseIcon,
  width: { min: 420, comfortable: 620 },
  height: { min: 300 },
  Component: Blotter,
});
