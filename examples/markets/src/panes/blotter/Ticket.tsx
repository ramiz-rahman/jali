/**
 * The order ticket. Its draft is pane state (kept through folds, tabs and reloads), and while it holds a quantity or
 * a price that hasn't been sent, it reports unsaved work, so nothing takes it away without asking (workspace/
 * unsent.ts). "Buy LMNA" from a quote or ⌘K arrives through the ticket's inbox (model/ticket.ts). ⌘↵ sends it.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { keyHint } from "jali";
import { useCommands, usePane, usePaneState, useUnsaved } from "jali/react";
import { isRecord, oneOf, text, useStore } from "@jali-examples/shared/store";
import { facts } from "../../market/classes";
import { useQuotes } from "../../market/react";
import type { Side } from "../../market/types";
import { inUsd, notional, type OrderType } from "../../model/ledger";
import { useServices } from "../../services";
import * as f from "../../ui/format";
import { Segmented } from "../../ui/molecules/Segmented";

interface Draft {
  symbol: string;
  side: Side;
  qty: string;
  type: OrderType;
  limit: string;
}
const BLANK: Draft = { symbol: "", side: "buy", qty: "", type: "market", limit: "" };

/** A draft kept in pane state, as read back: every field of the right kind, or a blank ticket. */
const parseDraft = (v: unknown): Draft | undefined => {
  if (!isRecord(v)) return undefined;
  const symbol = text(v.symbol);
  const side = oneOf<Side>(["buy", "sell"])(v.side);
  const qty = text(v.qty);
  const type = oneOf<OrderType>(["market", "limit"])(v.type);
  const limit = text(v.limit);
  return symbol !== undefined && side && qty !== undefined && type && limit !== undefined
    ? { symbol, side, qty, type, limit }
    : undefined;
};

/** After Jali has moved focus into the pane it just revealed: then into the quantity. */
const FOCUS_AFTER_REVEAL_MS = 150;

export function Ticket() {
  const { trading, ticket, market } = useServices();
  const [draft, setDraft] = usePaneState<Draft>("draft", BLANK, { parse: parseDraft });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const inst = market.instrument(draft.symbol);
  const q = useQuotes(inst ? [inst.symbol] : [], usePane().paused).get(draft.symbol);

  // "Buy LMNA" fills in the instrument and side, and keeps any quantity already typed; then the quantity has focus.
  const request = useStore(ticket, (r) => r);
  const [requests, setRequests] = useState(0);
  useEffect(() => {
    const taken = request && ticket.take();
    if (!taken) return;
    setDraft((d) => ({ ...d, symbol: taken.symbol, side: taken.side }));
    setResult(null);
    setRequests((n) => n + 1);
  }, [request, ticket, setDraft]);
  useEffect(() => {
    if (!requests) return;
    const t = setTimeout(() => qtyRef.current?.focus(), FOCUS_AFTER_REVEAL_MS);
    return () => clearTimeout(t);
  }, [requests]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setResult(null);
  };
  const qty = Number(draft.qty.replace(/[,\s_]/g, ""));
  const limit = Number(draft.limit);
  const typed = draft.qty !== "" || draft.limit !== "";
  // The words the app's question shows before a change loses it (workspace/unsent.ts, shell/Question.tsx).
  useUnsaved(
    typed &&
      `an unsent order to ${draft.side} ${draft.qty || "some"} ${draft.symbol || "of an instrument"}`,
  );

  const touch = q ? (draft.side === "buy" ? q.ask : q.bid) : 0;
  const price = draft.type === "limit" ? limit : touch;
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
          ? `${f.SIDE[draft.side].past} ${f.size(qty)} ${draft.symbol}.`
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
            { value: "buy", label: f.SIDE.buy.verb },
            { value: "sell", label: f.SIDE.sell.verb },
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
          .filter((i) => facts(i).tradable)
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
              {inst.name} · {draft.side === "buy" ? "ask" : "bid"} {f.price(inst, touch)}
              {value ? <> · about ${f.int(value)}</> : null}
            </>
          ) : inst ? (
            `${inst.name} · price not known yet`
          ) : (
            "Choose an instrument"
          )}
        </span>
        <button type="button" className="btn btn-quiet" onClick={clear}>
          Clear
        </button>
        <button type="submit" className={`btn btn-${draft.side}`}>
          {f.SIDE[draft.side].verb} <kbd>{keyHint("Mod+Enter")}</kbd>
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
