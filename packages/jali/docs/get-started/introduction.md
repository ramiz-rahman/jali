# Introduction

What Jali is, the problem it solves for apps where people work on several things at once, and when not to use it.

Jali is a layout library for apps where people work on several things at once. Each thing gets a pane, and the panes sit in rows, columns and tabs. You describe the kinds of pane your app has. Jali decides where they go, how they fit the window, and how people move between them.

Its core has no framework and no dependencies. React renders it, from `jali-layout/react`.

## The problem

Some work doesn't happen one screen at a time. A support agent reads a ticket while checking the customer's last order. A credit reviewer keeps an application open beside the borrower's file. Someone in operations compares two shipments.

Most web apps show one view at a time, so people open browser tabs, lose their place and copy details between windows. Building panes by hand is a lot of work. You have to split and resize, decide what happens when the window gets narrow, keep focus in the right place, and remember the layout.

Jali does that work once, for every screen size.

## What it gives you

### Panes that fold instead of squeeze

Each [pane kind](key-concepts.md#kind) says the narrowest and shortest it can be and still work. When the window is too small for every pane, Jali folds some of them into tabs of their neighbours. It never squeezes a tiled pane below its minimum. When the room comes back, so do the panes.

The pane you are working in, the pane it was opened from, and the details it opened fold last. On a phone, Jali shows one pane at a time; widen the window and the arrangement you had comes back.

### Focus, undo and the keyboard

One pane has focus, and commands act on it. Closing or tucking a pane away can be undone. <kbd className="kbd">F6</kbd> moves focus to the next pane, and every command has a key you can change or turn off. With the palette feature, <kbd className="kbd">⌘K</kbd> (<kbd className="kbd">Ctrl+K</kbd> on Windows and Linux) lists them all.

A pane can report unsaved work, such as an edited query that hasn't run. Jali asks before any change would lose it.

### A detail that follows a list

Open a record from a list, and the record's pane follows the list's selection: move down the list and the detail shows each row in turn. It waits until the selection rests, so holding a key doesn't load every row on the way. **Keep** the detail to hold it on one record.

### The layout in the address

With the `urlSync()` feature, the layout is written into the URL. A link opens the same panes in the same places, and Back and Forward step through the changes people made. If your app has a router, the router can own the address instead.

### Curated pages

For work that centres on one item, such as reviewing a loan application, you can design a page: a set of views in tabs, with a list of items beside it.

- In **Single view**, people see one view at a time, like any web app, and links open in a sheet over it.
- In **Split view**, they lay the views out side by side, starting from the layout you designed.

### Only what you use

Everything beyond laying out panes is a feature you pass in: the address, the ⌘K palette, Settings, renaming, Pop out. An app ships only the features it imports. See [Features](../guides/your-app.md#choose-features).

## One package

`jali-layout` is one package, with an entry for each part:

- [`jali-layout`](../reference/core.md): pane kinds, layouts, `createJali`, actions and events. No framework.
- [`jali-layout/react`](../reference/react.md): `<JaliRoot>`, `definePane`, the hooks and the parts you place in your own chrome.
- One entry per feature, such as `jali-layout/url` and `jali-layout/palette`, and [`jali-layout/features`](../reference/features.md) for Jali's usual set.
- [`jali-layout/testing`](../reference/testing.md) for your tests. To give an AI model your panes as tools, see [Let an agent arrange panes](../guides/your-app.md#let-an-agent-arrange-panes).

```sh
npm install jali-layout
```

## When not to use it

- **An app that shows one view at a time.** If people never need two things on screen together, a router and ordinary pages are simpler.
- **A dashboard of fixed tiles.** Jali is for panes that people open, close, move and resize. A grid of charts that never changes shape doesn't need a layout tree.
- **Windows that float and overlap.** Jali's panes tile: they sit in rows, columns and tabs, not on top of each other. The one exception is Pop out, which moves a single pane into a window of its own.
- **Bundle size above all.** With React, Jali's floor is about 84 KB gzipped (its core, its React parts and its styles), because it fits, focuses, undoes and announces. A splitter on its own is much smaller. See [Why Jali](why-jali.md).

## Next

- [Installation](installation.md): Add Jali to a Vite, Next.js or other React app.

- [Quickstart](quickstart.md): Build the smallest app, step by step.

- [Key concepts](key-concepts.md): The words Jali uses, and what each one means.
