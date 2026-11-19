# Choose what people can do with panes

Turn a pane's controls on or off, close, tuck, maximise, full screen, move, resize, pin and pop out, for a kind, a whole workspace, or a layout.

A pane can be closed, tucked, maximised, put full screen, moved, resized and pinned, and popped out into its own window. Not every app wants every one of these everywhere. With `allow`, your app decides, for a kind of pane, for the whole workspace, or depending on the layout:

`src/workspace.tsx`

```tsx
import { createJali, row } from "@jali/core";
import { definePane } from "@jali/react";

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
    // For the whole workspace: maximise, but not full screen.
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
| `popOut` | Popping it out into a floating window (experimental, off by default) |

Folding isn't a control: it is how a layout fits the room it has, so it always happens. Renaming has its own switch, `createJali({ rename: { can } })`.

## Who decides

Three levels, and each can only take away. A control is allowed when none of them says `false`:

1. **Jali's own rules.** A lone pane has nothing to maximise into; a phone shows one pane at a time and has nothing to drag; a curated page has rules of its own.
2. **The kind**, `definePane({ allow })`, for what its content can handle.
3. **The workspace**, `createJali({ allow })`: its defaults, and `when`, a function asked for each action, with the pane, the preset the layout came from and the curated page, if one is open.

Everything is allowed by default, except `popOut`, which you turn on with `allow: { popOut: true }`.

Because the levels only take away, a workspace's `true` can't turn back on what a kind turned off. `when` is your code, not part of the layout, so the rule itself never travels in a link. What it reads can: a layout's preset and its panes come from the address. These controls shape what people are offered; they are not a security boundary. A rule that must hold, such as who may delete a record, belongs in your app's own checks too.

## What people see

Jali's actions check `allow` themselves, so every way of asking gets the same answer: a button, a key, ⌘K, a tab's menu, a drag, or an [agent](agents.md).

- **Buttons and menu items** for a control that isn't allowed aren't drawn: no ×, no grip, no divider handle, no Pin tab.
- **⌘K** lists the command greyed out, with the reason ("Board can't be closed here").
- **Keys** are refused, and screen readers hear the same reason.
- **Agents** see what isn't allowed for each pane in their snapshot (`notAllowed`), and are refused if they ask.

For a decision that depends on the moment, such as unsaved work in your app's own data, use `beforeClose`, which is asked as the pane is about to close.
