# Accessibility

What Jali guarantees for keyboard, screen reader and forced-colours users, the keys it uses, and what your panes still have to do.

Jali builds its own accessible parts, with no dependencies, and tests them in a real browser on every change. This page says what it does for you and what is left to your panes' content.

## What Jali guarantees

These are checked by Jali's browser tests (`e2e/a11y.spec.ts` and `e2e/axe.spec.ts` in the repo, which run axe, WCAG 2.2 A and AA, on the panes, tab strips, menus, the palette, Settings, the discard question and curated pages):

- **Landmarks.** The panes are one region named "Panes", inside your page's `<main>`, or the page's `<main>` itself with `createJali({ landmark: "main" })`. Each pane is a region named by its title. With two instances on a page, `createJali({ label })` or `<JaliRoot aria-label>` names each one, and every landmark inside carries that name, so none repeats.
- **Focus you can see and follow.** The focused pane has a visible edge. After a change, focus goes to where the person expects: back to the pane that opened something, to the tab that moved, to the control that opened a dialog when it closes. Focus never leaves an element of your chrome marked `data-jali-chrome`.
- **Every action from the keyboard.** Everything a pointer can do (resize, move, tab, tuck, maximise, close) has a key or a menu item. Dragging always has an alternative, as WCAG 2.5.7 asks: "Add to tabs of…" and the move keys do what a drag does.
- **Standard patterns.** Dividers follow the WAI-ARIA window splitter pattern (`role="separator"`, its value as a percentage and as words). Tab strips follow the tabs pattern, with one tab stop per strip and their tab panels named. Menus follow the menu pattern, with type-ahead. The palette and the chooser are a field over a list of choices. Settings and the discard question are modal dialogs.
- **Modal dialogs.** While a dialog is open, focus moves into it, Tab stays inside it, everything behind it is `inert`, and Esc closes it and gives focus back.
- **Announcements.** A live region says what changed after each action that moves something ("Order 1041 opened beside Orders", "opened as a tab: not enough room") and why an action didn't happen. Messages that arrive within a moment of each other are read as one.
- **Reasons, not dead ends.** A control that can't act now stays reachable and says why (`aria-disabled` with its reason), and ⌘K lists refused commands greyed out with the reason.
- **Forced colours.** In Windows High Contrast and other forced-colour modes, the focused pane's ring, the shown tab's underline, a focused divider and the palette's active result are drawn in system colours. The browser tests check each of these.
- **Reduced motion.** With `prefers-reduced-motion: reduce`, panes don't animate as the layout changes, and tabs don't flash.
- **Zoom and small screens.** At 200% zoom or on a phone, panes fold, and below 600 pixels Jali shows one pane at a time with a switcher, rather than squeezing them.
- **Right to left.** With `dir="rtl"`, the layout mirrors, and every left and right that a key, drop zone or message names is still the screen's.

## The keyboard map

The defaults, as on a Mac (Ctrl in place of ⌘ on Windows and Linux). Every binding can be changed or turned off with `keyboard.keymap`; the full list is on the [Commands reference](../reference/commands.md).

| Keys | What they do |
|---|---|
| F6 / ⇧F6 | Focus the next / previous pane |
| ⌘K ⌘← ⌘→ ⌘↑ ⌘↓ | Focus the pane in that direction |
| ⌘K ⇧⌘← (and the other arrows) | Move the focused pane |
| ⇧⌘↵, or ⌘K ⌘M | Maximise or restore |
| ⌘K ⌘⌫ | Close the pane (asks first about unsaved work) |
| ⌘K ⌘Z | Undo the last close or tuck |
| ⌘K ⌘[ / ⌘K ⌘] | Tuck / put back |
| ⌘K ⌘R, then arrows, then Esc | Resize mode |
| ⌘\\ / ⌘K ⌘\\ | Split right / down (with a launcher) |
| ⌘K ⌘G | Add to tabs of… (with `chooser()`) |
| ⌘K | Open the palette (with `palette()`) |
| F2 | Rename (with `rename()`) |
| Esc | Close the peek, then restore a maximised pane, once the content has had its turn |

On a focused divider, ← and → (↑ and ↓ in a column) resize by a step, Shift by a bigger one, and Home and End go to the limits. In a tab strip, ← and → move between tabs, Home and End go to the ends, Enter or Space shows a tab, Delete or Backspace closes it, and Shift+F10 or the menu key opens its menu. On a phone, the switcher at the top takes ← and → and Enter.

Jali binds no single printable keys, and your content sees every key first. See [Commands and keys](../guides/commands-and-keys.md#content-first).

## Screen reader behaviour

- **Moving between panes:** each pane is a region, so landmark navigation (D in NVDA and JAWS, the rotor in VoiceOver) lists them by title. F6 moves focus there too.
- **What a pane is:** its region's name is its title. Its header's controls say its state in words: the unsaved mark is "Unsaved changes", and a linked pane's toggle is "Following Orders" until the person keeps it.
- **What changed:** after an action, the live region speaks once, politely. Toasts are your app's to render; give them `role="status"` (or `"alert"` for errors).
- **Dividers:** a divider is named "Resize between Orders and Order 1041", and its value is read in words: "Orders 480 pixels, Order 1041 360 pixels".
- **Tabs:** a moved tab is announced with its new place ("Orders moved to position 2 of 4"), and a pinned tab says "Pinned" first in its description. Its close and put-back buttons are for the pointer; their keys are in the tab's description instead.

## What your panes must do

Jali can't see inside your content. Each pane needs:

- **Names for its controls**, and a heading or label for anything that isn't obvious from the pane's title.
- **Keys that claim only what they use.** Call `event.preventDefault()` on the keys your content handles, and let the rest bubble, so F6, ⌘K and Jali's commands keep working. Content that needs every key, such as an editor, marks itself `data-pane-keys="content"`, and Jali then takes only F6 and ⇧F6 there, so focus can always leave.
- **A list that says where its cursor is.** A list that drives a following detail should use one tab stop with the active option exposed (`aria-activedescendant`, or moving focus between options), or a list of plain buttons. The [Following a list](following.md) sample does the first.
- **Contrast in your own colours.** Jali's default theme passes axe's colour-contrast check, light and dark, in the docs site's browser tests. Colours you set through `--jali-*` tokens are yours to check.
- **Toasts that can be read and reached.** Render them in `<JaliRoot overlays>`, with a live role, and keep Undo reachable from the keyboard.

## Next

- [Commands and keys](../guides/commands-and-keys.md)
- [Build your own chrome](../guides/custom-chrome.md)
