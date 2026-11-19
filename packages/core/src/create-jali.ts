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
import type { KeymapOptions, KeymapOverrides } from "./commands/keymap";
import type { Command } from "./commands/registry";
import { toLayout, type LayoutInput } from "./layout/build";
import { createPaneKinds, type PaneKindBase, type PaneKinds } from "./pane-kinds";
import { browserStorage, memoryStorage, type StoragePort } from "./ports";
import type { Preset, ProfileBase } from "./profile";
import { createUiStore, type UiStore, type UiStoreDeps, type UrlWriter } from "./state/store";
import { createUrlSync, type UrlSyncOptions } from "./url";

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
  /** The keymap's platform, and how refused bindings are reported. */
  keymapOptions?: KeymapOptions;
  /** A fixed size instead of the window's (tests, server rendering). */
  size?: { width: number; height: number };
  /** `false` leaves DOM focus alone (tests, a workspace that is never shown). Default true. */
  moveFocus?: boolean;
  /** Called when a focus or swap moved panes it should not have. Default: reported in development. */
  onUnstable?: (op: string, before: string, after: string) => void;
}

/** A workspace: its state, its actions (`jali.actions.openBeside(...)`) and what it was made with. */
export type Jali = UiStore;

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
    keymapOptions: options.keymapOptions,
    unstable: options.onUnstable,
    initial: {
      ...(layout ? { layout: toLayout(layout) } : {}),
      ...(size ? { area: size } : {}),
    },
  };
  if (!moveFocus) deps.focusPane = null;

  const jali = createUiStore(deps);
  boot(jali);
  return jali;
}
