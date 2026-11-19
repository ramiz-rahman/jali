/**
 * The desks: four layouts to start from, in ⌘K as "Layout: …" and in the top bar.
 *
 * Each desk has one watchlist (id "watch"). A pane with `linkedTo: "watch", follows: true` shows whatever the
 * watchlist's cursor is on; `pinned: true` keeps its instrument, for comparing. The blotter opens from any Buy or
 * Sell (or ⌘K ⌘B); the FX desk keeps it on screen. A pane with the same id in two desks keeps its state across a
 * switch, so a half-written ticket comes along from one desk with a blotter to another.
 */
import { column, pane, row, type PresetOptions } from "@jali/core";
import { blotter } from "./panes/blotter";
import { book } from "./panes/book";
import { chart } from "./panes/chart";
import { curve } from "./panes/curve";
import { news } from "./panes/news";
import { quote } from "./panes/quote";
import { tape } from "./panes/tape";
import { watchlist } from "./panes/watchlist";

const follows = { linkedTo: "watch", follows: true } as const;

export const presets: PresetOptions[] = [
  {
    id: "equities",
    label: "Equities desk",
    layout: row(
      pane(watchlist({ list: "equities" }), { id: "watch", weight: 0.9 }),
      column(
        { weight: 1.7 },
        pane(chart({ symbol: "LMNA" }), { id: "chart", ...follows, weight: 1.5 }),
        row(
          pane(book({ symbol: "LMNA" }), { id: "book", ...follows }),
          pane(tape({ symbol: "LMNA" }), { id: "tape", ...follows }),
        ),
      ),
      // Quote and news: narrow enough that a second chart, opened to compare, still has room at 1440.
      column(
        pane(quote({ symbol: "LMNA" }), { id: "quote", ...follows }),
        pane(news({ symbol: "LMNA" }), { id: "news", ...follows }),
      ),
    ),
  },
  {
    id: "rates",
    label: "Rates desk",
    layout: row(
      pane(watchlist({ list: "rates" }), { id: "watch", weight: 0.9 }),
      column(
        { weight: 1.5 },
        pane(curve(), { id: "curve", weight: 1.1 }),
        pane(chart({ symbol: "GOV10Y" }), { id: "chart", ...follows }),
      ),
      column(
        pane(quote({ symbol: "GOV10Y" }), { id: "quote", ...follows }),
        pane(news(), { id: "news" }),
      ),
    ),
  },
  {
    id: "fx",
    label: "FX desk",
    layout: row(
      pane(watchlist({ list: "fx" }), { id: "watch", weight: 0.9 }),
      column(
        { weight: 1.7 },
        pane(chart({ symbol: "EURUSD" }), { id: "chart", ...follows, weight: 1.5 }),
        row(
          pane(book({ symbol: "EURUSD" }), { id: "book", ...follows }),
          pane(tape({ symbol: "EURUSD" }), { id: "tape", ...follows }),
        ),
      ),
      column(
        pane(quote({ symbol: "EURUSD" }), { id: "quote", ...follows }),
        pane(blotter(), { id: "blotter", weight: 1.3 }),
      ),
    ),
  },
  {
    // Two instruments side by side: the top row is pinned to one; the bottom row follows the watchlist.
    id: "compare",
    label: "Compare",
    layout: row(
      pane(watchlist({ list: "core" }), { id: "watch", weight: 0.8 }),
      column(
        { weight: 2.4 },
        row(
          pane(chart({ symbol: "LMNA" }), {
            id: "chart-a",
            linkedTo: "watch",
            pinned: true,
            weight: 1.8,
          }),
          pane(quote({ symbol: "LMNA" }), { id: "quote-a", linkedTo: "watch", pinned: true }),
        ),
        row(
          pane(chart({ symbol: "ORBD" }), { id: "chart", ...follows, weight: 1.8 }),
          pane(quote({ symbol: "ORBD" }), { id: "quote", ...follows }),
        ),
      ),
    ),
  },
];
