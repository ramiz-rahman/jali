/**
 * The command table's data. Ids, titles, groups and keys come from jali itself (commandDefsOf, DEFAULT_KEYMAP),
 * so the table is always the package's; when each command is refused is written here, from each command's `check`
 * in packages/core/src/commands/registry.ts and the action it runs. The coverage test checks that every command id
 * has a note here, and no note names a command that is gone.
 */
import {
  chooserFeature,
  commandDefsOf,
  createPaneKinds,
  en,
  pageEngine,
  paletteFeature,
  popOutFeature,
  renameFeature,
  settingsFeature,
  spacingOf,
  type Env,
  type Layout,
} from "jali/adapter";

const empty = (): Layout => ({
  version: 1,
  root: { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } },
});

/** An instance with one preset, and a curated page's engine and words so the table lists the page's commands too
 *  (an instance has them only with a page from `definePage`). With no profile, titles in "page" words read "Back to
 *  page"; a real page puts its name there. Every feature that brings a command is
 *  on (the palette, Settings, the chooser, rename, pop out), so the table lists the commands an instance has only
 *  with them. */
export const SAMPLE_ENV: Env = {
  kinds: createPaneKinds([{ kind: "note", title: "Note" }]),
  profile: null,
  page: pageEngine,
  messages: en,
  presets: [{ id: "orders", label: "Orders", build: empty }],
  name: "Notes",
  spacing: spacingOf(),
  features: [
    paletteFeature(),
    settingsFeature(),
    chooserFeature(),
    renameFeature({ run: () => {} }),
    popOutFeature({
      can: () => true,
      open: async () => true,
      close: () => {},
      pane: () => undefined,
    }),
  ],
};

/** The one id per preset, shown as a pattern. */
export const PRESET_PATTERN = "layout.preset.<id>";
export const displayId = (id: string) => (id.startsWith("layout.preset.") ? PRESET_PATTERN : id);

export const COMMANDS = commandDefsOf({ env: SAMPLE_ENV });

/** When a command does not run. "Silent" means the key is still taken (the keyboard layer never lets a bound key
 *  through) but nothing is announced; the palette shows the command greyed out. */
export const REFUSED: Record<string, string> = {
  "pane.focus.next":
    "Never. Visits every pane on screen in reading order, then the shelf (when shown) and any element marked data-pane-region, then wraps.",
  "pane.focus.previous": "Never. The same cycle backwards.",
  "pane.focus.left": "Silent when no pane is focused. Does nothing when no pane lies to that side.",
  "pane.focus.right":
    "Silent when no pane is focused. Does nothing when no pane lies to that side.",
  "pane.focus.up": "Silent when no pane is focused. Does nothing when no pane lies to that side.",
  "pane.focus.down": "Silent when no pane is focused. Does nothing when no pane lies to that side.",
  "pane.focus.1": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.2": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.3": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.4": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.5": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.6": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.7": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.8": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.focus.9": "Never refused. Does nothing when there are fewer panes on screen.",
  "pane.zoom":
    'In a curated page in Single, with "Single shows one view: choose it from the tabs…". Silent when no pane is focused, or when only one pane is open and nothing is maximised.',
  "pane.tuck":
    'In Single, as for maximise. With no pane focused or recently focused: "No pane focused". A pane in a tab group, already tucked, or a tuck\'s home: "… is already a tab of …". Not on screen: "… is not on screen". The only pane open or on screen, or no neighbour to tuck into: "… can\'t be tucked".',
  "pane.putBack": '"Nothing is tucked" when no pane is tucked.',
  "shelf.reveal": "Silent when no pane is behind a tab (tucked, folded or an ordinary tab).",
  "pane.resize_mode":
    'Silent when no pane is focused. When the pane has no divider, the action says "Nothing to resize: this pane has no divider".',
  "pane.close":
    'Silent when no pane is focused or only one pane is open (so always in a curated page\'s Single view). In Split view a view is never closed: it goes back to the page tabs, refused with "… is the only view on screen" for the last one.',
  "pane.close_others":
    'Silent when no pane is focused or only one pane is open. In a curated page it means Back to the page, refused with "Nothing opened beyond the page" when nothing was opened.',
  "pane.undo_close":
    '"Nothing to restore" when the undo stack is empty. Undoes the last close, close others or tuck.',
  "pane.split.right":
    "Silent when no pane is focused, or there is no launcher. Where the pane doesn't allow `open`: \"Panes can't be opened from … here\".",
  "pane.split.down":
    "Silent when no pane is focused, or there is no launcher. Where the pane doesn't allow `open`: \"Panes can't be opened from … here\".",
  "pane.split.auto":
    "Silent when no pane is focused, or there is no launcher. Where the pane doesn't allow `open`: \"Panes can't be opened from … here\".",
  "pane.move.left":
    'Silent when no pane is focused or only one pane is open. With no pane to that side: "… can\'t move left".',
  "pane.move.right":
    'Silent when no pane is focused or only one pane is open. With no pane to that side: "… can\'t move right".',
  "pane.move.up":
    'Silent when no pane is focused or only one pane is open. With no pane to that side: "… can\'t move up".',
  "pane.move.down":
    'Silent when no pane is focused or only one pane is open. With no pane to that side: "… can\'t move down".',
  "pane.swap": "Silent when no pane is focused or only one pane is open.",
  "pane.move.out":
    'Silent unless the focused pane is in a row that scrolls sideways (`row({ scroll: "x" }, …)`). Takes it out beside the row, on the side it is nearer on screen: "… moved out of the row".',
  "pane.merge":
    'Only with the chooser() feature (jali/chooser). Silent when no pane is focused, or there is no other pane or stack on screen to join. Opens the "Add to tabs of…" chooser.',
  "pane.unmerge":
    "Silent unless the focused pane is in a tab group made by the person (not one the layout folded).",
  "tab.move.left":
    'Silent unless the focused pane is a tab in a group made by the person or the app. At the start of the strip: "… is already the first tab".',
  "tab.move.right":
    'Silent unless the focused pane is a tab in a group made by the person or the app. At the end of the strip: "… is already the last tab".',
  "pane.rename":
    "Only with the rename() feature (jali/rename). Silent unless its `can` allows the focused pane. Opens the rename field on its tab or title.",
  "stack.new-tab":
    "Silent when no pane is focused, or there is no launcher. Where the pane doesn't allow `open`: \"Panes can't be opened from … here\".",
  [PRESET_PATTERN]: 'Never. One command per preset, titled "Layout: <label>".',
  "pane.fullscreen":
    "On a curated page in Single view. Puts the focused pane on the whole screen, or takes it off.",
  "pane.pop_out":
    "Only with the popOut() feature (jali/pop-out). Silent when no pane is focused, or the browser can't pop out (Document Picture-in-Picture: Chrome and Edge on desktop). When the focused pane doesn't allow it, says so. Opens it in a floating window that stays on top.",
  "layout.reset": "Silent without presets. Rebuilds the preset last chosen.",
  "layout.auto":
    "On a curated page, on a phone (one pane at a time), or with one pane. Arranges every pane from the room and the kinds' sizes; Back undoes it.",
  "layout.copy_link":
    'Never. Copies store.href() and says "Link copied", or "Couldn\'t copy the link" when the clipboard refuses; says nothing where there is no clipboard API.',
  "page.back": "Silent unless a curated page is open and has panes opened from links.",
  "page.reset": "Silent unless a curated page is open in Split view.",
  "page.single": "Silent unless a curated page is open in Split view.",
  "page.split": "Silent unless a curated page is open in Single view.",
  "page.open": "Silent while the page is open, or when there is no curated page.",
  "page.leave": "Silent unless a curated page is open, and in a page-only app (no presets).",
  "peek.close": "Silent when no peek is open.",
  "peek.open_beside":
    "Silent when no peek is open. Where the pane the peek came from doesn't allow `open`: \"Panes can't be opened from … here\".",
  "settings.open": "Only with the settings() feature (jali/settings). Never refused there.",
  "settings.centre_drop.toggle": "Never.",
};
