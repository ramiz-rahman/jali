import type { Hinge } from "../workspace/stack";
import type { Rename } from "../actions/rename";
import type { PaneReport } from "../actions/content";
/**
 * The instance: state, one derived model, and apply(). Layout and view come from the layout ops; actions are pure
 * (actions/) and the store only commits them. Effects leave through sinks given at creation (URL, DOM focus) and
 * through `on("toast")`; announcements are state, so nothing said before the live region mounts is lost.
 */
import * as core from "../layout/engine";
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
import type { LayoutInput } from "../layout/build";
import { readLayout } from "../actions/layout";
import { bindSteps, stepOf, type Actions, type StepArgs, type StepName } from "../actions";
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
import { modelCache, type Model } from "./model";
import { loadSettings, systemPrefersDark, type Settings } from "./settings";
import { loadPrefs, type PagePrefs } from "./page-prefs";
import { pageEngineOf, type ItemId, type ViewMode, type ProfileBase } from "../profile";
import { presetById, PHONE_BELOW, type Env, type Preset } from "../env";
import { browserStorage, type StoragePort } from "../ports";
import { focusPane } from "../dom/focus";
import { cssString, paneDomId } from "../dom/ids";
import { noDom, type DomPort, type DragKind } from "../dom/port";
import { pageDirection } from "../dom/direction";
import { paneStateSync, type HeldStates, type PaneStateSync } from "./pane-state";
import { createLifetime } from "./lifetime";

declare const process: { env: { NODE_ENV?: string } };
import { startUi } from "../boot";
import { createKeymap, PALETTE_ID, type Keymap, type KeyboardOptions } from "../commands/keymap";
import type { Command } from "../commands/registry";
import { resolveMessages, type MessageOverrides, type Messages } from "./messages";
import type { ChooseOptions } from "../actions/choose";
import type { LinkMode } from "../actions/public";

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
}

/** A list's selected item, as its pane reported it (`select`). `inResults: false`: the list's filter no longer shows it. */
export interface Selection<R extends ObjectRef = ObjectRef> {
  ref: R;
  inResults: boolean;
}

export interface UiState {
  layout: Layout;
  /** Null in the free layout, where the person builds the layout. */
  page: PageState | null;
  /** What following a link on the curated page does for this person (`jali.page.setLinkMode`, `createJali({
   *  linkMode })`): opens a pane beside the views, or only peeks. The instance's policy, kept whether or not a page is
   *  open, so leaving the page and coming back never widens it. */
  linkMode: LinkMode;
  /** The person's mode and split layout (while Split view is on screen, the live layout is the truth). */
  prefs: PagePrefs;
  view: ViewState;
  /** The preset last chosen ("Reset layout" rebuilds it); undefined in an instance without presets. */
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
  /** A fold that splits the layout in two, measured from the browser's viewport segments; unset on a flat screen
   *  and in browsers without them. */
  hinge?: Hinge;
  /** The reading direction the panes are laid out in: right to left, a row starts at the right. Read from the page
   *  when the instance is measured, unless `createJali({ dir })` fixed it. */
  dir: Direction;
  /** Layout changes of the reshape class so far (state/apply.ts): the layout animates on a new one. */
  reshapes: number;
  /** A page tab hovered with ⌥ held: the instance previews where it would open beside. */
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
  /** What each caller of the pane hooks reports, per pane and caller: the one source of `activity`, `unsaved`,
   *  `paneCommands`, `titles` and `paneAttributes`, which are made from it (state/reports.ts) and written nowhere
   *  else. */
  paneReports: Record<NodeId, Record<string, PaneReport>>;
  /** Each pane's own state (usePaneState): JSON values, kept through folds, tabs and reloads, dropped on close. */
  paneState: Record<NodeId, Record<string, unknown>>;
  /** The object (`objectKey`) each pane's state belongs to: a pane that shows another object under the same id
   *  (a reused id, an undo, a reload) never reads it. */
  paneStateOf: Record<NodeId, string>;
  /** Pane state an undo could still bring back, by pane id and object (`objectKey`): another object's state under the
   *  same id took its place (A, then B in its pane, then Undo brings A back with A's state). Not saved. */
  paneStateHeld: HeldStates;
  /** The list (`objectKey`) each selection was made in: a new list under a closed list's id starts without it. */
  selectionOf: Record<NodeId, string>;
  /** The live region's text; `seq` makes a repeat a new announcement. */
  announcement: { text: string; seq: number };
}

/** The URL sink: writes the state (read when the write happens) to the address bar in a history mode. */
/** The share of the instance's state an address holds: what a URL writer reads. */
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

/** Writes the instance to an address: `createJali({ url })` takes one for a router of the host's own. */
export interface UrlWriter {
  /** `state` reads the instance when the write happens (a debounced write reads it late, so it writes the latest). */
  write(state: () => UrlState, mode: HistoryMode): void;
  /** The address to share ("Copy link"). */
  href?(): string;
  /** The instance is going away (`jali.destroy()`): drop a write still waiting (a debounced one), and every later
   *  one. */
  cancel?(): void;
}

/**
 * An instance's options, resolved once (`resolveOptions`, create-jali.ts) into the one shape the store reads. The
 * fields the env holds (kinds, page, presets, the chrome's options) are copied into it as they are; the rest is the
 * store's own. Adapters and tests make a store from one with `createJaliStore`. What each option means is said once,
 * on `JaliOptions`.
 */
export interface JaliConfig {
  /** This instance's pane kinds (createPaneKinds). */
  kinds: PaneKinds;
  /** The curated page (made with `definePage`). Default: none. */
  profile?: ProfileBase | null;
  /** Layouts to start from, in menu order. Default: none. */
  presets?: readonly Preset[];
  /** The preset the instance opens on, when no link or saved state says otherwise. Default: the first. An instance
   *  without presets passes `initial.layout` instead, or a `profile` alone: it then starts on its page. */
  preset?: string;
  name?: string;
  /** The launcher's kind (it must be in `kinds`). Default: none, so no Split. */
  launcher?: string;
  commands?: readonly Command[];
  /** The features it has (features/feature.ts), one of each id. */
  features?: readonly import("../features/feature").Feature[];
  dir?: Direction;
  /** `"main"` or nothing (resolved: any other value is a region). */
  landmark?: "main";
  /** Trimmed, and nothing when empty. */
  label?: string;
  confirmDiscard?: false;
  pageTheme?: false;
  tabMenu?: import("../commands/tab-menu").TabMenu;
  rename?: Rename;
  phone?: import("../env").PhoneOptions;
  allow?: import("../actions/allow").Allow;
  buttons?: import("../pane/buttons").PaneButtons;
  onPaneError?: (error: unknown, info: PaneErrorInfo) => void;
  gap?: number;
  inset?: number;
  keyboard?: KeyboardOptions;
  /** Where the instance writes its address (usually `createUrlSync()`, which `boot` and `startUi` read from too).
   *  Default: none. */
  url?: UrlWriter;
  /** Default: localStorage under `id`. */
  storage?: StoragePort;
  /** Prefix for this instance's DOM ids. Default "jali". */
  id?: string;
  initial?: Partial<UiState>;
  /** Moves DOM focus into a pane after the next paint. Default: Jali's (dom/focus.ts); `null` leaves DOM focus alone. */
  focusPane?: ((scope: JaliDom, id: NodeId) => void) | null;
  unstable?: (op: string, before: string, after: string) => void;
  beforeClose?: BeforeClose;
  settings?: Partial<Settings>;
  messages?: MessageOverrides;
}

export interface JaliStore {
  get(): UiState;
  /** A raw state write for interaction state (drag, dialogs, area). Area and pane-cap changes refit the layout. */
  set(patch: Partial<UiState>): void;
  subscribe(fn: () => void): () => void;
  model(): Model;
  ctx(): LayoutContext;
  snapshot(): Snapshot;
  /** Commit an outcome (or a step of the snapshot), and say what happened. Events go out once it is done; `action`
   *  is the public action it makes, which the `layout` event names. */
  apply(o: Outcome, action?: ActionName): ActionResult;
  /** The app's events (instance.ts). */
  on<E extends JaliEvent>(event: E, handler: (event: JaliEvents[E]) => void): () => void;
  /** The instance as an app sees it: what `createJali` returns. */
  jali: Jali;
  /** The host's close guard in use (`deps.beforeClose`). `createJali` sets it once the first layout is in place. */
  guard: BeforeClose | undefined;
  announce(text: string): void;
  writeUrl(mode: HistoryMode): void;
  /** A toast, for whoever listens to `on("toast")`; toasts sent before anyone listens are kept until someone does. */
  toast(t: Toast): void;
  /** Run the step `name` (actions/index.ts) with `args`, and say what happened: the one way every action is made, by
   *  the app (`jali.actions`), an adapter, a key, a command or an agent. */
  run<N extends StepName>(name: N, ...args: StepArgs<N>): ActionResult;
  /** The steps without a group, by name, each through `run`: `store.actions.close(id)`. */
  actions: Actions;
  /** Keys → command ids, resolved once from the defaults and `deps.keymap`. */
  keymap: Keymap;
  /** The pane kinds and profile this store was made with. */
  env: Env;
  /** Where this instance lives in the DOM. */
  dom: JaliDom;
  /** Every word this instance shows or says: English with `createJali({ messages })` over it. */
  messages: Messages;
  storage: StoragePort;
  /** Pane state and its storage, kept in step (state/pane-state.ts): what this instance changed is written over what
   *  other tabs wrote, and what they write comes in. */
  paneStates: PaneStateSync;
  /** The address to share, from the URL port. */
  href(): string;
  /** The URL writer this store was made with (`deps.url`). */
  url: UrlWriter | undefined;
  /**
   * While true, the instance moves no DOM focus of its own: not into a pane after a change, not into a dialog's
   * field when it opens, not back when the dialog closes. For something that drives the instance while the person
   * watches (a scripted tour, a remote presenter), so their keyboard focus stays where they left it. Keys the person
   * presses still move focus as usual. Default false.
   */
  focusHeld: boolean;
  /** Start the page-lifetime listeners: keys, Back and Forward, theme and saving. Returns their stop. `<JaliRoot>` calls
   *  it on mount; calling it while started does nothing. */
  start(): () => void;
  /** A gesture started (a pane or divider drag): `cancel` ends it, removing its listeners and putting back what it
   *  previewed. Stopping or destroying the instance cancels it. Returns the release the gesture calls when it ends on
   *  its own. */
  gesture(cancel: () => void): () => void;
  /** Stop for good (`jali.destroy()`): the listeners stop, a gesture in progress is cancelled, pane state waiting to
   *  be saved is saved, deferred steps
   *  (a follow waiting for the selection to rest) and a debounced address write are dropped, and the kind registry
   *  is no longer listened to. A question still open (the host's `beforeClose`, or "Discard unsaved changes?")
   *  settles as `"kept"`, every later commit is refused as `"unavailable"` and every raw write is dropped, so nothing
   *  lands on the next route. Calling it again does nothing. */
  destroy(): void;
}

/**
 * An instance's place in the DOM: the id prefix of its elements, the element that holds it (its app shell), set
 * by the component that renders it, and the adapter's `DomPort`, which finds the adapter's own elements in it. DOM
 * lookups (focus, drag, F6 regions) search inside `root()` only.
 */
export interface JaliDom {
  /** The prefix of its elements' ids. The adapter may scope it per mounted root (two instances with no `id`). */
  id: string;
  /** The adapter's markup, as the core needs to find it (dom/port.ts). `noDom` until the adapter gives one. */
  readonly port: DomPort;
  /** Give the instance the adapter's port. The adapter calls it before it renders the instance. */
  use(port: DomPort): void;
  /** What is being dragged by pointer now: a pane (or a page tab), a divider of a row or a column; null when nothing. */
  dragging(): DragKind | null;
  /** A drag starts or ends: kept here, and told to the port for the page's styles. */
  setDragging(what: DragKind | null, divider?: HTMLElement): void;
  /** The instance's root element; the document until one is attached. */
  root(): ParentNode;
  attach(el: Element | null): void;
  /** The element that holds this instance's dialogs (palette, settings, confirmations), which render outside the
   *  root; null until one is attached. Keys pressed there count as the instance's. */
  layer(): Element | null;
  attachLayer(el: Element | null): void;
  /** The element with this instance's pane id `id`, if rendered. */
  pane(id: NodeId): HTMLElement | null;
}

function createDom(id: string): JaliDom {
  let el: Element | null = null,
    layer: Element | null = null,
    port: DomPort = noDom,
    drag: DragKind | null = null;
  const root = (): ParentNode => el ?? document;
  const dom: JaliDom = {
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
        : root().querySelector<HTMLElement>(`[id=${cssString(paneDomId(dom.id, pane))}]`),
  };
  return dom;
}

export function createJaliStore(deps: JaliConfig): JaliStore {
  const page = pageEngineOf(deps.profile);
  if (deps.profile && !page)
    throw new Error("Jali: make the page with `definePage`, which gives it the code that runs it");
  const messages = resolveMessages(
    deps.messages,
    page?.words,
    deps.features?.map((f) => f.words),
  );
  const hasPalette = !!deps.features?.some((f) => f.id === "palette");
  // Development-only defaults and checks, behind a literal `process.env.NODE_ENV` test: a production build replaces
  // it with `false` and drops all of it, messages included; an unbundled page, which has no `process`, lands in the
  // catch and is production (dev.ts).
  let DEV = false;
  let devPaneError: ((error: unknown, info: PaneErrorInfo) => void) | undefined;
  let devUnstable: ((op: string) => void) | undefined;
  try {
    if (process.env.NODE_ENV !== "production") {
      DEV = true;
      devPaneError = (error, { pane, ref }) =>
        console.error(`Jali: pane ${pane ?? "peek"} (${ref.kind}) failed`, error);
      devUnstable = (op) =>
        console.error(`Layout stability: "${op}" never moves anything, but moved panes`);
      const presets = deps.presets ?? [];
      const scope = deps.keyboard?.scope;
      if (scope !== undefined && scope !== "page" && scope !== "local")
        console.error(`Jali: keyboard.scope is "page" or "local", not ${JSON.stringify(scope)}`);
      for (const [i, p] of presets.entries())
        if (presets.findIndex((q) => q.id === p.id) !== i)
          console.error(`Jali: two presets have the id "${p.id}"`);
      if (deps.preset !== undefined && !presets.some((p) => p.id === deps.preset))
        console.error(`Jali: there is no preset "${deps.preset}"`);
    }
  } catch {
    /* no `process`: production */
  }
  // The env holds the options it shares with the store as they were resolved, and what only the store can work out.
  const {
    preset: presetId,
    url,
    storage: storagePort,
    id = "jali",
    initial,
    focusPane: focusGiven,
    unstable,
    beforeClose,
    settings,
    messages: _words,
    keyboard = {},
    gap,
    inset,
    ...shared
  } = deps;
  const env: Env = {
    presets: [],
    commands: [],
    ...shared,
    profile: deps.profile ?? null,
    palette: hasPalette,
    messages,
    spacing: spacingOf({ gap, inset }),
  };
  const onPaneError = deps.onPaneError ?? devPaneError;
  if (onPaneError) env.onPaneError = onPaneError;
  if (page) env.page = page;
  const focusOf =
    focusGiven === undefined ? (typeof document === "undefined" ? null : focusPane) : focusGiven;
  const dom = createDom(id);
  // The id is the prefix: two instances with their own ids never overwrite each other ("jali" stays "jali").
  const storage = storagePort ?? browserStorage(id);
  const paneStates = paneStateSync(storage);
  const start = presetById(env, presetId);
  // A page-only app (a page, no presets or layout) starts on its page.
  const pageOnly = !initial?.layout && !start && !!env.profile;
  const first = firstLayout(env, initial?.layout, start, DEV);
  const layout = first.layout;
  let state: UiState = {
    page: null,
    prefs: loadPrefs(storage, env.profile?.id, env.kinds.registry()),
    view: { focusHistory: [] },
    // A layout that can't be shown gave way to a preset: the instance is on that preset.
    presetId: (first.preset ?? start)?.id,
    settings: loadSettings(storage, settings),
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
    linkMode: "open",
    reshapes: 0,
    ghost: null,
    unsaved: {},
    confirm: null,
    paneCommands: {},
    titles: {},
    paneAttributes: {},
    paneReports: {},
    ...paneStates.read(),
    paneStateHeld: {},
    selectionOf: {},
    ...initial,
    // The layout given, once checked (`firstLayout`), or what took its place.
    layout,
  };
  // `DEV` first: a page without `process` never reads it; a production build folds the test to false and drops it.
  if (DEV && process.env.NODE_ENV !== "production") {
    freezeTree(state.layout);
    freezeTree(state.view);
  }
  const subs = new Set<() => void>();
  const notify = () => {
    for (const fn of subs) fn();
  };
  const offKinds = env.kinds.onChange(() =>
    batch(() => {
      rereadLinks();
      // A kind registered changes titles and sizes even when no ref is read again.
      changed = true;
    }),
  );
  // The instance's lifetime (state/lifetime.ts): `destroy()` ends it, and whatever still waits on it (a host's
  // answer, a deferred step, a drag in progress) ends with it.
  const life = createLifetime();
  const pendingToasts: JaliEvents["toast"][] = [];
  const models = modelCache();
  const defer = (d: Deferred) => {
    const run = d.run;
    life.defer(d.key, d.ms, run && (() => store.apply(run)));
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
  const modelOf = (s: UiState) =>
    models({
      layout: s.layout,
      view: s.view,
      area: s.area,
      ctx: ctxOf(s),
      env,
      titles: s.titles,
      ...(s.hinge ? { hinge: s.hinge } : {}),
    });

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
    if (DEV && process.env.NODE_ENV !== "production") {
      if (next.layout !== prev.layout) freezeTree(next.layout);
      if (next.view !== prev.view) freezeTree(next.view);
    }
    state = next;
    // A refit's folds are part of what is on screen, so the address follows (a replace, once the size rests): a
    // link copied, or a reload at this size, reopens it. No history entry and no `layout` event: it is no change
    // the person made.
    // On a phone (Single view) the address stays as it was: widen, and the arrangement comes back (19 Nov 2026).
    if (
      next.layout !== patch.layout &&
      next.layout !== prev.layout &&
      (resized || recapped) &&
      next.area.width >= (env.phone?.below ?? PHONE_BELOW)
    )
      store.writeUrl("debounce");
    changed = true;
  };

  /**
   * A kind registered after a link gave refs of it: those refs drop the app-only params the link carried, wherever
   * the instance keeps them (the layout, the peek, Recent, Undo, the page's way back). A link never sets one.
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
  /** The state changed in this batch: subscribers hear it once, when the batch ends. */
  let changed = false;
  /** Batches that ended and are still to be told, oldest first. A listener that acts ends a batch while one is being
   *  told: its events wait behind that one's, so the app hears changes in the order they were made, and the last
   *  `layout` event is the layout now. */
  const queue: {
    before: UiState;
    after: UiState;
    ops: Op[];
    named?: ActionName;
    input: JaliInput;
  }[] = [];
  let telling = false;
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
    after: UiState,
    ops: readonly Op[],
    named: ActionName | undefined,
    input: JaliInput,
  ) => {
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
      if (--depth === 0) {
        // Everything the batch did is in place (state, address, announcement) before anyone hears of it: subscribers
        // once, then the events, in the order batches ended.
        if (handlers.size && from !== state)
          queue.push({ before: from, after: state, ops, named, input });
        if (changed) {
          changed = false;
          notify();
        }
        if (!telling) {
          telling = true;
          try {
            for (let e; (e = queue.shift());) told(e.before, e.after, e.ops, e.named, e.input);
          } finally {
            telling = false;
          }
        }
      }
    }
  };

  const store: JaliStore = {
    get: () => state,
    // Once destroyed, a raw write lands nowhere either: a handle kept past the instance changes nothing.
    set: (patch) => (life.ended() ? undefined : batch(() => write(patch))),
    jali: undefined as unknown as Jali,
    guard: beforeClose,
    focusHeld: false,
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) handlers.set(event, (set = new Set()));
      set.add(handler as (e: never) => void);
      if (event === "toast") for (const t of pendingToasts.splice(0)) emit("toast", t);
      return () => {
        set.delete(handler as (e: never) => void);
        if (!set.size) handlers.delete(event);
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    model: () => modelOf(state),
    ctx,
    // The model is built when a step reads it, for the state the snapshot was taken of: `apply` takes snapshots to
    // read the kinds or the words, and resolving the layout it just wrote was work nobody used.
    snapshot: () => {
      const s = state;
      let m: Model | undefined;
      return {
        s,
        get m() {
          return (m ??= modelOf(s));
        },
        ctx: ctxOf(s),
        env,
      };
    },
    // A destroyed instance changes nothing more: a late answer, a timer or a caller that kept a handle is refused.
    apply: (o, action) =>
      life.ended() ? { ok: false, reason: "unavailable" } : batch(() => apply(io, o, action)),
    // Two things said in one action ("1 change discarded", then "Order 1 closed") are one announcement: subscribers
    // hear an action once it is done, so the live region reads both.
    announce: (text) =>
      store.set({
        announcement: {
          text:
            depth && state.announcement.seq !== from.announcement.seq
              ? `${state.announcement.text}${/[.!?…]$/.test(state.announcement.text) ? "" : "."} ${text}`
              : text,
          seq: state.announcement.seq + 1,
        },
      }),
    // The writer reads the address's share of the state only (UrlState), when it writes, and as a link carries it:
    // without params only the app sets (`appOnly`).
    writeUrl: (mode) =>
      life.ended() ||
      url?.write(() => {
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
    toast: (t) => {
      const e = { ...t, input: currentInput() };
      if (handlers.has("toast")) emit("toast", e);
      else pendingToasts.push(e);
    },
    run: (name, ...args) => {
      const [step, as] = stepOf(name);
      // As a step, so a change held for an answer is the action itself, run again when the answer comes.
      return store.apply((x) => step(x, ...args), as);
    },
    actions: undefined as unknown as Actions,
    keymap: createKeymap(
      // Without Jali's palette, its key is the host's, unless the host binds it on purpose.
      !hasPalette && !(PALETTE_ID in (keyboard.keymap ?? {}))
        ? { ...keyboard.keymap, [PALETTE_ID]: null }
        : keyboard.keymap,
      { ...keyboard, words: keyboard.words ?? messages.keys },
    ),
    env,
    dom,
    messages,
    storage,
    paneStates,
    href: () => url?.href?.() ?? (typeof location === "undefined" ? "" : location.href),
    url,
    start() {
      if (stop || life.ended()) return () => {};
      const offInput = trackInput();
      const off = startUi(store, {
        keys: (keyboard.scope ?? "page") === "page" ? {} : { root: rootElement },
        pageTheme: deps.pageTheme,
      });
      stop = () => {
        // A drag still going has listeners of its own on the window: it ends with the listeners it began under.
        life.cancelGestures();
        off();
        offInput();
        stop = null;
      };
      return stop;
    },
    gesture: (cancel) => life.gesture(cancel),
    destroy() {
      if (life.ended()) return;
      // Stopping saves pane state still waiting to be saved; without a start, nothing saves it at all.
      stop?.();
      // A gesture in progress puts back what it previewed while the instance can still be written to.
      life.cancelGestures();
      // A question still open can never be answered now: the action it held ends as kept, so `settled` resolves.
      const asking = state.confirm;
      if (asking) store.set({ confirm: null });
      life.end();
      url?.cancel?.();
      offKinds();
      asking?.settle({ ok: false, reason: "kept" });
    },
  };
  let stop: (() => void) | null = null;
  const io = {
    get: store.get,
    set: write,
    // An action refused or held part way puts back the state it read: subscribers then hear no change at all.
    restore: (previous: UiState) => {
      state = previous;
      changed = true;
    },
    committed: (op: Op, action?: ActionName) => {
      ops.push(op);
      named ??= action;
    },
    get beforeClose() {
      return store.guard;
    },
    later: (o: Outcome) => store.apply(o),
    signal: life.signal,
    snapshot: store.snapshot,
    url: store.writeUrl,
    announce: store.announce,
    toast: store.toast,
    focus: (id: NodeId) => (store.focusHeld || life.ended() ? undefined : focusOf?.(dom, id)),
    defer,
    unstable: unstable ?? devUnstable,
  };
  // Every step without a group (public or an adapter's), by name: the same `run` the instance's actions call.
  store.actions = bindSteps(store.run, (name) =>
    name.includes(".") ? undefined : name,
  ) as unknown as Actions;
  store.jali = createInstance(store);
  // As an arrival, which writes no history: the address still holds the link boot is about to read, and boot writes
  // the address itself once it has.
  if ((pageOnly || first.page) && !initial?.page) store.run("arrivePage", { fromUrl: true });
  return store;
}

/**
 * In development, the layout and view an instance commits are frozen, so an app that edits what `get()`,
 * `getLayout()` or an event gave it fails at once, instead of changing the instance behind its back (no history, no
 * event, a model cache that no longer matches). Refs are left as they are: they may be the app's own objects. What is
 * frozen already (shared with the last commit) is not walked again.
 */
function freezeTree(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const [k, v] of Object.entries(value)) if (k !== "ref" && k !== "peek") freezeTree(v);
  Object.freeze(value);
}

/**
 * The layout an instance starts on, checked as `setLayout` and links check theirs (`core.validate`): the one given
 * (`createJali({ layout })`, often one the app saved), else the preset it opens on, the other presets, the curated
 * page, and a lone launcher, in that order. A layout that can't be shown (a kind removed since it was saved, two
 * panes with one id, a malformed tree) is skipped, and development says why. Throws only when nothing can be shown.
 */
function firstLayout(
  env: Env,
  given: Layout | undefined,
  start: Preset | undefined,
  dev: boolean,
): { layout: Layout; preset?: Preset; page?: true } {
  // A copy (the app's own object is never frozen or kept). A ref its kind's params can't read still opens, in the
  // kind's `Missing`, as an app's layout always has.
  const read = (input: LayoutInput | (() => LayoutInput)) => readLayout(input, env, false);
  // Why the layout given can't be shown, for development and for the error when nothing can be.
  const why = () => (given ? core.validate(given, env.kinds.registry(), { params: false }) : null);
  const done = (r: { layout: Layout; preset?: Preset; page?: true }) => {
    try {
      if (process.env.NODE_ENV !== "production" && dev && given)
        console.error("Jali: the layout given can't be shown", why());
    } catch {
      /* no `process`: production */
    }
    return r;
  };
  let layout = given && read(given);
  if (layout) return { layout };
  for (const p of start ? [start, ...env.presets.filter((q) => q !== start)] : env.presets)
    if ((layout = read(p.build))) return done({ layout, preset: p });
  const p = env.profile,
    launcher = env.launcher;
  // The page's layout opens the page, as a page-only instance does.
  if (p && (layout = read(() => p.build(p.firstItem)))) return done({ layout, page: true });
  if (launcher && (layout = read({ kind: launcher, params: {} }))) return done({ layout });
  const r = why();
  throw new Error(
    `Jali: no layout to start from can be shown${r && !r.ok ? `: ${r.errors[0]}` : ""}`,
  );
}
