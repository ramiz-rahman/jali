/**
 * The watchlist: the list every desk works from. J/K and the arrows move the cursor, and the chart, quote, book and
 * news beside it follow. Enter opens a chart, Space shows the quote at once, Delete takes the row off the list.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { ListBulletsIcon } from "@phosphor-icons/react";
import { keyHint } from "jali";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "jali/react";
import { text } from "@jali-examples/shared/store";
import { isBond } from "../../market/classes";
import { useMarket, useQuotes } from "../../market/react";
import type { Instrument } from "../../market/types";
import { DEFAULT_LISTS, listName, useList } from "../../model/lists";
import { useServices } from "../../services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/atoms/select";
import { Empty } from "../../ui/molecules/Empty";
import { openFollowing } from "../../workspace/actions";
import { chart } from "../chart";
import { listMove, scrollRowIntoView } from "../keys";
import { quote } from "../quote";
import { Row } from "./Row";
import { LIST_ORDER, nextSort, parseSort, sortRows, type Sort, type SortBy } from "./sort";

/** The kept cursor: a symbol, or none. */
const parseCursor = (v: unknown): string | null | undefined => (v === null ? null : text(v));

const COLUMNS: { by: SortBy; label: string; className: string }[] = [
  { by: "symbol", label: "Instrument", className: "c-name" },
  { by: "last", label: "Last", className: "c-num" },
  { by: "changePct", label: "Change", className: "c-num" },
  { by: "volume", label: "Volume", className: "c-num c-vol" },
];

const sectorOf = (inst: Instrument | undefined) =>
  inst?.assetClass === "equity" ? inst.sector : undefined;

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
  // Only what this market has: a kept list is checked (model/lists.ts), and a live feed may be missing.
  const instruments = useMemo(
    () => (list?.symbols ?? []).flatMap((s) => market.instrument(s) ?? []),
    [list, market],
  );
  const symbols = useMemo(() => instruments.map((i) => i.symbol), [instruments]);
  const quotes = useQuotes(symbols, paused);
  const [sort, setSort] = usePaneState<Sort>("sort", LIST_ORDER, { parse: parseSort });
  const [kept, setCursor] = usePaneState<string | null>("cursor", null, { parse: parseCursor });
  // The cursor is on the instrument Jali has selected: it starts this list on what its following quote shows
  // (`selects`), and moves it with that quote when a layout (a desk, a link, Back) gives it another.
  const selected = useJaliState((s) => s.selection[node.id]?.ref);
  const cursor = selected?.kind === "quote" ? String(selected.params.symbol) : kept;
  const listRef = useRef<HTMLDivElement>(null);

  // Sorted by what the person chose; the cursor stays on the same instrument, not the same position.
  const rows = useMemo(
    () =>
      sortRows(
        instruments.map((inst) => ({ inst, q: quotes.get(inst.symbol) })),
        sort,
      ),
    [instruments, quotes, sort],
  );
  const at = rows.findIndex((r) => r.inst.symbol === cursor);
  const current = rows[at]?.inst;

  // Tell Jali what is selected: its following quote, chart, book, trades and news show it (panes/instrument.tsx).
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

  const onKeyDown = (e: KeyboardEvent) => {
    const to = rows[listMove(e, at < 0 ? -1 : at, rows.length) ?? -1];
    const plain = !e.metaKey && !e.ctrlKey;
    if (to) moveTo(to.inst.symbol);
    else if (e.key === "Enter" && plain && current) openChart(current.symbol);
    else if (e.key === " " && current) peek(quote({ symbol: current.symbol }));
    else if ((e.key === "Delete" || e.key === "Backspace") && plain && current)
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
      run: () => setSort(LIST_ORDER),
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

  const bySector = sort.by === "list" && list?.bySector;
  // A list of bonds is read in yields.
  const yields = rows.length > 0 && rows.every((r) => isBond(r.inst));
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
              onClick={() => setSort((s) => nextSort(s, c.by))}
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
          {rows.map((r, i) => {
            const sector = bySector ? sectorOf(r.inst) : undefined;
            return (
              <Row
                key={r.inst.symbol}
                id={`${node.id}-${r.inst.symbol}`}
                inst={r.inst}
                q={r.q}
                selected={i === at}
                focused={focused}
                paused={paused}
                group={sector !== sectorOf(rows[i - 1]?.inst) ? sector : undefined}
                // A second tap on the selected row opens its chart: on a phone there is no Enter or double-click.
                onSelect={() => (i === at ? openChart(r.inst.symbol) : moveTo(r.inst.symbol))}
                onOpen={() => openChart(r.inst.symbol)}
              />
            );
          })}
        </div>
      ) : (
        <Empty title="This list is empty">Add an instrument with ⌘K, "Add to watchlist".</Empty>
      )}
    </div>
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
