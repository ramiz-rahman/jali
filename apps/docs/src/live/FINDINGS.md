# What the live parts need from Jali

The shop demo uses Jali's public API, except where this file says. Each gap below has its workaround in
`workspace/jali-gaps.ts`. When Jali covers one, delete its piece there and use Jali's.

## 1. A provider for parts beside the root

The tree's panels sit beside the workspace and read its model, so they need the root's `JaliProvider`. `jali/react`
keeps it internal, and `jali-gaps.ts` imports it from the package's source.

**Wanted:** `JaliProvider` exported from `jali/react`, or a component that renders its children in an instance's scope.

## 2. A reset

Reset puts the figure back to its starting layout. Jali has no action for it, so `resetTo` writes nine parts of
Jali's state itself (`undoStack`, `dnd`, `resizeMode`, `paletteOpen` and the rest). A new field in Jali's state would
be missed.

**Wanted:** `actions.reset(layout)`: the layout fitted, and the view, selection, undo, drag and dialogs cleared.

## 3. The drop under a point

The tour shows a drag as a person makes one: the chip, the drop preview and the drop. `dragAt` copies the rule from
Jali's `workspace/dnd.ts` to work out what is under the pointer, so the tour can drift from what a real drag does.

**Wanted:** the function Jali's own drag uses, exported from `jali/adapter`: a pane and a point in, the `DndState` out.

## 4. The layer for menus

A menu of the app's own (the order row's) belongs in Jali's layer, over the panes and in the workspace's theme.
`layerOf` finds it by walking the DOM from the root's element. Jali has it as `store.dom.layer()`, which isn't public.

**Wanted:** a hook that returns the instance's layer element, or (better, with 5) a menu that opens there itself.

## 5. A menu, or a menu for a list's items

The order list's row menu (Open, Open beside, the customer) rebuilds Jali's own `Menu`: focus, arrow keys, Esc,
placement inside the window. It draws with Jali's private menu classes so it looks the same.

**Wanted:** `Menu` exported from `jali/react`. Better still, a menu Jali gives any list item it can open, with Open,
Open beside, Peek and the app's own items: every list-and-detail app needs it, and the shortcut alone (⌥-click) is
hard to find.

## 6. Pane rects during a divider drag

The map moves with a divider as it is dragged. Jali moves the panes on the DOM each frame and commits once on release,
so its model doesn't change meanwhile; `dividerDragRects` reads the rects back from the panes' inline styles.

**Wanted:** the drag's rects in the model while it runs (or an event with them), so a part beside the workspace can
follow it.

## 7. One word for two kinds of "Following"

A pane opened beside a list with "Open beside" says **Following** in its header, like the list's real follower, but it
doesn't follow the selection: it is a plain link, which the next "Open beside" replaces. Its tooltip says so, but the
word on screen is the follower's, so a reader sees two "Following" panes and only one moves.

**Wanted:** the follow control saying something different for a plain link (for example "Replaced next", or the icon
alone).
