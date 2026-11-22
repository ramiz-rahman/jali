# Choose what people can do with panes

Turn a pane's controls on or off, close, tuck, maximise, full screen, move, resize, pin and pop out, for a kind, for every pane, or for one layout.

A pane can be closed, tucked, maximised, put full screen, moved, resized and pinned, and popped out into its own window. Not every app wants every one of these everywhere. With `allow`, your app decides, for a kind of pane, for every pane, or depending on the layout:

`src/jali.tsx`

```tsx
import { createJali, row } from "jali";
import { definePane } from "jali/react";

// What the content can handle: a toolbar can't fill a screen, so the kind says so.
const toolbar = definePane("toolbar", {
  title: "Tools",
  allow: { fullScreen: false },
  Component: () => <div>…</div>,
});
const report = definePane("report", {
  params: { id: Number },
  title: ({ id }) => `Report ${id}`,
  Component: () => <div>…</div>,
});

export const jali = createJali({
  panes: [toolbar, report],
  presets: [
    { id: "review", label: "Review", layout: () => row(toolbar(), report({ id: 1 })) },
    { id: "free", label: "Free", layout: () => row(report({ id: 1 }), report({ id: 2 })) },
  ],
  allow: {
    // For every pane: maximise, but not full screen.
    fullScreen: false,
    // It depends: on the Review layout, people arrange panes as they like but never remove one.
    when: ({ action, presetId }) =>
      !(presetId === "review" && (action === "close" || action === "tuck")),
  },
});
```

## The controls

| Control | What it covers |
|---|---|
| `close` | Closing the pane: its ×, a tab's ×, middle-click, Delete on a tab, ⌘K, Close other tabs (which then leaves it open) |
| `tuck` | Tucking it into its neighbour |
| `maximise` | Maximising it (restoring is always allowed) |
| `fullScreen` | Putting it on the whole screen (leaving is always allowed) |
| `move` | Dragging it, the move keys, swapping, merging into tabs, pulling a tab out, reordering tabs |
| `resize` | The dividers beside it |
| `pin` | Pinning its tab |
| `popOut` | Popping it out into a floating window (with the `popOut()` feature) |

Folding isn't a control: it is how a layout fits the room it has, so it always happens. Renaming has its own switch: the `rename({ can, run })` feature.

## Who decides

Three levels, and each can only take away. A control is allowed when none of them says `false`:

1. **Jali's own rules.** A lone pane has nothing to maximise into; a phone shows one pane at a time and has nothing to drag; a curated page has rules of its own.
2. **The kind**, `definePane("chart", { allow })`, for what its content can handle.
3. **Every pane**, `createJali({ allow })`: defaults for all panes, and `when`, a function asked for each action, with the pane, the preset the layout came from and the curated page, if one is open.

Everything is allowed by default. Pop out comes with its feature, `popOut()` from `jali/pop-out`: adding it also adds a Pop out button to the header, before Close, and **Pop out pane** (`pane.pop_out`) to ⌘K, with no key until you bind one.

Because the levels only take away, `createJali({ allow })`'s `true` can't turn back on what a kind turned off. `when` is your code, not part of the layout, so the rule itself never travels in a link. What it reads can: a layout's preset and its panes come from the address. These controls shape what people are offered; they are not a security boundary. A rule that must hold, such as who may delete a record, belongs in your app's own checks too.

## What people see

Jali's actions check `allow` themselves, so every way of asking gets the same answer: a button, a key, ⌘K, a tab's menu, a drag, or an [agent](agents.md).

- **Buttons and menu items** for a control that isn't allowed aren't drawn: no ×, no grip, no divider handle, no Pin tab.
- **⌘K** lists the command greyed out, with the reason ("Board can't be closed here").
- **Keys** are refused, and screen readers hear the same reason.
- **Agents** see what isn't allowed for each pane in their snapshot (`notAllowed`), and are refused if they ask.

For a decision that depends on the moment, such as unsaved work in your app's own data, use `beforeClose`, which is asked as the pane is about to close.

## Header buttons

`allow` decides what can happen; `buttons` decides which of those get a button in the pane's header. The buttons are shortcuts. Everything allowed is always in the pane's menu, which opens from a right-click on the header, from the ⋯ button, or with Shift+F10, and in ⌘K.

You don't have to set `buttons`. Jali's choice is Tuck, Maximise, Pop out (where it is allowed) and Close, with Full screen in Maximise's place on a lone pane, and only Close on a phone. A ⋯ button shows whenever the menu offers more than the buttons do, so nothing is out of reach on a touch screen.

To change them, give a list, which replaces Jali's, or a function, which adjusts them. A kind's `buttons` win over `createJali`'s:

```tsx
import { createJali } from "jali";
import { definePane } from "jali/react";
import { Chart } from "./chart-view";

// Charts: Jali's buttons, without Tuck (Tuck stays in the menu).
const chart = definePane("chart", {
  title: "Chart",
  buttons: (defaults) => defaults.filter((b) => b !== "tuck"),
  Component: Chart,
});

// Every other pane: only Maximise and Close.
const jali = createJali({ panes: [chart], layout: chart(), buttons: ["maximise", "close"] });
```

`allow` still filters the list: a button for something that isn't allowed isn't drawn. And the way out of a state always shows, whatever the list says: Restore while a pane is maximised, Exit full screen while it is full screen.

In a narrow pane, the title comes first. Before it gets shorter than a few characters, Tuck, Maximise, Full screen and Pop out move from the header into the pane's menu, where they keep their names and keys. Close and ⋯ stay. The header takes them back once there is room. `data-narrow` on the header and `data-count` on its buttons let a theme follow this (see [Parts](../reference/parts.md)).

A header holds, in order: the grip, the title (or tabs), Following / Kept, the pane's own controls, and these buttons. A pane's content puts its own controls there with `useHeaderActions` (see [Controls in the header](pane-kinds.md#controls-in-the-header)).
