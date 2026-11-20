# Commands

Every workspace command, its default keys on a Mac and on Windows and Linux, and when it is refused.

Every command has a stable id. The palette lists them all (greyed while refused); the keyboard runs the one a binding names; `runCommand(jali, id)` runs one from code. Rebind or unbind any of them with the workspace's `keymap` option:

```ts
createJali({ panes, layout, keymap: { "pane.close": "Mod+K Mod+W", "pane.split.down": null } });
```

`Mod` is ⌘ on a Mac and Ctrl on Windows and Linux. A key written after a space is a second step: for ⌘K ⌘M, hold ⌘, press K, then M, keeping ⌘ held. ⌘K on its own opens the palette.

When a command is refused, its key is still taken. If the refusal has a reason, it is announced in the live region; "silent" below means it is not. While the palette, Settings or the chooser is open, only the palette's key works.

The titles below are for a workspace with no curated page. With a curated page, "page" becomes the page's name and "viewer" and "investigator" its viewers' words; "Open Workspace" uses the workspace's `name`.

| Command | Title | Mac | Windows and Linux | Refused when |
| --- | --- | --- | --- | --- |
| `palette.toggle` | Open or close the command palette, and start a two-step chord | ⌘K | Ctrl+K | Never. Works with a dialog open too. |
| `pane.focus.next` | Focus next pane | F6 | F6 | Never. Visits every pane on screen in reading order, then the shelf (when shown) and any element marked data-pane-region, then wraps. |
| `pane.focus.previous` | Focus previous pane | ⇧F6 | Shift+F6 | Never. The same cycle backwards. |
| `pane.focus.left` | Focus pane left | ⌘K ⌘← | Ctrl+K Ctrl+Left | Silent when no pane is focused. Does nothing when no pane lies to that side. |
| `pane.focus.right` | Focus pane right | ⌘K ⌘→ | Ctrl+K Ctrl+Right | Silent when no pane is focused. Does nothing when no pane lies to that side. |
| `pane.focus.up` | Focus pane up | ⌘K ⌘↑ | Ctrl+K Ctrl+Up | Silent when no pane is focused. Does nothing when no pane lies to that side. |
| `pane.focus.down` | Focus pane down | ⌘K ⌘↓ | Ctrl+K Ctrl+Down | Silent when no pane is focused. Does nothing when no pane lies to that side. |
| `pane.focus.1` | Focus pane 1 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.2` | Focus pane 2 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.3` | Focus pane 3 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.4` | Focus pane 4 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.5` | Focus pane 5 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.6` | Focus pane 6 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.7` | Focus pane 7 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.8` | Focus pane 8 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.focus.9` | Focus pane 9 | none | none | Never refused. Does nothing when there are fewer panes on screen. |
| `pane.zoom` | Maximise or restore pane | ⇧⌘↵ or ⌘K ⌘M | Ctrl+Shift+Enter or Ctrl+K Ctrl+M | In a curated page in Single, with "Single shows one view: choose it from the tabs…". Silent when no pane is focused, or when only one pane is open and nothing is maximised. |
| `pane.fullscreen` | Full screen pane, or exit full screen | none | none | On a curated page in Single view. Puts the focused pane on the whole screen, or takes it off. |
| `pane.tuck` | Tuck pane into its neighbour | ⌘K ⌘[ | Ctrl+K Ctrl+[ | In Single, as for maximise. With no pane focused or recently focused: "No pane focused". A pane in a tab group, already tucked, or a tuck's home: "… is already a tab of …". Not on screen: "… is not on screen". The only pane open or on screen, or no neighbour to tuck into: "… can't be tucked". |
| `pane.putBack` | Put back tucked pane | ⌘K ⌘] | Ctrl+K Ctrl+] | "Nothing is tucked" when no pane is tucked. |
| `shelf.reveal` | Show a pane from the shelf | none | none | Silent when no pane is behind a tab (tucked, folded or an ordinary tab). |
| `pane.resize_mode` | Resize mode (arrows, then Esc) | ⌘K ⌘R | Ctrl+K Ctrl+R | Silent when no pane is focused. When the pane has no divider, the action says "Nothing to resize: this pane has no divider". |
| `pane.close` | Close pane | ⌘K ⌘⌫ | Ctrl+K Ctrl+Backspace | Silent when no pane is focused or only one pane is open (so always in a curated page's Single). In Split view a view is never closed: it goes back to the page tabs, refused with "… is the only view on screen" for the last one. |
| `pane.close_others` | Close other panes | none | none | Silent when no pane is focused or only one pane is open. In a curated page it means Back to the page, refused with "Nothing opened beyond the page" when nothing was opened. |
| `pane.undo_close` | Undo last close or tuck | ⌘K ⌘Z | Ctrl+K Ctrl+Z | "Nothing to restore" when the undo stack is empty. Undoes the last close, close others or tuck. |
| `pane.split.right` | Split right (new pane) | ⌘\ | Ctrl+\ | Silent when no pane is focused, or the workspace has no launcher kind. |
| `pane.split.down` | Split down (new pane) | ⌘K ⌘\ | Ctrl+K Ctrl+\ | Silent when no pane is focused, or the workspace has no launcher kind. |
| `pane.split.auto` | Split auto (new pane, by shape) | none | none | Silent when no pane is focused, or the workspace has no launcher kind. |
| `pane.move.left` | Move pane left | ⌘K ⇧⌘← | Ctrl+K Ctrl+Shift+Left | Silent when no pane is focused or only one pane is open. With no pane to that side: "… can't move left". |
| `pane.move.right` | Move pane right | ⌘K ⇧⌘→ | Ctrl+K Ctrl+Shift+Right | Silent when no pane is focused or only one pane is open. With no pane to that side: "… can't move right". |
| `pane.move.up` | Move pane up | ⌘K ⇧⌘↑ | Ctrl+K Ctrl+Shift+Up | Silent when no pane is focused or only one pane is open. With no pane to that side: "… can't move up". |
| `pane.move.down` | Move pane down | ⌘K ⇧⌘↓ | Ctrl+K Ctrl+Shift+Down | Silent when no pane is focused or only one pane is open. With no pane to that side: "… can't move down". |
| `pane.move.out` | Move pane out of the row | none | none | Silent unless the focused pane is in a row that scrolls sideways (`row({ scroll: "x" }, …)`). Takes it out beside the row, on the side it is nearer on screen: "… moved out of the row". |
| `pane.swap` | Swap with next pane | none | none | Silent when no pane is focused or only one pane is open. |
| `pane.merge` | Add to tabs of… | ⌘K ⌘G | Ctrl+K Ctrl+G | Silent when no pane is focused, or there is no other pane or stack on screen to join. Opens the "Add to tabs of…" chooser. |
| `pane.unmerge` | Move out of tabs | ⌘K ⇧⌘G | Ctrl+K Ctrl+Shift+G | Silent unless the focused pane is in a tab group made by the person (not one the layout folded). |
| `tab.move.left` | Move tab left | ⌘K ⇧PageUp | Ctrl+K Shift+PageUp | Silent unless the focused pane is a tab in a group made by the person or the app. At the start of the strip: "… is already the first tab". |
| `tab.move.right` | Move tab right | ⌘K ⇧PageDown | Ctrl+K Shift+PageDown | Silent unless the focused pane is a tab in a group made by the person or the app. At the end of the strip: "… is already the last tab". |
| `pane.rename` | Rename pane | F2 | F2 | Silent unless the workspace has `rename` and its `can` allows the focused pane. Opens the rename field on its tab or title. |
| `stack.new-tab` | New tab here | none | none | Silent when no pane is focused, or the workspace has no launcher kind. |
| `layout.preset.<id>` | Layout: Orders | none | none | Never. One command per preset, titled "Layout: <label>". |
| `layout.reset` | Reset layout | none | none | Silent in a workspace without presets. Rebuilds the preset last chosen. |
| `layout.auto` | Arrange panes automatically | none | none | On a curated page, or with one pane. Arranges every pane from the room and the kinds' sizes; Back undoes it. |
| `layout.copy_link` | Copy link to this layout | none | none | Never. Copies store.href() and says "Link copied", or "Couldn't copy the link" when the clipboard refuses; says nothing where there is no clipboard API. |
| `page.back` | Back to page (close opened panes) | none | none | Silent unless a curated page is open and has panes opened from links. |
| `page.reset` | Reset layout to its design | none | none | Silent unless a curated page is open in Split view. |
| `page.single` | Single view: one view at a time | none | none | Silent unless a curated page is open in Split view. |
| `page.split` | Split view: views side by side | none | none | Silent unless a curated page is open in Single and the viewer may investigate. |
| `page.open` | Open page | none | none | Silent while the page is open, or when the workspace has no profile. |
| `page.leave` | Open Workspace | none | none | Silent unless a curated page is open, and in a page-only app (no presets). |
| `page.as_limited` | View as viewer (Single only, links peek) | none | none | Silent unless a curated page is open and the viewer may investigate. |
| `page.as_full` | View as investigator (links open beside) | none | none | Silent unless a curated page is open and the viewer may not investigate. |
| `peek.close` | Close peek | none | none | Silent when no peek is open. |
| `peek.open_beside` | Open peek beside | none | none | Silent when no peek is open. |
| `peek.open_full` | Open peek full | none | none | Silent when no peek is open. |
| `settings.open` | Open settings | none | none | Never. |
| `settings.centre_drop.toggle` | Switch centre drop (swap ↔ tab) | none | none | Never. |

## Keys that are not commands

- **Esc**, after the focused content has had it: closes the peek, else leaves maximise.
- **Resize mode** (`pane.resize_mode`): the arrows move the divider nearest the pane on that side, Shift for bigger steps; Esc or Enter leaves.
- **In content marked `data-pane-keys="content"`** (an editor), the workspace takes only F6 and Shift+F6, so focus can always leave.
- Single character keys, ⌘Z or Ctrl+Z, Enter, Space and the first Esc belong to the focused content. A binding of a single character key with no Mod, Ctrl or Alt is refused when the keymap is made.
