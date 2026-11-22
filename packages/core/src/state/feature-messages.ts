/**
 * The English each feature brings (features/): an instance has these words exactly when it has the feature, as it has
 * the curated page's words only with a page (page-messages.ts). `en` holds them all, for a translation to start from.
 */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** `urlSync()`: what the address says. */
export const urlSyncEn = {
  announcements: {
    historyChanged: "Layout changed by browser history",
    brokenLink: "The layout in this link couldn't be read. Opened the default layout instead.",
  },
  toasts: {
    brokenLink: (preset: string | undefined) => ({
      title: "This link’s layout couldn’t be read",
      description: preset
        ? `Opened “${preset}” instead. A copy of the link was kept.`
        : "The layout stayed as it was. A copy of the link was kept.",
      error: true as const,
    }),
  },
};

/** ⌘K. */
const palette = {
  label: "Commands",
  placeholder: "Type a command…",
  listLabel: "Commands",
  empty: (query: string) => `No command matches “${query}”.`,
};

/** `palette()`. */
export const paletteEn = { palette };

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

/** `chooser()`: "Add to tabs of…" and `jali.dialogs.choose`. */
export const chooserEn = { chooser, commands: { merge: "Add to tabs of…" } };

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
  paneCapHelp: "Over the cap, the oldest pane that is neither kept nor focused becomes a tab.",
  openedPanes: (page: string) => `${page}: opened panes`,
  boundaryTint: "Tinted header and “Opened” tag",
  boundaryNone: "No marking",
  viewingAs: (page: string) => `${page}: viewing as`,
  viewerFull: (viewer: string) => `${cap(viewer)}: links open beside`,
  viewerLimited: (viewer: string) => `${cap(viewer)}: Single view only, links open as a peek`,
  keyboard: "Keyboard",
  keyboardLabel: "Keyboard shortcuts",
  paletteKey: "Command palette (then a second key for a chord)",
  escapeKey: "Close the peek, then leave maximise (after the pane's own use of it)",
  /** `undo` is the platform's undo key ("⌘Z", "Ctrl+Z"). */
  keyboardNote: (undo: string) =>
    `Inside a pane, its own keys come first: J/K and the arrows move, Space peeks, ${undo} undoes the pane's own changes, and the first Esc is the pane's.`,
};

/** `settings()`: the settings panel. */
export const settingsEn = { settings, commands: { settingsOpen: "Open settings" } };

/** `rename()`: renaming a pane in place. */
export const renameEn = {
  commands: { rename: "Rename pane" },
  tabs: { rename: "Rename…" },
  pane: {
    /** The rename field's name, and what it says when the app turned the name down. */
    renameField: (pane: string) => `Rename ${pane}`,
    renameFailed: "Not renamed. Change the name, or press Escape",
  },
};

/** `popOut()`: a pane in a floating window. */
export const popOutEn = {
  commands: { popOut: "Pop out pane" },
  tabs: { popOut: "Pop out" },
  pane: {
    /** A popped-out pane's place (experimental Pop out). */
    poppedOut: "Popped out into its own window",
    bringBack: "Bring back",
    popOut: (pane: string) => `Pop out ${pane}`,
    popOutTip: "Pop out into a floating window",
    bringBackPane: (pane: string) => `Bring back ${pane}`,
  },
};
