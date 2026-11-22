# Quickstart

Build the smallest Jali app, two notes side by side, then open a third from a button.

This page builds a small app, one file at a time: two notes side by side, each with a button that opens the next note beside it. The finished app is [`examples/minimal`](https://github.com/ramiz-rahman/jali/tree/master/examples/minimal) in the repo, which adds a launcher and makes the panes the page's `<main>`.

You need Node and a React app. Start from a new one, or skip this step and use your own:

```sh
npm create vite@latest notes -- --template react-ts
cd notes
```

*Live demo on the site: What you are building, running: two notes side by side. Drag the line between them, or click a note's button to open the next note beside it.*

### Install Jali

```sh
npm install jali
```

One package: `jali` holds the model (the layout, the panes and their commands) and has no framework; `jali/react` renders it. If your app links Jali from a checkout or a monorepo, see [Installation](installation.md#linked-or-in-a-monorepo).

### Define a pane

A [pane kind](key-concepts.md#kind) says what one kind of pane shows and how. This one shows a note.

`note.tsx`

```tsx
import { definePane } from "jali/react";

// A kind of pane: what it shows (its params), its title, and the component that renders it.
export const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,

  Component: ({ params }) => (
    <article className="note">
      <h3>Note {params.id}</h3>
    </article>
  ),
});
```

- `"note"` is the kind's name. Every pane of this kind carries it.
- `params` says what a note pane needs to know: its `id`, a number. A link turns every value into text, so `Number` reads it back as a number.
- `title` names the pane in its header, its tab and ⌘K.
- `Component` renders the pane. It gets the params, typed, along with the functions a pane uses to open other panes.

`note` is now also how you name a note: `note({ id: 1 })` is the [ref](key-concepts.md#ref) of note 1, `{ kind: "note", params: { id: 1 } }`. You use refs to open panes and to write layouts.

### Create the instance

`createJali` makes the [instance](key-concepts.md#instance): it holds the panes, focus, history and settings. It takes the kinds it can show and the [layout](key-concepts.md#layout-tree) it opens on.

`jali.ts`

```tsx
import { createJali, row } from "jali";
import { defaultFeatures } from "jali/features";
import { note } from "./note";

export const jali = createJali({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
  features: defaultFeatures(),
});
```

`row(...)` puts panes side by side; `column(...)` puts them one above the other. These two share the width equally.

`features` turns on what Jali does beyond laying out panes. `defaultFeatures()` is Jali's usual set: the layout in the address bar, the ⌘K palette, Settings and the chooser. Reload the page and the layout comes back; Back and Forward step through changes. If the address already holds a layout, that one opens instead. An app that wants less picks each feature from its own entry, and ships only those: see [Features](../reference/features.md).

### Render it

`<JaliRoot>` draws the panes and the features' dialogs, such as the ⌘K palette. While it is on the page, it also turns on the keyboard, Back and Forward, the theme and saving.

`main.tsx`

```tsx
import { createRoot } from "react-dom/client";
import { JaliRoot } from "jali/react";
import "jali/styles.css";
import "./app.css";
import { jali } from "./jali";

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} className="app" />);
```

The panes fill the box you give them, so that box needs a height: here `html`, `body` and `#root` are the full window. To add your own top bar or sidebar, put it inside `<JaliRoot>` with `<JaliView />` where the panes go: the panes take the room it leaves. If the box has no height, the panes have none either, and a warning in the console says so while you develop.

Screen readers meet the panes as a region named "Panes", inside your page's own `<main>`. When Jali is the whole page and it has no `<main>` of its own, pass `landmark: "main"` to `createJali` so the panes are the page's `<main>`.

### Add the styles and the layer line

`jali/styles.css` is Jali's default theme and the panes' layout. Every rule in it sits in a CSS cascade layer named `jali`.

`app.css`

```css
/* Name the layers once. Jali's styles sit in `jali`; anything in a later layer wins without !important. */
@layer base, jali;

@layer base {
  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }
  body {
    font-family: system-ui, sans-serif;
    background: var(--jali-canvas);
    color: var(--jali-text);
  }
}

/* Jali fills whatever box you give it. */
.app {
  height: 100%;
  display: grid;
}
.note {
  padding: 1rem;
}
```

The `@layer` line names the order of the layers once. Your resets go in a layer before `jali`; your own styles go after it, or outside any layer, and win without `!important`. With Tailwind, the line is `@layer theme, base, jali, components, utilities;`.

Run the app. You see two notes side by side. Drag the line between them to resize. Press ⌘K (Ctrl+K on Windows and Linux) to see every command.

### Open a pane beside

A pane opens another with `openBeside`. Pass it the ref of what to open.

`note.tsx`

```tsx
import { definePane } from "jali/react";

export const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,

  Component: ({ params, openBeside }) => (
    <article className="note">
      <h3>Note {params.id}</h3>
      <button onClick={() => openBeside(note({ id: params.id + 1 }))}>
        Open the next note beside
      </button>
    </article>
  ),
});
```

Click the button in note 2. Note 3 opens to its right, and focus stays in note 2, so you can keep working where you were.

Keep clicking the button in the newest note. Each click opens the next note beside the one you clicked in. When the panes no longer fit at their minimum width, some fold into tabs, and the note you are working in stays on screen. Widen the window and they come back. [How a layout fits](../learn/fitting.md) explains the order, and [Opening and linking](../learn/opening-and-linking.md) explains what `openBeside` does when a pane opens several links.

## Next

- [Key concepts](key-concepts.md): Every Jali word in one place, with a picture or an example.

- [The layout tree](../learn/layout-tree.md): Rows, columns, stacks and sizes, live.

- [How a layout fits](../learn/fitting.md): What folds when the window is too small, and what comes back first.
