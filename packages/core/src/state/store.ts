import type { Rename } from "../actions/rename";
/**
 * The workspace: state, one derived model, and apply(). Layout and view come from the layout ops; actions are pure
 * (actions/) and the store only commits them. Effects leave through sinks given at creation (URL, DOM focus) and
 * through `onToast` (toasts); announcements are state, so nothing said before the live region mounts is lost.
 */
import * as core from "../layout";
import type {
  Direction,
  Layout,
  LayoutContext,
  NodeId,
  ObjectRef,
  UndoEntry,
  ViewState,
} from "../layout/types";
import type {
  PaneActivity,
  PaneAttributes,
  PaneCommand,
  PaneErrorInfo,
  PaneKinds,
} from "../pane-kinds";
import { GAP, initialArea } from "../tokens";
import { toLayout } from "../layout/build";
import { bindActions, type Actions } from "../actions";
import {
  apply,
  type ActionResult,
  type BeforeClose,
  type Change,
  type Deferred,
  type HistoryMode,
  type Op,
  type Outcome,
  type Snapshot,
  type Toast,
} from "./apply";
import { createInstance, type Jali, type JaliEvent, type JaliEvents } from "./instance";
import { currentInput, trackInput, type JaliInput } from "../dom/input";
import { sameRef } from "../actions/follow";
import { modelCache, type JaliModel } from "./model";
import { loadSettings, systemPrefersDark, type Settings } from "./settings";
import { loadPrefs, type PagePrefs } from "./page-prefs";
import {
  presetById,
  type Env,
  type ItemId,
  type Preset,
  type ViewMode,
  type ProfileBase,
} from "../profile";
import { browserStorage, type StoragePort } from "../ports";
import { focusPane } from "../dom/focus";
import { pageDirection } from "../dom/direction";
import { loadPaneState } from "./pane-state";
import { startUi } from "../boot";
import {
  createKeymap,
  PALETTE_ID,
  type Keymap,
  type KeymapOptions,
  type KeymapOverrides,
} from "../commands/keymap";
import type { Command } from "../commands/registry";
import { resolveMessages, type MessageOverrides, type Messages } from "./messages";
import type { ChooseOptions } from "../actions/choose";

/** A drag in progress. `label` names a view dragged from a page's tabs, which may not be on screen. */
export interface DndState {
  dragged: NodeId;
  x: number;
  y: number;
  target?: NodeId;
  zone?: import("../layout/types").Edge | "centre";
  label?: string;
  /** Over its own tab strip: where the tab would go (workspace/dnd.ts). */
  tabAt?: import("../workspace/dnd").TabDrop;
}
/** "Discard unsaved changes?": the panes that would lose work and the change, applied as is on Discard. */
export interface ConfirmState {
  panes: NodeId[];
  change: Change;
}
/** A chooser dialog: ⌘K "Add to tabs of…" (`merge`), or an item asked for by the app (`choose`, actions/choose.ts). */
export type ChooserState =
  | { kind: "merge"; source: NodeId }
  | { kind: "choose"; request: ChooseOptions<unknown> };

/** A curated page in use (profile.ts): the item, the mode, the view Single shows, and what this person may do. */
export interface PageState {
  /** The profile's id: what a link names (`?page=loan-review`). */
  profile: string;
  item: ItemId;
  mode: ViewMode;
  /** The view Single mode shows (in Split view, the last role focused). */
  tab: string;
  /** The split layout just before the first opened pane: "Back to …" returns to it exactly. */
  before?: Layout;
  /** Role permission: following a link opens an investigation pane (true) or only peeks (false). */
  canInvestigate: boolean;
}

/** A list's selected item, as its pane reported it (`select`). `inResults: false`: the list's filter no longer shows it. */
export interface Selection {
  ref: ObjectRef;
  inResults: boolean;
}

export interface UiState {
  layout: Layout;
  /** Null in the free workspace, where the person builds the layout. */
  page: PageState | null;
  /** The person's mode and split layout (while Split view is on screen, the live layout is the truth). */
  prefs: PagePrefs;
  view: ViewState;
  /** The preset last chosen ("Reset layout" rebuilds it); undefined in a workspace without presets. */
  presetId: string | undefined;
  settings: Settings;
  /** The system's colour preference, for the "system" theme. */
  systemDark: boolean;
  /** Undo (⌘K ⌘Z, the Undo toast): closes and tucks, most recent last (state/undo.ts). */
  undoStack: UndoEntry[];
  activity: Record<NodeId, PaneActivity>;
  peekSource?: NodeId;
  /** Each list pane's selected item; its following detail shows it (layout/ops/follow.ts). */
  selection: Record<NodeId, Selection>;
  dnd: DndState | null;
  resizeMode: NodeId | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  chooser: ChooserState | null;
  /** The pane whose title is being renamed in place (`actions.startRename`), if any. */
  renaming: NodeId | null;
  /** Objects opened this session, most recent first (the launcher's "Recent"). */
  recent: ObjectRef[];
  area: { width: number; height: number };
  /** The reading direction the panes are laid out in: right to left, a row starts at the right. Read from the page
   *  when the workspace is measured, unless `createJali({ dir })` fixed it. */
  dir: Direction;
  /** Layout changes of the reshape class so far (state/apply.ts): the workspace animates on a new one. */
  reshapes: number;
  /** A page tab hovered with ⌥ held: the workspace previews where it would open beside. */
  ghost: string | null;
  /** Panes with unsaved work, and what it is (useUnsaved). */
  unsaved: Record<NodeId, string>;
  /** A change that would lose unsaved work, held until the person discards it or keeps editing. */
  confirm: ConfirmState | null;
  /** Each pane's commands for ⌘K (useCommands). */
  paneCommands: Record<NodeId, PaneCommand[]>;
  /** Titles panes set from their data (useTitle), in place of their kind's title. Not saved; a pane that shows
   *  another object loses its title until it sets one again. */
  titles: Record<NodeId, string>;
  /** `data-*` attributes panes set from their data (usePaneAttributes), put on everything that stands for the pane.
   *  Not saved; cleared, like a title, when the pane closes or shows another object. */
  paneAttributes: Record<NodeId, PaneAttributes>;
  /** Each pane's own state (usePaneState): JSON values, kept through folds, tabs and reloads, dropped on close. */
  paneState: Record<NodeId, Record<string, unknown>>;
  /** The live region's text; `seq` makes a repeat a new announcement. */
  announcement: { text: string; seq: number };
}

/** The URL sink: writes the state (read when the write happens) to the address bar in a history mode. */
export interface UrlWriter {
  write(state: () => UiState, mode: HistoryMode): void;
  /** The address to share ("Copy link"). */
  href?(): string;
}

export interface UiStoreDeps {
  /** This workspace's pane kinds (createPaneKinds). */
  kinds: PaneKinds;
  /** The curated page this workspace can show (profile.ts). Default: none. */
  profile?: ProfileBase | null;
  /** Layouts to start from, in menu order (the bar and ⌘K "Layout: …"). Default: none. */
  presets?: readonly Preset[];
  /** The preset the workspace opens on, when no link or saved state says otherwise. Default: the first. A workspace
   *  without presets passes `initial.layout` instead, or a `profile` alone: it then starts on its page. */
  preset?: string;
  /** The free workspace's name ("Data Studio"), in commands such as "Open Data Studio". Default "Workspace". */
  name?: string;
  /** The kind a split or a new tab opens until the person chooses (it must be in `kinds`). Default: none, so no Split. */
  launcher?: string;
  /** Which keys the workspace takes: every key on the page ("page", the default), or only keys from inside its root
   *  and keys on the page body while it was the last one used ("workspace": two workspaces on one page). */
  keys?: "page" | "scoped";
  /** Set `data-theme` on `<html>` from the person's setting while started. Default true. */
  pageTheme?: boolean;
  /** Where the workspace writes its address: usually `createUrlSync()`, which `boot` and `startUi` then also read
   *  from. Default: none (the address is left alone). */
  url?: UrlWriter;
  /** Moves DOM focus into a pane after the next paint. Default: Jali's (dom/focus.ts), looking inside the workspace's
   *  root; `null` leaves DOM focus alone (a test, a workspace that is never shown). */
  focusPane?: ((scope: JaliDom, id: NodeId) => void) | null;
  /** What this person keeps on this device: settings, a curated page's mode and layout. Default: localStorage
   *  under the store's `id` ("jali" by default), so each workspace keeps its own. */
  storage?: StoragePort;
  /** Prefix for this workspace's DOM ids. Give each workspace on one page its own. Default "jali". */
  id?: string;
  initial?: Partial<UiState>;
  /** A focus or swap op moved something (layout stability, state/apply.ts). Default: reported in development. */
  unstable?: (op: string, before: string, after: string) => void;
  /** The host's own commands: listed in the palette after Jali's, and bindable in `keymap` like any other. Their ids
   *  should not start with a Jali prefix (`pane.`, `layout.`, `page.`, `peek.`, `settings.`, `stack.`). */
  commands?: readonly Command[];
  /** Rebind or unbind commands (commands/keymap.ts): `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. */
  keymap?: KeymapOverrides;
  /** The keymap's platform and how refused bindings are reported. */
  keymapOptions?: KeymapOptions;
  /** `false`: the host has its own command menu. Jali renders no palette and its key is unbound. Default true. */
  palette?: boolean;
  /** The host's close guard: asked before a change removes panes or points them at another object (state/apply.ts). */
  beforeClose?: BeforeClose;
  /** Settings for a person who has none saved yet (`createJali({ settings })`). Saved settings win. */
  settings?: Partial<Settings>;
  /** Words to use instead of Jali's English ones (state/messages.ts). Default: English. */
  messages?: MessageOverrides;
  /** A pane's content threw while rendering. Default: reported in development. */
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void;
  /** A fixed reading direction. Default: the page's, read where the workspace is rendered. */
  dir?: Direction;
  /** `"main"`: the panes are the page's main landmark. Default `"region"`, a labelled section. */
  landmark?: "region" | "main";
  /** `false`: the app asks about unsaved work itself; Jali never does. Default true. */
  confirmDiscard?: boolean;
  /** The app's items for a tab's menu, after Jali's. */
  tabMenu?: import("../commands/tab-menu").TabMenu;
  /** Renaming a pane in place: the app keeps the name. */
  rename?: Rename;
}

export interface UiStore {
  get(): UiState;
  /** A raw state write for interaction state (drag, dialogs, area). Area and pane-cap changes refit the layout. */
  set(patch: Partial<UiState>): void;
  subscribe(fn: () => void): () => void;
  model(): JaliModel;
  ctx(): LayoutContext;
  snapshot(): Snapshot;
  /** Commit an outcome (or a step of the snapshot), and say what happened. Events go out once it is done. */
  apply(o: Outcome): ActionResult;
  /** The app's events (instance.ts). */
  on<E extends JaliEvent>(event: E, handler: (event: JaliEvents[E]) => void): () => void;
  /** The workspace as an app sees it: what `createJali` returns. */
  jali: Jali;
  /** The host's close guard in use (`deps.beforeClose`). `createJali` sets it once the first layout is in place. */
  guard: BeforeClose | undefined;
  announce(text: string): void;
  writeUrl(mode: HistoryMode): void;
  toast(t: Toast): void;
  /** Toasts for whoever renders them; toasts sent before anyone listens are kept until someone does. */
  onToast(fn: (t: Toast) => void): () => void;
  actions: Actions;
  /** Keys → command ids, resolved once from the defaults and `deps.keymap`. */
  keymap: Keymap;
  /** The pane kinds and profile this store was made with. */
  env: Env;
  /** Where this workspace lives in the DOM. */
  dom: JaliDom;
  /** Every word this workspace shows or says: English with `createJali({ messages })` over it. */
  messages: Messages;
  storage: StoragePort;
  /** The address to share, from the URL port. */
  href(): string;
  /** The URL writer this store was made with (`deps.url`). */
  url: UrlWriter | undefined;
  /**
   * While true, the workspace moves no DOM focus of its own: not into a pane after a change, not into a dialog's
   * field when it opens, not back when the dialog closes. For something that drives the workspace while the person
   * watches (a scripted tour, a remote presenter), so their keyboard focus stays where they left it. Keys the person
   * presses still move focus as usual. Default false.
   */
  focusHeld: boolean;
  /** Start the page-lifetime listeners: keys, Back and Forward, theme and saving. Returns their stop. `<JaliRoot>` calls
   *  it on mount; calling it while started does nothing. */
  start(): () => void;
}

/**
 * A workspace's place in the DOM: the id prefix of its elements, and the element that holds it (its app shell), set
 * by the component that renders it. DOM lookups (focus, drag, F6 regions) search inside `root()` only.
 */
export interface JaliDom {
  id: string;
  /** The workspace's root element; the document until one is attached. */
  root(): ParentNode;
  attach(el: Element | null): void;
  /** The element that holds this workspace's dialogs (palette, settings, confirmations), which render outside the
   *  root; null until one is attached. Keys pressed there count as the workspace's. */
  layer(): Element | null;
  attachLayer(el: Element | null): void;
  /** The element with this workspace's pane id `id`, if rendered. */
  pane(id: NodeId): HTMLElement | null;
}

function createDom(id: string): JaliDom {
  let el: Element | null = null,
    layer: Element | null = null;
  const root = (): ParentNode => el ?? document;
  return {
    id,
    root,
    attach: (next) => {
      el = next;
    },
    layer: () => layer,
    attachLayer: (next) => {
      layer = next;
    },
    pane: (pane) =>
      typeof document === "undefined"
        ? null
        : root().querySelector<HTMLElement>(`[id="${id}-pane-${pane}"]`),
  };
}

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

export function createUiStore(deps: UiStoreDeps): UiStore {
  const messages = resolveMessages(deps.messages);
  const env: Env = {
    kinds: deps.kinds,
    profile: deps.profile ?? null,
    presets: deps.presets ?? [],
    commands: deps.commands ?? [],
    palette: deps.palette !== false,
    name: deps.name ?? messages.workspace.name,
    messages,
  };
  const onPaneError =
    deps.onPaneError ??
    (DEV
      ? (error: unknown, { pane, ref }: PaneErrorInfo) =>
          console.error(`Jali: pane ${pane ?? "peek"} (${ref.kind}) failed`, error)
      : undefined);
  if (onPaneError) env.onPaneError = onPaneError;
  if (deps.launcher) env.launcher = deps.launcher;
  if (deps.dir) env.dir = deps.dir;
  if (deps.landmark === "main") env.landmark = "main";
  if (deps.confirmDiscard === false) env.confirmDiscard = false;
  if (deps.tabMenu) env.tabMenu = deps.tabMenu;
  if (deps.rename) env.rename = deps.rename;
  const focusOf =
    deps.focusPane === undefined
      ? typeof document === "undefined"
        ? null
        : focusPane
      : deps.focusPane;
  const dom = createDom(deps.id ?? "jali");
  // The id is the prefix: two workspaces with their own ids never overwrite each other ("jali" stays "jali").
  const storage = deps.storage ?? browserStorage(deps.id ?? "jali");
  const start = presetById(env, deps.preset);
  // A page-only app (a page, no presets or layout) starts on its page.
  const pageOnly = !deps.initial?.layout && !start && !!env.profile;
  const layout =
    deps.initial?.layout ??
    start?.build() ??
    (env.profile ? toLayout(env.profile.build(env.profile.firstItem)) : undefined);
  if (!layout)
    throw new Error("Jali: give the workspace a `layout`, `presets` or a `page` to start from");
  let state: UiState = {
    layout,
    page: null,
    prefs: loadPrefs(storage, env.profile?.id, env.kinds.registry()),
    view: { focusHistory: [] },
    presetId: start?.id,
    settings: loadSettings(storage, deps.settings),
    systemDark: systemPrefersDark(),
    undoStack: [],
    activity: {},
    selection: {},
    dnd: null,
    resizeMode: null,
    paletteOpen: false,
    settingsOpen: false,
    chooser: null,
    renaming: null,
    recent: [],
    area: initialArea(),
    dir: deps.dir ?? pageDirection(),
    announcement: { text: "", seq: 0 },
    reshapes: 0,
    ghost: null,
    unsaved: {},
    confirm: null,
    paneCommands: {},
    titles: {},
    paneAttributes: {},
    paneState: loadPaneState(storage),
    ...deps.initial,
  };
  const subs = new Set<() => void>();
  const notify = () => {
    for (const fn of subs) fn();
  };
  env.kinds.onChange(notify);
  const toastFns = new Set<(t: Toast) => void>();
  const pendingToasts: Toast[] = [];
  const models = modelCache();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const defer = (d: Deferred) => {
    clearTimeout(timers.get(d.key));
    timers.delete(d.key);
    if (!d.run) return;
    const run = d.run;
    timers.set(
      d.key,
      setTimeout(() => {
        timers.delete(d.key);
        store.apply(run(store.snapshot()));
      }, d.ms),
    );
  };

  const rootElement = () => {
    const el = dom.root();
    return el instanceof Element ? el : null;
  };
  const ctx = (): LayoutContext => ({
    fit: { ...state.area, gap: GAP, kinds: env.kinds.registry() },
    paneCap: state.settings.paneCap,
    ...(state.dir === "rtl" ? { dir: state.dir } : {}),
  });

  /** A raw write. Size and cap changes come from outside the layout, so they refit it. Link arrivals refit where
   *  they land. */
  const write = (patch: Partial<UiState>) => {
    const prev = state;
    state = { ...state, ...patch };
    const resized = prev.area.width !== state.area.width || prev.area.height !== state.area.height;
    const recapped = prev.settings.paneCap !== state.settings.paneCap;
    const known = env.kinds.registry();
    if (
      (resized || recapped) &&
      core.tree.panes(state.layout.root).every((p) => known[p.ref.kind])
    ) {
      const layout = core.refit(state.layout, state.view, ctx());
      if (layout !== state.layout) state = { ...state, layout };
    }
    notify();
  };

  // Events: changes are gathered while a commit runs (apply, set, and anything they call) and told once it ends.
  const handlers = new Map<JaliEvent, Set<(e: never) => void>>();
  const emit = <E extends JaliEvent>(event: E, e: JaliEvents[E]) => {
    for (const fn of handlers.get(event) ?? []) {
      try {
        (fn as (e: JaliEvents[E]) => void)(e);
      } catch (err) {
        console.error(err);
      }
    }
  };
  let depth = 0;
  let from: UiState = state;
  /** Where this batch's change came from, read when it starts. */
  let input: JaliInput = "code";
  /** Layout ops committed in this batch: a refit alone is not a layout change. */
  let ops: Op[] = [];
  const told = (before: UiState) => {
    const after = state;
    if (after.layout !== before.layout) {
      const was = new Map(core.tree.panes(before.layout.root).map((p) => [p.id, p.ref]));
      const pinnedBefore = new Map(
        core.tree.panes(before.layout.root).map((p) => [p.id, !!p.pinned]),
      );
      const now = core.tree.panes(after.layout.root);
      const ids = new Set(now.map((p) => p.id));
      for (const [pane, ref] of was) if (!ids.has(pane)) emit("close", { pane, ref, input });
      for (const p of now) {
        const previous = was.get(p.id);
        if (!previous) emit("open", { pane: p.id, ref: p.ref, input });
        else if (!sameRef(previous, p.ref))
          emit("open", { pane: p.id, ref: p.ref, previous, input });
      }
      for (const p of now) {
        const was = pinnedBefore.get(p.id);
        if (was !== undefined && was !== !!p.pinned)
          emit("pin", { pane: p.id, pinned: !!p.pinned, input });
      }
    }
    if (after.view.focused !== before.view.focused)
      emit("focus", { pane: after.view.focused, previous: before.view.focused, input });
    if (after.layout !== before.layout && ops.length)
      emit("layout", {
        layout: after.layout,
        source: ops.includes("arrive") ? "address" : "action",
        input,
      });
  };
  const batch = <T>(run: () => T): T => {
    if (depth++ === 0) {
      from = state;
      ops = [];
      input = currentInput();
    }
    try {
      return run();
    } finally {
      if (--depth === 0 && handlers.size) told(from);
    }
  };

  const store: UiStore = {
    get: () => state,
    set: (patch) => batch(() => write(patch)),
    jali: undefined as unknown as Jali,
    guard: deps.beforeClose,
    focusHeld: false,
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) handlers.set(event, (set = new Set()));
      set.add(handler as (e: never) => void);
      return () => {
        set.delete(handler as (e: never) => void);
        if (!set.size) handlers.delete(event);
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    model: () =>
      models({
        layout: state.layout,
        view: state.view,
        area: state.area,
        ctx: ctx(),
        env,
        titles: state.titles,
      }),
    ctx,
    snapshot: () => ({ s: state, m: store.model(), ctx: ctx(), env }),
    apply: (o) => batch(() => apply(io, o)),
    announce: (text) => store.set({ announcement: { text, seq: state.announcement.seq + 1 } }),
    writeUrl: (mode) => deps.url?.write(store.get, mode),
    toast: (t) => (toastFns.size ? toastFns.forEach((fn) => fn(t)) : pendingToasts.push(t)),
    onToast(fn) {
      toastFns.add(fn);
      for (const t of pendingToasts.splice(0)) fn(t);
      return () => toastFns.delete(fn);
    },
    actions: undefined as unknown as Actions,
    keymap: createKeymap(
      // Without Jali's palette, its key is the host's, unless the host binds it on purpose.
      deps.palette === false && !(PALETTE_ID in (deps.keymap ?? {}))
        ? { ...deps.keymap, [PALETTE_ID]: null }
        : deps.keymap,
      { ...deps.keymapOptions, words: deps.keymapOptions?.words ?? messages.keys },
    ),
    env,
    dom,
    messages,
    storage,
    href: () => deps.url?.href?.() ?? (typeof location === "undefined" ? "" : location.href),
    url: deps.url,
    start() {
      if (stop) return () => {};
      const offInput = trackInput();
      const off = startUi(store, undefined, {
        keys: deps.keys === "scoped" ? { root: rootElement } : {},
        pageTheme: deps.pageTheme,
      });
      stop = () => {
        off();
        offInput();
        stop = null;
      };
      return stop;
    },
  };
  let stop: (() => void) | null = null;
  const io = {
    get: store.get,
    set: write,
    committed: (op: Op) => ops.push(op),
    get beforeClose() {
      return store.guard;
    },
    later: (o: Outcome) => store.apply(o),
    snapshot: store.snapshot,
    url: store.writeUrl,
    announce: store.announce,
    toast: store.toast,
    focus: (id: NodeId) => (store.focusHeld ? undefined : focusOf?.(dom, id)),
    defer,
    unstable:
      deps.unstable ??
      (DEV
        ? (op: string) =>
            console.error(`Layout stability: "${op}" is a focus or swap op but moved panes`)
        : undefined),
  };
  store.actions = bindActions(store);
  store.jali = createInstance(store);
  if (pageOnly && !deps.initial?.page) store.actions.openPage();
  return store;
}
