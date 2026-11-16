/**
 * UI state: one small external store (useSyncExternalStore). Layout + view come from layout-core ops; everything
 * here is coordination: history, undo, announcements, settings, transient interaction state.
 */
import { useSyncExternalStore } from "react";
import type {
  Edge, FitOptions, Layout, LayoutNode, NodeId, ObjectRef, PaneNode, ResolvedLayout, UndoEntry, ViewState,
} from "../layout-core/types";
import { core, setPaneCap } from "./core";
import { kindRegistry, paneTitle, type PaneActivity } from "./pane-kinds";
import { DEFAULT_PRESET, presetById, type PresetId } from "./presets";

export const GAP = 6;

export interface Settings {
  adapter: "rrp" | "ark";
  centreDrop: "swap" | "tab";
  paneCap: number;
  showStats: boolean;
}

export interface DndState {
  dragged: NodeId;
  x: number;
  y: number;
  target?: NodeId;
  zone?: Edge | "centre";
}

export interface UiState {
  layout: Layout;
  view: ViewState;
  presetId: PresetId;
  settings: Settings;
  closedStack: UndoEntry[];
  activity: Record<NodeId, PaneActivity>;
  peekSource?: NodeId;
  /** A divider drag is in progress (heavy panes hold their content). */
  dividerDrag: boolean;
  dnd: DndState | null;
  resizeMode: NodeId | null;
  paletteOpen: boolean;
  settingsOpen: boolean;
  area: { width: number; height: number };
  /** Bumped when persisted (URL written), for the status line. */
  savedAt: number;
}

const SETTINGS_KEY = "pane-lab:settings";
function loadSettings(): Settings {
  const d: Settings = { adapter: "rrp", centreDrop: "swap", paneCap: 8, showStats: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return d;
  }
}

let state: UiState = {
  layout: presetById(DEFAULT_PRESET).build(),
  view: { focusHistory: [] },
  presetId: DEFAULT_PRESET,
  settings: loadSettings(),
  closedStack: [],
  activity: {},
  dividerDrag: false,
  dnd: null,
  resizeMode: null,
  paletteOpen: false,
  settingsOpen: false,
  // First guess before the ResizeObserver measures: window minus bars and insets.
  area: typeof window === "undefined" ? { width: 1200, height: 700 } : { width: window.innerWidth - 12, height: window.innerHeight - 48 - 28 - 12 },
  savedAt: 0,
};
const subs = new Set<() => void>();
let kindsVersion = 0;
setPaneCap(state.settings.paneCap);

export const getState = () => state;
export function setState(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  if ("settings" in p) {
    if (state.settings.paneCap !== undefined) {
      setPaneCap(state.settings.paneCap);
      kindsVersion++;
    }
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* private mode */ }
  }
  for (const s of subs) s();
}
export function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export function useUi<T>(sel: (s: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

// ---------- derived ----------

let kindsCache: { v: number; reg: ReturnType<typeof kindRegistry> } | null = null;
export function bumpKinds() { kindsVersion++; }
export function fit(): FitOptions {
  if (!kindsCache || kindsCache.v !== kindsVersion) kindsCache = { v: kindsVersion, reg: kindRegistry() };
  return { width: state.area.width, height: state.area.height, gap: GAP, kinds: kindsCache.reg };
}

let resolvedCache: { layout: Layout; view: ViewState; w: number; h: number; k: number; r: ResolvedLayout } | null = null;
export function resolved(): ResolvedLayout {
  const c = resolvedCache;
  if (c && c.layout === state.layout && c.view === state.view && c.w === state.area.width && c.h === state.area.height && c.k === kindsVersion) return c.r;
  const r = core.resolve(state.layout, state.view, fit());
  resolvedCache = { layout: state.layout, view: state.view, w: state.area.width, h: state.area.height, k: kindsVersion, r };
  return r;
}

export function allPanes(node: LayoutNode = state.layout.root): PaneNode[] {
  if (node.type === "pane") return [node];
  return node.children.flatMap((c) => allPanes(c as LayoutNode));
}
export function findPane(id: NodeId | undefined): PaneNode | undefined {
  return id ? allPanes().find((p) => p.id === id) : undefined;
}
export function findNode(id: NodeId, node: LayoutNode = state.layout.root): LayoutNode | undefined {
  if (node.id === id) return node;
  if (node.type === "pane") return undefined;
  for (const c of node.children) {
    const f = findNode(id, c as LayoutNode);
    if (f) return f;
  }
  return undefined;
}
export function titleOf(id: NodeId | undefined): string {
  const p = findPane(id);
  return p ? paneTitle(p.ref) : "pane";
}
/** Visible panes in reading order (resolve order). */
export function visiblePaneIds(): NodeId[] {
  return resolved().panes.filter((b) => !b.hiddenInStack).map((b) => b.id);
}

// ---------- announcer + history hooks (wired by App) ----------

type HistoryMode = "push" | "replace" | "debounce" | "none";
export const hooks = {
  announce: (_msg: string) => {},
  writeUrl: (_mode: HistoryMode) => {},
  toastClosed: (_label: string) => {},
};

function commit(layout: Layout, view: ViewState, opts: { history: HistoryMode; announce?: string; extra?: Partial<UiState> }) {
  setState({ layout, view, ...opts.extra });
  hooks.writeUrl(opts.history);
  if (opts.announce) hooks.announce(opts.announce);
}

/** Split, close and move leave zoom first (herdr). */
function unzoomed(view: ViewState): ViewState {
  if (!view.zoomed) return view;
  const v = { ...view };
  delete v.zoomed;
  return v;
}

// ---------- actions ----------

export const actions = {
  focus(id: NodeId) {
    if (state.view.focused === id && state.view.focusHistory[0] === id) return;
    setState({ view: core.focus(state.view, id) });
  },
  focusCycle(delta: 1 | -1) {
    const v = core.focusCycle(state.view, resolved(), delta);
    actions.afterFocusMove(v);
  },
  focusIndex(n: number) {
    const id = visiblePaneIds()[n - 1];
    if (id) actions.afterFocusMove(core.focus(state.view, id));
  },
  focusDirection(dir: Edge) {
    actions.afterFocusMove(core.focusDirection(state.view, resolved(), dir));
  },
  /** While zoomed, focus keys switch which pane is zoomed (herdr). */
  afterFocusMove(v: ViewState) {
    if (state.view.zoomed && v.focused && v.focused !== state.view.zoomed) {
      v = { ...v, zoomed: v.focused };
      setState({ view: v });
      hooks.writeUrl("replace");
      hooks.announce(`${titleOf(v.focused)} maximised · Escape to restore`);
      return;
    }
    setState({ view: v });
  },

  openBeside(source: NodeId, ref: ObjectRef) {
    const view0 = unzoomed(state.view);
    const r = core.openBeside(state.layout, view0, source, ref, fit());
    // Founder decision 2: focus stays in the source.
    const view = { ...r.view, focused: source, focusHistory: r.view.focusHistory.length ? r.view.focusHistory : [source] };
    const t = paneTitle(ref), s = titleOf(source);
    const msg =
      r.mode === "replaced" ? `${t} shown beside ${s}` : r.mode === "tab" ? `${t} opened as a tab: not enough room beside ${s}` : `${t} opened beside ${s}`;
    commit(r.layout, view, { history: "push", announce: msg });
    return r.opened;
  },
  split(dir: "right" | "bottom", target = state.view.focused) {
    const p = findPane(target);
    if (!p) return;
    const r = core.split(state.layout, unzoomed(state.view), p.id, dir, p.ref, fit());
    commit(r.layout, r.view, {
      history: "push",
      announce: r.mode === "tab" ? `Split opened as a tab: not enough room` : `${titleOf(p.id)} split ${dir === "right" ? "right" : "down"}`,
    });
  },
  close(id = state.view.focused) {
    if (!id || !findPane(id)) return;
    if (allPanes().length <= 1) {
      hooks.announce("The last pane stays open");
      return;
    }
    const title = titleOf(id);
    const r = core.close(state.layout, unzoomed(state.view), id);
    commit(r.layout, r.view, { history: "push", announce: `${title} closed · Undo available`, extra: { closedStack: [...state.closedStack, r.undo].slice(-20), ...(state.peekSource === id ? { peekSource: undefined } : {}) } });
    hooks.toastClosed(title);
  },
  closeOthers(id = state.view.focused) {
    if (!id) return;
    const r = core.closeOthers(state.layout, unzoomed(state.view), id);
    commit(r.layout, r.view, { history: "push", announce: `Other panes closed · Undo available`, extra: { closedStack: [...state.closedStack, r.undo].slice(-20) } });
    hooks.toastClosed("Other panes");
  },
  undoClose() {
    const e = state.closedStack[state.closedStack.length - 1];
    if (!e) {
      hooks.announce("Nothing to restore");
      return;
    }
    commit(e.before.layout, e.before.view, { history: "push", announce: `${e.label === "Pane closed" ? "Pane" : "Panes"} restored`, extra: { closedStack: state.closedStack.slice(0, -1) } });
  },
  toggleZoom(id = state.view.focused) {
    if (!id) return;
    if (allPanes().length <= 1 && !state.view.zoomed) return; // one pane alone: zoom does nothing
    const v = core.toggleZoom(core.focus(state.view, id), id);
    setState({ view: v });
    hooks.writeUrl("replace");
    hooks.announce(v.zoomed ? `${titleOf(id)} maximised · Escape to restore` : `${titleOf(id)} restored`);
  },
  setCollapsed(id = state.view.focused, collapsed?: boolean) {
    const p = findPane(id);
    if (!p) return;
    const next = collapsed ?? !p.collapsed;
    commit(core.setCollapsed(state.layout, p.id, next), state.view, { history: "replace", announce: `${titleOf(p.id)} ${next ? "collapsed" : "restored"}` });
  },
  moveDirection(dir: Edge, id = state.view.focused) {
    if (!id) return;
    const before = state.layout;
    const r = core.moveDirection(state.layout, unzoomed(state.view), id, dir, fit());
    if (r.layout === before) {
      hooks.announce(`${titleOf(id)} can't move ${dirWord(dir)}`);
      return;
    }
    commit(r.layout, r.view, { history: "push", announce: `${titleOf(id)} moved ${dirWord(dir)}` });
  },
  drop(dragged: NodeId, target: NodeId, zone: Edge | "centre") {
    const mode = state.settings.centreDrop;
    const r = core.drop(state.layout, state.view, dragged, target, zone, mode);
    const msg =
      zone === "centre"
        ? mode === "swap" ? `${titleOf(dragged)} swapped with ${titleOf(target)}` : `${titleOf(dragged)} added as a tab with ${titleOf(target)}`
        : `${titleOf(dragged)} placed ${dirWord(zone)} of ${titleOf(target)}`;
    commit(r.layout, core.focus(r.view, dragged), { history: "push", announce: msg });
  },
  swapWithNext(id = state.view.focused) {
    const order = visiblePaneIds();
    const i = order.indexOf(id ?? "");
    const other = order[i + 1] ?? order[i - 1];
    if (!id || !other) return;
    commit(core.swap(state.layout, id, other), state.view, { history: "push", announce: `${titleOf(id)} swapped with ${titleOf(other)}` });
  },
  setActiveTab(stack: NodeId, pane: NodeId) {
    commit(core.setActiveTab(state.layout, stack, pane), core.focus(state.view, pane), { history: "replace", announce: `${titleOf(pane)} tab shown` });
  },
  resizeDivider(parentId: NodeId, index: number, deltaPx: number) {
    if (!deltaPx) return;
    const next = core.resizeDivider(state.layout, parentId, index, deltaPx, fit());
    if (next !== state.layout) commit(next, state.view, { history: "debounce" });
  },
  resetDivider(parentId: NodeId, index: number) {
    commit(core.resetDivider(state.layout, parentId, index), state.view, { history: "replace", announce: "Sizes reset" });
  },
  preset(id: PresetId) {
    const layout = core.resetLayout(presetById(id).build());
    const first = allPanes(layout.root)[0]?.id;
    const view: ViewState = first ? { focused: first, focusHistory: [first] } : { focusHistory: [] };
    commit(layout, view, { history: "push", announce: `Layout: ${presetById(id).label}`, extra: { presetId: id, peekSource: undefined, resizeMode: null } });
  },
  resetLayout() {
    actions.preset(state.presetId);
  },
  peek(ref: ObjectRef | null, source?: NodeId) {
    const view = { ...state.view };
    if (ref) view.peek = ref;
    else delete view.peek;
    setState({ view, peekSource: ref ? (source ?? state.peekSource ?? state.view.focused) : undefined });
    hooks.writeUrl("replace");
    hooks.announce(ref ? `Peek: ${paneTitle(ref)} · Escape to close` : "Peek closed");
  },
  pinPeek() {
    const ref = state.view.peek;
    const source = state.peekSource ?? state.view.focused;
    if (!ref || !source) return;
    actions.peek(null);
    actions.openBeside(source, ref);
  },
  openPeekFull() {
    const ref = state.view.peek;
    if (!ref) return;
    const layout: Layout = { version: 1, root: { id: "full", type: "pane", size: { weight: 1 }, ref } };
    commit(layout, { focused: "full", focusHistory: ["full"] }, { history: "push", announce: `${paneTitle(ref)} opened full`, extra: { peekSource: undefined } });
  },
  /** The pane's selection moved; an open peek from that pane follows it (Linear). */
  select(source: NodeId, ref: ObjectRef | null) {
    if (ref && state.view.peek && state.peekSource === source) {
      setState({ view: { ...state.view, peek: ref } });
      hooks.writeUrl("replace");
    }
  },
  setActivity(id: NodeId, a: PaneActivity) {
    if (state.activity[id] === a) return;
    setState({ activity: { ...state.activity, [id]: a } });
  },
};

export function dirWord(d: Edge | "centre") {
  return d === "top" ? "up" : d === "bottom" ? "down" : d === "centre" ? "into the centre" : d;
}
