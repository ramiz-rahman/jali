/**
 * Every sentence the workspace says: live-region announcements, refusals, toasts and drop outcomes. Logic passes
 * titles in; nothing else in src/ui writes announcement English.
 */
import type { Edge } from "../../layout-core/types";

/** Direction as a word: "up", "down", "left", "right", "into the centre". */
export const dirWord = (d: Edge | "centre") => (d === "top" ? "up" : d === "bottom" ? "down" : d === "centre" ? "into the centre" : d);

export const msg = {
  // focus and zoom
  maximised: (t: string) => `${t} maximised · Escape to restore`,
  restored: (t: string) => `${t} restored`,
  noFocus: "No pane focused",

  // open
  openedBeside: (mode: "beside" | "replaced" | "tab", t: string, source: string) =>
    mode === "replaced" ? `${t} shown beside ${source}` : mode === "tab" ? `${t} opened as a tab: not enough room beside ${source}` : `${t} opened beside ${source}`,
  split: (mode: "beside" | "replaced" | "tab", dir: "right" | "bottom", source: string) =>
    mode === "tab"
      ? `New pane opened as a tab: not enough room beside ${source}. Choose what to show`
      : `New pane ${dir === "right" ? "right of" : "below"} ${source}. Choose what to show`,
  alreadyOpen: (t: string) => `Already open: focused ${t}`,
  opened: (t: string) => `${t} opened`,
  newTab: (source: string) => `New tab beside ${source}. Choose what to show`,
  launcherClosed: (focus: string) => `New pane closed. Focus is on ${focus}`,
  openedFull: (t: string) => `${t} opened full`,

  // linked selection: a list's detail follows its selection
  followed: (t: string) => `Showing ${t}`,
  keptUnsaved: (what: string) => `The detail stays put: it has ${what}`,

  // unsaved work
  discarded: (n: number) => (n === 1 ? "Changes discarded" : `Changes in ${n} panes discarded`),
  keptEditing: "Nothing changed. Keep editing",
  openedPinned: (t: string, source: string) => `${t} opened beside ${source}, pinned: it stays on this item`,
  pinned: (t: string) => `${t} pinned: it stays on this item`,
  unpinned: (t: string, list: string) => `${t} follows the selection in ${list}`,
  notInResults: (list: string) => `Not in the current results of ${list}`,

  // close and undo
  lastPaneStays: "The last pane stays open",
  noOtherPanes: "There are no other panes to close",
  closed: (t: string) => `${t} closed · Undo available`,
  othersClosed: "Other panes closed · Undo available",
  nothingToRestore: "Nothing to restore",
  undone: (kind: "close" | "closeOthers") => `${kind === "close" ? "Pane" : "Panes"} restored`,

  // tuck and the shelf
  tucked: (t: string, home: string) => `${t} tucked into ${home}`,
  alreadyTab: (t: string, of: string) => `${t} is already a tab of ${of}`,
  notOnScreen: (t: string) => `${t} is not on screen`,
  onlyOpen: (t: string) => `${t} is the only open pane and can't be tucked`,
  onlyOnScreen: (t: string) => `${t} is the only pane on screen and can't be tucked`,
  nothingTucked: "Nothing is tucked",
  notTucked: (t: string) => `${t} is not tucked`,
  putBack: (t: string) => `${t} put back`,
  revealed: (t: string, before: string) => `${t} shown in place of ${before}`,
  shelf: "Shelf",
  shelfChoose: (n: number) => `Shelf: ${n} panes. Arrows to choose, Enter to show`,

  // move and tabs
  cantMove: (t: string, d: Edge) => `${t} can't move ${dirWord(d)}`,
  moved: (t: string, d: Edge) => `${t} moved ${dirWord(d)}`,
  swapped: (a: string, b: string) => `${a} swapped with ${b}`,
  addedToTabsOf: (a: string, b: string) => `${a} added to the tabs of ${b}`,
  addedToTabsWith: (a: string, b: string) => `${a} added to tabs with ${b}`,
  placed: (a: string, zone: Edge, b: string) => `${a} placed ${dirWord(zone)} of ${b}`,
  notInTabs: (t: string) => `${t} is not in tabs`,
  movedOutOfTabs: (t: string, rightOf: string) => `${t} moved out of tabs, right of ${rightOf}`,
  tabShown: (t: string) => `${t} tab shown`,

  // sizes
  sizesReset: "Sizes reset",
  resizeModeOn: "Resize mode: arrows resize, Shift for bigger steps, Escape or Enter to leave",
  resizeModeOff: "Resize mode off",
  nothingToResize: "Nothing to resize: this pane has no divider",

  // layout, peek, link, settings
  preset: (label: string) => `Layout: ${label}`,
  peek: (t: string) => `Peek: ${t} · Escape to close`,
  peekClosed: "Peek closed",
  linkCopied: "Link copied",
  linkNotCopied: "Couldn't copy the link",
  historyChanged: "Layout changed by browser history",
  brokenLink: "The layout in this link couldn't be read. Opened the default layout instead.",
  centreDrop: (mode: "swap" | "tab") => `Centre drop: ${mode === "swap" ? "swap" : "add as tab"}`,

  // curated pages (loan review)
  reviewOpened: (name: string, mode: "single" | "multi") => `${name} · ${mode === "single" ? "Single: one view at a time" : "Multiplexed: views side by side"}`,
  modeSingle: (t: string) => `Single: showing ${t}. Your multiplexed layout is kept.`,
  modeMulti: "Multiplexed: drag tabs into the layout to see views side by side",
  viewing: (t: string) => `Showing ${t}`,
  reviewReset: "Layout reset to its design",
  activated: (noun: string, id: number, dropped: number) => `Showing ${noun} ${id}${dropped ? ` · ${dropped} opened ${dropped === 1 ? "pane" : "panes"} closed` : ""}`,
  roleHidden: (t: string) => `${t} closed · it's still in the tabs`,
  roleShown: (t: string) => `${t} on screen`,
  lastView: (t: string) => `${t} is the only view on screen`,
  replaced: (t: string, was: string) => `${t} in place of ${was} · ${was} is in the tabs`,
  replacedNeedsRoom: (t: string, was: string) => `${t} in place of ${was} · it needed more room, so the layout adjusted`,
  sentToTabs: (titles: string[]) => `${titles.join(", ")} went back to the tabs: not enough room`,
  alreadyView: (t: string) => `${t} is already a view on this page`,
  notInvestigating: "Nothing opened beyond the review",
  backToReview: (n: number) => `Back to review · ${n} opened ${n === 1 ? "pane" : "panes"} closed · Undo available`,
  permission: (can: boolean) => (can ? "Viewing as credit reviewer: Multiplexed available, links open beside" : "Viewing as loan officer: Single only, links open as a peek"),
  singleNoLayout: "Single shows one view: choose it from the tabs. Switch to Multiplexed to arrange views",
  singleOnly: "Your role works in Single: one view at a time",
  peekOnly: (t: string) => `Peek: ${t} · your role opens links as a peek`,
  peekSingle: (t: string) => `Peek: ${t} · switch to Multiplexed to open links beside`,

  // what the workspace did on its own
  singleOn: "Single view: one pane at a time. Use the pane switcher at the top.",
  singleOff: "Single view ended: full layout restored",
  folded: (titles: string[]) => `${titles.join(", ")} folded into tabs: not enough room`,
  unfolded: (titles: string[]) => `${titles.join(", ")} unfolded: room returned`,
} as const;

/** Toasts: title, description, and whether it offers Undo. */
export const toasts = {
  closed: (t: string) => ({ title: "Pane closed", description: t, undo: true }),
  othersClosed: () => ({ title: "Other panes closed", undo: true }),
  backToReview: (n: number) => ({ title: "Back to review", description: `${n} opened ${n === 1 ? "pane" : "panes"} closed`, undo: true }),
  brokenLink: (preset: string) => ({
    title: "This link’s layout couldn’t be read",
    description: `Opened “${preset}” instead. A copy of the link was kept.`,
    error: true,
  }),
};

/** What releasing a drag will do, in words: "Swap with orders", "Place above orders". */
export function dropText(zone: Edge | "centre", target: string, centreDrop: "swap" | "tab"): string {
  if (zone === "centre") return centreDrop === "swap" ? `Swap with ${target}` : `Add as tab to ${target}`;
  return zone === "top" ? `Place above ${target}` : zone === "bottom" ? `Place below ${target}` : `Place ${zone} of ${target}`;
}
