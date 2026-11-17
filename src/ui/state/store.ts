/**
 * The UI store: state, one derived model, and apply(). Layout and view come from layout-core ops; actions are pure
 * (actions/) and the store only commits them. Effects leave through sinks given at creation (URL, DOM focus) and
 * through `onToast` (toasts); announcements are state, so nothing said before the live region mounts is lost.
 */
import * as core from "../../layout-core";
import type { Layout, LayoutContext, NodeId, ObjectRef, UndoEntry, ViewState } from "../../layout-core/types";
import { kindRegistry, onKindsChange, type PaneActivity } from "../pane-kinds";
import { DEFAULT_PRESET, presetById, type PresetId } from "../presets";
import { GAP, initialArea } from "../tokens";
import { bindActions, type Actions } from "../actions";
import { apply, type HistoryMode, type Outcome, type Snapshot, type Toast } from "./apply";
import { modelCache, type WorkspaceModel } from "./model";
import { loadSettings, systemPrefersDark, type Settings } from "./settings";

export interface DndState { dragged: NodeId; x: number; y: number; target?: NodeId; zone?: import("../../layout-core/types").Edge | "centre" }
/** A chooser dialog opened by a command (⌘K "Add to tabs of…"). */
export interface ChooserState { kind: "merge"; source: NodeId }

export interface UiState {
  layout: Layout;
  view: ViewState;
  presetId: PresetId;
  settings: Settings;
  /** The system's colour preference, for the "system" theme. */
  systemDark: boolean;
  /** ⌘Z: closes and tucks, most recent last (state/undo.ts). */
  undoStack: UndoEntry[];
  activity: Record<NodeId, PaneActivity>;
  peekSource?: NodeId;
  dnd: DndState | null;
  resizeMode: NodeId | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  chooser: ChooserState | null;
  /** Objects opened this session, most recent first (the launcher's "Recent"). */
  recent: ObjectRef[];
  area: { width: number; height: number };
  /** The live region's text; `seq` makes a repeat a new announcement. */
  announcement: { text: string; seq: number };
}

/** The URL sink: writes the state (read when the write happens) to the address bar in a history mode. */
export interface UrlWriter { write(state: () => UiState, mode: HistoryMode): void }

export interface UiStoreDeps {
  url?: UrlWriter;
  /** Moves DOM focus into a pane after the next paint (dom/focus.ts). */
  focusPane?: (id: NodeId) => void;
  initial?: Partial<UiState>;
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
}

export function createUiStore(deps: UiStoreDeps = {}): UiStore {
  let state: UiState = {
    layout: presetById(DEFAULT_PRESET).build(),
    view: { focusHistory: [] },
    presetId: DEFAULT_PRESET,
    settings: loadSettings(),
    systemDark: systemPrefersDark(),
    undoStack: [],
    activity: {},
    dnd: null,
    resizeMode: null,
    paletteOpen: false,
    settingsOpen: false,
    chooser: null,
    recent: [],
    area: initialArea(),
    announcement: { text: "", seq: 0 },
    ...deps.initial,
  };
  const subs = new Set<() => void>();
  const notify = () => { for (const fn of subs) fn(); };
  onKindsChange(notify);
  const toastFns = new Set<(t: Toast) => void>();
  const pendingToasts: Toast[] = [];
  const models = modelCache();

  const ctx = (): LayoutContext => ({ fit: { ...state.area, gap: GAP, kinds: kindRegistry() }, paneCap: state.settings.paneCap });

  const store: UiStore = {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      // Size and cap changes come from outside the layout, so they refit it. Link arrivals refit where they land.
      const resized = prev.area.width !== state.area.width || prev.area.height !== state.area.height;
      const recapped = prev.settings.paneCap !== state.settings.paneCap;
      const known = kindRegistry();
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
    model: () => models({ layout: state.layout, view: state.view, area: state.area, ctx: ctx() }),
    ctx,
    snapshot: () => ({ s: state, m: store.model(), ctx: ctx() }),
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
  };
  const io = {
    get: store.get,
    set: store.set,
    snapshot: store.snapshot,
    url: store.writeUrl,
    announce: store.announce,
    toast: store.toast,
    focus: (id: NodeId) => deps.focusPane?.(id),
  };
  store.actions = bindActions(store);
  return store;
}
