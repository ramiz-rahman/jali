/**
 * Positions and P&L, with an order ticket. The ticket is the pane's work: its draft is pane state (kept through
 * folds, tabs and reloads), and while it holds a quantity or a price that hasn't been sent, it reports unsaved work,
 * so nothing closes it or swaps it out without asking.
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { BriefcaseIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import {
  definePane,
  useCommands,
  usePane,
  usePaneState,
  useUnsaved,
  type PaneProps,
} from "@jali/react";
import { useMarket, useQuotes } from "../market/react";
import type { Instrument } from "../market/types";
import { useServices } from "../services";
import { useStore } from "../store";
import { inUsd, notional, unrealized, type Side } from "../trading/trading";
import * as f from "../ui/format";
import { Delta, Empty, Scroller, Segmented } from "../ui/parts";
import { quote } from "./quote";

interface Draft {
  symbol: string;
  side: Side;
  qty: string;
  type: "market" | "limit";
  limit: string;
}
const BLANK: Draft = { symbol: "", side: "buy", qty: "", type: "market", limit: "" };
type Tab = "positions" | "orders" | "fills";

function Blotter({ paused, openBeside }: PaneProps) {
  const services = useServices();
  const [tab, setTab] = usePaneState<Tab>("tab", "positions");
  const book = useStore(services.trading, (b) => b);
  const working = book.orders.filter((o) => o.status === "working").length;

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
              {
                value: "positions",
                label: `Positions ${book.positions.filter((p) => p.qty).length}`,
              },
              { value: "orders", label: `Working ${working}` },
              { value: "fills", label: `Fills ${book.fills.length}` },
            ]}
          />
        </div>
        {tab === "positions" ? (
          <Positions paused={paused} onOpen={(s) => openBeside(quote({ symbol: s }))} />
        ) : tab === "orders" ? (
          <Orders />
        ) : (
          <Fills />
        )}
      </section>
    </div>
  );
}

/** The order ticket. ⌘↵ sends it. */
function Ticket() {
  const { trading, ticket, market } = useServices();
  const [draft, setDraft] = usePaneState<Draft>("draft", BLANK);
  const [applied, setApplied] = usePaneState("applied", 0);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const request = useStore(ticket, (r) => r);
  const inst = market.instrument(draft.symbol);
  const q = useQuotes(inst ? [inst.symbol] : [], usePane().paused).get(draft.symbol);

  // "Buy LMNA" from a quote or ⌘K fills in the instrument and side, and keeps any quantity already typed. Each
  // request is applied once (`applied` is pane state, so a reload doesn't apply it again).
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  useEffect(() => {
    if (!request || request.at <= appliedRef.current) return;
    setApplied(request.at);
    setDraft((d) => ({ ...d, symbol: request.symbol, side: request.side }));
    setResult(null);
    // After Jali has moved focus into the pane it just revealed: then into the quantity.
    const t = setTimeout(() => qtyRef.current?.focus(), 150);
    return () => clearTimeout(t);
    // Only a new request runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setResult(null);
  };
  const qty = Number(draft.qty.replace(/[,\s_]/g, ""));
  const limit = Number(draft.limit);
  const typed = draft.qty !== "" || draft.limit !== "";
  // The words Jali shows in "Discard unsaved changes?".
  useUnsaved(
    typed &&
      `an unsent order to ${draft.side} ${draft.qty || "some"} ${draft.symbol || "of an instrument"}`,
  );

  const price = draft.type === "limit" ? limit : q ? (draft.side === "buy" ? q.ask : q.bid) : 0;
  const value = inst && qty > 0 && price > 0 ? inUsd(inst, notional(inst, qty, price), price) : 0;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const order = trading.submit({
      symbol: draft.symbol,
      side: draft.side,
      qty,
      type: draft.type,
      limit: draft.type === "limit" ? limit : undefined,
    });
    if ("error" in order) return setResult({ ok: false, text: order.error });
    setDraft({ ...BLANK, symbol: draft.symbol, side: draft.side });
    setResult({
      ok: true,
      text:
        order.status === "filled"
          ? `${draft.side === "buy" ? "Bought" : "Sold"} ${f.size(qty)} ${draft.symbol}.`
          : `Working: ${draft.side} ${f.size(qty)} ${draft.symbol} at ${draft.limit}.`,
    });
  };
  const clear = () => {
    setDraft(BLANK);
    setResult(null);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault(); // claimed: ⌘↵ sends the order
      submit();
    }
  };

  useCommands([
    {
      id: "submit",
      title: "Send order",
      keys: keyHint("Mod+Enter"),
      disabled: inst && qty > 0 ? false : "Choose an instrument and a quantity",
      run: () => submit(),
    },
    {
      id: "clear",
      title: "Clear ticket",
      disabled: typed || draft.symbol ? false : "The ticket is empty",
      run: clear,
    },
  ]);

  return (
    <form
      className="ticket"
      aria-label="Order ticket"
      onSubmit={submit}
      onKeyDown={onKeyDown}
      data-side={draft.side}
    >
      <div className="ticket-row">
        <Segmented
          label="Side"
          className="ticket-side"
          value={draft.side}
          onChange={(side) => set({ side })}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <Segmented
          label="Order type"
          value={draft.type}
          onChange={(type) => set({ type })}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
          ]}
        />
      </div>
      <div className="ticket-fields">
        <label>
          <span>Instrument</span>
          <input
            value={draft.symbol}
            onChange={(e) => set({ symbol: e.target.value.toUpperCase().trim() })}
            list="markets-symbols"
            placeholder="Symbol"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          <span>Quantity{inst ? ` (${f.unit(inst)})` : ""}</span>
          <input
            ref={qtyRef}
            value={draft.qty}
            onChange={(e) => set({ qty: e.target.value })}
            inputMode="numeric"
            placeholder="0"
          />
        </label>
        {draft.type === "limit" ? (
          <label>
            <span>Limit</span>
            <input
              value={draft.limit}
              onChange={(e) => set({ limit: e.target.value })}
              inputMode="decimal"
              placeholder={q ? String(draft.side === "buy" ? q.bid : q.ask) : ""}
            />
          </label>
        ) : null}
      </div>
      <datalist id="markets-symbols">
        {market.instruments
          .filter((i) => i.assetClass !== "index")
          .map((i) => (
            <option key={i.symbol} value={i.symbol}>
              {i.name}
            </option>
          ))}
      </datalist>
      <div className="ticket-foot">
        <span className="ticket-est">
          {inst && q ? (
            <>
              {inst.name} · {draft.side === "buy" ? "ask" : "bid"}{" "}
              {f.price(inst, draft.side === "buy" ? q.ask : q.bid)}
              {value ? <> · about ${f.int(value)}</> : null}
            </>
          ) : (
            "Choose an instrument"
          )}
        </span>
        <button type="button" className="btn btn-quiet" onClick={clear}>
          Clear
        </button>
        <button type="submit" className={`btn btn-${draft.side}`}>
          {draft.side === "buy" ? "Buy" : "Sell"} <kbd>{keyHint("Mod+Enter")}</kbd>
        </button>
      </div>
      {result ? (
        <p
          className="ticket-result"
          role={result.ok ? "status" : "alert"}
          data-ok={result.ok ? "" : undefined}
        >
          {result.text}
        </p>
      ) : null}
    </form>
  );
}

function Summary({ paused }: { paused: boolean }) {
  const { trading, market } = useServices();
  const positions = useStore(trading, (b) => b.positions);
  const quotes = useQuotes(
    positions.map((p) => p.symbol),
    paused,
  );
  let open = 0;
  let realized = 0;
  let gross = 0;
  for (const p of positions) {
    const inst = market.instrument(p.symbol);
    if (!inst) continue;
    const q = quotes.get(p.symbol);
    open += unrealized(inst, p, q);
    realized += p.realized;
    if (q) gross += Math.abs(inUsd(inst, notional(inst, p.qty, q.last), q.last));
  }
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

function Positions({ paused, onOpen }: { paused: boolean; onOpen: (symbol: string) => void }) {
  const { trading } = useServices();
  const market = useMarket();
  const positions = useStore(trading, (b) => b.positions);
  const open = useMemo(() => positions.filter((p) => p.qty !== 0), [positions]);
  const quotes = useQuotes(
    open.map((p) => p.symbol),
    paused,
  );
  if (!open.length)
    return <Empty title="No open positions">Orders you send from the ticket show here.</Empty>;
  return (
    <Scroller className="table-scroll" label="Open positions">
      <table className="grid-table">
        <caption className="sr-only">Open positions</caption>
        <thead>
          <tr>
            <th scope="col">Instrument</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col" className="num">
              Average
            </th>
            <th scope="col" className="num">
              Last
            </th>
            <th scope="col" className="num">
              P&amp;L
            </th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => {
            const inst = market.instrument(p.symbol) as Instrument;
            const q = quotes.get(p.symbol);
            const pnl = unrealized(inst, p, q);
            return (
              <tr key={p.symbol} onClick={() => onOpen(p.symbol)}>
                <td>
                  <b>{p.symbol}</b>
                </td>
                <td className="num">
                  <Delta value={p.qty}>{f.size(Math.abs(p.qty))}</Delta>
                </td>
                <td className="num">{f.price(inst, p.avgPrice)}</td>
                <td className="num">{q ? f.price(inst, q.last) : ""}</td>
                <td className="num">
                  <Delta value={pnl}>{f.money(pnl)}</Delta>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroller>
  );
}

function Orders() {
  const { trading, market } = useServices();
  const orders = useStore(trading, (b) => b.orders);
  if (!orders.length) return <Empty title="No orders yet">Send one from the ticket.</Empty>;
  return (
    <Scroller className="table-scroll" label="Orders">
      <table className="grid-table">
        <caption className="sr-only">Orders, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Order</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 50).map((o) => {
            const inst = market.instrument(o.symbol)!;
            return (
              <tr key={o.id}>
                <td className="t-time">{f.time(o.time)}</td>
                <td>
                  {o.side === "buy" ? "Buy" : "Sell"} {f.size(o.qty)} <b>{o.symbol}</b>
                  {o.type === "limit" ? ` at ${f.price(inst, o.limit!)}` : " at market"}
                </td>
                <td>
                  {o.status === "working"
                    ? "Working"
                    : o.status === "filled"
                      ? "Filled"
                      : "Cancelled"}
                </td>
                <td>
                  {o.status === "working" ? (
                    <button
                      type="button"
                      className="btn btn-quiet btn-small"
                      onClick={() => trading.cancel(o.id)}
                    >
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroller>
  );
}

function Fills() {
  const { trading, market } = useServices();
  const fills = useStore(trading, (b) => b.fills);
  if (!fills.length) return <Empty title="No fills yet" />;
  return (
    <Scroller className="table-scroll" label="Fills">
      <table className="grid-table">
        <caption className="sr-only">Fills, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">Side</th>
            <th scope="col">Instrument</th>
            <th scope="col" className="num">
              Quantity
            </th>
            <th scope="col" className="num">
              Price
            </th>
          </tr>
        </thead>
        <tbody>
          {fills.map((fl) => (
            <tr key={fl.id}>
              <td className="t-time">{f.time(fl.time)}</td>
              <td>
                <Delta value={fl.side === "buy" ? 1 : -1}>
                  {fl.side === "buy" ? "Buy" : "Sell"}
                </Delta>
              </td>
              <td>
                <b>{fl.symbol}</b>
              </td>
              <td className="num">{f.size(fl.qty)}</td>
              <td className="num">{f.price(market.instrument(fl.symbol)!, fl.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

export const blotter = definePane("blotter", {
  title: "Blotter",
  icon: BriefcaseIcon,
  width: { min: 420, comfortable: 620 },
  height: { min: 300 },
  Component: Blotter,
});
