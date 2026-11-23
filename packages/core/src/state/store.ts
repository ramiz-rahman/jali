import { sameHinge, type Hinge } from "../workspace/stack";
import { restoreWide, snapshotWide, type WideSnapshot } from "../workspace/single-view";
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
  rereadLayout,
  rereadRef,
  type PaneActivity,
  type PaneAttributes,
  type PaneCommand,
  type PaneErrorInfo,
  type PaneKinds,
} from "../pane-kinds";
import { spacingOf } from "../tokens";
import {
  bindSteps,
  REPORT_STEPS,
  stepOf,
  type Actions,
  type StepArgs,
  type StepName,
} from "../actions";
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
  type Outcome,
  type Snapshot,
  type Toast,
} from "./apply";
import { createInstance, type Jali, type JaliEvent, type JaliEvents } from "./instance";
import { currentInput, trackInput, withInput } from "../dom/input";
import { modelCache, type Model } from "./model";
import type { Settings } from "./settings";
import type { PagePrefs } from "./page-prefs";
import { pageEngineOf, type ItemId, type ViewMode, type ProfileBase } from "../profile";
import { presetById, PHONE_BELOW, type Env, type Preset } from "../env";
import { browserStorage, type StoragePort } from "../ports";
import { focusPane } from "../dom/focus";
import { createDom, type JaliDom } from "../dom/scope";
export type { JaliDom } from "../dom/scope";
import { paneStateSync, type HeldStates, type PaneStateSync } from "./pane-state";
import { createLifetime } from "./lifetime";
import { createEvents } from "./events";
import { developmentChecks, firstLayout, freezeTree, initialState } from "./initial";

declare const process: { env: { NODE_ENV?: string } };
import { startUi } from "../boot";
import { createKeymap, PALETTE_ID, type Keymap, type KeyboardOptions } from "../commands/keymap";
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
  /** The arrangement just before one pane at a time began, put back when it ends (workspace/single-view.ts). */
  wide: WideSnapshot | null;
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
/** `view` without the peek, which no address holds. */
function withoutPeek(view: ViewState): ViewState {
  if (!view.peek) return view;
  const { peek: _peek, ...rest } = view;
  return rest;
}

export interface UrlState {
  /** The layout on screen. */
  layout: Layout;
  /** Focus, the maximised pane and where rows that scroll came to rest. Never the peek: a reload closes it. */
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
  /** How long `layout`'s text would be in the address this writer writes (after its own filtering). With it, a change
   *  whose link would be too long to read back is refused; without it, only the node count is checked. */
  linkText?(layout: Layout): number;
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

/** The panes' element as the adapter measured it (`store.measure`). */
export interface Measurement {
  area: { width: number; height: number };
  dir: Direction;
  hinge: Hinge | undefined;
}

export interface JaliStore {
  get(): UiState;
  /** A raw state write for interaction state (drag, dialogs, area). Area and pane-cap changes refit the layout. */
  set(patch: Partial<UiState>): void;
  /**
   * What the adapter measured of the panes' element: its usable size, reading direction and fold. The first since the
   * instance started is where it starts; from then on, one pane at a time starting or ending (for this or any other
   * change) is said, and ending it puts back the arrangement from just before it began.
   */
  measure(measured: Measurement): void;
  subscribe(fn: () => void): () => void;
  model(): Model;
  ctx(): LayoutContext;
  snapshot(): Snapshot;
  /** Commit an outcome (or a step of the snapshot), and say what happened. Events go out once it is done; `action`
   *  is the public action it makes, which the `layout` event names. Made from host code a commit is running (its
   *  `beforeClose` answering at once), it waits for that commit to end, then runs against the state then: it returns
   *  `"pending"`, and `settled` says what happened. */
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
  /** Whether `destroy()` has run: nothing it is asked to do lands any more. */
  ended(): boolean;
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
  // Development-only defaults and checks (state/initial.ts); a production build drops them.
  const { dev: DEV, paneError: devPaneError, unstable: devUnstable } = developmentChecks(deps);
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
    ...shared
  } = deps;
  const env: Env = {
    presets: [],
    commands: [],
    ...shared,
    profile: deps.profile ?? null,
    palette: hasPalette,
    messages,
    spacing: spacingOf({ gap }),
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
  // The first state: the layout the instance opens on (`firstLayout`), what this device kept, and `initial` over it.
  const start = presetById(env, presetId);
  // A page-only app (a page, no presets or layout) starts on its page.
  const pageOnly = !initial?.layout && !start && !!env.profile;
  const first = firstLayout(env, initial?.layout, start, DEV);
  let state: UiState = initialState({
    env,
    storage,
    paneStates,
    first,
    start,
    ...(settings ? { settings } : {}),
    ...(deps.dir ? { dir: deps.dir } : {}),
    ...(initial ? { initial } : {}),
  });
  // `DEV` first: a page without `process` never reads it; a production build folds the test to false and drops it.
  if (DEV && process.env.NODE_ENV !== "production") {
    freezeTree(state.layout);
    freezeTree(state.view);
  }
  // Who hears what the instance did, once each commit ends (state/events.ts). One pane at a time is settled as each
  // ends, whatever changed it.
  const events = createEvents(
    () => state,
    () => settleOnePane(),
  );
  const batch = events.batch;
  const offKinds = env.kinds.onChange(() =>
    batch(() => {
      rereadLinks();
      // A kind registered changes titles and sizes even when no ref is read again.
      events.changed();
    }),
  );
  // The instance's lifetime (state/lifetime.ts): `destroy()` ends it, and whatever still waits on it (a host's
  // answer, a deferred step, a drag in progress) ends with it.
  const life = createLifetime();
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
    events.changed();
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

  /**
   * One pane at a time, as last settled; undefined until the adapter measures (`measure`) after a start, so an instance
   * with no element, or one only just mounted, says nothing about it.
   */
  let onePane: boolean | undefined;
  /** Settles one pane at a time starting or ending, as the batch that changed it ends: it freezes the arrangement the
   *  batch started from, or puts the frozen one back, and says so, in the same batch. */
  const settleOnePane = () => {
    // A hidden element (no width) says nothing about room: one pane at a time stays as it was.
    if (onePane === undefined || !state.area.width) return;
    const now = modelOf(state).onePane;
    if (now === onePane) return;
    onePane = now;
    const from = events.batchStart()!;
    if (now) write({ wide: snapshotWide(modelOf(from), from.view) });
    else {
      const wide = state.wide;
      if (wide) {
        commit((x) => restoreWide(x, wide));
        write({ wide: null });
      }
    }
    const said = messages.announcements;
    store.announce(now ? said.onePaneOn : said.onePaneOff);
  };

  const store: JaliStore = {
    get: () => state,
    // Once destroyed, a raw write lands nowhere either: a handle kept past the instance changes nothing.
    set: (patch) => (life.ended() ? undefined : batch(() => write(patch))),
    jali: undefined as unknown as Jali,
    guard: beforeClose,
    focusHeld: false,
    on: events.on,
    subscribe: events.subscribe,
    model: () => modelOf(state),
    measure: ({ area, dir, hinge }) => {
      if (life.ended()) return;
      const s = state;
      if (
        s.area.width !== area.width ||
        s.area.height !== area.height ||
        s.dir !== dir ||
        !sameHinge(s.hinge, hinge)
      )
        store.set({ area, dir, hinge });
      onePane ??= modelOf(state).onePane;
    },
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
    apply: (o, action) => (hosting ? wait(o, action) : commit(o, action)),
    // Two things said in one action ("1 change discarded", then "Order 1 closed") are one announcement: subscribers
    // hear an action once it is done, so the live region reads both.
    announce: (text) => {
      const from = events.batchStart();
      store.set({
        announcement: {
          text:
            from && state.announcement.seq !== from.announcement.seq
              ? `${state.announcement.text}${/[.!?…]$/.test(state.announcement.text) ? "" : "."} ${text}`
              : text,
          seq: state.announcement.seq + 1,
        },
      });
    },
    // The writer reads the address's share of the state only (UrlState), when it writes, and as a link carries it:
    // without params only the app sets (`appOnly`), and without the peek, which is never in the address.
    writeUrl: (mode) =>
      life.ended() ||
      url?.write(() => {
        const { layout, view, presetId, page } = store.get();
        const kinds = env.kinds.registry();
        // The page's way back holds refs too: a writer of the host's own sees it as a link carries it.
        const before = page?.before && linkLayout(kinds, page.before);
        return {
          layout: linkLayout(kinds, layout),
          view: withoutPeek(view),
          presetId,
          page: page && before !== page.before ? { ...page, before } : page,
        };
      }, mode),
    toast: events.toast,
    run: (name, ...args) => {
      const [step, as] = stepOf(name);
      // As a step, so a change held for an answer is the action itself, run again when the answer comes. A pane's
      // report lands at once even while host code decides: the commit asking reads it again (unsaved work is asked
      // about), and it never changes the layout that commit was made from.
      const o = (x: Snapshot) => step(x, ...args);
      return REPORT_STEPS.has(name) ? commit(o, as) : store.apply(o, as);
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
      // Each start's stop is its own: once it has run, or once another start has taken over, calling it again does
      // nothing, so a stale handle never stops (or forgets) a later start's listeners.
      const mine = () => {
        if (stop !== mine) return;
        stop = null;
        // The next start measures afresh.
        onePane = undefined;
        // A drag still going has listeners of its own on the window: it ends with the listeners it began under.
        life.cancelGestures();
        off();
        offInput();
      };
      stop = mine;
      return mine;
    },
    gesture: (cancel) => life.gesture(cancel),
    ended: () => life.ended(),
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
      // Commits host code made that still wait are refused now, so their `settled` resolves.
      for (const w of waiting.splice(0)) w();
      url?.cancel?.();
      offKinds();
      asking?.settle({ ok: false, reason: "kept" });
    },
  };
  let stop: (() => void) | null = null;
  /**
   * Host code a commit is running now (`beforeClose` answering at once). A commit it makes can't land in the middle:
   * the commit asking has read the state, and would write over it. So it waits, and runs once that commit ends,
   * against the state then, as a held action does (state/apply.ts, "Held questions").
   */
  let hosting = 0;
  const waiting: (() => void)[] = [];
  function wait(o: Outcome, action?: ActionName): ActionResult {
    let settle!: (r: ActionResult | Promise<ActionResult>) => void;
    const settled = new Promise<ActionResult>((r) => (settle = r));
    const input = currentInput();
    waiting.push(() => {
      const r = withInput(input, () => commit(o, action));
      settle(r.reason === "pending" && r.settled ? r.settled : r);
    });
    return { ok: false, reason: "pending", settled };
  }
  // A destroyed instance changes nothing more: a late answer, a timer or a caller that kept a handle is refused.
  function commit(o: Outcome, action?: ActionName): ActionResult {
    if (life.ended()) return { ok: false, reason: "unavailable" };
    const r = batch(() => apply(io, o, action));
    // Commits host code made while this one asked it, in the order it made them: each its own batch, after this.
    while (!hosting && waiting.length) waiting.shift()!();
    return r;
  }
  const io = {
    get: store.get,
    set: write,
    // An action refused or held part way puts back the state it read: subscribers then hear no change at all.
    restore: (previous: UiState) => {
      state = previous;
      events.changed();
    },
    committed: events.committed,
    get beforeClose() {
      return store.guard;
    },
    host<T>(call: () => T): T {
      hosting++;
      try {
        return call();
      } finally {
        hosting--;
      }
    },
    later: (o: Outcome) => store.apply(o),
    // As a link carries it: without params only the app sets.
    linkText: url?.linkText && ((l: Layout) => url.linkText!(linkLayout(env.kinds.registry(), l))),
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
