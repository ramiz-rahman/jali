import type { WorkspaceAllow } from "./actions/allow";
import type { PhoneOptions } from "./profile";
import type { Rename } from "./actions/rename";
/**
 * `createJali`: one call from pane kinds and a layout to a workspace that is ready to render.
 *
 *   const jali = createJali({
 *     panes: [orders, order, customer],
 *     layout: row(orders(), order({ id: 1 })),
 *   });
 *
 * The workspace reads its address, fits its first layout and is ready before the first render. `<JaliRoot>` (or
 * `jali.start()` without React) starts its keys, Back and Forward, theme and saving.
 */
import type { TabMenu } from "./commands/tab-menu";
import { boot } from "./boot";
import type { KeymapOptions, KeymapOverrides, KeyString } from "./commands/keymap";
import type { Command } from "./commands/registry";
import { toLayout, type LayoutInput } from "./layout/build";
import type { Direction } from "./layout/types";
import {
  createPaneKinds,
  type PaneErrorInfo,
  type PaneKindBase,
  type PaneKinds,
} from "./pane-kinds";
import { browserStorage, memoryStorage, type StoragePort } from "./ports";
import type { Preset, ProfileBase } from "./profile";
import type { BeforeClose } from "./state/apply";
import type { Jali } from "./state/instance";
import { createUiStore, type UiStoreDeps, type UrlWriter } from "./state/store";
import { createUrlSync, type UrlSyncOptions } from "./url";
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
   * was arranged. "Reset layout" (`resetLayout`) builds `layout`. A saved layout that names a kind this workspace
   * no longer has is ignored.
   */
  saved?: () => LayoutInput | undefined;
}

export interface JaliOptions<D extends PaneKindBase = PaneKindBase> {
  /** The kinds of pane this workspace can show. */
  panes: readonly D[] | PaneKinds<D>;
  /** The layout it opens on. Give this or `presets`. */
  layout?: LayoutInput;
  /** Layouts to start from, in menu order. The first is the one it opens on, unless `preset` names another. */
  presets?: readonly PresetOptions[];
  /** The preset it opens on. Default: the first. */
  preset?: string;
  /** What Split and "New tab here" open until the person chooses what to show. Without one there is no Split. */
  launcher?: D;
  /** A curated page this workspace can show (one item, with its views as tabs). */
  page?: ProfileBase | null;
  /** The free workspace's name, in commands such as "Open Data Studio". Default "Workspace". */
  name?: string;
  /**
   * The address. `true` (the default in a browser): the layout lives in the address bar, so a link reopens it and
   * Back and Forward step through it. Options configure that (`{ prefix: "b.", sizes: "link", location }`); `false`
   * leaves the address alone.
   */
  url?: boolean | UrlSyncOptions | UrlWriter;
  /** What a person keeps on this device (settings, pane state, sizes): localStorage under this prefix, or a port.
   *  Default: the workspace's `id` ("jali") in a browser, so two workspaces never overwrite each other; memory
   *  elsewhere. */
  storage?: string | StoragePort;
  /** Prefix for DOM ids. Give each workspace on one page its own. Default "jali". */
  id?: string;
  /** `"scoped"`: take only keys from inside this workspace (and keys on the page's body while it was the last one
   *  used), for two on one page. Default `"page"`: every key. Any other value is a development error, and scoped. */
  keys?: "page" | "scoped";
  /** Set the page's theme (`data-theme` on `<html>`) from the person's setting. Default true; false when the
   *  workspace sits inside a page that has its own theme. */
  pageTheme?: boolean;
  /** Your own commands: listed in ⌘K after Jali's, and bindable in `keymap` like Jali's
   *  (`{ id: "app.refresh", title: "Refresh data", group: "App", run: () => refetch() }`). A Jali id wins. */
  commands?: readonly Command[];
  /** Rebind or unbind commands: `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. */
  keymap?: KeymapOverrides;
  /** The first step of Jali's two-step keys, and its palette's key. Default "Mod+K". Move it when the app owns ⌘K:
   *  `"Mod+J"` makes "Restore last closed pane" ⌘J ⌘Z. */
  keyPrefix?: KeyString;
  /** Keys the app uses for itself (`["Mod+K", "Mod+/"]`). Jali drops any binding of its own that is one of them,
   *  or starts with one, and reports it to `keymapOptions.onInvalid`. */
  reservedKeys?: readonly KeyString[];
  /** `false`: the app shows Jali's commands in its own command menu (`useJaliCommands`, `listCommands`). Jali then
   *  renders no palette, and its key is unbound unless `keymap` binds "palette.toggle". Default true. */
  palette?: boolean;
  /** The keymap's platform, and how refused bindings are reported. */
  keymapOptions?: KeymapOptions;
  /** The reading direction. Default: the page's (the computed `direction` where the workspace is rendered, so
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
   * The workspace's name for assistive technology, when a page has more than one workspace: its landmark is named
   * this instead of "Panes", and each of Jali's landmarks inside it adds it ("Orders, Sales"), so no two workspaces
   * repeat a landmark. Default: none, and the names are Jali's own.
   */
  label?: string;
  /**
   * The gap between panes, in CSS pixels. Default 6 (`GAP`). The layout measures with it, and `<JaliRoot>` writes it
   * on its root as `--jali-gap`, so styles that read the variable agree with where the panes are.
   */
  gap?: number;
  /** The space between the workspace's edges and its panes, in CSS pixels. Default: the gap. Written as
   *  `--jali-inset`. */
  inset?: number;
  /** A fixed size instead of the window's (tests, server rendering). */
  size?: { width: number; height: number };
  /** `false` leaves DOM focus alone (tests, a workspace that is never shown). Default true. */
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
   * Renaming in place: double-click or F2 on a tab, or on a lone pane's title, opens a field there. `can(pane)` says
   * which panes may be renamed (default: all); `run(pane, text)` saves the name in your app, which then shows it
   * (`useTitle`). Return `false`, throw or reject to keep the field open. Without it, nothing offers renaming.
   */
  rename?: Rename;
  /**
   * Phones: below `phone.below` pixels of workspace width (default 600), the workspace shows one pane at a time,
   * with a switcher, whatever the panes' minimums. Its layout, address and history don't change; widen it and the
   * arrangement comes back. `{ below: 0 }` switches only when even one pane can't fit.
   */
  phone?: PhoneOptions;
  /**
   * What may happen to panes, beside each kind's own `allow`: turn controls off (`{ fullScreen: false }`), turn Pop out
   * on (`{ popOut: true }`), and `when` for rules that depend on the layout: `when: ({ action, presetId }) =>
   * !(presetId === "review" && action === "close")`. The actions obey it, whatever asks (a button, a key, ⌘K, a drag,
   * an agent), and the chrome draws only what is allowed. Default: everything but Pop out.
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

export type { Jali };

const inBrowser = typeof window !== "undefined";

const presetOf = ({ id, label, layout, saved }: PresetOptions): Preset => ({
  id,
  label,
  ...(saved ? { saved } : {}),
  build: () => toLayout(typeof layout === "function" ? layout() : structuredClone(layout)),
});

export function createJali<D extends PaneKindBase>(options: JaliOptions<D>): Jali {
  const { panes, launcher, layout, url = inBrowser, size, moveFocus = true } = options;

  const kinds: PaneKinds<D> = "register" in panes ? panes : createPaneKinds<D>([...panes]);
  if (launcher) kinds.register({ ...launcher, transient: true });

  const storage =
    typeof options.storage === "object"
      ? options.storage
      : inBrowser
        ? browserStorage(options.storage ?? options.id ?? "jali")
        : memoryStorage();

  const writer: UrlWriter | undefined =
    url === false
      ? undefined
      : url === true
        ? createUrlSync({ storage })
        : "write" in url
          ? url
          : createUrlSync({ storage, ...url });

  const deps: UiStoreDeps = {
    kinds: kinds as unknown as PaneKinds,
    profile: options.page ?? null,
    presets: options.presets?.map(presetOf) ?? [],
    preset: options.preset,
    name: options.name,
    launcher: launcher?.kind,
    url: writer,
    storage,
    id: options.id,
    keys: options.keys,
    pageTheme: options.pageTheme,
    commands: options.commands,
    keymap: options.keymap,
    keymapOptions: {
      ...options.keymapOptions,
      ...(options.keyPrefix ? { prefix: options.keyPrefix } : {}),
      ...(options.reservedKeys ? { reserved: options.reservedKeys } : {}),
    },
    palette: options.palette,
    messages: options.messages,
    ...(options.settings ? { settings: options.settings } : {}),
    ...(options.dir ? { dir: options.dir } : {}),
    ...(options.landmark ? { landmark: options.landmark } : {}),
    ...(options.label ? { label: options.label } : {}),
    unstable: options.onUnstable,
    onPaneError: options.onPaneError,
    ...(options.confirmDiscard === false ? { confirmDiscard: false } : {}),
    ...(options.tabMenu ? { tabMenu: options.tabMenu } : {}),
    ...(options.rename ? { rename: options.rename } : {}),
    ...(options.phone ? { phone: options.phone } : {}),
    ...(options.allow ? { allow: options.allow } : {}),
    ...(options.buttons ? { buttons: options.buttons } : {}),
    ...(options.gap !== undefined ? { gap: options.gap } : {}),
    ...(options.inset !== undefined ? { inset: options.inset } : {}),
    initial: {
      ...(layout ? { layout: toLayout(layout) } : {}),
      ...(size ? { area: size } : {}),
    },
  };
  if (!moveFocus) deps.focusPane = null;

  const store = createUiStore(deps);
  boot(store);
  // Only now: putting the first layout in place closes nothing the person had.
  store.guard = options.beforeClose;
  return store.jali;
}
