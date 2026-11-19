/**
 * Every word Jali shows or says: announcements, refusals, toasts, command titles, and the text of its dialogs, tabs,
 * shelf and buttons, including aria-labels, tooltips and placeholders. `en` is the English set; `createJali({
 * messages })` overrides any of it. Logic passes values in (titles, counts, keys, directions); nothing else in Jali
 * writes user-facing English.
 *
 * A message that needs values is a function, so a translation can put them in its own order and choose its own
 * plurals. A message with emphasis (a bold title) takes `bold` and returns its parts in order.
 */
import type { Edge } from "../layout/types";
import type { PaneActivity, ParamProblem } from "../pane-kinds";
import type { Platform } from "../commands/format";
import type { Env } from "../profile";
import type { Toast } from "./apply";

/** A direction on screen, as command ids name it ("pane.focus.left"). Right to left, left is still the screen's left. */
export type ScreenDirection = "left" | "right" | "up" | "down";

/** Direction as a word: "up", "down", "left", "right", "into the centre". */
export const dirWord = (d: Edge | "centre") =>
  d === "top" ? "up" : d === "bottom" ? "down" : d === "centre" ? "into the centre" : d;

const panes = (n: number) => (n === 1 ? "pane" : "panes");
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** The live region: what happened, and why something did not. */
const announcements = {
  // focus and zoom
  maximised: (pane: string) => `${pane} maximised · Escape to restore`,
  restored: (pane: string) => `${pane} restored`,
  noFocus: "No pane focused",

  // open
  openedBeside: (mode: "beside" | "replaced" | "tab", pane: string, source: string) =>
    mode === "replaced"
      ? `${pane} shown beside ${source}`
      : mode === "tab"
        ? `${pane} opened as a tab: not enough room beside ${source}`
        : `${pane} opened beside ${source}`,
  split: (mode: "beside" | "replaced" | "tab", dir: "right" | "bottom", source: string) =>
    mode === "tab"
      ? `New pane opened as a tab: not enough room beside ${source}. Choose what to show`
      : `New pane ${dir === "right" ? "right of" : "below"} ${source}. Choose what to show`,
  alreadyOpen: (pane: string) => `Already open: focused ${pane}`,
  alreadyOpenBeside: (pane: string) => `Already open: ${pane}`,
  opened: (pane: string) => `${pane} opened`,
  newTab: (source: string) => `New tab beside ${source}. Choose what to show`,
  launcherClosed: (focus: string) => `New pane closed. Focus is on ${focus}`,
  openedFull: (pane: string) => `${pane} opened full`,

  // linked selection: a list's detail follows its selection
  followed: (pane: string) => `Showing ${pane}`,
  keptUnsaved: (what: string) => `The detail stays put: it has ${what}`,

  // unsaved work
  discarded: (count: number) =>
    count === 1 ? "Changes discarded" : `Changes in ${count} panes discarded`,
  keptEditing: "Nothing changed. Keep editing",
  openedPinned: (pane: string, source: string) =>
    `${pane} opened beside ${source}, pinned: it stays on this item`,
  pinned: (pane: string) => `${pane} pinned: it stays on this item`,
  unpinned: (pane: string, list: string) => `${pane} follows the selection in ${list}`,
  notInResults: (list: string) => `Not in the current results of ${list}`,

  // close and undo
  lastPaneStays: "The last pane stays open",
  noOtherPanes: "There are no other panes to close",
  closed: (pane: string) => `${pane} closed · Undo available`,
  othersClosed: "Other panes closed · Undo available",
  /** Tabs closed together from a tab's menu (Close other tabs, Close tabs to the right). */
  tabsClosed: (count: number) => `${count} ${count === 1 ? "tab" : "tabs"} closed · Undo available`,
  noTabsToClose: "There are no tabs to close",
  nothingToRestore: "Nothing to restore",
  undone: (kind: "close" | "closeOthers") => `${kind === "close" ? "Pane" : "Panes"} restored`,

  // tuck and the shelf
  tucked: (pane: string, home: string) => `${pane} tucked into ${home}`,
  alreadyTab: (pane: string, of: string) => `${pane} is already a tab of ${of}`,
  notOnScreen: (pane: string) => `${pane} is not on screen`,
  onlyOpen: (pane: string) => `${pane} is the only open pane and can't be tucked`,
  onlyOnScreen: (pane: string) => `${pane} is the only pane on screen and can't be tucked`,
  nothingTucked: "Nothing is tucked",
  notTucked: (pane: string) => `${pane} is not tucked`,
  putBack: (pane: string) => `${pane} put back`,
  revealed: (pane: string, before: string) => `${pane} shown in place of ${before}`,
  shelf: "Shelf",
  shelfChoose: (count: number) => `Shelf: ${count} panes. Arrows to choose, Enter to show`,

  // move and tabs
  cantMove: (pane: string, edge: Edge) => `${pane} can't move ${dirWord(edge)}`,
  moved: (pane: string, edge: Edge) => `${pane} moved ${dirWord(edge)}`,
  swapped: (a: string, b: string) => `${a} swapped with ${b}`,
  addedToTabsOf: (a: string, b: string) => `${a} added to the tabs of ${b}`,
  addedToTabsWith: (a: string, b: string) => `${a} added to tabs with ${b}`,
  placed: (a: string, zone: Edge, b: string) => `${a} placed ${dirWord(zone)} of ${b}`,
  notInTabs: (pane: string) => `${pane} is not in tabs`,
  movedOutOfTabs: (pane: string, rightOf: string) =>
    `${pane} moved out of tabs, right of ${rightOf}`,
  tabShown: (pane: string) => `${pane} tab shown`,
  /** A tab moved within its group: its place, counted from 1, of `count` tabs. */
  tabMoved: (pane: string, position: number, count: number) =>
    `${pane} moved to position ${position} of ${count}`,
  /** A tab can't move further that way: `edge` is "first" or "last". */
  tabAtEdge: (pane: string, edge: "first" | "last") => `${pane} is already the ${edge} tab`,

  // sizes
  sizesReset: "Sizes reset",
  resizeModeOn: "Resize mode: arrows resize, Shift for bigger steps, Escape or Enter to leave",
  resizeModeOff: "Resize mode off",
  nothingToResize: "Nothing to resize: this pane has no divider",

  // layout, peek, link, settings
  preset: (label: string) => `Layout: ${label}`,
  peek: (pane: string) => `Peek: ${pane} · Escape to close`,
  peekClosed: "Peek closed",
  linkCopied: "Link copied",
  linkNotCopied: "Couldn't copy the link",
  historyChanged: "Layout changed by browser history",
  brokenLink: "The layout in this link couldn't be read. Opened the default layout instead.",
  centreDrop: (mode: "swap" | "tab") => `Centre drop: ${mode === "swap" ? "swap" : "add as tab"}`,

  // curated pages
  pageOpened: (page: string, mode: "single" | "split") =>
    `${page} · ${mode === "single" ? "Single view: one view at a time" : "Split view: views side by side"}`,
  modeSingle: (view: string) => `Single: showing ${view}. Your split layout is kept.`,
  modeSplit: "Split view: drag tabs into the layout to see views side by side",
  viewing: (view: string) => `Showing ${view}`,
  pageReset: "Layout reset to its design",
  activated: (noun: string, id: string | number, closed: number) =>
    `Showing ${noun} ${id}${closed ? ` · ${closed} opened ${panes(closed)} closed` : ""}`,
  roleHidden: (view: string) => `${view} closed · it's still in the tabs`,
  roleShown: (view: string) => `${view} on screen`,
  lastView: (view: string) => `${view} is the only view on screen`,
  replaced: (view: string, was: string) => `${view} in place of ${was} · ${was} is in the tabs`,
  replacedNeedsRoom: (view: string, was: string) =>
    `${view} in place of ${was} · it needed more room, so the layout adjusted`,
  sentToTabs: (views: string[]) => `${views.join(", ")} went back to the tabs: not enough room`,
  alreadyView: (view: string) => `${view} is already a view on this page`,
  notInvestigating: "Nothing opened beyond the page",
  backToPage: (page: string, count: number) =>
    `Back to ${page} · ${count} opened ${panes(count)} closed · Undo available`,
  permission: (viewer: string, canInvestigate: boolean) =>
    canInvestigate
      ? `Viewing as ${viewer}: Split view available, links open beside`
      : `Viewing as ${viewer}: Single only, links open as a peek`,
  singleNoLayout:
    "Single shows one view: choose it from the tabs. Switch to Split view to arrange views",
  singleOnly: "Your role works in Single: one view at a time",
  peekOnly: (pane: string) => `Peek: ${pane} · your role opens links as a peek`,
  peekSingle: (pane: string) => `Peek: ${pane} · switch to Split view to open links beside`,

  // what the workspace did on its own
  singleOn: "Single view: one pane at a time. Use the pane switcher at the top.",
  singleOff: "Single view ended: full layout restored",
  folded: (panes: string[]) => `${panes.join(", ")} folded into tabs: not enough room`,
  unfolded: (panes: string[]) => `${panes.join(", ")} unfolded: room returned`,

  /** Two things said at once: what happened, then what else it did. */
  both: (first: string, then: string) => `${first} · ${then}`,
};

/** Toasts (`jali.onToast`): a title, a description, and whether it offers Undo or is an error. */
const toasts = {
  closed: (pane: string): Toast => ({ title: "Pane closed", description: pane, undo: true }),
  othersClosed: (): Toast => ({ title: "Other panes closed", undo: true }),
  tabsClosed: (count: number): Toast => ({
    title: `${count} ${count === 1 ? "tab" : "tabs"} closed`,
    undo: true,
  }),
  backToPage: (page: string, count: number): Toast => ({
    title: `Back to ${page}`,
    description: `${count} opened ${panes(count)} closed`,
    undo: true,
  }),
  brokenLink: (preset: string | undefined): Toast => ({
    title: "This link’s layout couldn’t be read",
    description: preset
      ? `Opened “${preset}” instead. A copy of the link was kept.`
      : "The layout stayed as it was. A copy of the link was kept.",
    error: true,
  }),
};

/** The label over a drop target while dragging: what releasing will do. */
const drop = {
  swapWith: (target: string) => `Swap with ${target}`,
  addAsTabTo: (target: string) => `Add as tab to ${target}`,
  place: (edge: Edge, target: string) =>
    edge === "top"
      ? `Place above ${target}`
      : edge === "bottom"
        ? `Place below ${target}`
        : `Place ${edge} of ${target}`,
};

/** Command titles: ⌘K, the keyboard list in Settings, `listCommands`. Named after what the command does. */
const commands = {
  focusNext: "Focus next pane",
  focusPrevious: "Focus previous pane",
  focusDirection: (direction: ScreenDirection) => `Focus pane ${direction}`,
  focusIndex: (n: number) => `Focus pane ${n}`,
  zoom: "Maximise or restore pane",
  tuck: "Tuck pane into its neighbour",
  putBack: "Put back tucked pane",
  revealFromShelf: "Show a pane from the shelf",
  resizeMode: "Resize mode (arrows, then Esc)",
  close: "Close pane",
  closeOthers: "Close other panes",
  undoClose: "Undo last close or tuck",
  splitRight: "Split right (new pane)",
  splitDown: "Split down (new pane)",
  splitAuto: "Split auto (new pane, by shape)",
  moveDirection: (direction: ScreenDirection) => `Move pane ${direction}`,
  swap: "Swap with next pane",
  merge: "Add to tabs of…",
  unmerge: "Move out of tabs",
  moveTab: (direction: "left" | "right") => `Move tab ${direction}`,
  newTab: "New tab here",
  preset: (label: string) => `Layout: ${label}`,
  resetLayout: "Reset layout",
  copyLink: "Copy link to this layout",
  /** `page` is the curated page's name; undefined in a workspace without one. */
  pageBack: (page: string | undefined) => `Back to ${page ?? "page"} (close opened panes)`,
  pageReset: "Reset layout to its design",
  pageSingle: "Single view: one view at a time",
  pageSplit: "Split view: views side by side",
  pageOpen: (page: string | undefined) => `Open ${page ?? "page"}`,
  /** `workspace` is the free workspace's name (`createJali({ name })`). */
  pageLeave: (workspace: string) => `Open ${workspace}`,
  viewAsLimited: (viewer: string) => `View as ${viewer} (Single only, links peek)`,
  viewAsFull: (viewer: string) => `View as ${viewer} (links open beside)`,
  peekClose: "Close peek",
  peekPin: "Pin peek beside",
  peekOpenFull: "Open peek full",
  settingsOpen: "Open settings",
  centreDropToggle: "Switch centre drop (swap ↔ tab)",
};

/** The groups Jali's commands are listed under. A host command names its own group. */
const commandGroups = {
  focus: "Focus",
  pane: "Pane",
  move: "Move",
  tabs: "Tabs",
  layout: "Layout",
  peek: "Peek",
  settings: "Settings",
};

/** Words in key labels ("Ctrl+Shift+Esc", "Alt-click"). Mac symbols (⌘ ⌥ ⇧ ↵ ←) are not words and stay. */
const keys = {
  ctrl: "Ctrl",
  alt: "Alt",
  shift: "Shift",
  escape: "Esc",
  space: "Space",
  left: "Left",
  right: "Right",
  up: "Up",
  down: "Down",
  /** Click with Alt held: "⌥-click" on a Mac, "Alt-click" elsewhere. */
  altClick: (platform: Platform) => (platform === "mac" ? "⌥-click" : "Alt-click"),
  /** A command bound to more than one key: "⌘K ⌘M or ⇧⌘↵". */
  alternatives: (keys: string[]) => keys.join(" or "),
  /** A tooltip with its shortcut: "Put back · ⌘K ⌘]". `keys` is "" when the command is unbound. */
  withKeys: (label: string, keys: string) => (keys ? `${label} · ${keys}` : label),
};

/** ⌘K. */
const palette = {
  label: "Commands",
  placeholder: "Type a command…",
  listLabel: "Commands",
  empty: (query: string) => `No command matches “${query}”.`,
};

/** "Add to tabs of…" (⌘K ⌘G). */
const chooser = {
  label: (pane: string) => `Add ${pane} to tabs of`,
  heading: <T>(pane: string, bold: (text: string) => T): (string | T)[] => [
    "Add ",
    bold(pane),
    " to the tabs of…",
  ],
  placeholder: "Pane or stack",
  inputLabel: "Pane or stack",
  listLabel: "Panes and stacks",
  empty: (query: string) => `No pane or stack matches “${query}”.`,
  /** The hint beside a stack: how many tabs it has. */
  stackHint: (count: number) => `${count} tabs`,
  /** The hint beside a pane that is still choosing what to show (the launcher). */
  newPaneHint: "new pane",
  /** `jali.actions.choose`, when the app asks for an item: the field's placeholder (unless the app gives one), the
   *  list's name for screen readers, and what it says when nothing matches. The title is the app's. */
  choosePlaceholder: "Type to search",
  chooseListLabel: "Choices",
  chooseEmpty: (query: string) => `Nothing matches “${query}”.`,
};

/** "Discard unsaved changes?" */
const confirmDiscard = {
  title: "Discard unsaved changes?",
  body: (count: number) =>
    count === 1
      ? "This pane has work that is not saved. It will be lost."
      : "These panes have work that is not saved. It will be lost.",
  /** One pane in the list: its title and what is unsaved (what `useUnsaved` reported). */
  item: <T>(pane: string, what: string, bold: (text: string) => T): (string | T)[] => [
    bold(pane),
    ": ",
    what,
  ],
  discard: "Discard",
  keepEditing: "Keep editing",
};

/** The settings panel. */
const settings = {
  title: "Settings",
  close: "Close settings",
  theme: "Theme",
  themeSystem: "System",
  themeLight: "Light",
  themeDark: "Dark",
  centreDrop: "Centre drop",
  centreDropSwap: "Swap the two panes",
  centreDropTab: "Add as a tab",
  paneCap: "Pane cap",
  paneCapHelp: "Over the cap, the oldest unpinned, unfocused pane becomes a tab.",
  openedPanes: (page: string) => `${page}: opened panes`,
  boundaryTint: "Tinted header and “Opened” tag",
  boundaryNone: "No marking",
  viewingAs: (page: string) => `${page}: viewing as`,
  viewerFull: (viewer: string) => `${cap(viewer)}: links open beside`,
  viewerLimited: (viewer: string) => `${cap(viewer)}: Single only, links open as a peek`,
  keyboard: "Keyboard",
  keyboardLabel: "Keyboard shortcuts",
  paletteKey: "Command palette (then a second key for a chord)",
  escapeKey: "Close the peek, then leave maximise (after the pane's own use of it)",
  /** `undo` is the platform's undo key ("⌘Z", "Ctrl+Z"). */
  keyboardNote: (undo: string) =>
    `Inside a pane, its own keys come first: J/K and the arrows move, Space peeks, ${undo} undoes the pane's own changes, and the first Esc is the pane's.`,
};

/** Tabs (made by you: merged, opened, tucked; made by the layout: folded) and the tab strip's overflow menu. */
const tabs = {
  listLabel: (count: number) => `Tabs: ${count}`,
  close: (pane: string) => `Close ${pane}`,
  putBack: (pane: string) => `Put back ${pane}`,
  putBackTip: "Put back",
  newTab: "New tab in this stack",
  newTabTip: "New tab",
  folded: "Folded",
  tucked: "Tucked",
  foldedTip: "Folded: not enough room · returns when there's space",
  /** A folded tab's tooltip: its title, then why it is a tab. */
  foldedTitle: (pane: string) => `${pane} · Folded: not enough room · returns when there's space`,
  foldedDescription: "Folded: returns when there's room",
  tuckedDescription: "Tucked here. Put back to restore its place.",
  /**
   * A tab's description in a strip: why it is a tab, when it is folded or tucked, then the keys it takes. `putBackKeys`
   * is the put back shortcut on a tucked tab ("⌘K ⌘]"), "" otherwise or when it is unbound.
   */
  description: (reason: "folded" | "tucked" | undefined, putBackKeys: string) =>
    reason === "folded"
      ? "Folded: returns when there's room. Delete closes it."
      : reason === "tucked"
        ? `Tucked here. ${putBackKeys ? `${putBackKeys} puts it back` : "Put back to restore its place"}. Delete closes it.`
        : "Delete closes it.",
  all: (count: number, outOfView: number) =>
    `All ${count} tabs${outOfView ? `, ${outOfView} out of view` : ""}`,
  allTip: "All tabs",
  /** The overflow button's text: how many tabs are out of view. */
  moreCount: (count: number) => `+${count}`,
  menuLabel: "Tabs in this group",
  /** A tab's own menu (right-click, Shift+F10 or the menu key on a tab). */
  tabMenuLabel: (pane: string) => `${pane} tab`,
  closeTab: "Close",
  closeOtherTabs: "Close other tabs",
  /** The tabs after this one: to its right, or its left when the strip reads right to left. */
  closeTabsAfter: (side: "left" | "right") => `Close tabs to the ${side}`,
  moveTab: (side: "left" | "right") => `Move tab ${side}`,
  moveOutOfTabs: "Move out of tabs",
  splitRight: "Split right",
  splitDown: "Split down",
  maximise: "Maximise",
  restore: "Restore",
};

/** The shelf: tucked and folded panes as chips. */
const shelf = {
  label: "Shelf",
  toolbar: "Tucked and folded panes",
  behind: (home: string) => `Behind ${home}`,
  behindHeading: (home: string) => `Behind ${home}:`,
  folded: "Folded",
  foldedHeading: "Folded:",
  /** A chip's name for screen readers. `activity` is the pane's (`useActivity`); `reason`, why it is on the shelf. */
  chip: (c: {
    pane: string;
    home: string;
    reason: "tucked" | "folded" | "tab";
    activity: PaneActivity | undefined;
  }) => {
    const word =
      c.activity === "loading" || c.activity === "working"
        ? "working"
        : c.activity === "needs-you"
          ? "needs you"
          : c.activity === "error"
            ? "failed"
            : "";
    const where = c.reason === "folded" ? "folded" : `behind ${c.home}`;
    const keys = c.reason === "tucked" ? ", Shift+Enter puts it back" : "";
    return `${c.pane}${word ? `, ${word}` : ""}, ${where}. Enter shows it${keys}`;
  },
  chipTip: (pane: string, home: string) => `${pane} · behind ${home}`,
  putBack: (pane: string) => `Put back ${pane}`,
  putBackTip: "Put back",
  summary: (count: number) => `${count} folded panes. Enter lists them`,
  summaryText: (count: number) => `${count} folded`,
  more: (count: number) => `${count} more tucked or folded panes`,
  moreCount: (count: number) => `+${count}`,
  menuFolded: "Folded panes",
  menuMore: "More tucked or folded panes",
  /** Beside a pane in the shelf's menus: where it is. */
  where: (folded: boolean, home: string) => (folded ? "folded" : `behind ${home}`),
};

/** A pane's header and body. */
const pane = {
  /** A pane's title when there is no pane to name. */
  untitled: "pane",
  tuck: (pane: string) => `Tuck ${pane}`,
  tuckInto: (home: string) => `Tuck into ${home}`,
  cantTuck: (pane: string) => `${pane} can't be tucked`,
  close: (pane: string) => `Close ${pane}`,
  closeTip: "Close",
  /** A curated page's view closes back into the page's tabs. */
  closeViewTip: "Close · it stays in the tabs above",
  maximise: (pane: string) => `Maximise ${pane}`,
  maximiseTip: "Maximise",
  restore: (pane: string) => `Restore ${pane}`,
  restoreTip: "Restore",
  opened: "Opened",
  pinned: "Pinned",
  following: "Following",
  pin: (pane: string) => `Pin ${pane}`,
  pinnedTip: (list: string) =>
    `Pinned: stays on this item. Unpin to follow the selection in ${list}`,
  followingTip: (list: string) => `Follows the selection in ${list}. Pin to keep this item`,
  loading: "Loading",
  working: "Working",
  needsYou: "Needs you",
  error: "Error",
  unknownKind: (kind: string) => `Unknown pane kind “${kind}”.`,
  /** `keys` opens the command palette ("⌘K"). */
  unknownKindHelp: (keys: string) =>
    `This pane stays in place so the layout keeps its shape. Close it or reset the layout from the command palette (${keys}).`,
  /** A ref its kind can't read: `kind` is the kind's name ("order"). */
  cantOpen: (kind: string) => `This ${kind} can’t open.`,
  /** Why: each param missing (`value` undefined) or unreadable, then what to do. */
  cantOpenHelp: (problems: ParamProblem[]) =>
    `${problems
      .map((p) =>
        p.value === undefined
          ? `Its link has no “${p.param}”.`
          : `Its “${p.param}” (${String(p.value)}) isn’t one it can read.`,
      )
      .join(" ")} Close it, or open it again from where it was linked.`,
  /** A pane whose content threw while rendering. */
  failed: (pane: string) => `${pane} could not be shown.`,
  retry: "Retry",
  /** The failed pane's Retry, in ⌘K while it is focused. */
  retryCommand: "Retry",
  closeFailed: "Close",
  /** A pane whose content is still loading, when its kind has no `Loading`. */
  loadingContent: "Loading…",
  /** A pane with unsaved work (`useUnsaved`): the unsaved mark's name, and the start of a tab's description. */
  unsaved: "Unsaved changes",
};

/** The peek sheet. */
const peek = {
  label: (pane: string) => `Peek: ${pane}`,
  badge: "Peek",
  pinBeside: "Pin beside",
  openFull: "Open full",
  close: "Close peek",
  closeTip: (keys: string) => `Close (${keys})`,
};

/** The panes region, Single view's pane switcher, and the dividers between panes. */
const workspace = {
  /** The free workspace's name when `createJali({ name })` gives none. */
  name: "Workspace",
  label: "Panes",
  switcher: "Panes",
  switcherList: (count: number) => `Panes: ${count}`,
  /** The panes on one side of a divider: up to three titles, then a count. */
  dividerSide: (panes: string[]) =>
    panes.length <= 3
      ? panes.join(", ")
      : `${panes.slice(0, 2).join(", ")}, +${panes.length - 2} more`,
  divider: (a: string, b: string) => `Resize between ${a} and ${b}`,
  dividerValue: (a: string, aPx: number, b: string, bPx: number) =>
    `${a} ${aPx} pixels, ${b} ${bPx} pixels`,
  /** One side of a focused divider's size tip. */
  dividerTip: (side: string, px: number) => `${side} · ${px}px`,
};

/** A curated page: its bar, its tabs and the ⌥ preview. */
const page = {
  /** Who may open links beside, and who only peeks, when the page names no `viewers`. */
  viewerFull: "investigator",
  viewerLimited: "viewer",
  viewMode: "View mode",
  single: "Single view",
  singleTip: "One view at a time",
  split: "Split view",
  splitTip: "Views side by side: drag tabs into the layout",
  splitTipLimited: "Your role works in Single",
  investigation: "Investigation",
  investigating: <T>(count: number, bold: (text: string) => T): (string | T)[] => [
    "Investigating · ",
    bold(String(count)),
    " opened",
  ],
  backTo: (page: string) => `Back to ${page}`,
  reset: "Reset layout to its design",
  resetTip: "Reset layout · drops your split layout",
  tabsLabel: (page: string) => `${page} views`,
  tabOff: "Not on screen",
  tabBehind: "Behind another tab",
  tabOn: "On screen",
  /** `altClick` is the platform's words for it ("⌥-click"). */
  tabTipOff: (view: string, altClick: string) =>
    `${view} in place of the view you're in · drag to place it · ${altClick}: beside`,
  tabTipFocus: (view: string) => `Focus ${view} · drag to move it`,
  tabTipSingle: (view: string, altClick: string) =>
    `${view} · drag or ${altClick} to see it beside`,
  /** The ⌥ preview: where a view opens, and the views it sends back to the tabs. */
  ghost: (view: string, leaving: string[]) =>
    `${view} opens here${leaving.length ? ` · ${leaving.join(", ")} back to the tabs` : ""}`,
};

/** English, Jali's default words. Spread it to start a translation, or pass only what changes to `createJali`. */
export const en = {
  announcements,
  toasts,
  drop,
  commands,
  commandGroups,
  keys,
  palette,
  chooser,
  confirmDiscard,
  settings,
  tabs,
  shelf,
  pane,
  peek,
  workspace,
  page,
};

/** Every message Jali uses, by area. A full translation is a `Messages`: a missing key is a type error. */
export type Messages = {
  [Area in keyof typeof en]: { [Key in keyof (typeof en)[Area]]: (typeof en)[Area][Key] };
};

/** What `createJali({ messages })` takes: any areas, and any keys in them. The rest stay English. */
export type MessageOverrides = { [Area in keyof Messages]?: Partial<Messages[Area]> };

/** `overrides` over English, area by area. */
export function resolveMessages(overrides?: MessageOverrides): Messages {
  if (!overrides) return en;
  const out: Record<string, object> = { ...en };
  for (const [area, v] of Object.entries(overrides)) if (v) out[area] = { ...out[area], ...v };
  return out as Messages;
}

/** The messages of the workspace an env, snapshot or model belongs to (English when it was made without any). */
export const messagesOf = (from: Env | { env: Env }): Messages =>
  ("kinds" in from ? from : from.env).messages ?? en;

/** Its announcements: `say(x).closed(title)`. */
export const say = (from: Env | { env: Env }) => messagesOf(from).announcements;

/** What releasing a drag will do, in words: "Swap with orders", "Place above orders". */
export function dropText(
  zone: Edge | "centre",
  target: string,
  centreDrop: "swap" | "tab",
  words: Messages["drop"] = en.drop,
): string {
  if (zone === "centre")
    return centreDrop === "swap" ? words.swapWith(target) : words.addAsTabTo(target);
  return words.place(zone, target);
}
