/**
 * The watchlist: the list every desk works from. J/K and the arrows move the cursor, and the chart, quote, book and
 * news beside it follow. Enter opens a chart, Space shows the quote at once, Delete takes the row off the list.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { ListBulletsIcon } from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "@jali/react";
import { keyHint } from "@jali/core";
import { DEFAULT_LISTS, listName, useList } from "../lists";
import { useMarket, useQuotes } from "../market/react";
import type { Instrument, Quote } from "../market/types";
import { useServices } from "../services";
import * as f from "../ui/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Delta, Empty, Flash } from "../ui/parts";
import { Sparkline } from "../ui/Sparkline";
import { openFollowing } from "../actions";
import { chart } from "./chart";
import { listMove, scrollRowIntoView } from "./keys";
import { quote } from "./quote";

type SortBy = "list" | "symbol" | "last" | "changePct" | "volume";
interface Sort {
  by: SortBy;
  dir: 1 | -1;
}

const COLUMNS: { by: SortBy; label: string; className: string }[] = [
  { by: "symbol", label: "Instrument", className: "c-name" },
  { by: "last", label: "Last", className: "c-num" },
  { by: "changePct", label: "Change", className: "c-num" },
  { by: "volume", label: "Volume", className: "c-num c-vol" },
];

/** What a watchlist pane shows; its component and `definePane` share it. */
const watchlistParams = { list: String };

function Watchlist({
  params,
  paused,
  focused,
  node,
  select,
  peek,
  openHere,
}: PaneProps<typeof watchlistParams>) {
  const { lists } = useServices();
  const market = useMarket();
  const jali = useJali();
  const list = useList(lists, params.list);
  const symbols = useMemo(
    () => (list?.symbols ?? []).filter((s) => market.instrument(s)),
    [list, market],
  );
  const quotes = useQuotes(symbols, paused);
  const [sort, setSort] = usePaneState<Sort>("sort", { by: "list", dir: 1 });
  const [kept, setCursor] = usePaneState<string | null>("cursor", null);
  // The cursor is on the instrument Jali has selected: it starts this list on what its following quote shows
  // (`selects`), and moves it with that quote when a layout (a desk, a link, Back) gives it another.
  const selected = useJaliState((s) => s.selection[node.id]?.ref);
  const cursor = selected?.kind === "quote" ? String(selected.params.symbol) : kept;
  const listRef = useRef<HTMLDivElement>(null);

  // Sorted by what the person chose; the cursor stays on the same instrument, not the same position.
  const rows = useMemo(() => {
    const out = symbols.map((s, i) => ({ inst: market.instrument(s)!, q: quotes.get(s), i }));
    if (sort.by === "list") return out;
    const key = (r: (typeof out)[number]): number | string =>
      sort.by === "symbol"
        ? r.inst.symbol
        : (r.q?.[sort.by as "last" | "changePct" | "volume"] ?? 0);
    return out.sort((a, b) => {
      const [x, y] = [key(a), key(b)];
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [symbols, quotes, sort, market]);
  const at = rows.findIndex((r) => r.inst.symbol === cursor);
  const current = at >= 0 ? rows[at]!.inst : undefined;

  // Tell Jali what is selected: its following quote, chart, book, trades and news show it (panes/follow.ts).
  const moveTo = (symbol: string) => {
    setCursor(symbol);
    select(quote({ symbol }));
  };

  // With nothing selected on this list (no following quote, or another list chosen), start on the first row.
  const start = cursor && symbols.includes(cursor) ? cursor : symbols[0];
  const unselected = selected?.kind !== "quote" || selected.params.symbol !== start;
  useEffect(() => {
    if (!start || !unselected) return;
    setCursor(start);
    select(quote({ symbol: start }));
  }, [start, unselected, select, setCursor]);

  useEffect(() => scrollRowIntoView(listRef.current, at), [at]);

  const openChart = (symbol: string) => {
    if (symbol !== cursor) moveTo(symbol);
    openFollowing(jali, node.id, chart({ symbol }));
  };
  const remove = (symbol: string) => {
    const next = rows[at + 1] ?? rows[at - 1];
    lists.remove(params.list, symbol);
    if (next && symbol === cursor) moveTo(next.inst.symbol);
  };
  const sortBy = (by: SortBy) =>
    setSort((s) =>
      s.by === by
        ? s.dir === 1
          ? { by, dir: -1 }
          : { by: "list", dir: 1 }
        : { by, dir: by === "symbol" ? 1 : -1 },
    );

  const onKeyDown = (e: KeyboardEvent) => {
    const to = listMove(e, at < 0 ? -1 : at, rows.length);
    if (to !== null) moveTo(rows[to]!.inst.symbol);
    else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && current) openChart(current.symbol);
    else if (e.key === " " && current) peek(quote({ symbol: current.symbol }));
    else if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey && current)
      remove(current.symbol);
    else return; // not ours: let it bubble to the workspace
    e.preventDefault();
  };

  // ⌘K lists these while the watchlist is focused.
  useCommands([
    {
      id: "open-chart",
      title: current ? `Open chart for ${current.symbol}` : "Open chart",
      keys: keyHint("Enter"),
      disabled: current ? false : "Nothing selected",
      run: () => current && openChart(current.symbol),
    },
    {
      id: "sort-change",
      title: "Sort by change",
      run: () => setSort({ by: "changePct", dir: -1 }),
    },
    { id: "sort-volume", title: "Sort by volume", run: () => setSort({ by: "volume", dir: -1 }) },
    {
      id: "sort-list",
      title: "Sort in list order",
      disabled: sort.by === "list" ? "Already in list order" : false,
      run: () => setSort({ by: "list", dir: 1 }),
    },
    {
      id: "remove",
      title: current
        ? `Remove ${current.symbol} from ${listName(params.list)}`
        : "Remove from list",
      keys: keyHint("Delete"),
      disabled: current ? false : "Nothing selected",
      run: () => current && remove(current.symbol),
    },
  ]);

  const grouped = sort.by === "list" && params.list === "equities";
  // A list of bonds is read in yields.
  const yields = rows.length > 0 && rows.every((r) => r.inst.coupon !== undefined);
  return (
    <div className="pane-body watchlist">
      <div className="toolbar">
        <Select value={params.list} onValueChange={(list) => openHere(watchlist({ list }))}>
          <SelectTrigger aria-label="List">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DEFAULT_LISTS.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="toolbar-note">{rows.length} instruments</span>
      </div>
      <div className="wl-head" role="presentation">
        {COLUMNS.map((c) => {
          const label = c.by === "last" && yields ? "Yield" : c.label;
          return (
            <button
              key={c.by}
              type="button"
              className={c.className}
              aria-label={`Sort by ${label.toLowerCase()}`}
              aria-pressed={sort.by === c.by}
              data-dir={sort.by === c.by ? (sort.dir === 1 ? "asc" : "desc") : undefined}
              onClick={() => sortBy(c.by)}
            >
              {label}
            </button>
          );
        })}
        <span className="c-num c-bid">Bid</span>
        <span className="c-num c-ask">Ask</span>
        <span className="c-spark">Today</span>
      </div>
      {rows.length ? (
        <div
          ref={listRef}
          className="wl-rows"
          role="listbox"
          aria-label={listName(params.list)}
          tabIndex={0}
          aria-activedescendant={current ? `${node.id}-${current.symbol}` : undefined}
          onKeyDown={onKeyDown}
        >
          {rows.map((r, i) => (
            <Row
              key={r.inst.symbol}
              id={`${node.id}-${r.inst.symbol}`}
              inst={r.inst}
              q={r.q}
              selected={i === at}
              focused={focused}
              paused={paused}
              group={
                grouped && (i === 0 || rows[i - 1]!.inst.group !== r.inst.group)
                  ? r.inst.group
                  : undefined
              }
              // A second tap on the selected row opens its chart: on a phone there is no Enter or double-click.
              onSelect={() => (i === at ? openChart(r.inst.symbol) : moveTo(r.inst.symbol))}
              onOpen={() => openChart(r.inst.symbol)}
            />
          ))}
        </div>
      ) : (
        <Empty title="This list is empty">Add an instrument with ⌘K, "Add to watchlist".</Empty>
      )}
    </div>
  );
}

function Row({
  id,
  inst,
  q,
  selected,
  focused,
  paused,
  group,
  onSelect,
  onOpen,
}: {
  id: string;
  inst: Instrument;
  q: Quote | undefined;
  selected: boolean;
  focused: boolean;
  paused: boolean;
  group?: string;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const isBond = q?.yield !== undefined;
  return (
    <>
      {group ? (
        <div className="wl-group" role="presentation">
          {group}
        </div>
      ) : null}
      <div
        id={id}
        data-row=""
        role="option"
        aria-selected={selected}
        data-active={selected && focused ? "" : undefined}
        className="wl-row"
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className="c-name">
          <b>{inst.symbol}</b>
          <span className="wl-sub">{inst.name}</span>
        </span>
        {q ? (
          <>
            <span className="c-num">
              <Flash value={q.last} dir={q.tickDir}>
                {isBond ? f.percent(q.yield!) : f.price(inst, q.last)}
              </Flash>
            </span>
            <span className="c-num">
              <Delta value={isBond ? q.yieldChangeBp! : q.change}>
                {isBond ? f.bp(q.yieldChangeBp!) : f.pct(q.changePct)}
              </Delta>
            </span>
            <span className="c-num c-vol">
              {inst.assetClass === "index" || inst.assetClass === "fx" ? "" : f.size(q.volume)}
            </span>
            <span className="c-num c-bid">{f.price(inst, q.bid)}</span>
            <span className="c-num c-ask">{f.price(inst, q.ask)}</span>
            <span className="c-spark">
              <Sparkline symbol={inst.symbol} prevClose={inst.prevClose} paused={paused} />
            </span>
          </>
        ) : (
          // A live price before its first quote: said, not shown as 0.
          <span className="c-pending">Not known yet</span>
        )}
      </div>
    </>
  );
}

export const watchlist = definePane("watchlist", {
  params: watchlistParams,
  title: ({ list }) => listName(list),
  icon: ListBulletsIcon,
  width: { min: 280, comfortable: 380 },
  height: { min: 220 },
  holdWhileResizing: true,
  // It reports select(quote(...)): with nothing selected, it starts on what its following quote shows.
  selects: "quote",
  Component: Watchlist,
});
