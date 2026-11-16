/**
 * One command registry (spec §0.2): every pane action has a stable ID that feeds the palette, keys and menus.
 */
import type { Edge } from "../layout-core/types";
import { actions, allPanes, getState, hooks, mergeTargets, resolved, setState, stackOf } from "./store";
import { PRESETS } from "./presets";
import { nearestDivider } from "./dividers/DividerLayer";

export interface Command {
  id: string;
  title: string;
  /** Display shortcut (Mac glyphs). */
  keys?: string;
  group: "Focus" | "Pane" | "Move" | "Tabs" | "Layout" | "Peek" | "Settings";
  enabled?: () => boolean;
  run: () => void;
}

const hasFocus = () => !!getState().view.focused;
const many = () => allPanes().length > 1;
const DIRS: [Edge, string, string][] = [
  ["left", "left", "←"],
  ["right", "right", "→"],
  ["top", "up", "↑"],
  ["bottom", "down", "↓"],
];

export function copyLink() {
  const url = location.href;
  navigator.clipboard?.writeText(url).then(
    () => hooks.announce("Link copied"),
    () => hooks.announce("Couldn't copy the link"),
  );
  return url;
}

export const COMMANDS: Command[] = [
  { id: "pane.focus.next", title: "Focus next pane", keys: "F6", group: "Focus", run: () => actions.focusCycle(1) },
  { id: "pane.focus.previous", title: "Focus previous pane", keys: "⇧F6", group: "Focus", run: () => actions.focusCycle(-1) },
  ...DIRS.map(([d, w, g]): Command => ({ id: `pane.focus.${w}`, title: `Focus pane ${w}`, keys: `⌥⌘${g}`, group: "Focus", enabled: hasFocus, run: () => actions.focusDirection(d) })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n): Command => ({ id: `pane.focus.${n}`, title: `Focus pane ${n}`, keys: `⌥${n}`, group: "Focus", run: () => actions.focusIndex(n) })),

  { id: "pane.zoom", title: "Maximise or restore pane", keys: "⇧⌘↵", group: "Pane", enabled: () => hasFocus() && (many() || !!getState().view.zoomed), run: () => actions.toggleZoom() },
  { id: "pane.minimise", title: "Minimise or restore pane", keys: "⌥⌘M", group: "Pane", enabled: hasFocus, run: () => actions.setCollapsed() },
  { id: "pane.resize_mode", title: "Resize mode (arrows, then Esc)", keys: "⌥⌘R", group: "Pane", enabled: hasFocus, run: () => enterResizeMode() },
  { id: "pane.close", title: "Close pane", keys: "⌥⌘W", group: "Pane", enabled: () => hasFocus() && many(), run: () => actions.close() },
  { id: "pane.close_others", title: "Close other panes", group: "Pane", enabled: () => hasFocus() && many(), run: () => actions.closeOthers() },
  { id: "pane.undo_close", title: "Restore last closed pane", keys: "⌘Z", group: "Pane", enabled: () => getState().closedStack.length > 0, run: () => actions.undoClose() },
  // Splits open a launcher (a "New pane" to choose an object in), never a copy of the focused object.
  { id: "pane.split.right", title: "Split right (new pane)", keys: "⌥⌘\\", group: "Pane", enabled: hasFocus, run: () => actions.split("right") },
  { id: "pane.split.down", title: "Split down (new pane)", keys: "⌥⇧⌘\\", group: "Pane", enabled: hasFocus, run: () => actions.split("bottom") },
  {
    id: "pane.split.auto",
    title: "Split auto (new pane, by shape)",
    group: "Pane",
    enabled: hasFocus,
    run: () => {
      const b = resolved().panes.find((p) => p.id === getState().view.focused);
      actions.split(b && b.rect.height > b.rect.width ? "bottom" : "right");
    },
  },

  ...DIRS.map(([d, w, g]): Command => ({ id: `pane.move.${w}`, title: `Move pane ${w}`, keys: `⌥⇧⌘${g}`, group: "Move", enabled: () => hasFocus() && many(), run: () => actions.moveDirection(d) })),
  { id: "pane.swap", title: "Swap with next pane", group: "Move", enabled: () => hasFocus() && many(), run: () => actions.swapWithNext() },

  // Merge and unmerge without dragging (WCAG 2.5.7).
  { id: "pane.merge", title: "Add to tabs of…", keys: "⌥⌘T", group: "Tabs", enabled: () => mergeTargets().length > 0, run: () => openMergeChooser() },
  { id: "pane.unmerge", title: "Move out of tabs", keys: "⌥⇧⌘T", group: "Tabs", enabled: () => !!stackOf(getState().view.focused), run: () => actions.unmerge() },
  { id: "stack.new-tab", title: "New tab here", group: "Tabs", enabled: hasFocus, run: () => void actions.newTab() },

  ...PRESETS.map((p): Command => ({ id: `layout.preset.${p.id}`, title: `Layout: ${p.label}`, group: "Layout", run: () => actions.preset(p.id) })),
  { id: "layout.reset", title: "Reset layout", group: "Layout", run: () => actions.resetLayout() },
  { id: "layout.copy_link", title: "Copy link to this layout", group: "Layout", run: () => void copyLink() },

  { id: "peek.close", title: "Close peek", keys: "Esc", group: "Peek", enabled: () => !!getState().view.peek, run: () => actions.peek(null) },
  { id: "peek.pin", title: "Pin peek beside", group: "Peek", enabled: () => !!getState().view.peek, run: () => actions.pinPeek() },
  { id: "peek.open_full", title: "Open peek full", group: "Peek", enabled: () => !!getState().view.peek, run: () => actions.openPeekFull() },

  { id: "settings.open", title: "Open settings", group: "Settings", run: () => setState({ settingsOpen: true }) },
  {
    id: "settings.adapter.toggle",
    title: "Switch resize adapter (rrp ↔ Ark)",
    group: "Settings",
    run: () => {
      const s = getState().settings;
      const adapter = s.adapter === "rrp" ? "ark" : "rrp";
      setState({ settings: { ...s, adapter } });
      hooks.announce(`Resize adapter: ${adapter === "rrp" ? "react-resizable-panels" : "Ark UI Splitter"}`);
    },
  },
  {
    id: "settings.centre_drop.toggle",
    title: "Switch centre drop (swap ↔ tab)",
    group: "Settings",
    run: () => {
      const s = getState().settings;
      const centreDrop = s.centreDrop === "swap" ? "tab" : "swap";
      setState({ settings: { ...s, centreDrop } });
      hooks.announce(`Centre drop: ${centreDrop === "swap" ? "swap" : "add as tab"}`);
    },
  },
];

export function runCommand(id: string): boolean {
  const c = COMMANDS.find((c) => c.id === id);
  if (!c || (c.enabled && !c.enabled())) return false;
  c.run();
  return true;
}

export function openMergeChooser() {
  const source = getState().view.focused;
  if (!source) return;
  if (!mergeTargets(source).length) {
    hooks.announce("No other pane or stack to add this to");
    return;
  }
  setState({ chooser: { kind: "merge", source } });
}

export function enterResizeMode() {
  const id = getState().view.focused;
  if (!id) return;
  if (!nearestDivider(id, true) && !nearestDivider(id, false)) {
    hooks.announce("Nothing to resize: this pane has no divider");
    return;
  }
  setState({ resizeMode: id });
  hooks.announce("Resize mode: arrows resize, Shift for bigger steps, Escape or Enter to leave");
}
