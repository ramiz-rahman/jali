/**
 * The workspace: the pane kinds, the desks (presets), the launcher, and the app's own commands in ⌘K.
 * `createMarketsJali` takes the app's services and Jali's usual options, so a test can give it a memory address,
 * memory storage and a fixed size (workspace.test.ts).
 */
import { createJali, type Command, type Jali, type JaliOptions } from "@jali/core";
import { makerCommand } from "#shared/maker/maker";
import { prepareTicket, show, showBlotter } from "./actions";
import { listName } from "./lists";
import type { AssetClass } from "./market/types";
import { blotter } from "./panes/blotter";
import { book } from "./panes/book";
import { chart } from "./panes/chart";
import { curve } from "./panes/curve";
import { launcher } from "./panes/launcher";
import { news } from "./panes/news";
import { quote } from "./panes/quote";
import { tape } from "./panes/tape";
import { watchlist } from "./panes/watchlist";
import { presets } from "./presets";
import type { Services } from "./services";

export const kinds = [watchlist, chart, quote, book, tape, news, curve, blotter];

type Options = Pick<JaliOptions, "url" | "storage" | "size" | "moveFocus" | "preset"> & {
  /** A short message for the person ("LMNA added to Core"). */
  notify?: (text: string) => void;
};

const TRADABLE: AssetClass[] = ["equity", "govt", "corp", "fx", "crypto"];
/** How the chooser names an instrument's class, beside its name. */
const ASSET_CLASS: Record<AssetClass, string> = {
  equity: "Equity",
  govt: "Government",
  corp: "Corporate",
  fx: "FX",
  index: "Index",
  crypto: "Crypto, live",
};
const BOOKED: AssetClass[] = TRADABLE;

export function createMarketsJali(services: Services, options: Options = {}): Jali {
  const { notify = () => {}, ...jaliOptions } = options;
  const { market, lists, desks } = services;
  /** Ask for an instrument in Jali's chooser (type a symbol or a name), then `onPick` its symbol. */
  const pick = (jali: Jali, title: string, onPick: (symbol: string) => void, only?: AssetClass[]) =>
    jali.actions.choose({
      title,
      items: market.instruments.filter((i) => !only || only.includes(i.assetClass)),
      label: (i) => i.symbol,
      hint: (i) => `${i.name} · ${ASSET_CLASS[i.assetClass]}`,
      placeholder: "Symbol or name",
      onChoose: (i) => onPick(i.symbol),
    });

  /** The watchlist "Add to watchlist" adds to: the focused one, else the first on screen, else Core. */
  const targetList = (jali: Jali) => {
    const focused = jali.get().view.focused;
    const panes = jali.model().panes.filter((p) => p.ref.kind === watchlist.kind);
    const pane = panes.find((p) => p.id === focused) ?? panes[0];
    return String(pane?.ref.params.list ?? "core");
  };

  // ⌘K lists these after Jali's own, under the app's groups. "…" ones ask for an instrument first.
  const commands: Command[] = [
    {
      id: "markets.chart",
      title: "Open chart for…",
      group: "Markets",
      run: (jali) => pick(jali, "Open chart for…", (symbol) => show(jali, chart({ symbol }))),
    },
    {
      id: "markets.quote",
      title: "Open quote for…",
      group: "Markets",
      run: (jali) => pick(jali, "Open quote for…", (symbol) => show(jali, quote({ symbol }))),
    },
    {
      id: "markets.book",
      title: "Open order book for…",
      group: "Markets",
      run: (jali) =>
        pick(jali, "Open order book for…", (symbol) => show(jali, book({ symbol })), BOOKED),
    },
    {
      id: "markets.tape",
      title: "Open time and sales for…",
      group: "Markets",
      run: (jali) =>
        pick(jali, "Open time and sales for…", (symbol) => show(jali, tape({ symbol })), BOOKED),
    },
    {
      id: "markets.news",
      title: "Open news for…",
      group: "Markets",
      run: (jali) => pick(jali, "Open news for…", (symbol) => show(jali, news({ symbol }))),
    },
    {
      id: "markets.watch",
      title: "Add to watchlist…",
      group: "Markets",
      run: (jali) => {
        const list = targetList(jali);
        pick(jali, `Add to ${listName(list)}…`, (symbol) =>
          notify(
            lists.add(list, symbol)
              ? `${symbol} added to ${listName(list)}`
              : `${symbol} is already in ${listName(list)}`,
          ),
        );
      },
    },
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
    {
      id: "markets.buy",
      title: "Buy…",
      group: "Trading",
      run: (jali) =>
        pick(jali, "Buy…", (symbol) => prepareTicket(jali, services, symbol, "buy"), TRADABLE),
    },
    {
      id: "markets.sell",
      title: "Sell…",
      group: "Trading",
      run: (jali) =>
        pick(jali, "Sell…", (symbol) => prepareTicket(jali, services, symbol, "sell"), TRADABLE),
    },
    {
      id: "markets.blotter",
      title: "Open the blotter and ticket",
      group: "Trading",
      run: (jali) => showBlotter(jali),
    },
    {
      id: "markets.theme",
      title: "Switch between light and dark",
      group: "Settings",
      run: (jali) => {
        const { theme } = jali.get().settings;
        const systemDark = !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
        const dark = theme === "dark" || (theme === "system" && systemDark);
        jali.actions.changeSettings({ theme: dark ? "light" : "dark" });
      },
    },
  ];

  const jali = createJali({
    panes: kinds,
    launcher,
    // Each desk comes back as the person left it; Reset in the top bar puts them back.
    presets: presets.map((p) => ({ ...p, saved: () => desks.get(p.id) })),
    commands: [...commands, makerCommand],
    name: "Markets",
    // Bound like Jali's own commands; ⌘K then ⌘O, and so on.
    keymap: { "markets.chart": "Mod+K Mod+O", "markets.blotter": "Mod+K Mod+B" },
    storage: "markets",
    // Dark first: until the person picks a theme, a terminal is dark. (Jali's own default follows the system.)
    settings: { theme: "dark" },
    // On a portrait phone: the watchlist above the chart it opened, rather than one at a time.
    phone: { stack: true },
    ...jaliOptions,
  });
  desks.track(jali);
  return jali;
}
