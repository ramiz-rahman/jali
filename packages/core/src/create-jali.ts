import type { WorkspaceAllow } from "./actions/allow";
import type { PhoneOptions } from "./profile";
/**
 * `createJali`: one call from pane kinds and a layout to an instance that is ready to render.
 *
 *   const jali = createJali({
 *     panes: [orders, order, customer],
 *     layout: row(orders(), order({ id: 1 })),
 *   });
 *
 * The instance reads its address, fits its first layout and is ready before the first render. `<JaliRoot>` (or
 * `jali.start()` without React) starts its keys, Back and Forward, theme and saving.
 */
import type { TabMenu } from "./commands/tab-menu";
import { boot } from "./boot";
import type { KeyboardOptions } from "./commands/keymap";
import type { Command } from "./commands/registry";
import { toLayout, type LayoutInput } from "./layout/build";
import type { Direction } from "./layout/types";
import {
  createPaneKinds,
  type PaneErrorInfo,
  type PaneKindBase,
  type PaneKinds,
  type RefOf,
} from "./pane-kinds";
import { browserStorage, memoryStorage, type StoragePort } from "./ports";
import type { Preset, ProfileBase } from "./profile";
import type { BeforeClose } from "./state/apply";
import type { Jali, PageOf } from "./state/instance";
import type { LinkMode } from "./actions/public";
import { createJaliStore, type JaliConfig, type UrlWriter } from "./state/store";
import type { Feature } from "./features/feature";
import { warnUnknown } from "./dev-options";
import type { MessageOverrides } from "./state/messages";
import type { Settings } from "./state/settings";

/** A layout the person can switch to from ⌘K ("Layout: Triage"), and "Reset layout" rebuilds. */
export interface PresetOptions {
  id: string;
  label: string;
  /** The layout, or a function that builds it each time it is chosen. */
  layout: LayoutInput | (() => LayoutInput);
  /**
   * The layout the person left this preset in, if the app kept one (from `getLayout()`, or `on("layout")`).
   * Choosing the preset, from a button, ⌘K or a key, shows it instead of `layout`, so each preset comes back as it
   * was arranged. "Reset layout" (`resetLayout`) builds `layout`. A saved layout that names a kind this instance
   * no longer has is ignored.
   */
  saved?: () => LayoutInput | undefined;
}

export interface JaliOptions<
  D extends PaneKindBase = PaneKindBase,
  L extends PaneKindBase = D,
  P extends ProfileBase<any, any> | null | undefined = ProfileBase | null | undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
> {
  /** The kinds of pane this instance can show. */
  panes: readonly D[] | PaneKinds<D>;
  /** The layout it opens on. Give this or `presets`. */
  layout?: LayoutInput;
  /** Layouts to start from, in menu order. The first is the one it opens on, unless `preset` names another. */
  presets?: readonly PresetOptions[];
  /** The preset it opens on. Default: the first. */
  preset?: string;
  /** What Split and "New tab here" open until the person chooses what to show. Without one there is no Split. */
  launcher?: L;
  /** A curated page this instance can show (one item, with its views as tabs): `jali.page` then has its actions. */
  page?: P;
  /** What following a link on the curated page does at first: `"open"` (the default) opens a pane beside the views,
   *  `"peek"` only peeks, in Single view, for a viewer who may look but not rearrange. `jali.page.setLinkMode` changes
   *  it later. */
  linkMode?: LinkMode;
  /** The app's name for the free layout (where the person arranges panes), in commands such as "Open Data Studio"
   *  on a curated page. Default: none, and the command says "Leave Loan review" instead. */
  name?: string;
  /**
   * What the instance does beyond laying out panes, each a value from its own module, so an app ships only what it
   * uses: `[urlSync(), palette(), settings(), chooser(), rename({ run })]`, or `defaultFeatures()` from
   * `jali/features` for all of Jali's usual ones at once. Default: none (no address, no palette, no Settings).
   */
  features?: readonly Feature[];
  /** A writer of your own for the address (a router's), in place of `urlSync()`: it writes, and Jali reads nothing
   *  back. Most apps give `urlSync({ location })` instead. */
  url?: UrlWriter;
  /** What a person keeps on this device (settings, pane state, sizes): localStorage under this prefix, or a port.
   *  Default: the instance's `id` ("jali") in a browser, so two instances never overwrite each other; memory
   *  elsewhere. */
  storage?: string | StoragePort;
  /** Prefix for DOM ids. Give each instance on one page its own. Default "jali". */
  id?: string;
  /** Set the page's theme (`data-theme` on `<html>`) from the person's setting. Default true; false when the
   *  instance sits inside a page that has its own theme. */
  pageTheme?: boolean;
  /** Your own commands: listed in ⌘K after Jali's, and bindable in `keymap` like Jali's
   *  (`{ id: "app.refresh", title: "Refresh data", group: "App", run: () => refetch() }`). A Jali id wins. */
  commands?: readonly Command[];
  /**
   * Jali's keys: which it takes, what they are bound to, and which the app keeps.
   *
   *  - `scope`: `"page"` (default) takes every key on the page; `"local"` only keys from inside this Jali (and keys
   *    on the page's body while it was the last one used), for two on one page or Jali inside a larger app.
   *  - `keymap`: rebind or unbind commands, `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`.
   *  - `prefix`: the first step of Jali's two-step keys, and its palette's key. Default "Mod+K". Move it when the app
   *    owns ⌘K: `"Mod+J"` makes "Restore last closed pane" ⌘J ⌘Z.
   *  - `reserved`: keys the app uses for itself (`["Mod+K", "Mod+/"]`). Jali drops any binding of its own that is one
   *    of them, or starts with one, and reports it to `onInvalid`.
   *  - `platform`, `onInvalid`, `words`: the keymap's platform, how a refused binding is reported (default:
   *    `console.warn`), and the words printed keys use.
   */
  keyboard?: KeyboardOptions;
  /** The reading direction. Default: the page's (the computed `direction` where the instance is rendered, so
   *  `<html dir="rtl">` is enough), followed when it changes. Give one to fix it: `<JaliRoot>` then sets `dir` on its
   *  elements, so the styles agree. Right to left, a row starts at the right; the layout and its links are the same. */
  dir?: Direction;
  /**
   * What the panes are to assistive technology. Default `"region"`: a `<section>` labelled "Panes", which sits inside
   * your page's own `<main>`. `"main"` renders the page's `<main>` instead: use it when Jali is the whole app and your
   * page has no `<main>` of its own (a page should have one).
   */
  landmark?: "region" | "main";
  /**
   * The instance's name for assistive technology, when a page has more than one instance: its landmark is named
   * this instead of "Panes", and each of Jali's landmarks inside it adds it ("Orders, Sales"), so no two instances
   * repeat a landmark. Default: none, and the names are Jali's own.
   */
  label?: string;
  /**
   * The gap between panes, in CSS pixels. Default 6 (`GAP`). The layout measures with it, and `<JaliRoot>` writes it
   * on its root as `--jali-gap`, so styles that read the variable agree with where the panes are.
   */
  gap?: number;
  /** The space between the instance's edges and its panes, in CSS pixels. Default: the gap. Written as
   *  `--jali-inset`. */
  inset?: number;
  /** A fixed size instead of the window's (tests, server rendering). */
  size?: { width: number; height: number };
  /** `false` leaves DOM focus alone (tests, an instance that is never shown). Default true. */
  moveFocus?: boolean;
  /** Called when an action that never moves anything (choosing, moving or pinning a tab, revealing or keeping a
   *  pane) moved panes: a bug. Default: reported in development. */
  onUnstable?: (op: string, before: string, after: string) => void;
  /**
   * Asked before a change removes panes or makes them show another object: a close, close others, a preset,
   * `setLayout`, Back and Forward, a pane showing something else. `true` lets it happen, `false` keeps the panes; a
   * promise holds the change until it answers (the action returns `reason: "pending"`). Jali's own "Discard unsaved
   * changes?" comes after a yes, when a pane still reports unsaved work (`useUnsaved`).
   */
  beforeClose?: BeforeClose;
  /**
   * `false`: the app asks about unsaved work itself, usually from `beforeClose`. Panes still report it with
   * `useUnsaved` and show the unsaved mark, but Jali never asks "Discard unsaved changes?" and doesn't hold the page's
   * unload. Default true.
   */
  confirmDiscard?: boolean;
  /**
   * Your items for a tab's menu (right-click, Shift+F10 or the menu key on a tab), after Jali's own (close, move,
   * split, maximise). Called as the menu opens, with the tab's pane; return `undefined` or `[]` for none.
   * `(pane) => [{ id: "duplicate", title: "Duplicate", run: () => duplicate(pane.ref) }]`.
   */
  tabMenu?: TabMenu;
  /**
   * Phones: below `phone.below` pixels of instance width (default 600), the instance shows one pane at a time,
   * with a switcher, whatever the panes' minimums. Its layout, address and history don't change; widen it and the
   * arrangement comes back. `{ below: 0 }` switches only when even one pane can't fit.
   */
  phone?: PhoneOptions;
  /**
   * What may happen to panes, beside each kind's own `allow`: turn controls off (`{ fullScreen: false }`), turn Pop out
   * off (`{ popOut: false }`, with the `popOut()` feature), and `when` for rules that depend on the layout: `when: ({ action, presetId }) =>
   * !(presetId === "review" && action === "close")`. The actions obey it, whatever asks (a button, a key, ⌘K, a drag,
   * an agent), and the chrome draws only what is allowed. Default: everything (Pop out with its feature).
   */
  allow?: WorkspaceAllow;
  /**
   * The buttons in a pane's header, as shortcuts: everything allowed is in the pane's menu (right-click, ⋯ or
   * Shift+F10) and ⌘K either way. Leave it out for Jali's: Tuck, Maximise, Pop out (where allowed) and Close, with Full screen in Maximise's
   * place on a lone pane. A list replaces them (`["maximise", "close"]`); a function adjusts them
   * (`(defaults) => defaults.filter((b) => b !== "tuck")`). A kind's own `buttons` win over these. `allow` still filters them, and
   * Restore and Exit full screen always show while a pane is maximised or full screen.
   */
  buttons?: import("./pane/buttons").PaneButtons;
  /** Settings for a person who has none saved on this device yet: `{ theme: "dark" }` for a dark-first app. Settings
   *  the person changes are saved and win from then on. Default: Jali's (`theme: "system"`, `paneCap: 8`, ...). */
  settings?: Partial<Settings>;
  /** Jali's words in your language, or your own wording: any keys of `Messages`, by area. The rest stay English
   *  (`en`). `{ commands: { close: "Fermer le volet" }, palette: { placeholder: "Rechercher…" } }`. */
  messages?: MessageOverrides;
  /** Called when a pane's component throws. The pane shows a failed state with Retry and Close; the other panes
   *  carry on. `pane` is the pane's id (null in the peek sheet), `ref` what it was showing. Default: `console.error`
   *  in development. */
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void;
}

const inBrowser = typeof window !== "undefined";
declare const process: { env: { NODE_ENV?: string } };

const presetOf = ({ id, label, layout, saved }: PresetOptions): Preset => ({
  id,
  label,
  ...(saved ? { saved } : {}),
  build: () => toLayout(typeof layout === "function" ? layout() : structuredClone(layout)),
});

/**
 * `JaliOptions` resolved once into the shape the store reads (`JaliConfig`): kinds registered, presets built, the
 * address and storage ports made, and every option that a later step would otherwise check again normalised. Options
 * whose name and meaning are the same in both pass through as they are.
 */
export function resolveOptions(options: JaliOptions): JaliConfig {
  const {
    panes,
    launcher,
    layout,
    presets,
    page,
    url,
    features: given = [],
    size,
    moveFocus = true,
    storage: kept,
    onUnstable,
    beforeClose: _guard,
    linkMode,
    landmark,
    label,
    confirmDiscard,
    pageTheme,
    ...same
  } = options;
  // One of each: a later one of the same id takes the earlier's place.
  const features = given.filter((f, i) => !given.slice(i + 1).some((g) => g.id === f.id));
  const kinds = "register" in panes ? panes : createPaneKinds([...panes]);
  if (launcher) kinds.register({ ...launcher, transient: true });
  const storage =
    typeof kept === "object"
      ? kept
      : inBrowser
        ? browserStorage(kept ?? options.id ?? "jali")
        : memoryStorage();
  return {
    ...same,
    kinds,
    profile: page ?? null,
    presets: presets?.map(presetOf) ?? [],
    ...(launcher ? { launcher: launcher.kind } : {}),
    features,
    url:
      url && typeof url === "object" && "write" in url
        ? url
        : features.find((f) => f.address)?.address?.(storage),
    storage,
    ...(features.some((f) => f.env?.rename)
      ? { rename: features.find((f) => f.env?.rename)!.env!.rename! }
      : {}),
    ...(landmark === "main" ? { landmark } : {}),
    ...(typeof label === "string" && label.trim() ? { label: label.trim() } : {}),
    ...(confirmDiscard === false ? { confirmDiscard } : {}),
    ...(pageTheme === false ? { pageTheme } : {}),
    ...(onUnstable ? { unstable: onUnstable } : {}),
    ...(moveFocus ? {} : { focusPane: null }),
    initial: {
      ...(layout ? { layout: toLayout(layout) } : {}),
      ...(size ? { area: size } : {}),
      ...(linkMode ? { linkMode } : {}),
    },
  };
}

/**
 * An instance from its kinds and a layout. Its type comes from them: `jali.actions` takes refs of these kinds only,
 * events and the model say which kind, and `jali.page` is there only with a page.
 */
export function createJali<
  const D extends PaneKindBase,
  const L extends PaneKindBase = never,
  const P extends ProfileBase<any, any> | null | undefined = undefined, // eslint-disable-line @typescript-eslint/no-explicit-any
>(options: JaliOptions<D, L, P>): Jali<RefOf<D | L>, PageOf<P>> {
  try {
    if (process.env.NODE_ENV !== "production")
      warnUnknown(
        "createJali",
        options,
        (key, value) => key === "url" && !!value && typeof value === "object" && "write" in value,
      );
  } catch {
    /* no `process`: production */
  }
  const store = createJaliStore(resolveOptions(options as JaliOptions));
  boot(store);
  // Only now: putting the first layout in place closes nothing the person had.
  store.guard = options.beforeClose;
  return store.jali as unknown as Jali<RefOf<D | L>, PageOf<P>>;
}
