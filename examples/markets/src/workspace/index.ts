/**
 * The workspace: the pane kinds, the desks (presets.ts), the launcher, the app's own commands in ⌘K (commands.ts),
 * and its question before an unsent order is lost (unsent.ts). `createMarketsJali` takes the app's services and
 * Jali's usual options, so a test can give it a memory address, memory storage and a fixed size (workspace.test.ts).
 */
import { createJali, type CloseRequest, type Jali, type JaliOptions } from "jali-layout";
import { defaultFeatures } from "jali-layout/features";
import { blotter } from "../panes/blotter";
import { book } from "../panes/book";
import { chart } from "../panes/chart";
import { curve } from "../panes/curve";
import { launcher } from "../panes/launcher";
import { news } from "../panes/news";
import { quote } from "../panes/quote";
import { tape } from "../panes/tape";
import { watchlist } from "../panes/watchlist";
import type { Services } from "../services";
import { marketsCommands } from "./commands";
import { desks } from "./presets";
import { unsentQuestion, type Ask } from "./unsent";

export const kinds = [watchlist, chart, quote, book, tape, news, curve, blotter];

type Options = Pick<
  JaliOptions,
  "features" | "storage" | "size" | "moveFocus" | "preset" | "keyboard"
> & {
  /** A short message for the person ("LMNA added to Core"). */
  notify?: (text: string) => void;
  /** Ask the person whether to let unsent work go (main.tsx: the app's dialog, shell/Question.tsx). Default: it
   *  goes, as in a test that doesn't ask. */
  ask?: Ask;
};

export function createMarketsJali(services: Services, options: Options = {}): Jali {
  const { notify = () => {}, ask = () => true, ...jaliOptions } = options;
  const { savedLayouts } = services;

  const jali = createJali({
    panes: kinds,
    launcher,
    // Each desk comes back as the person left it; Reset in the top bar puts them back.
    presets: desks.map(({ tab: _tab, ...preset }) => ({
      ...preset,
      saved: () => savedLayouts.get(preset.id),
    })),
    commands: marketsCommands(services, notify),
    name: "Markets",
    storage: "markets",
    // Markets asks about an unsent order itself, naming it (unsent.ts); Jali only marks the pane.
    confirmDiscard: false,
    beforeClose: (request) => askBeforeLosing(request),
    // Dark first: until the person picks a theme, a terminal is dark. (Jali's own default follows the system.)
    settings: { theme: "dark" },
    // On a portrait phone: the watchlist above the chart it opened, rather than one at a time.
    phone: { stack: true },
    ...jaliOptions,
    keyboard: {
      ...jaliOptions.keyboard,
      // Bound like Jali's own commands; ⌘K then ⌘O, and so on.
      keymap: { "markets.chart": "Mod+K Mod+O", "markets.blotter": "Mod+K Mod+B" },
    },
    // Jali's usual features; a test's own (its address in memory) take their places.
    features: [...defaultFeatures(), ...(jaliOptions.features ?? [])],
  });
  savedLayouts.track(jali);

  /** A change that takes away a pane with unsent work (the blotter's ticket) asks first; anything else just happens. */
  function askBeforeLosing({ panes, reason }: CloseRequest): boolean | Promise<boolean> {
    const unsaved = jali.get().unsaved;
    const question = unsentQuestion(
      panes.flatMap(({ pane }) => unsaved[pane] ?? []),
      reason,
    );
    return question ? ask(question) : true;
  }
  return jali;
}
