/**
 * UI state: one small external store (useSyncExternalStore). Layout + view come from layout-core ops; everything
 * here is coordination: history, undo, announcements, settings, transient interaction state.
 */
import { useSyncExternalStore } from "react";
import type {
  Edge, FitOptions, Layout, LayoutNode, NodeId, ObjectRef, PaneNode, ResolvedLayout, ShelfEntry, TuckRefusal, UndoEntry, ViewState,
} from "../layout-core/types";
import { core } from "./core";
import { kindRegistry, paneTitle, type PaneActivity } from "./pane-kinds";
import { DEFAULT_PRESET, presetById, type PresetId } from "./presets";
import { paneDomId } from "./ids";

export const GAP = 6;
/** Height of the pane switcher in single view. */
export const SWITCHER_H = 44;

export interface Settings {
  adapter: "own" | "ark";
  centreDrop: "swap" | "tab";
  paneCap: number;
  showStats: boolean;
  theme: ThemeChoice;
}
export type ThemeChoice = "system" | "light" | "dark";

/** Sets or clears data-theme on <html>; CSS follows the system when it is absent. */
export function applyTheme(theme: ThemeChoice) {
  if (typeof document === "undefined") return;
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export interface DndState {
  dragged: NodeId;
  x: number;
  y: number;
  target?: NodeId;
  zone?: Edge | "centre";
}

/** A chooser dialog opened by a command (⌘K "Add to tabs of…"). */
export interface ChooserState {
  kind: "merge";
  source: NodeId;
}

/** What a new split or a stack's "+" shows until the person chooses an object. */
export const LAUNCHER: ObjectRef = { kind: "launcher", params: {} };
export const RECENT_MAX = 8;

export interface UiState {
  layout: Layout;
  view: ViewState;
  presetId: PresetId;
  settings: Settings;
  /** ⌘Z: closes and tucks, most recent last. A tuck entry (`tucked`) is undone by putting the pane back. */
  closedStack: UndoEntry[];
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
  /** Bumped when persisted (URL written), for the status line. */
  savedAt: number;
}

const SETTINGS_KEY = "pane-lab:settings";
function loadSettings(): Settings {
  const d: Settings = { adapter: "own", centreDrop: "swap", paneCap: 8, showStats: true, theme: "system" };
  try {
    const s: Settings = { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
    // "rrp" (react-resizable-panels) was dropped from the drag path: saved settings fall back to our own separator.
    if (s.adapter !== "own" && s.adapter !== "ark") s.adapter = "own";
    if (s.theme !== "light" && s.theme !== "dark") s.theme = "system";
    return s;
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
  dnd: null,
  resizeMode: null,
  paletteOpen: false,
  settingsOpen: false,
  chooser: null,
  recent: [],
  // First guess before the ResizeObserver measures: window minus bars and insets.
  area: typeof window === "undefined" ? { width: 1200, height: 700 } : { width: window.innerWidth - 12, height: window.innerHeight - 48 - 28 - 12 },
  savedAt: 0,
};
const subs = new Set<() => void>();
let kindsVersion = 0;
applyTheme(state.settings.theme);

export const getState = () => state;

export function setState(patch: Partial<UiState> | ((s: UiState) => Partial<UiState>)) {
  const p = typeof patch === "function" ? patch(state) : patch;
  const prev = state;
  state = { ...state, ...p };
  if ("settings" in p) {
    if (state.settings.paneCap !== undefined) {
      kindsVersion++;
    }
    applyTheme(state.settings.theme);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* private mode */ }
  }
  // External size and cap changes refit. URL arrivals and boot refit at their call sites.
  const resized = "area" in p && (prev.area.width !== state.area.width || prev.area.height !== state.area.height);
  const recapped = "settings" in p && prev.settings.paneCap !== state.settings.paneCap;
  if ((resized || recapped) && allPanes().every(p => fit().kinds[p.ref.kind])) {
    const layout = core.refit(state.layout, state.view, context());
    if (layout !== state.layout) state = { ...state, layout };
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
export const context = () => ({ fit: fit(), paneCap: state.settings.paneCap });
export function fit(): FitOptions {
  if (!kindsCache || kindsCache.v !== kindsVersion) kindsCache = { v: kindsVersion, reg: kindRegistry() };
  return { width: state.area.width, height: state.area.height, gap: GAP, kinds: kindsCache.reg };
}

// resolve() is a function of layout plus size; the view only places the zoom overlay, so focus is not part of the key.
let resolvedCache: { layout: Layout; zoomed?: NodeId; w: number; h: number; k: number; r: ResolvedLayout } | null = null;
export function resolved(): ResolvedLayout {
  const c = resolvedCache;
  if (c && c.layout === state.layout && c.zoomed === state.view.zoomed && c.w === state.area.width && c.h === state.area.height && c.k === kindsVersion) return c.r;
  const r = core.resolve(state.layout, state.view, context());
  resolvedCache = { layout: state.layout, zoomed: state.view.zoomed, w: state.area.width, h: state.area.height, k: kindsVersion, r };
  return r;
}

export const allPanes = (node: LayoutNode = state.layout.root) => core.tree.panes(node);
export const findPane = (id: NodeId | undefined) => { const n = id ? core.tree.find(state.layout.root, id) : undefined; return n?.type === "pane" ? n : undefined; };
export const findNode = (id: NodeId, node: LayoutNode = state.layout.root) => core.tree.find(node, id);
export const tuckedFrom = (id: NodeId | undefined) => state.layout.overlay?.tucks.find(t => t.pane === id);
export const foldedPaneIds = (r: ResolvedLayout) => r.shelf.filter(e => e.reason === "folded").map(e => e.paneId);
export function titleOf(id: NodeId | undefined): string {
  const p = findPane(id);
  return p ? paneTitle(p.ref) : "pane";
}
/** The deliberate (tree) stack holding this pane, if any. Automatic stacks (folds) exist only in resolve() output. */
export const stackOf = (id: NodeId | undefined, node: LayoutNode = state.layout.root) => id ? core.tree.stackOf(node, id) : undefined;

/** Same object: kind plus identifying params (ids compare as text; `autorun` is an instruction, not identity). */
export function sameRef(a: ObjectRef, b: ObjectRef): boolean {
  if (a.kind !== b.kind) return false;
  const keys = (r: ObjectRef) => Object.keys(r.params).filter((k) => k !== "autorun").sort();
  const ka = keys(a), kb = keys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && String(a.params[k]) === String(b.params[k]));
}

/** Kinds that are scratch space rather than objects: never deduplicated, never listed as recent. */
const SCRATCH = new Set(["launcher", "query"]);
const isObject = (ref: ObjectRef) => !SCRATCH.has(ref.kind);

/** The pane already showing `ref`, other than `except`. Queries are scratch editors and never count. */
export function openPaneFor(ref: ObjectRef, except?: NodeId): PaneNode | undefined {
  if (!isObject(ref)) return undefined;
  return allPanes().find((p) => p.id !== except && sameRef(p.ref, ref));
}

function withRecent(refs: ObjectRef[], recent = state.recent): ObjectRef[] {
  let out = recent;
  for (const ref of refs) {
    if (ref.kind === "launcher") continue;
    if (ref.kind === "chart" && !ref.params.runId) continue;
    out = [ref, ...out.filter((r) => !sameRef(r, ref))];
  }
  return out.slice(0, RECENT_MAX);
}

/** Panes and stacks the focused pane can join as a tab, by title. Excludes itself and its own stack. */
export interface MergeTarget { id: NodeId; label: string; hint: string }
export function mergeTargets(source = state.view.focused): MergeTarget[] {
  if (!source) return [];
  const own = stackOf(source);
  const out: MergeTarget[] = [];
  for (const b of resolvedFlat().panes) {
    if (b.hidden || b.id === source || own?.children.some((c) => c.id === b.id)) continue;
    const st = stackOf(b.id);
    if (st) out.push({ id: b.id, label: st.children.map((c) => paneTitle(c.ref)).join(" · "), hint: `${st.children.length} tabs` });
    else {
      const p = findPane(b.id);
      if (p) out.push({ id: b.id, label: paneTitle(p.ref), hint: p.ref.kind === "launcher" ? "new pane" : p.ref.kind });
    }
  }
  return out;
}

/** Visible panes in reading order (resolve order). */
export function visiblePaneIds(): NodeId[] {
  return resolved().panes.filter((b) => !b.hidden).map((b) => b.id);
}

/** The layout as it is when not zoomed. Focus keys use it, so they can move on from a zoomed pane (resolve() hides the rest). */
export function resolvedFlat(): ResolvedLayout {
  return state.view.zoomed ? core.resolve(state.layout, unzoomed(state.view), context()) : resolved();
}

// ---------- single view: exact restore ----------

/** What the workspace looked like just before it fell into single view. */
export interface WideSnapshot {
  /** Tree shape only (ids, types, order): sizes and active tabs may change without invalidating a restore. */
  shape: string;
  visible: NodeId[];
  /** Each deliberate stack's active tab. */
  active: Record<NodeId, NodeId>;
  view: ViewState;
}
export const layoutShape = (node: LayoutNode = state.layout.root) => core.tree.shape(node);
export function snapshotWide(r: ResolvedLayout): WideSnapshot {
  const active: Record<NodeId, NodeId> = {};
  (function walk(n: LayoutNode) {
    if (n.type === "pane") return;
    if (n.type === "stack") active[n.id] = n.active;
    n.children.forEach((c) => walk(c as LayoutNode));
  })(state.layout.root);
  return { shape: layoutShape(), visible: r.panes.filter((b) => !b.hidden).map((b) => b.id), active, view: state.view };
}
/**
 * Widening out of single view: put back each stack's active tab and the visible pane set from before, provided the
 * layout kept its shape meanwhile. Focus was moved by the switcher; the earlier view is used only if it reproduces
 * the earlier visible set (an automatic fold shows its focused tab), otherwise the current view stays.
 */
export function restoreWide(snap: WideSnapshot) {
  if (snap.shape !== layoutShape()) return;
  let layout = state.layout;
  for (const [stackId, tab] of Object.entries(snap.active)) {
    const st = findNode(stackId, layout.root);
    if (st && st.type === "stack" && st.active !== tab && st.children.some((c) => c.id === tab)) layout = core.setActiveTab(layout, stackId, tab, context());
  }
  // Folds were refitted for the width and replay as before; focus moved by the switcher is kept only if it is in view.
  const shown = new Set(core.resolve(layout, state.view, context()).panes.filter((b) => !b.hidden).map((b) => b.id));
  const cur = state.view;
  const earlier: ViewState = { ...snap.view, ...(cur.peek ? { peek: cur.peek } : {}) };
  if (!cur.peek) delete earlier.peek;
  delete earlier.zoomed;
  const view = !cur.focused || shown.has(cur.focused) || !earlier.focused || !shown.has(earlier.focused) ? cur : earlier;
  if (layout === state.layout && view === state.view) return;
  setState({ layout, view });
  hooks.writeUrl("replace");
}

// ---------- announcer + history hooks (wired by App) ----------

type HistoryMode = "push" | "replace" | "debounce" | "none";
export const hooks = {
  announce: (_msg: string) => {},
  writeUrl: (_mode: HistoryMode) => {},
  toastClosed: (_label: string) => {},
};

const sameView = (a: ViewState, b: ViewState) => a.focused === b.focused && a.zoomed === b.zoomed && a.peek === b.peek;

interface CommitOptions {
  history: HistoryMode;
  announce?: string;
  extra?: Partial<UiState>;
  /** Announce when only focus changed (for example "Already open: focused …"). Otherwise only a layout change is announced. */
  announceView?: boolean;
}
/**
 * Apply an action's result. Nothing that did not happen is written or announced: an unchanged layout keeps its object,
 * pushes no history and says nothing. Returns whether the layout changed.
 */
function commit(layout: Layout, view: ViewState, opts: CommitOptions): boolean {
  const next = layout;
  const layoutChanged = next !== state.layout;
  const viewChanged = !sameView(view, state.view);
  if (!layoutChanged && !viewChanged && !opts.extra) return false;
  const closedStack = (opts.extra?.closedStack ?? state.closedStack).filter(e => e.kind !== "tuck" || next.overlay?.tucks.some(t => t.pane === e.tucked));
  setState({ layout: layoutChanged ? next : state.layout, view: viewChanged || layoutChanged ? view : state.view, ...opts.extra, closedStack });
  if (layoutChanged) hooks.writeUrl(opts.history);
  else if (viewChanged) hooks.writeUrl("replace");
  if (opts.announce && (layoutChanged || (opts.announceView && viewChanged))) hooks.announce(opts.announce);
  return layoutChanged;
}

/** Show a pane that sits behind another tab (deliberate or automatic stack). Selecting a tab never moves panes. */
const reveal = (layout: Layout, id: NodeId) => core.reveal(layout, id, context());

/** DOM focus after the next paint (the store owns focus moves the Workspace effect cannot infer). */
function focusLater(id: NodeId) {
  if (typeof document === "undefined" || typeof requestAnimationFrame === "undefined") return;
  requestAnimationFrame(() => {
    if (document.activeElement?.closest?.("[role=separator], .divider, [role=dialog]")) return;
    const el = document.getElementById(paneDomId(id));
    if (!el) return;
    const target = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("[role=grid]") ?? el;
    target?.focus({ preventScroll: true });
  });
}

// ---------- tuck and the shelf ----------

/** Whether this pane can be tucked now (false for the last pane on screen, a tab, or a pane off screen). */
export function canTuck(id: NodeId | undefined): boolean {
  return !!id && core.canTuck(state.layout, id, context()).ok;
}
/** The pane a tuck would join, for labels such as "Tuck into orders". */
export function tuckHome(id: NodeId | undefined): NodeId | undefined {
  if (!id) return undefined;
  const r = core.canTuck(state.layout, id, context());
  return r.ok ? r.home : undefined;
}
/** Why a tuck was refused, in words. */
function tuckRefusal(id: NodeId, reason: TuckRefusal): string {
  const title = titleOf(id);
  if (reason === "missing") return "No pane focused";
  if (reason === "tab") return `${title} is already a tab of ${titleOf(shownWith(id))}`;
  if (reason === "hidden") return `${title} is not on screen`;
  return allPanes().length <= 1 ? `${title} is the only open pane and can't be tucked` : `${title} is the only pane on screen and can't be tucked`;
}
/** The pane on screen in the same group as `id` (itself when shown). */
function shownWith(id: NodeId): NodeId {
  const boxes = resolvedFlat().panes, box = boxes.find((b) => b.id === id);
  return (box?.hidden && boxes.find((b) => b.stackId === box.stackId && !b.hidden)?.id) || id;
}
/** Every pane not on screen (tucked, folded, inactive tab), with its activity. The Shelf UI may filter by reason. */
export type UiShelfEntry = ShelfEntry & { activity?: PaneActivity };
export function shelfEntries(): UiShelfEntry[] {
  return resolved().shelf.map((e) => (state.activity[e.paneId] ? { ...e, activity: state.activity[e.paneId] } : e));
}
/** Tucked panes, most recently tucked first (from the undo stack), then any others in reading order. */
function tuckedPanes(): NodeId[] {
  const tucked = (state.layout.overlay?.tucks ?? []).map(t => t.pane);
  const recent = state.closedStack.flatMap((e) => (e.tucked && tucked.includes(e.tucked) ? [e.tucked] : [])).reverse();
  return [...new Set([...recent, ...tucked])];
}

const unzoomed = core.tree.unzoom;

// ---------- actions ----------

export const actions = {
  focus(id: NodeId) {
    if (state.view.focused === id && state.view.focusHistory[0] === id) return;
    setState({ view: core.focus(state.view, id, context()) });
  },
  focusCycle(delta: 1 | -1) {
    const v = core.focusCycle(state.view, resolvedFlat(), delta, context());
    actions.afterFocusMove(v);
  },
  focusIndex(n: number) {
    const id = resolvedFlat().panes.filter((b) => !b.hidden).map((b) => b.id)[n - 1];
    if (id) actions.afterFocusMove(core.focus(state.view, id, context()));
  },
  focusDirection(dir: Edge) {
    actions.afterFocusMove(core.focusDirection(state.view, resolvedFlat(), dir, context()));
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
    const r = core.openBeside(state.layout, view0, source, ref, context());
    // Founder decision 2: focus stays in the source.
    const view = { ...r.view, focused: source, focusHistory: r.view.focusHistory.length ? r.view.focusHistory : [source] };
    const t = paneTitle(ref), s = titleOf(source);
    const recent = withRecent([ref]);
    const msg =
      r.mode === "replaced" ? `${t} shown beside ${s}` : r.mode === "tab" ? `${t} opened as a tab: not enough room beside ${s}` : `${t} opened beside ${s}`;
    commit(r.layout, view, { history: "push", announce: msg, extra: { recent },  });
    return r.opened;
  },
  /** Split opens a launcher beside the pane, not a copy of it; focus moves in, because the person is about to choose. */
  split(dir: "right" | "bottom", target = state.view.focused) {
    const p = findPane(target);
    if (!p) return;
    const r = core.split(state.layout, unzoomed(state.view), p.id, dir, LAUNCHER, context());
    const view = core.focus(r.view, r.opened, context());
    commit(r.layout, view, {
      history: "push",
      announce:
        r.mode === "tab"
          ? `New pane opened as a tab: not enough room beside ${titleOf(p.id)}. Choose what to show`
          : `New pane ${dir === "right" ? "right of" : "below"} ${titleOf(p.id)}. Choose what to show`,
    });
    return r.opened;
  },
  /**
   * Show `ref` in pane `id`, in place (same node, new ref). If the object is already open elsewhere, focus that pane
   * instead and quietly drop the launcher: one object, one pane.
   */
  openHere(id: NodeId, ref: ObjectRef) {
    const p = findPane(id);
    if (!p) return;
    const recent = withRecent([ref]);
    const dup = openPaneFor(ref, id);
    if (dup) {
      let layout = state.layout, view = unzoomed(state.view);
      if (p.ref.kind === "launcher" && allPanes().length > 1) ({ layout, view } = core.close(layout, view, id, context()));
      layout = reveal(layout, dup.id);
      commit(layout, core.focus(view, dup.id, context()), { history: "push", announce: `Already open: focused ${paneTitle(dup.ref)}`, extra: { recent }, announceView: true });
      return dup.id;
    }
    const layout = core.setRef(state.layout, state.view, id, ref, context());
    commit(layout, core.focus(state.view, id, context()), { history: "push", announce: `${paneTitle(ref)} opened`, extra: { recent } });
    return id;
  },
  /** Esc on an untouched launcher: close it without an undo toast; focus returns to where it came from. */
  dismiss(id: NodeId) {
    if (!findPane(id)) return;
    if (allPanes().length <= 1) {
      hooks.announce("The last pane stays open");
      return;
    }
    const r = core.close(state.layout, unzoomed(state.view), id, context());
    commit(r.layout, r.view, { history: "push", announce: `New pane closed. Focus is on ${titleOf(r.view.focused)}` });
  },
  /** "+" on a tab strip and ⌘K "New tab here": a launcher as a new tab of the pane's stack (or a new stack). */
  newTab(id = state.view.focused) {
    const p = findPane(id);
    if (!p) return;
    const r = core.addTab(state.layout, unzoomed(state.view), p.id, LAUNCHER, context());
    commit(r.layout, r.view, { history: "push", announce: `New tab beside ${titleOf(p.id)}. Choose what to show` });
    return r.opened;
  },
  /** Merge without dragging (WCAG 2.5.7): the pane joins `target`'s stack as a tab. Same op as a centre drop in tab mode. */
  mergeInto(source: NodeId, target: NodeId) {
    if (!findPane(source) || !findPane(target) || source === target) return;
    const into = stackOf(target) ? `the tabs of ${titleOf(target)}` : `tabs with ${titleOf(target)}`;
    const r = core.drop(state.layout, unzoomed(state.view), source, target, "centre", "tab", context());
    commit(r.layout, core.focus(r.view, source, context()), { history: "push", announce: `${titleOf(source)} added to ${into}` });
  },
  /** Move a tab out of its stack, to the right of the stack. Same op as dragging the tab to the right edge. */
  unmerge(id = state.view.focused) {
    const st = stackOf(id);
    if (!id || !st) {
      hooks.announce(`${titleOf(id)} is not in tabs`);
      return;
    }
    const other = st.children.find((c) => c.id !== id)!;
    const r = core.drop(state.layout, unzoomed(state.view), id, other.id, "right", "swap", context());
    commit(r.layout, core.focus(r.view, id, context()), { history: "push", announce: `${titleOf(id)} moved out of tabs, right of ${titleOf(st.active === id ? other.id : st.active)}` });
  },
  close(id = state.view.focused) {
    if (!id || !findPane(id)) return;
    if (allPanes().length <= 1) {
      hooks.announce("The last pane stays open");
      return;
    }
    const title = titleOf(id);
    const r = core.close(state.layout, unzoomed(state.view), id, context());
    if (commit(r.layout, r.view, { history: "push", announce: `${title} closed · Undo available`, extra: { closedStack: [...state.closedStack, r.undo].slice(-20), ...(state.peekSource === id ? { peekSource: undefined } : {}) } }))
      hooks.toastClosed(title);
  },
  closeOthers(id = state.view.focused) {
    if (!id) return;
    if (allPanes().length <= 1) {
      hooks.announce("There are no other panes to close");
      return;
    }
    const r = core.closeOthers(state.layout, unzoomed(state.view), id, context());
    if (commit(r.layout, r.view, { history: "push", announce: `Other panes closed · Undo available`, extra: { closedStack: [...state.closedStack, r.undo].slice(-20) } }))
      hooks.toastClosed("Other panes");
  },
  /** ⌘Z: undo the last close or tuck. A tuck is undone by putting the pane back, so later changes survive. */
  undoClose() {
    const e = state.closedStack.at(-1);
    if (!e) {
      hooks.announce("Nothing to restore");
      return;
    }
    if (e.tucked) return actions.putBack(e.tucked);
    commit(core.refit(e.before.layout, e.before.view, context()), e.before.view, { history: "push", announce: `${e.kind === "close" ? "Pane" : "Panes"} restored`, extra: { closedStack: state.closedStack.slice(0, -1) } });
  },
  toggleZoom(id = state.view.focused) {
    if (!id) return;
    if (allPanes().length <= 1 && !state.view.zoomed) return; // one pane alone: zoom does nothing
    const v = core.toggleZoom(core.focus(state.view, id, context()), id, context());
    setState({ view: v });
    hooks.writeUrl("replace");
    hooks.announce(v.zoomed ? `${titleOf(id)} maximised · Escape to restore` : `${titleOf(id)} restored`);
  },
  /**
   * Tuck: the pane becomes a tab of its home (see layout-core tuck). The home keeps its shown tab and absorbs the space;
   * nothing else moves or unfolds (no refit). Focus moves into the home. ⌘Z puts it back.
   */
  tuck(id = state.view.focused) {
    const target = id && findPane(id) ? id : state.view.focusHistory.find((h) => findPane(h));
    if (!target) return hooks.announce("No pane focused");
    const r = core.tuck(state.layout, unzoomed(state.view), target, context());
    if (!r.ok) return hooks.announce(tuckRefusal(target, r.reason));
    if (commit(r.layout, r.view, { history: "push", announce: `${titleOf(target)} tucked into ${titleOf(r.home)}`, extra: { closedStack: [...state.closedStack, r.undo].slice(-20) } }))
      focusLater(r.home);
  },
  /**
   * Put back: the given pane; else the focused pane if it is tucked (a revealed tucked tab, or a tucked tab with DOM
   * focus); else the most recently tucked pane. Restores its slot and size; only folds if room ran out. Focus moves in.
   */
  putBack(id?: NodeId) {
    let target = id;
    if (!target && typeof document !== "undefined") {
      const tab = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>("[data-tab]")?.dataset.tab;
      if (tab && tuckedFrom(tab)) target = tab;
    }
    if (!target && tuckedFrom(state.view.focused)) target = state.view.focused;
    target ??= tuckedPanes()[0];
    if (!target) return hooks.announce("Nothing is tucked");
    const r = core.putBack(state.layout, unzoomed(state.view), target, context());
    if (!r.ok) return hooks.announce(r.reason === "missing" ? "No pane focused" : `${titleOf(target)} is not tucked`);
    const closedStack = state.closedStack.filter((e) => e.tucked !== target);
    if (commit(r.layout, r.view, { history: "push", announce: `${titleOf(target)} put back`, extra: { closedStack } })) focusLater(target);
  },
  /** Show a pane that is off screen (tucked, folded or a tab) by selecting its tab in its home. Nothing moves. */
  reveal(id: NodeId) {
    if (!findPane(id)) return;
    const shownBefore = shownWith(id);
    const layout = reveal(state.layout, id);
    const changed = commit(layout, core.focus(state.view, id, context()), { history: "replace", announce: `${titleOf(id)} shown in place of ${titleOf(shownBefore)}` });
    if (changed || state.view.focused === id) focusLater(id);
  },
  moveDirection(dir: Edge, id = state.view.focused) {
    if (!id) return;
    const r = core.moveDirection(state.layout, unzoomed(state.view), id, dir, context());
    if (r.layout === state.layout) {
      hooks.announce(`${titleOf(id)} can't move ${dirWord(dir)}`);
      return;
    }
    commit(r.layout, r.view, { history: "push", announce: `${titleOf(id)} moved ${dirWord(dir)}` });
  },
  drop(dragged: NodeId, target: NodeId, zone: Edge | "centre") {
    const mode = state.settings.centreDrop;
    // Dragging a tucked tab out of its home on the side it came from is a put back (exact slot and size).
    const from = tuckedFrom(dragged);
    const home = resolved().stacks.find(s => s.paneIds.includes(dragged));
    if (from && zone !== "centre" && home?.paneIds.includes(target)) {
      const edge = core.putBackEdge(state.layout, dragged);
      if (zone === edge) return actions.putBack(dragged);
    }
    const r = core.drop(state.layout, state.view, dragged, target, zone, mode, context());
    const msg =
      zone === "centre"
        ? mode === "swap" ? `${titleOf(dragged)} swapped with ${titleOf(target)}` : `${titleOf(dragged)} added to the tabs of ${titleOf(target)}`
        : `${titleOf(dragged)} placed ${dirWord(zone)} of ${titleOf(target)}`;
    commit(r.layout, core.focus(r.view, dragged, context()), { history: "push", announce: msg });
  },
  swapWithNext(id = state.view.focused) {
    const order = visiblePaneIds();
    const i = order.indexOf(id ?? "");
    const other = order[i + 1] ?? order[i - 1];
    if (!id || !other) return;
    commit(core.swap(state.layout, id, other, context()), state.view, { history: "push", announce: `${titleOf(id)} swapped with ${titleOf(other)}` });
  },
  /** Selects the tab (deliberate or automatic stack) and focuses it. Nothing else moves: no refit. */
  setActiveTab(stack: NodeId, pane: NodeId) {
    commit(core.setActiveTab(state.layout, stack, pane, context()), core.focus(state.view, pane, context()), { history: "replace", announce: `${titleOf(pane)} tab shown` });
  },
  resizeDivider(parentId: NodeId, index: number, deltaPx: number) {
    if (!deltaPx) return;
    const next = core.resizeDivider(state.layout, parentId, index, deltaPx, context());
    // Sizes do not change minimums, so a divider never changes what fits: no refit.
    if (next !== state.layout) commit(next, state.view, { history: "debounce" });
  },
  /** End of a pointer drag: the layout the drag previewed (from core.resizeDivider), committed once. */
  commitDividerDrag(layout: Layout) {
    if (layout !== state.layout) commit(layout, state.view, { history: "debounce" });
  },
  resetDivider(parentId: NodeId, index: number) {
    commit(core.resetDivider(state.layout, parentId, index, context()), state.view, { history: "replace", announce: "Sizes reset" });
  },
  preset(id: PresetId) {
    const preset = presetById(id).build();
    const initial = core.tree.panes(preset.root)[0]?.id;
    const layout = core.resetLayout(preset, { focused: initial, focusHistory: initial ? [initial] : [] }, context());
    const first = allPanes(layout.root)[0]?.id;
    const view: ViewState = first ? { focused: first, focusHistory: [first] } : { focusHistory: [] };
    const recent = withRecent(allPanes(layout.root).map((p) => p.ref).reverse());
    commit(layout, view, { history: "push", announce: `Layout: ${presetById(id).label}`, extra: { presetId: id, peekSource: undefined, resizeMode: null, recent } });
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
    commit(core.refit(layout, { focused: "full", focusHistory: ["full"] }, context()), { focused: "full", focusHistory: ["full"] }, { history: "push", announce: `${paneTitle(ref)} opened full`, extra: { peekSource: undefined, recent: withRecent([ref]) } });
  },
  /** The pane's selection moved; an open peek from that pane follows it (Linear). */
  select(source: NodeId, ref: ObjectRef | null) {
    if (ref && state.view.peek && state.peekSource === source) {
      setState({ view: { ...state.view, peek: ref } });
      hooks.writeUrl("replace");
    }
  },
  /** Seed Recent with what is already on screen (boot, link open), reading order first. */
  noteOpen(refs: ObjectRef[]) {
    setState({ recent: withRecent([...refs].reverse()) });
  },
  setActivity(id: NodeId, a: PaneActivity) {
    if (state.activity[id] === a) return;
    setState({ activity: { ...state.activity, [id]: a } });
  },
};

export function dirWord(d: Edge | "centre") {
  return d === "top" ? "up" : d === "bottom" ? "down" : d === "centre" ? "into the centre" : d;
}
