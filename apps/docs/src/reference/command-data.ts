/**
 * The command table's data. Ids, titles, groups and keys come from @jali/core itself (commandsOf, DEFAULT_KEYMAP),
 * so the table is always the package's; when each command is refused is written here, from each command's `check`
 * in packages/core/src/commands/registry.ts and the action it runs. The coverage test checks that every command id
 * has a note here, and no note names a command that is gone.
 */
import { commandsOf, createPaneKinds, type Env, type Layout } from "@jali/core/adapter";

const empty = (): Layout => ({ version: 1, root: { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } } });

/** A workspace with one preset and no curated page: what commandsOf lists for most apps. Titles in "page" words
 *  ("Back to page", "View as viewer") take the profile's name and viewers when the workspace has one. */
export const SAMPLE_ENV: Env = {
  kinds: createPaneKinds([{ kind: "note", title: "Note" }]),
  profile: null,
  presets: [{ id: "orders", label: "Orders", build: empty }],
  name: "Workspace",
};

/** The one id per preset, shown as a pattern. */
export const PRESET_PATTERN = "layout.preset.<id>";
export const displayId = (id: string) => (id.startsWith("layout.preset.") ? PRESET_PATTERN : id);

export const COMMANDS = commandsOf({ env: SAMPLE_ENV });

/** When a command does not run. "Silent" means the key is still taken (the keyboard layer never lets a bound key
 *  through) but nothing is announced; the palette shows the command greyed out. */
export const REFUSED: Record<string, string> = {
  "pane.focus.next": "Never. Visits every pane on screen in reading order, then the shelf (when shown) and any element marked data-pane-region, then wraps.",
  "pane.focus.previous": "Never. The same cycle backwards.",
  "pane.focus.left": "Silent when no pane is focused. Does nothing when no pane lies to that side.",
  "pane.focus.right": "Silent when no pane is focused. Does nothing when no pane lies to that side.",
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
  "pane.zoom": "In a curated page in Single, with \"Single shows one view: choose it from the tabs…\". Silent when no pane is focused, or when only one pane is open and nothing is maximised.",
  "pane.tuck": "In Single, as for maximise. With no pane focused or recently focused: \"No pane focused\". A pane in a tab group, already tucked, or a tuck's home: \"… is already a tab of …\". Not on screen: \"… is not on screen\". The only pane open or on screen, or no neighbour to tuck into: \"… can't be tucked\".",
  "pane.putBack": "\"Nothing is tucked\" when no pane is tucked.",
  "shelf.reveal": "Silent when no pane is behind a tab (tucked, folded or an ordinary tab).",
  "pane.resize_mode": "Silent when no pane is focused. When the pane has no divider, the action says \"Nothing to resize: this pane has no divider\".",
  "pane.close": "Silent when no pane is focused or only one pane is open (so always in a curated page's Single). In Multiplexed a view is never closed: it goes back to the page tabs, refused with \"… is the only view on screen\" for the last one.",
  "pane.close_others": "Silent when no pane is focused or only one pane is open. In a curated page it means Back to the page, refused with \"Nothing opened beyond the page\" when nothing was opened.",
  "pane.undo_close": "\"Nothing to restore\" when the undo stack is empty. Undoes the last close, close others or tuck.",
  "pane.split.right": "Silent when no pane is focused.",
  "pane.split.down": "Silent when no pane is focused.",
  "pane.split.auto": "Silent when no pane is focused.",
  "pane.move.left": "Silent when no pane is focused or only one pane is open. With no pane to that side: \"… can't move left\".",
  "pane.move.right": "Silent when no pane is focused or only one pane is open. With no pane to that side: \"… can't move right\".",
  "pane.move.up": "Silent when no pane is focused or only one pane is open. With no pane to that side: \"… can't move up\".",
  "pane.move.down": "Silent when no pane is focused or only one pane is open. With no pane to that side: \"… can't move down\".",
  "pane.swap": "Silent when no pane is focused or only one pane is open.",
  "pane.merge": "Silent when no pane is focused, or there is no other pane or stack on screen to join. Opens the \"Add to tabs of…\" chooser.",
  "pane.unmerge": "Silent unless the focused pane is in a tab group made by the person (not one the layout folded).",
  "stack.new-tab": "Silent when no pane is focused.",
  [PRESET_PATTERN]: "Never. One command per preset, titled \"Layout: <label>\".",
  "layout.reset": "Silent in a workspace without presets. Rebuilds the preset last chosen.",
  "layout.copy_link": "Never. Copies store.href() and says \"Link copied\", or \"Couldn't copy the link\" when the clipboard refuses; says nothing where there is no clipboard API.",
  "page.back": "Silent unless a curated page is open and has panes opened from links.",
  "page.reset": "Silent unless a curated page is open in Multiplexed.",
  "page.single": "Silent unless a curated page is open in Multiplexed.",
  "page.multi": "Silent unless a curated page is open in Single and the viewer may investigate.",
  "page.open": "Silent while the page is open, or when the workspace has no profile.",
  "page.leave": "Silent unless a curated page is open.",
  "page.as_limited": "Silent unless a curated page is open and the viewer may investigate.",
  "page.as_full": "Silent unless a curated page is open and the viewer may not investigate.",
  "peek.close": "Silent when no peek is open.",
  "peek.pin": "Silent when no peek is open.",
  "peek.open_full": "Silent when no peek is open.",
  "settings.open": "Never.",
  "settings.centre_drop.toggle": "Never.",
};
