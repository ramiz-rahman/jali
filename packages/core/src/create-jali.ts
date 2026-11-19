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

/** A layout the person can switch to from ⌘K ("Layout: Triage"), and "Reset layout" rebuilds. */
export interface PresetOptions {
  id: string;
  label: string;
  /** The layout, or a function that builds it each time it is chosen. */
  layout: LayoutInput | (() => LayoutInput);
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
  /** "workspace": take only keys from inside this workspace, for two on one page. Default "page": every key. */
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
  /** A fixed size instead of the window's (tests, server rendering). */
  size?: { width: number; height: number };
  /** `false` leaves DOM focus alone (tests, a workspace that is never shown). Default true. */
  moveFocus?: boolean;
  /** Called when a focus or swap moved panes it should not have. Default: reported in development. */
  onUnstable?: (op: string, before: string, after: string) => void;
  /**
   * Asked before a change removes panes or makes them show another object: a close, close others, a preset,
   * `setLayout`, Back and Forward, a pane showing something else. `true` lets it happen, `false` keeps the panes; a
   * promise holds the change until it answers (the action returns `reason: "pending"`). Jali's own "Discard unsaved
   * changes?" comes after a yes, when a pane still reports unsaved work (`useUnsaved`).
   */
  beforeClose?: BeforeClose;
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

const presetOf = ({ id, label, layout }: PresetOptions): Preset => ({
  id,
  label,
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
    ...(options.dir ? { dir: options.dir } : {}),
    unstable: options.onUnstable,
    onPaneError: options.onPaneError,
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
