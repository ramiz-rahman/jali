import type { Hinge } from "../workspace/stack";
import type { Rename } from "../actions/rename";
import type { PaneReport } from "../actions/content";
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
import {
  linkLayout,
  linkView,
  rereadLayout,
  rereadRef,
  type PaneActivity,
  type PaneAttributes,
  type PaneCommand,
  type PaneErrorInfo,
  type PaneKinds,
} from "../pane-kinds";
import { initialArea, spacingOf } from "../tokens";
import { toLayout } from "../layout/build";
import { bindActions, type Actions } from "../actions";
import type { ActionName } from "../actions/public";
import {
  apply,
  type ActionResult,
  type Agreed,
  type Asked,
  type BeforeClose,
  type Deferred,
  type Intent,
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
  pageEngineOf,
  presetById,
  type Env,
  type ItemId,
  type Preset,
  type ViewMode,
  type ProfileBase,
} from "../profile";
import { browserStorage, type StoragePort } from "../ports";
import { focusPane } from "../dom/focus";
import { cssString, paneDomId } from "../dom/ids";
import { noDom, type DomPort, type DragKind } from "../dom/port";
import { pageDirection } from "../dom/direction";
import { readPaneState } from "./pane-state";
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
/** "Discard unsaved changes?": the panes that would lose work, and the action held (state/apply.ts, held questions).
 *  Discard runs the action again: made if it still loses only the work asked about, else asked again. */
export interface ConfirmState {
  panes: NodeId[];
  /** The panes asked about, with the objects they showed. */
  asked: Asked;
  /** What was agreed before the question (the host's `beforeClose` yes). */
  agreed: Agreed;
  /** The public action held, which the `layout` event names when Discard makes it. */
  action?: ActionName;
  intent: Intent;
  /** How the question ended: what the answer did, or `"kept"` (Keep editing, or a newer question took its place). */
  settled: Promise<ActionResult>;
  settle(r: ActionResult | Promise<ActionResult>): void;
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
  /** The pane on the whole screen (`actions.toggleFullScreen`): maximised, with the page in the browser's full
   *  screen. Not in the layout or the address. */
  fullScreen?: NodeId;
  /** A fold that splits the workspace in two, measured from the browser's viewport segments; unset on a flat screen
   *  and in browsers without them. */
  hinge?: Hinge;
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
  /** What each caller of the pane hooks reports, per pane and caller; merged into `activity`, `unsaved`,
   *  `paneCommands`, `titles` and `paneAttributes` (actions/content.ts `reportPane`). */
  paneReports: Record<NodeId, Record<string, PaneReport>>;
  /** Each pane's own state (usePaneState): JSON values, kept through folds, tabs and reloads, dropped on close. */
  paneState: Record<NodeId, Record<string, unknown>>;
  /** The object (`objectKey`) each pane's state belongs to: a pane that shows another object under the same id
   *  (a reused id, an undo, a reload) never reads it. */
  paneStateOf: Record<NodeId, string>;
  /** The list (`objectKey`) each selection was made in: a new list under a closed list's id starts without it. */
  selectionOf: Record<NodeId, string>;
  /** The live region's text; `seq` makes a repeat a new announcement. */
  announcement: { text: string; seq: number };
}

/** The URL sink: writes the state (read when the write happens) to the address bar in a history mode. */
/** The share of the workspace's state an address holds: what a URL writer reads. */
export interface UrlState {
  /** The layout on screen. */
  layout: Layout;
  /** Focus, the maximised pane, the peek and where rows that scroll came to rest. */
  view: ViewState;
  /** The preset the layout came from, if any. */
  presetId: string | undefined;
  /** The curated page open, if any: a page link carries its item and view, not the layout. */
  page: PageState | null;
}

/** Writes the workspace to an address: `createJali({ url })` takes one for a router of the host's own. */
export interface UrlWriter {
  /** `state` reads the workspace when the write happens (a debounced write reads it late, so it writes the latest). */
  write(state: () => UrlState, mode: HistoryMode): void;
  /** The address to share ("Copy link"). */
  href?(): string;
  /** Drop a write still waiting (a debounced one): the workspace is going away (`jali.destroy()`). */
  cancel?(): void;
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
  /** The workspace's name for assistive technology: its landmark's, and part of each of Jali's landmarks in it. */
  label?: string;
  /** `false`: the app asks about unsaved work itself; Jali never does. Default true. */
  confirmDiscard?: boolean;
  /** The app's items for a tab's menu, after Jali's. */
  tabMenu?: import("../commands/tab-menu").TabMenu;
  /** Renaming a pane in place: the app keeps the name. */
  rename?: Rename;
  /** How the workspace behaves on a phone. */
  phone?: import("../profile").PhoneOptions;
  /** What may happen to panes. */
  allow?: import("../actions/allow").WorkspaceAllow;
  /** The buttons in a pane's header. */
  buttons?: import("../pane/buttons").PaneButtons;
  /** The gap between panes, in px. Default 6 (`GAP`). */
  gap?: number;
  /** The inset from the workspace's edges to the panes, in px. Default: the gap. */
  inset?: number;
}

export interface UiStore {
  get(): UiState;
  /** A raw state write for interaction state (drag, dialogs, area). Area and pane-cap changes refit the layout. */
  set(patch: Partial<UiState>): void;
  subscribe(fn: () => void): () => void;
  model(): JaliModel;
  ctx(): LayoutContext;
  snapshot(): Snapshot;
  /** Commit an outcome (or a step of the snapshot), and say what happened. Events go out once it is done; `action`
   *  is the public action it makes, which the `layout` event names. */
  apply(o: Outcome, action?: ActionName): ActionResult;
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
  /** Stop for good (`jali.destroy()`): the listeners stop, pane state waiting to be saved is saved, deferred steps
   *  (a follow waiting for the selection to rest) and a debounced address write are dropped, and the kind registry
   *  is no longer listened to. Later deferred steps are dropped too. Calling it again does nothing. */
  destroy(): void;
}

/**
 * A workspace's place in the DOM: the id prefix of its elements, the element that holds it (its app shell), set
 * by the component that renders it, and the adapter's `DomPort`, which finds the adapter's own elements in it. DOM
 * lookups (focus, drag, F6 regions) search inside `root()` only.
 */
export interface JaliDom {
  id: string;
  /** The adapter's markup, as the core needs to find it (dom/port.ts). `noDom` until the adapter gives one. */
  readonly port: DomPort;
  /** Give the workspace the adapter's port. The adapter calls it before it renders the workspace. */
  use(port: DomPort): void;
  /** What is being dragged by pointer now: a pane (or a page tab), a divider of a row or a column; null when nothing. */
  dragging(): DragKind | null;
  /** A drag starts or ends: kept here, and told to the port for the page's styles. */
  setDragging(what: DragKind | null, divider?: HTMLElement): void;
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
    layer: Element | null = null,
    port: DomPort = noDom,
    drag: DragKind | null = null;
  const root = (): ParentNode => el ?? document;
  return {
    id,
    get port() {
      return port;
    },
    use: (next) => {
      port = next;
    },
    dragging: () => drag,
    setDragging: (what, divider) => {
      drag = what;
      port.dragging(what, divider);
    },
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
        : root().querySelector<HTMLElement>(`[id=${cssString(paneDomId(id, pane))}]`),
  };
}

const DEV = !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;

export function createUiStore(deps: UiStoreDeps): UiStore {
  const page = pageEngineOf(deps.profile);
  if (deps.profile && !page)
    throw new Error("Jali: make the page with `definePage`, which gives it the code that runs it");
  const messages = resolveMessages(deps.messages, page?.words);
  const env: Env = {
    kinds: deps.kinds,
    profile: deps.profile ?? null,
    presets: deps.presets ?? [],
    commands: deps.commands ?? [],
    palette: deps.palette !== false,
    name: deps.name ?? messages.workspace.name,
    messages,
    spacing: spacingOf(deps),
  };
  const onPaneError =
    deps.onPaneError ??
    (DEV
      ? (error: unknown, { pane, ref }: PaneErrorInfo) =>
          console.error(`Jali: pane ${pane ?? "peek"} (${ref.kind}) failed`, error)
      : undefined);
  if (onPaneError) env.onPaneError = onPaneError;
  if (page) env.page = page;
  if (deps.launcher) env.launcher = deps.launcher;
  if (deps.dir) env.dir = deps.dir;
  if (deps.landmark === "main") env.landmark = "main";
  if (typeof deps.label === "string" && deps.label.trim()) env.label = deps.label.trim();
  if (deps.confirmDiscard === false) env.confirmDiscard = false;
  if (deps.pageTheme === false) env.pageTheme = false;
  if (deps.tabMenu) env.tabMenu = deps.tabMenu;
  if (deps.rename) env.rename = deps.rename;
  if (deps.phone) env.phone = deps.phone;
  if (deps.allow) env.allow = deps.allow;
  if (deps.buttons) env.buttons = deps.buttons;
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
    area: initialArea(env.spacing.inset),
    dir: deps.dir ?? pageDirection(),
    announcement: { text: "", seq: 0 },
    reshapes: 0,
    ghost: null,
    unsaved: {},
    confirm: null,
    paneCommands: {},
    titles: {},
    paneAttributes: {},
    paneReports: {},
    ...readPaneState(storage),
    selectionOf: {},
    ...deps.initial,
  };
  const subs = new Set<() => void>();
  const notify = () => {
    for (const fn of subs) fn();
  };
  const offKinds = env.kinds.onChange(() => {
    rereadLinks();
    notify();
  });
  let destroyed = false;
  const toastFns = new Set<(t: Toast) => void>();
  const pendingToasts: Toast[] = [];
  const models = modelCache();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const defer = (d: Deferred) => {
    clearTimeout(timers.get(d.key));
    timers.delete(d.key);
    if (!d.run || destroyed) return;
    const run = d.run;
    timers.set(
      d.key,
      setTimeout(() => {
        timers.delete(d.key);
        store.apply(run);
      }, d.ms),
    );
  };

  const rootElement = () => {
    const el = dom.root();
    return el instanceof Element ? el : null;
  };
  const ctxOf = (s: UiState): LayoutContext => ({
    fit: { ...s.area, gap: env.spacing.gap, kinds: env.kinds.registry() },
    paneCap: s.settings.paneCap,
    ...(s.dir === "rtl" ? { dir: s.dir } : {}),
  });
  const ctx = () => ctxOf(state);

  /** A raw write. Size and cap changes come from outside the layout, so they refit it. Link arrivals refit where
   *  they land. The next state is computed whole before it is put in place, so a refit that throws leaves the
   *  state as it was. */
  const write = (patch: Partial<UiState>) => {
    const prev = state;
    let next = { ...state, ...patch };
    const resized = prev.area.width !== next.area.width || prev.area.height !== next.area.height;
    const recapped = prev.settings.paneCap !== next.settings.paneCap;
    const known = env.kinds.registry();
    if (
      (resized || recapped) &&
      core.tree.panes(next.layout.root).every((p) => Object.hasOwn(known, p.ref.kind))
    ) {
      const layout = core.refit(next.layout, next.view, ctxOf(next));
      if (layout !== next.layout) next = { ...next, layout };
    }
    state = next;
    notify();
  };

  /**
   * A kind registered after a link gave refs of it: those refs drop the app-only params the link carried, wherever
   * the workspace keeps them (the layout, the peek, Recent, Undo, the page's way back). A link never sets one.
   */
  const rereadLinks = () => {
    const kinds = env.kinds.registry();
    const layout = (l: Layout) => rereadLayout(kinds, l);
    const view = (v: ViewState) => {
      const peek = v.peek && rereadRef(kinds, v.peek);
      return peek === v.peek ? v : { ...v, peek };
    };
    const patch: Partial<UiState> = {};
    const l = layout(state.layout);
    if (l !== state.layout) patch.layout = l;
    const v = view(state.view);
    if (v !== state.view) patch.view = v;
    const recent = state.recent.map((r) => rereadRef(kinds, r));
    if (recent.some((r, i) => r !== state.recent[i])) patch.recent = recent;
    const undo = state.undoStack.map((e) => {
      const bl = layout(e.before.layout),
        bv = view(e.before.view);
      return bl === e.before.layout && bv === e.before.view
        ? e
        : { ...e, before: { layout: bl, view: bv } };
    });
    if (undo.some((e, i) => e !== state.undoStack[i])) patch.undoStack = undo;
    const back = state.page?.before && layout(state.page.before);
    if (state.page && back !== state.page.before) patch.page = { ...state.page, before: back };
    if (Object.keys(patch).length) write(patch);
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
  /** The first public action that committed a layout op in this batch. */
  let named: ActionName | undefined;
  /** Tells the app what a batch changed: its own `ops`, `named` and `input`, read as it ended. A listener that acts
   *  starts a batch of its own, which must not rename this one's `layout` event. */
  const told = (
    before: UiState,
    ops: readonly Op[],
    named: ActionName | undefined,
    input: JaliInput,
  ) => {
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
        ...(named && !ops.includes("arrive") ? { action: named } : {}),
        input,
      });
  };
  const batch = <T>(run: () => T): T => {
    if (depth++ === 0) {
      from = state;
      ops = [];
      named = undefined;
      input = currentInput();
    }
    try {
      return run();
    } finally {
      if (--depth === 0 && handlers.size) told(from, ops, named, input);
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
        ...(state.hinge ? { hinge: state.hinge } : {}),
      }),
    ctx,
    snapshot: () => ({ s: state, m: store.model(), ctx: ctx(), env }),
    apply: (o, action) => batch(() => apply(io, o, action)),
    announce: (text) => store.set({ announcement: { text, seq: state.announcement.seq + 1 } }),
    // The writer reads the address's share of the state only (UrlState), when it writes, and as a link carries it:
    // without params only the app sets (`appOnly`).
    writeUrl: (mode) =>
      deps.url?.write(() => {
        const { layout, view, presetId, page } = store.get();
        const kinds = env.kinds.registry();
        // The page's way back holds refs too: a writer of the host's own sees it as a link carries it.
        const before = page?.before && linkLayout(kinds, page.before);
        return {
          layout: linkLayout(kinds, layout),
          view: linkView(kinds, view),
          presetId,
          page: page && before !== page.before ? { ...page, before } : page,
        };
      }, mode),
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
      if (stop || destroyed) return () => {};
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
    destroy() {
      if (destroyed) return;
      // Stopping saves pane state still waiting to be saved; without a start, nothing saves it at all.
      stop?.();
      destroyed = true;
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
      deps.url?.cancel?.();
      offKinds();
      // A question still open can never be answered now: the action it held ends as kept, so `settled` resolves.
      const asking = state.confirm;
      if (asking) {
        state = { ...state, confirm: null };
        notify();
        asking.settle({ ok: false, reason: "kept" });
      }
    },
  };
  let stop: (() => void) | null = null;
  const io = {
    get: store.get,
    set: write,
    committed: (op: Op, action?: ActionName) => {
      ops.push(op);
      named ??= action;
    },
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
  // As an arrival, which writes no history: the address still holds the link boot is about to read, and boot writes
  // the address itself once it has.
  if (pageOnly && !deps.initial?.page) store.actions.openPage({ fromUrl: true });
  return store;
}
