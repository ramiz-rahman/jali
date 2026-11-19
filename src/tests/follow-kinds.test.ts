/**
 * One selection drives followers of every kind (docs/DECISIONS.md, 19 Nov 2026, "From building examples/markets"):
 * a watchlist that selects a quote moves its following quote, and its following chart and news through their kinds'
 * `follow`. A follower whose kind has no `follow` keeps what it shows, as before.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, optional, pane, row, column } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { FOLLOW_MS } from "../../packages/core/src/actions/follow";
import { geometryOf } from "../../packages/core/src/state/apply";

const Nothing = () => null;
const watchlist = definePane("watchlist", { title: "Watchlist", Component: Nothing });
const quote = definePane("quote", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} quote`,
  width: { min: 240 },
  Component: Nothing,
});
const chart = definePane("chart", {
  params: { symbol: String },
  title: ({ symbol }) => `${symbol} chart`,
  width: { min: 240 },
  follow: (selected) => ({ symbol: selected.params.symbol }),
  Component: Nothing,
});
const news = definePane("news", {
  params: { symbol: optional(String) },
  title: ({ symbol }) => (symbol ? `${symbol} news` : "Market news"),
  width: { min: 240 },
  follow: (selected) => ({ symbol: selected.params.symbol }),
  Component: Nothing,
});
// No `follow`: a note linked to the list keeps what it shows.
const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 240 },
  Component: Nothing,
});

const follows = { linkedTo: "watch", follows: true } as const;
const make = (layout = defaultLayout()) =>
  createJali({
    panes: [watchlist, quote, chart, news, note],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
    onUnstable: (op) => breaches.push(op),
  });
const defaultLayout = () =>
  row(
    pane(watchlist(), { id: "watch" }),
    column(
      pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows }),
      pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows }),
    ),
    column(
      pane(news({ symbol: "LMNA" }), { id: "news", ...follows }),
      pane(note({ id: 1 }), { id: "note", ...follows }),
    ),
  );

let breaches: string[];
beforeEach(() => {
  vi.useFakeTimers();
  breaches = [];
});
afterEach(() => vi.useRealTimers());

const shown = (jali: ReturnType<typeof make>, id: string) => jali.model().pane(id)?.ref;

describe("one selection, followers of every kind", () => {
  it("moves every follower that can show it, together, once the selection rests, in place", () => {
    const jali = make();
    const before = geometryOf(jali.model());
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e.layout));
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(FOLLOW_MS - 1);
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "LMNA" }));
    vi.advanceTimersByTime(1);
    expect(shown(jali, "quote")).toEqual(quote({ symbol: "HRBK" }));
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "HRBK" }));
    expect(shown(jali, "news")).toEqual(news({ symbol: "HRBK" }));
    // A kind without `follow` keeps what it shows.
    expect(shown(jali, "note")).toEqual(note({ id: 1 }));
    // One change: one layout event, and nothing moved on screen.
    expect(layouts).toHaveLength(1);
    expect(geometryOf(jali.model())).toBe(before);
    expect(breaches).toEqual([]);
    // Said once, with the title of the follower of the selected kind.
    expect(storeOf(jali).get().announcement.text).toBe("Showing HRBK quote");
  });

  it("moves followers of other kinds when no follower shows the selected kind", () => {
    const jali = make(
      row(
        pane(watchlist(), { id: "watch" }),
        pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows }),
      ),
    );
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
    expect(storeOf(jali).get().announcement.text).toBe("Showing ORBD chart");
  });

  it("keeps a follower whose kind can't read what `follow` gives", () => {
    const jali = make();
    // A selection with no symbol: the chart's `follow` gives no symbol, which the chart requires.
    jali.actions.select("watch", note({ id: 4 }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "LMNA" }));
    // News's symbol is optional, so it shows the market's news; the note follows its own kind.
    expect(shown(jali, "news")).toEqual(news());
    expect(shown(jali, "note")).toEqual(note({ id: 4 }));
  });

  it("a pinned follower keeps its object, and unpinning catches only it up", () => {
    const jali = make();
    jali.actions.setPinned("chart", true);
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "LMNA" }));
    expect(shown(jali, "news")).toEqual(news({ symbol: "ORBD" }));
    jali.actions.setPinned("chart", false);
    expect(shown(jali, "chart")).toEqual(chart({ symbol: "ORBD" }));
    expect(jali.model().pane("chart")).toMatchObject({ follows: true });
  });

  it("opening a chart for the selected quote is opening the selection: it follows, or pins to compare", () => {
    const jali = make(
      row(
        pane(watchlist(), { id: "watch" }),
        pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows }),
      ),
    );
    jali.actions.select("watch", quote({ symbol: "ORBD" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    const opened = jali.actions.openBeside("watch", chart({ symbol: "ORBD" }));
    expect(jali.model().pane(opened.pane!)).toMatchObject({ linkedTo: "watch", follows: true });
    jali.actions.select("watch", quote({ symbol: "HRBK" }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, opened.pane!)).toEqual(chart({ symbol: "HRBK" }));
    // Opening the chart it already shows pins it, as for a follower of the selected kind.
    jali.actions.openBeside("watch", chart({ symbol: "HRBK" }));
    expect(jali.model().pane(opened.pane!)).toMatchObject({ pinned: true });
    // A chart of something else is a plain link, not the selection.
    const other = jali.actions.openBeside("watch", chart({ symbol: "KSTR" }));
    expect(jali.model().pane(other.pane!)?.follows).toBeUndefined();
  });

  it("leaves the single-kind case as it was: a list of orders and its following order", () => {
    const orders = definePane("orders", { title: "Orders", Component: Nothing });
    const order = definePane("order", {
      params: { id: Number },
      title: ({ id }) => `Order ${id}`,
      Component: Nothing,
    });
    const jali = createJali({
      panes: [orders, order],
      layout: row(
        pane(orders(), { id: "orders" }),
        pane(order({ id: 1 }), { id: "order", linkedTo: "orders", follows: true }),
      ),
      url: false,
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    jali.actions.select("orders", order({ id: 2 }));
    vi.advanceTimersByTime(FOLLOW_MS);
    expect(shown(jali, "order")).toEqual(order({ id: 2 }));
    expect(storeOf(jali).get().announcement.text).toBe("Showing Order 2");
  });
});
