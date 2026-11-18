/**
 * The UI store: state, one derived model, and apply(). Layout and view come from layout-core ops; actions are pure
 * (actions/) and the store only commits them. Effects leave through sinks given at creation (URL, DOM focus) and
 * through `onToast` (toasts); announcements are state, so nothing said before the live region mounts is lost.
 */
import * as core from "../layout";
import type { Layout, LayoutContext, NodeId, ObjectRef, UndoEntry, ViewState } from "../layout/types";
import type { PaneActivity, PaneCommand, PaneKinds } from "../pane-kinds";
import { GAP, initialArea } from "../tokens";
import { bindActions, type Actions } from "../actions";
import { apply, type Change, type Deferred, type HistoryMode, type Outcome, type Snapshot, type Toast } from "./apply";
import { modelCache, type WorkspaceModel } from "./model";
import { loadSettings, systemPrefersDark, type Settings } from "./settings";
import { loadPrefs, type PagePrefs } from "./page-prefs";
import { presetById, type Env, type Preset, type ViewMode, type ProfileBase } from "../profile";
import { browserStorage, type StoragePort } from "../ports";
import { focusPane } from "../dom/focus";
import { createKeymap, type Keymap, type KeymapOptions, type KeymapOverrides } from "../commands/keymap";

/** A drag in progress. `label` names a view dragged from a page's tabs, which may not be on screen. */
export interface DndState { dragged: NodeId; x: number; y: number; target?: NodeId; zone?: import("../layout/types").Edge | "centre"; label?: string }
/** "Discard unsaved changes?": the panes that would lose work and the change, applied as is on Discard. */
export interface ConfirmState { panes: NodeId[]; change: Change }
/** A chooser dialog opened by a command (⌘K "Add to tabs of…"). */
export interface ChooserState { kind: "merge"; source: NodeId }

/** A curated page in use (ui/profile.ts): the item, the mode, the view Single shows, and what this person may do. */
export interface PageState {
  /** The profile's id: what a link names (`?page=loan-review`). */
  profile: string;
  item: number;
  mode: ViewMode;
  /** The view Single mode shows (in Multiplexed, the last role focused). */
  tab: string;
  /** The multiplexed layout just before the first opened pane: "Back to …" returns to it exactly. */
  before?: Layout;
  /** Role permission: following a link opens an investigation pane (true) or only peeks (false). */
  canInvestigate: boolean;
}

/** A list's selected item, as its pane reported it (`select`). `inResults: false`: the list's filter no longer shows it. */
export interface Selection { ref: ObjectRef; inResults: boolean }

export interface UiState {
  layout: Layout;
  /** Null in Data Studio, where the person builds the layout. */
  page: PageState | null;
  /** The person's mode and multiplexed layout (while Multiplexed is on screen, the live layout is the truth). */
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
  /** Each list pane's selected item; its following detail shows it (layout-core ops/follow.ts). */
  selection: Record<NodeId, Selection>;
  dnd: DndState | null;
  resizeMode: NodeId | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  chooser: ChooserState | null;
  /** Objects opened this session, most recent first (the launcher's "Recent"). */
  recent: ObjectRef[];
  area: { width: number; height: number };
  /** Layout changes of the reshape class so far (state/apply.ts): the workspace animates on a new one. */
  reshapes: number;
  /** A page tab hovered with ⌥ held: the workspace previews where it would open beside. */
  ghost: string | null;
  /** Panes with unsaved work, and what it is (PaneComponentProps.setUnsaved). */
  unsaved: Record<NodeId, string>;
  /** A change that would lose unsaved work, held until the person discards it or keeps editing. */
  confirm: ConfirmState | null;
  /** Each pane's commands for ⌘K (PaneComponentProps.setCommands). */
  paneCommands: Record<NodeId, PaneCommand[]>;
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
  /** The curated page this workspace can show (ui/profile.ts). Default: none. */
  profile?: ProfileBase | null;
  /** Layouts to start from, in menu order (the bar and ⌘K "Layout: …"). Default: none. */
  presets?: readonly Preset[];
  /** The preset the workspace opens on, when no link or saved state says otherwise. Default: the first. A workspace
   *  without presets passes `initial.layout` instead. */
  preset?: string;
  /** The free workspace's name ("Data Studio"), in commands such as "Open Data Studio". Default "Workspace". */
  name?: string;
  /** Where the workspace writes its address: usually `createUrlSync()`, which `boot` and `startUi` then also read
   *  from. Default: none (the address is left alone). */
  url?: UrlWriter;
  /** Moves DOM focus into a pane after the next paint. Default: Jali's (dom/focus.ts), looking inside the workspace's
   *  root; `null` leaves DOM focus alone (a test, a workspace that is never shown). */
  focusPane?: ((scope: WorkspaceDom, id: NodeId) => void) | null;
  /** What this person keeps on this device: settings, a curated page's mode and layout. Default: localStorage
   *  under "jali". */
  storage?: StoragePort;
  /** Prefix for this workspace's DOM ids. Give each workspace on one page its own. Default "jali". */
  id?: string;
  initial?: Partial<UiState>;
  /** A focus or swap op moved something (layout stability, state/apply.ts). Default: reported in development. */
  unstable?: (op: string, before: string, after: string) => void;
  /** Rebind or unbind commands (commands/keymap.ts): `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. */
  keymap?: KeymapOverrides;
  /** The keymap's platform and how refused bindings are reported. */
  keymapOptions?: KeymapOptions;
}

export interface UiStore {
  get(): UiState;
  /** A raw state write for interaction state (drag, dialogs, area). Area and pane-cap changes refit the layout. */
  set(patch: Partial<UiState>): void;
  subscribe(fn: () => void): () => void;
  model(): WorkspaceModel;
  ctx(): LayoutContext;
  snapshot(): Snapshot;
  apply(o: Outcome): NodeId | undefined;
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
  dom: WorkspaceDom;
  storage: StoragePort;
  /** The address to share, from the URL port. */
  href(): string;
  /** The URL writer this store was made with (`deps.url`). */
  url: UrlWriter | undefined;
}

/**
 * A workspace's place in the DOM: the id prefix of its elements, and the element that holds it (its app shell), set
 * by the component that renders it. DOM lookups (focus, drag, F6 regions) search inside `root()` only.
 */
export interface WorkspaceDom {
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

function createDom(id: string): WorkspaceDom {
  let el: Element | null = null, layer: Element | null = null;
  const root = (): ParentNode => el ?? document;
  return {
    id,
    root,
    attach: (next) => { el = next; },
    layer: () => layer,
    attachLayer: (next) => { layer = next; },
    pane: (pane) => (typeof document === "undefined" ? null : root().querySelector<HTMLElement>(`[id="${id}-pane-${pane}"]`)),
  };
}

const PANE_STATE_KEY = "pane-state";
function loadPaneState(storage: StoragePort): Record<NodeId, Record<string, unknown>> {
  try {
    const v = JSON.parse(storage.get(PANE_STATE_KEY) ?? "{}") as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<NodeId, Record<string, unknown>>) : {};
  } catch {
    return {};
  }
}
export const savePaneState = (storage: StoragePort, state: UiState["paneState"]) => storage.set(PANE_STATE_KEY, JSON.stringify(state));

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

export function createUiStore(deps: UiStoreDeps): UiStore {
  const env: Env = { kinds: deps.kinds, profile: deps.profile ?? null, presets: deps.presets ?? [], name: deps.name ?? "Workspace" };
  const focusOf = deps.focusPane === undefined ? (typeof document === "undefined" ? null : focusPane) : deps.focusPane;
  const dom = createDom(deps.id ?? "jali");
  const storage = deps.storage ?? browserStorage("jali");
  const start = presetById(env, deps.preset);
  const layout = deps.initial?.layout ?? start?.build();
  if (!layout) throw new Error("createUiStore: give `presets` or an `initial.layout` to start from");
  let state: UiState = {
    layout,
    page: null,
    prefs: loadPrefs(storage, env.profile?.id, env.kinds.registry()),
    view: { focusHistory: [] },
    presetId: start?.id,
    settings: loadSettings(storage),
    systemDark: systemPrefersDark(),
    undoStack: [],
    activity: {},
    selection: {},
    dnd: null,
    resizeMode: null,
    paletteOpen: false,
    settingsOpen: false,
    chooser: null,
    recent: [],
    area: initialArea(),
    announcement: { text: "", seq: 0 },
    reshapes: 0,
    ghost: null,
    unsaved: {},
    confirm: null,
    paneCommands: {},
    paneState: loadPaneState(storage),
    ...deps.initial,
  };
  const subs = new Set<() => void>();
  const notify = () => { for (const fn of subs) fn(); };
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
    timers.set(d.key, setTimeout(() => { timers.delete(d.key); store.apply(run(store.snapshot())); }, d.ms));
  };

  const ctx = (): LayoutContext => ({ fit: { ...state.area, gap: GAP, kinds: env.kinds.registry() }, paneCap: state.settings.paneCap });

  const store: UiStore = {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      // Size and cap changes come from outside the layout, so they refit it. Link arrivals refit where they land.
      const resized = prev.area.width !== state.area.width || prev.area.height !== state.area.height;
      const recapped = prev.settings.paneCap !== state.settings.paneCap;
      const known = env.kinds.registry();
      if ((resized || recapped) && core.tree.panes(state.layout.root).every((p) => known[p.ref.kind])) {
        const layout = core.refit(state.layout, state.view, ctx());
        if (layout !== state.layout) state = { ...state, layout };
      }
      notify();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    model: () => models({ layout: state.layout, view: state.view, area: state.area, ctx: ctx(), env }),
    ctx,
    snapshot: () => ({ s: state, m: store.model(), ctx: ctx(), env }),
    apply: (o) => apply(io, o),
    announce: (text) => store.set({ announcement: { text, seq: state.announcement.seq + 1 } }),
    writeUrl: (mode) => deps.url?.write(store.get, mode),
    toast: (t) => (toastFns.size ? toastFns.forEach((fn) => fn(t)) : pendingToasts.push(t)),
    onToast(fn) {
      toastFns.add(fn);
      for (const t of pendingToasts.splice(0)) fn(t);
      return () => toastFns.delete(fn);
    },
    actions: undefined as unknown as Actions,
    keymap: createKeymap(deps.keymap, deps.keymapOptions),
    env,
    dom,
    storage,
    href: () => deps.url?.href?.() ?? (typeof location === "undefined" ? "" : location.href),
    url: deps.url,
  };
  const io = {
    get: store.get,
    set: store.set,
    snapshot: store.snapshot,
    url: store.writeUrl,
    announce: store.announce,
    toast: store.toast,
    focus: (id: NodeId) => focusOf?.(dom, id),
    defer,
    unstable: deps.unstable ?? (DEV ? (op: string) => console.error(`Layout stability: "${op}" is a focus or swap op but moved panes`) : undefined),
  };
  store.actions = bindActions(store);
  return store;
}
