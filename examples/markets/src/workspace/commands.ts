/**
 * The app's own commands in ⌘K, after Jali's own and under the app's groups. The "…" ones ask for an instrument
 * first, in Jali's chooser (type a symbol or a name).
 */
import type { Command, Jali, ObjectRef } from "jali";
import { makerCommand } from "@jali-examples/shared/maker/maker";
import { themeCommand } from "@jali-examples/shared/theme";
import { facts, tradable } from "../market/classes";
import type { Instrument, Side } from "../market/types";
import { listName } from "../model/lists";
import type { Services } from "../services";
import { book } from "../panes/book";
import { chart } from "../panes/chart";
import { curve } from "../panes/curve";
import { news } from "../panes/news";
import { quote } from "../panes/quote";
import { tape } from "../panes/tape";
import { SIDE } from "../ui/format";
import { prepareTicket, show, showBlotter, watchlistFor } from "./actions";

/** "Open … for…": a view of one instrument. A book and a tape are only for what trades. */
const OPENERS: {
  id: string;
  view: string;
  make: (p: { symbol: string }) => ObjectRef;
  tradableOnly?: true;
}[] = [
  { id: "markets.chart", view: "chart", make: chart },
  { id: "markets.quote", view: "quote", make: quote },
  { id: "markets.book", view: "order book", make: book, tradableOnly: true },
  { id: "markets.tape", view: "time and sales", make: tape, tradableOnly: true },
  { id: "markets.news", view: "news", make: news },
];

const SIDES: Side[] = ["buy", "sell"];

export function marketsCommands(
  { market, lists, ticket }: Pick<Services, "market" | "lists" | "ticket">,
  notify: (text: string) => void,
): Command[] {
  /** Ask for an instrument, then `onPick` its symbol. */
  const pick = (
    jali: Jali,
    title: string,
    onPick: (symbol: string) => void,
    among = market.instruments,
  ) =>
    jali.dialogs.choose<Instrument>({
      title,
      items: [...among],
      label: (i) => i.symbol,
      hint: (i) => `${i.name} · ${facts(i).label}${i.source ? ", live" : ""}`,
      placeholder: "Symbol or name",
      onChoose: (i) => onPick(i.symbol),
    });

  const addToWatchlist = (jali: Jali) => {
    const list = watchlistFor(jali);
    pick(jali, `Add to ${listName(list)}…`, (symbol) =>
      notify(
        lists.add(list, symbol)
          ? `${symbol} added to ${listName(list)}`
          : `${symbol} is already in ${listName(list)}`,
      ),
    );
  };

  return [
    ...OPENERS.map(({ id, view, make, tradableOnly }) => ({
      id,
      title: `Open ${view} for…`,
      group: "Markets",
      run: (jali: Jali) =>
        pick(
          jali,
          `Open ${view} for…`,
          (symbol) => show(jali, make({ symbol })),
          tradableOnly ? tradable(market.instruments) : undefined,
        ),
    })),
    { id: "markets.watch", title: "Add to watchlist…", group: "Markets", run: addToWatchlist },
    {
      id: "markets.market-news",
      title: "Open market news",
      group: "Markets",
      run: (jali) => show(jali, news()),
    },
    {
      id: "markets.curve",
      title: "Open the yield curve",
      group: "Markets",
      run: (jali) => show(jali, curve()),
    },
    ...SIDES.map((side) => ({
      id: `markets.${side}`,
      title: `${SIDE[side].verb}…`,
      group: "Trading",
      run: (jali: Jali) =>
        pick(
          jali,
          `${SIDE[side].verb}…`,
          (symbol) => prepareTicket(jali, ticket, { symbol, side }),
          tradable(market.instruments),
        ),
    })),
    {
      id: "markets.blotter",
      title: "Open the blotter and ticket",
      group: "Trading",
      run: (jali) => showBlotter(jali),
    },
    themeCommand("markets.theme"),
    makerCommand,
  ];
}
