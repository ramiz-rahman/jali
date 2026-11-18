/**
 * One command registry (spec §0.2): every workspace command has a stable id, a title, a check and a run. Keys are
 * not here: the store's keymap (commands/keymap.ts) binds ids to keys, so a host can rebind or unbind any of them.
 * The palette lists every command (disabled while the check refuses) with its keys; the keyboard runs the command a
 * binding names (and says a refusal's reason); tooltips print `store.keymap.label(id)`.
 */
import type { Edge } from "../../layout-core/types";
import { checkUndo } from "../actions/close";
import { checkZoom } from "../actions/focus";
import { checkPeek } from "../actions/peek";
import { checkPutBack, checkTuck } from "../actions/tuck";
import { checkMerge, checkUnmerge } from "../actions/tabs";
import { activeTabId, focusShelfChip } from "../dom/focus";
import { PRESETS } from "../presets";
import { refuse, type Refusal, type Snapshot } from "../state/apply";
import { msg } from "../state/messages";
import type { UiStore } from "../state/store";
import { cycleRegions } from "./regions";

export interface Command {
  id: string;
  title: string;
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings";
  /** Why the command can't run now (silent without a message); undefined when it can. */
  check?: (x: Snapshot) => Refusal | undefined;
  run: (store: UiStore) => void;
}

const needFocus = ({ s }: Snapshot) => (s.view.focused ? undefined : refuse());
const needOthers = (x: Snapshot) => needFocus(x) ?? (x.m.panes.length > 1 ? undefined : refuse());
const DIRS: [Edge, string][] = [["left", "left"], ["right", "right"], ["top", "up"], ["bottom", "down"]];

export const COMMANDS: Command[] = [
  // F6 visits the panes, then the shelf and the host's regions (commands/regions.ts).
  { id: "pane.focus.next", title: "Focus next pane", group: "Focus", run: (u) => cycleRegions(u, false) },
  { id: "pane.focus.previous", title: "Focus previous pane", group: "Focus", run: (u) => cycleRegions(u, true) },
  ...DIRS.map(([d, w]): Command => ({ id: `pane.focus.${w}`, title: `Focus pane ${w}`, group: "Focus", check: needFocus, run: (u) => u.actions.focusDirection(d) })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): Command => ({ id: `pane.focus.${n}`, title: `Focus pane ${n}`, group: "Focus", run: (u) => u.actions.focusIndex(n) })),

  { id: "pane.zoom", title: "Maximise or restore pane", group: "Pane", check: checkZoom, run: (u) => u.actions.toggleZoom() },
  { id: "pane.tuck", title: "Tuck pane into its neighbour", group: "Pane", check: (x) => checkTuck(x), run: (u) => u.actions.tuck() },
  // A tucked tab with DOM focus is the one put back first.
  { id: "pane.putBack", title: "Put back tucked pane", group: "Pane", check: checkPutBack, run: (u) => u.actions.putBack(undefined, activeTabId()) },
  { id: "shelf.reveal", title: "Show a pane from the shelf", group: "Pane", check: (x) => (x.m.resolved.shelf.length ? undefined : refuse()), run: revealFromShelf },
  { id: "pane.resize_mode", title: "Resize mode (arrows, then Esc)", group: "Pane", check: needFocus, run: (u) => u.actions.enterResizeMode() },
  { id: "pane.close", title: "Close pane", group: "Pane", check: needOthers, run: (u) => u.actions.close() },
  { id: "pane.close_others", title: "Close other panes", group: "Pane", check: needOthers, run: (u) => u.actions.closeOthers() },
  { id: "pane.undo_close", title: "Restore last closed pane", group: "Pane", check: checkUndo, run: (u) => u.actions.undo() },
  // Splits open a launcher (a "New pane" to choose an object in), never a copy of the focused object.
  { id: "pane.split.right", title: "Split right (new pane)", group: "Pane", check: needFocus, run: (u) => u.actions.split("right") },
  { id: "pane.split.down", title: "Split down (new pane)", group: "Pane", check: needFocus, run: (u) => u.actions.split("bottom") },
  { id: "pane.split.auto", title: "Split auto (new pane, by shape)", group: "Pane", check: needFocus, run: (u) => u.actions.splitAuto() },

  ...DIRS.map(([d, w]): Command => ({ id: `pane.move.${w}`, title: `Move pane ${w}`, group: "Move", check: needOthers, run: (u) => u.actions.moveDirection(d) })),
  { id: "pane.swap", title: "Swap with next pane", group: "Move", check: needOthers, run: (u) => u.actions.swapWithNext() },

  // Merge and unmerge without dragging (WCAG 2.5.7).
  { id: "pane.merge", title: "Add to tabs of…", group: "Tabs", check: checkMerge, run: (u) => u.set({ chooser: { kind: "merge", source: u.get().view.focused! } }) },
  { id: "pane.unmerge", title: "Move out of tabs", group: "Tabs", check: checkUnmerge, run: (u) => u.actions.unmerge() },
  { id: "stack.new-tab", title: "New tab here", group: "Tabs", check: needFocus, run: (u) => u.actions.newTab() },

  ...PRESETS.map((p): Command => ({ id: `layout.preset.${p.id}`, title: `Layout: ${p.label}`, group: "Layout", run: (u) => u.actions.preset(p.id) })),
  { id: "layout.reset", title: "Reset layout", group: "Layout", run: (u) => u.actions.resetLayout() },
  { id: "layout.copy_link", title: "Copy link to this layout", group: "Layout", run: copyLink },
  { id: "review.back", title: "Back to review (close opened panes)", group: "Layout", check: ({ s, m }) => (s.review && m.panes.some((p) => !p.role) ? undefined : refuse()), run: (u) => u.actions.backToReview() },
  { id: "review.reset", title: "Reset layout to its design", group: "Layout", check: ({ s }) => (s.review?.mode === "multi" ? undefined : refuse()), run: (u) => u.actions.resetReview() },
  { id: "review.single", title: "Single: one view at a time", group: "Layout", check: ({ s }) => (s.review?.mode === "multi" ? undefined : refuse()), run: (u) => u.actions.setMode("single") },
  { id: "review.multi", title: "Multiplexed: views side by side", group: "Layout", check: ({ s }) => (s.review?.mode === "single" && s.review.canInvestigate ? undefined : refuse()), run: (u) => u.actions.setMode("multi") },
  { id: "review.enter", title: "Open Loan review", group: "Layout", check: ({ s }) => (s.review ? refuse() : undefined), run: (u) => u.actions.enterReview() },
  { id: "review.leave", title: "Open Data Studio", group: "Layout", check: ({ s }) => (s.review ? undefined : refuse()), run: (u) => u.actions.leaveReview() },
  { id: "review.as_officer", title: "View as loan officer (Single only, links peek)", group: "Settings", check: ({ s }) => (s.review?.canInvestigate ? undefined : refuse()), run: (u) => u.actions.setCanInvestigate(false) },
  { id: "review.as_reviewer", title: "View as credit reviewer (links open beside)", group: "Settings", check: ({ s }) => (s.review && !s.review.canInvestigate ? undefined : refuse()), run: (u) => u.actions.setCanInvestigate(true) },

  { id: "peek.close", title: "Close peek", group: "Peek", check: checkPeek, run: (u) => u.actions.peek(null) },
  { id: "peek.pin", title: "Pin peek beside", group: "Peek", check: checkPeek, run: (u) => u.actions.pinPeek() },
  { id: "peek.open_full", title: "Open peek full", group: "Peek", check: checkPeek, run: (u) => u.actions.openPeekFull() },

  { id: "settings.open", title: "Open settings", group: "Settings", run: (u) => u.set({ settingsOpen: true }) },
  { id: "settings.centre_drop.toggle", title: "Switch centre drop (swap ↔ tab)", group: "Settings", run: toggleCentreDrop },
];

const byId = new Map(COMMANDS.map((c) => [c.id, c]));

/** Runs a command if its check passes. Returns whether it ran (the palette and tests use this). */
export function runCommand(store: UiStore, id: string): boolean {
  const c = byId.get(id);
  if (!c || c.check?.(store.snapshot())) return false;
  c.run(store);
  return true;
}

export const commandById = (id: string) => byId.get(id);

/** "⌘K ⌘M": a command's first binding in this store's keymap, for tooltips and the palette ("" when unbound). */
export const shortcutLabel = (store: Pick<UiStore, "keymap">, id: string) => store.keymap.label(id);

export function copyLink(store: UiStore) {
  const url = location.href;
  navigator.clipboard?.writeText(url).then(() => store.announce(msg.linkCopied), () => store.announce(msg.linkNotCopied));
}

/** One pane off screen: show it. Several: move focus to the shelf toolbar (arrows choose, Enter shows). */
export function revealFromShelf(store: UiStore) {
  const { m } = store.snapshot();
  const items = m.resolved.shelf;
  if (items.length > 1 && focusShelfChip(store.dom)) return store.announce(msg.shelfChoose(items.length));
  const first = items.find((i) => m.tuckOf(i.paneId)) ?? items[0];
  if (first) store.actions.reveal(first.paneId);
}

function toggleCentreDrop(store: UiStore) {
  const settings = store.get().settings;
  const centreDrop = settings.centreDrop === "swap" ? "tab" : "swap";
  store.set({ settings: { ...settings, centreDrop } });
  store.announce(msg.centreDrop(centreDrop));
}
