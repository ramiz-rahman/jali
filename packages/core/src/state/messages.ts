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
import { pageEn } from "./page-messages";
import {
  chooserEn,
  paletteEn,
  popOutEn,
  renameEn,
  settingsEn,
  urlSyncEn,
} from "./feature-messages";

/** A direction on screen, as command ids name it ("pane.focus.left"). Right to left, left is still the screen's left. */
export type ScreenDirection = "left" | "right" | "up" | "down";

/** Direction as a word: "up", "down", "left", "right", "into the centre". */
export const dirWord = (d: Edge | "centre") =>
  d === "top" ? "up" : d === "bottom" ? "down" : d === "centre" ? "into the centre" : d;

const panes = (n: number) => (n === 1 ? "pane" : "panes");

/** The live region: what happened, and why something did not. */
const announcements = {
  // focus and zoom
  maximised: (pane: string) => `${pane} maximised · Escape to restore`,
  fullScreen: (pane: string) => `${pane} full screen · Escape to exit`,
  /** An action the app doesn't allow for this pane (`allow`). */
  notAllowed: (action: string, pane: string) =>
    `${pane} can't be ${
      {
        close: "closed",
        tuck: "tucked",
        maximise: "maximised",
        fullScreen: "shown full screen",
        move: "moved",
        resize: "resized",
        pin: "pinned",
        popOut: "popped out",
      }[action] ?? "changed"
    } here`,
  fullScreenOff: (pane: string) => `${pane} left full screen`,
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
  openedKept: (pane: string, source: string) =>
    `${pane} opened beside ${source}, kept: it stays on this item`,
  kept: (pane: string) => `${pane} kept: it stays on this item`,
  released: (pane: string, list: string) => `${pane} follows the selection in ${list}`,
  /** A kept plain link let go: the next link from its source shows there again. */
  unkept: (pane: string) => `${pane} is no longer kept`,
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

  // an app's call with a ref that can't be shown (actions/public.ts)
  unknownKind: (kind: string) => `There is no pane kind “${kind}”`,
  invalidRef: "That can’t be shown in a pane",
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
  movedOutOfRow: (pane: string) => `${pane} moved out of the row`,
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
  tabPinned: (pane: string) => `${pane} pinned`,
  tabUnpinned: (pane: string) => `${pane} unpinned`,
  /** A tab can't move further that way: `edge` is "first" or "last". */
  tabAtEdge: (pane: string, edge: "first" | "last") => `${pane} is already the ${edge} tab`,

  // sizes
  sizesReset: "Sizes reset",
  resizeModeOn: "Resize mode: arrows resize, Shift for bigger steps, Escape or Enter to leave",
  resizeModeOff: "Resize mode off",
  nothingToResize: "Nothing to resize: this pane has no divider",

  // layout, peek, link, settings
  preset: (label: string) => `Layout: ${label}`,
  arranged: (n: number) => `Arranged ${n} ${panes(n)}`,
  peek: (pane: string) => `Peek: ${pane} · Escape to close`,
  peekClosed: "Peek closed",
  linkCopied: "Link copied",
  linkNotCopied: "Couldn't copy the link",
  centreDrop: (mode: "swap" | "tab") => `Centre drop: ${mode === "swap" ? "swap" : "add as tab"}`,

  // inside a curated page: what the workspace's own steps say there (the page's own words are in page-messages.ts)
  sentToTabs: (views: string[]) => `${views.join(", ")} went back to the tabs: not enough room`,
  singleNoLayout:
    "Single shows one view: choose it from the tabs. Switch to Split view to arrange views",
  peekOnly: (pane: string) => `Peek: ${pane} · your role opens links as a peek`,
  peekSingle: (pane: string) => `Peek: ${pane} · switch to Split view to open links beside`,

  // what the workspace did on its own
  singleOn: "Single view: one pane at a time. Use the pane switcher at the top.",
  singleOff: "Single view ended: full layout restored",
  /** Stacked view on a phone: two linked panes, one above the other. */
  stacked: (top: string, bottom: string) => `Two panes stacked: ${top} above, ${bottom} below`,
  /** A folding screen: a pane each side of the fold. */
  foldSplit: (first: string, second: string) => `Split at the fold: ${first} and ${second}`,
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
  fullScreen: "Full screen pane, or exit full screen",
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
  moveOutOfRow: "Move pane out of the row",
  unmerge: "Move out of tabs",
  moveTab: (direction: "left" | "right") => `Move tab ${direction}`,
  newTab: "New tab here",
  preset: (label: string) => `Layout: ${label}`,
  resetLayout: "Reset layout",
  autoLayout: "Arrange panes automatically",
  copyLink: "Copy link to this layout",
  peekClose: "Close peek",
  peekOpenBeside: "Open peek beside",
  peekOpenFull: "Open peek full",
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
  /** A folded tab's tooltip: its title, then why it is a tab. */
  foldedTitle: (pane: string) => `${pane} · Folded: not enough room · returns when there's space`,
  foldedDescription: "Folded: returns when there's room",
  /** The chip at the end of a strip for the panes the layout folded into it (not the one it shows). */
  foldedChip: (count: number) => `${count} folded`,
  /** `activity` is the most pressing of the folded panes' (`useActivity`), so the chip can say one is working. */
  foldedChipLabel: (count: number, activity?: PaneActivity) => {
    const word =
      activity === "loading" || activity === "working"
        ? "working"
        : activity === "live"
          ? "live"
          : activity === "needs-you"
            ? "one needs you"
            : activity === "error"
              ? "one failed"
              : "";
    return `${count} folded ${count === 1 ? "pane" : "panes"}${word ? `, ${word}` : ""}`;
  },
  foldedChipTip: "Folded: not enough room to show these side by side",
  /** Atop the folded chip's menu. */
  foldedNote: "No room to show these side by side. Widen the window, or pick one to show it here.",
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
  /** A pane in a row that scrolls sideways: out of it, beside it. */
  moveOutOfRow: "Move out of the row",
  pinTab: "Pin tab",
  /** A pinned tab's description starts with this. */
  pinned: "Pinned",
  splitRight: "Split right",
  splitDown: "Split down",
  maximise: "Maximise",
  restore: "Restore",
  fullScreen: "Full screen",
  exitFullScreen: "Exit full screen",
  tuck: "Tuck",
};

/** The shelf: tucked and folded panes as chips. */
const shelf = {
  label: "Shelf",
  toolbar: "Tucked panes",
  behind: (home: string) => `Behind ${home}`,
  behindHeading: (home: string) => `Behind ${home}:`,
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
        : c.activity === "live"
          ? "live"
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
  more: (count: number) => `${count} more tucked panes`,
  moreCount: (count: number) => `+${count}`,
  menuFolded: "Folded panes",
  menuMore: "More tucked panes",
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
  fullScreen: (pane: string) => `Full screen ${pane}`,
  fullScreenTip: "Full screen",
  exitFullScreen: (pane: string) => `Exit full screen ${pane}`,
  exitFullScreenTip: "Exit full screen",
  /** The ⋯ button: everything the pane's menu offers. */
  menu: (pane: string) => `More for ${pane}`,
  menuTip: "More",
  restore: (pane: string) => `Restore ${pane}`,
  restoreTip: "Restore",
  opened: "Opened",
  kept: "Kept",
  following: "Following",
  /** The follow toggle's name while it follows `list` (its visible word is `following`, which the name starts with). */
  followingName: (list: string) => `Following ${list}`,
  /** The follow toggle's tooltip and description: what it does now, and what a click does. */
  keptTip: (list: string) => `Kept: stays on this item. Click to follow ${list} again`,
  followingTip: (list: string) => `Follows the selection in ${list}. Click to keep this one`,
  plainTip: (list: string) =>
    `The next link from ${list} shows here. Click to keep this one and open the next beside it`,
  loading: "Loading",
  working: "Working",
  live: "Live",
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
  openBeside: "Open beside",
  openFull: "Open full",
  close: "Close peek",
  closeTip: (keys: string) => `Close (${keys})`,
};

/** The panes region, Single view's pane switcher, and the dividers between panes. */
const workspace = {
  label: "Panes",
  /** A landmark of a workspace the host named (`createJali({ label })`): a pane, the shelf, the switcher, the peek. */
  within: (landmark: string, workspace: string) => `${landmark}, ${workspace}`,
  switcher: "Panes",
  switcherList: (count: number) => `Panes: ${count}`,
  /** The panes on one side of a divider: up to three titles, then a count. */
  dividerSide: (panes: string[]) =>
    panes.length <= 3
      ? panes.join(", ")
      : `${panes.slice(0, 2).join(", ")}, +${panes.length - 2} more`,
  divider: (a: string, b: string) => `Resize between ${a} and ${b}`,
  /** Stacked view's divider: the top pane's share, as the person hears it. */
  stackValue: (top: string, percent: number) => `${top} ${percent} percent of the height`,
  dividerValue: (a: string, aPx: number, b: string, bPx: number) =>
    `${a} ${aPx} pixels, ${b} ${bPx} pixels`,
  /** One side of a focused divider's size tip. */
  dividerTip: (side: string, px: number) => `${side} · ${px}px`,
};

/** English for every workspace, without a curated page's words (those come with `definePage`; page-messages.ts) or a
 *  feature's (each feature brings its own; feature-messages.ts). */
export const baseEn = {
  announcements,
  toasts,
  drop,
  commands,
  commandGroups,
  keys,
  confirmDiscard,
  tabs,
  shelf,
  pane,
  peek,
  workspace,
};

/** `base` with `more` over it, area by area. */
const withAreas = <B extends object, M extends object>(base: B, more: M): B & M => {
  const out = { ...base } as Record<string, object>;
  for (const [area, words] of Object.entries(more)) out[area] = { ...out[area], ...words };
  return out as B & M;
};

/** English, Jali's default words. Spread it to start a translation, or pass only what changes to `createJali`. */
// Pure, so an app that never reads `en` (it reads `jali.messages`) doesn't ship the page's words through it.
export const en = /* @__PURE__ */ [
  pageEn,
  urlSyncEn,
  paletteEn,
  chooserEn,
  settingsEn,
  renameEn,
  popOutEn,
].reduce<object>(withAreas, baseEn) as typeof baseEn &
  typeof pageEn &
  typeof urlSyncEn &
  typeof paletteEn &
  typeof chooserEn &
  typeof settingsEn &
  typeof renameEn &
  typeof popOutEn;

/** Every message Jali uses, by area. A full translation is a `Messages`: a missing key is a type error. */
export type Messages = {
  [Area in keyof typeof en]: { [Key in keyof (typeof en)[Area]]: (typeof en)[Area][Key] };
};

/** What `createJali({ messages })` takes: any areas, and any keys in them. The rest stay English. */
export type MessageOverrides = { [Area in keyof Messages]?: Partial<Messages[Area]> };

/**
 * A workspace's words: English, then each feature's English (`features`, which each feature brings), then a curated
 * page's (`page`, which its engine brings), then `overrides`, area by area. What a workspace doesn't have is left out:
 * nothing reads it, and an app without it doesn't ship it. So `Messages`' feature and page words are there exactly
 * when the workspace has the feature or the page.
 */
export const resolveMessages = (
  overrides?: MessageOverrides,
  page?: MessageOverrides,
  features: readonly (MessageOverrides | undefined)[] = [],
): Messages =>
  [...features, page, overrides].reduce<object>(
    (words, more) => (more ? withAreas(words, more) : words),
    baseEn,
  ) as Messages;

/** The messages of the workspace an env, snapshot or model belongs to (English when it was made without any). */
export const messagesOf = (from: Env | { env: Env }): Messages =>
  ("kinds" in from ? from : from.env).messages ?? (baseEn as Messages);

/** Its announcements: `say(x).closed(title)`. */
export const say = (from: Env | { env: Env }) => messagesOf(from).announcements;

/** What releasing a drag will do, in words: "Swap with orders", "Place above orders". */
export function dropText(
  zone: Edge | "centre",
  target: string,
  centreDrop: "swap" | "tab",
  words: Messages["drop"] = baseEn.drop,
): string {
  if (zone === "centre")
    return centreDrop === "swap" ? words.swapWith(target) : words.addAsTabTo(target);
  return words.place(zone, target);
}
