# Rows that scroll sideways

Design note, 20 Nov 2026. Question: today a Jali workspace is exactly the size its host gives it, and panes that don't fit fold into tabs. Should Jali also offer a layout that scrolls sideways, so a board of panes keeps every column at a comfortable width?

## Recommendation

Yes. Make it an option on a row, not a second kind of workspace:

```ts
row({ scroll: "x" }, pane(day({ n: 1 })), pane(day({ n: 2 })) /* … */);
```

A scrolling row lays its children out at their own widths and scrolls to show the rest, instead of sharing its width out and folding what doesn't fit. Everything else about panes stays the same: they are real panes of any kind, with headers, menus, follow, keep, tabs, splits down a column, links and undo.

A whole workspace that scrolls is then just a layout whose root is a scrolling row. But the option on a row also allows the mix that makes this better than a board app:

```ts
row(
  pane(trip(), { id: "overview" }), // fixed: stays put
  row({ scroll: "x" }, ...days.map((n) => pane(day({ n })))), // scrolls
  column(pane(map({ day: 0 }), { id: "map" }), pane(place())), // fixed: stays put
);
```

The overview and the map stay where they are, and the days scroll between them. "Pinned columns" are just ordinary panes outside the scrolling row, so no new concept is needed.

## What happens today, measured

Trips' Days layout is seven day panes (`min 300`, `comfortable 360`) with a map and a place in a column beside them. Measured in Chrome:

| Window    | Days side by side | Their width | Folded into tabs |
| --------- | ----------------- | ----------- | ---------------- |
| 1280×800  | 2 of 7            | 362 px      | 5                |
| 1440×900  | 3 of 7            | 352 px      | 4                |
| 1728×1117 | 4 of 7            | 335 px      | 3                |
| 1920×1080 | 5 of 7            | 306 px      | 2                |
| 2560×1440 | 7 of 7            | 309 px      | 0                |

On a typical laptop you see a third of the week, and the rest is behind "4 folded". Folding is the right answer for a workspace of different things, because a fifth table beside four others is clutter. It is the wrong answer for a sequence of like things (days, stages, columns of a board, steps of a pipeline), where the person wants to move along the sequence, not pick from a menu of it.

## Prior art

- **Scrolling tiling window managers**: niri (Wayland), PaperWM (GNOME) and Karousel (KDE). Windows sit in columns on an endless horizontal strip. A column keeps its width, and windows stack down a column. Focusing a column scrolls the strip just enough to show it, and niri can also centre it. Column widths cycle through presets (a third, a half, two thirds of the screen). This is the closest model, and people who use it describe it as calmer than tiling, because opening a window never squeezes the others.
- **Miller columns**: Finder's column view, and the column browsers in NeXTSTEP and iTunes. Opening an item adds a column to its right and scrolls it into view. This is Jali's "open beside", on a strip.
- **Boards**: Trello, Linear and Notion's board views, and GitHub Projects. Columns scroll sideways, but a column is only a list of cards, and a card opens as a modal over the board, hiding it. Jali can do better on both counts. A column can be any pane (a day plan, a chart, a record). A card's detail opens as a pane beside its column, so the board stays visible and the detail follows the selection.

## How it fits Jali

**The tree.** `SplitNode` gains an optional `scroll?: "x"`, on rows only. The builder is `row({ scroll: "x" }, …children)`. It round-trips through the URL codec and storage like `weight` does.

**Bounds** (`layout/geometry/bounds.ts`). Towards its parent, a scrolling row needs only its widest child's minimum width (it can always scroll to the rest). It would like the sum of its children's comfortable widths, so the parent's share rule gives it all the room it can. Its height is the tallest child's, as for any row.

**Fitting** (`layout/fit`). The children of a scrolling row never fold for width, and they don't count towards the pane cap: the cap exists because a screen holds only so many panes, and a strip doesn't have that limit. Height still folds inside a column, as today. A scrolling row nested inside another scrolling row is treated as a plain row.

**Geometry** (`resolve`). The row draws its children at their own widths: a person's `px` size, or else `comfortable`, clamped to `min` and `max`. Their rects are in the row's content coordinates. `ResolvedLayout` gains `scrollers: { id, rect, contentWidth, paneIds }[]`, where `rect` is the strip's window on screen. A divider inside a strip has no `max`: it changes only the column to its left, and the content gets longer.

**Scroll position and what is in view.** The offset is view state, `view.scroll[rowId]` in px, like `zoomed`, so links and reloads reopen at the same place. Scrolling writes it with `replaceState`, debounced like a divider drag, and never adds a history entry. The model gains `inView`: panes whose rect meets their strip's window. A pane out of view gets `paused` (Trips' map already stops drawing when paused). So a strip of twenty panes costs about what the few on screen do.

**Rendering** (`@jali/react`). Each scroller is one real element at its rect, with `overflow-x: auto` and `scroll-snap-type: x proximity`, and its panes are laid out inside it. Native scrolling gives trackpad momentum, Shift+wheel, scroll-snap, `scrollIntoView` and screen-reader scrolling for free. The cost is that a pane moving into or out of a strip remounts. That only happens on a preset change or a drag between the strip and outside it, and pane state survives it through `usePaneState`. Faint fades at the strip's edges show there is more.

**Focus and opening.** Focusing a pane in a strip (a click, F6, ⌘K ⌘← and →, a link, an undo) scrolls the strip by the least amount that shows the whole pane. `opening beside` inserts the new pane right of its source and scrolls to show both. Focus stays in the source, as it does everywhere in Jali.

**Dragging.** While a pane, or an app's own drag like Trips' stops, is held near a strip's edge, the strip scrolls. Jali does this for its own pane drag, and exports `autoScroll(x, y)` for apps that run their own drag.

**Maximise, phone and pop-out.** Maximise is unchanged: the pane fills the workspace. On a phone, the existing single view lists every column in its switcher. Swiping between snapped columns is a natural later step, since a strip of full-width columns is a phone's own idiom. Pop-out is unchanged.

**Accessibility.** The strip is a region named after the row ("Days, 7 panes"), and every pane stays in the reading and focus order, whether in view or not. Moving focus brings a pane into view, so a keyboard user never lands on something off screen. Reduced motion scrolls instantly.

## What it would take

1. **Core**: `scroll` on rows, plus bounds, fit, cap and `resolve` with `scrollers`, all pure. Unit tests: no folds in a strip, the cap ignores it, dividers without a max, nesting, RTL (a strip starts at the right).
2. **View state**: `view.scroll`, `inView` and `paused`, the URL codec, and focus that scrolls.
3. **React**: the scroller element, edge fades, snap, dividers and drop zones inside a strip, auto-scroll while dragging, and the region's name.
4. **Trips**: Days becomes the overview, then seven days scrolling, then the map and the place, all fixed outside the strip. Dragging a stop to a day off screen scrolls to it. Plus an e2e test: every day at its comfortable width at 1280 px, focus scrolls, and a link restores the scroll.
5. **Docs**: a guide page, with the Days layout live in it.

## Open questions

- **The scroll position in links.** I recommend including it, so a link reopens exactly what was shown, which is Jali's round-trip rule.
- **Snap.** I recommend proximity rather than mandatory snap: it settles on a column edge when close, and lets go otherwise.
- **Who decides.** I recommend that only the layout (a preset, or an app's arrangement) can make a row scroll at first. A person's "Let this row scroll" in a row's menu can come later, once the first version has shown how it feels.
- **Column widths.** niri's presets (a third, a half, two thirds of the strip) are worth trying as a "Width" command, beside dragging the divider.
