# Auto layout

Let Jali arrange the panes on screen from the room there is and each kind's size hints, when they have piled up.

After a while of opening things, a layout collects panes in whatever order the person opened them. `jali.actions.autoLayout()` arranges them again: the same panes, in a fresh layout built from the room there is and what each kind says about its size. Nothing reloads, because every pane stays the same pane, with its state, its link and its pin. People find it in ⌘K as **Arrange panes automatically**.

```tsx
<button onClick={() => jali.actions.autoLayout()}>Tidy up</button>
```

![Trips' Plan layout, arranged: the four panes stay side by side, the place moves next to the map it follows](https://jali.ramizrahman.com/media/auto-layout/plan.gif)

## What it does

![The four steps: order the panes, fill one row, add a second row for what didn't fit, and make the rest tabs](https://jali.ramizrahman.com/media/auto-layout/steps.svg)

1. **Order.** The panes in front, in reading order, with each pane's linked panes right after it: a list, then its detail, then what the detail opened. Then the panes that were behind another tab, in the same way.
2. **One row.** In that order, every chain of linked panes that fits across whole at its kinds' minimum widths, so linked panes sit next to each other, then single panes that still fit. A pane becomes a tab only when it didn't fit across in either row. The fit then shares the row out, bringing every pane towards its comfortable width.
3. **A second row**, below, only for the panes that didn't fit across, and only when the height has room for both rows' tallest minimum. Never more than two rows.
4. **Tabs** for the rest. A pane joins the tabs of the pane it was opened from, else of the pane whose tabs it already is, else of the pane before it in the order, as long as that cell's row still fits with the tab's width. The focused pane is the tab that shows, so the person never loses the pane they were in.

![Studio's Mix at 1024 pixels: four panes in two rows, the mixer below the library and the timeline](https://jali.ramizrahman.com/media/auto-layout/mix.gif)

## What it keeps

- **The same panes.** Ids, objects, links, pins and Keep are unchanged, so pane state, unsaved work and followers all carry over.
- **Rows that scroll sideways**, whole. A row made with `row({ scroll: "x" }, …)` was arranged on purpose, so auto layout places it as one unit with its panes in their order. It always gets a place of its own, and tabs never go into it. It asks for room for one of its panes, so beside other panes it may be left narrow: the row still scrolls to the rest.
- **Hidden panes** (`hidden`), which stay hidden.

![Trips' Days: the week stays a row that scrolls, beside the overview, the map and the place](https://jali.ramizrahman.com/media/auto-layout/week.gif)

What it doesn't keep is the shape: sizes the person dragged, fixed `px` widths, and which panes shared a column. Tucked panes come back into the layout, since a tidy-up should show what is open.

## What to expect

- **Running it again changes nothing.** Arranging an arranged layout gives the same layout, and the action returns `"nothing-to-do"` without a new history entry.
- **Every pane comes out once.** Auto layout never loses or copies a pane: if it ever would, it leaves the layout as it is.
- **The tabs it makes are tabs.** They stay when the window grows, as tabs the person made do. Arrange again in the bigger window to spread them out. Panes that are only folded for room, by the fit, come back on their own as before.
- **Back returns** to the arrangement before, as after choosing a preset.
- **A narrower window** gets a second row before any tabs, and tabs before any pane is squeezed below its minimum.
- **On a phone** it does nothing: Jali shows one pane at a time there, and a layout arranged for a phone's width would be a poor one when the window is wide again. The command is unavailable, and the action returns `{ ok: false, reason: "unavailable" }`.
- **On a curated page** it's unavailable too: a page's arrangement is the page's.
- **With one pane**, it returns `"nothing-to-do"`.
- **A pane your app doesn't let move** (`allow: { move: false }`, for any pane on screen) keeps the layout as it is: auto layout moves every pane, so it returns `"not-allowed"`.

## From your code

- `jali.actions.autoLayout()` arranges the panes, as the command does.
- `layout.arrange(layout, ctx, { focused, maxColumns, maxRows })` is the pure step, for a layout you hold: it returns a new layout and changes nothing. Run `layout.refit` on the result before showing it, as `autoLayout` does.
- An agent can call it, or have Jali arrange the panes after each of its turns that opened or closed panes (`arrange: "after-changes"`). That step asks your `allow` like any other and is skipped when the agent chose the layout itself: see [Let an agent arrange panes](agents.md).

## Next

- [Presets](presets.md): layouts you design, for the arrangements you know people want.
- [Rows that scroll sideways](scrolling-rows.md): a sequence of panes that keeps its width.
