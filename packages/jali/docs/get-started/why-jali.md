# Why Jali

Jali beside dockview, FlexLayout, react-mosaic, Golden Layout and react-resizable-panels: when each is the better choice, and what Jali costs and works with.

Several good libraries lay out panes on the web. They solve different problems. This page says what Jali does differently, and where another library fits better. Every claim about another library comes from its own README or site (read on 22 Nov 2026); where its docs don't say, the table says "not stated", not "no".

## What Jali is built around

Most layout libraries give people a docking surface: drag tabs and groups anywhere, and save the result. Jali starts from a different question: **what should the app show when there isn't room for everything?**

- **Fold, never squeeze.** Each kind of pane declares its minimum width and height. When the window is too small, Jali folds panes into tabs of their neighbours, in an order that protects the pane you are working in. When room returns, they come back to their exact place. See [How a layout fits](../learn/fitting.md).
- **Panes show objects.** A pane is a kind plus params (`order({ id: 7 })`), not a component instance. That is what makes a layout fit in a link, lets a detail follow a list's selection, and lets one object have one pane.
- **The address is the layout.** With `urlSync()`, a link reopens the same panes in the same places, and Back and Forward step through deliberate changes. See [Keep the layout in the URL](../guides/url-and-routers.md).
- **Typed refusals.** Every action returns what happened, or why it didn't (`{ ok: false, reason: "unsaved" }`). Nothing throws at a person's click.
- **A framework-free core.** The layout, fitting, actions and keys are plain TypeScript with no dependencies. React is one adapter.

## At a glance

| | Jali | dockview | FlexLayout | react-mosaic | Golden Layout | react-resizable-panels |
| --- | --- | --- | --- | --- | --- | --- |
| Frameworks | React (core has none) | React, Vue, Angular, plain TS | React | React | Plain JS; guides for React and Angular | React |
| Runtime dependencies | None | "Zero dependencies" | "only dependency is React" | Built on react-dnd | Not stated | Not stated |
| Licence | Apache-2.0 | MIT (an enterprise add-on is commercial) | MIT | Apache-2.0 | MIT | MIT |
| Splits and tabs | Rows, columns, tab stacks | Grids, split views, tab groups | Rows, tabsets, borders | N-ary splits, tabs | Not stated in the README | Groups, panels, grids |
| Drag to rearrange | Yes | Yes | Yes | Yes | Yes | Resize by dragging |
| Floating panels | No (tiles only) | Floating groups | Floating panels | Not stated | Not stated | Not stated |
| Pop out to a window | One pane, Chrome and Edge | Popout windows | Popout windows | Not stated | Native popout windows | Not stated |
| Save and restore | Layout JSON, the URL, presets | Serialisation | `toJson` / `fromJson` | Controlled tree value | Load and save layouts | `defaultLayout`, `getLayout` |
| Too little room | Panes fold into tabs and return | Not stated | Tab overflow menu | Not stated | Not stated | Min and max sizes; panels can collapse |
| Layout in the URL | Yes, with `urlSync()` | Not stated | Not stated | Not stated | Not stated | Not stated |
| Keyboard and ARIA | Every command keyed; APG separators, tabs and dialogs | Not stated | ARIA roles, configurable keymap | Not stated | Not stated | Keyboard separators with ARIA |

Sources: [dockview](https://dockview.dev/), [FlexLayout](https://github.com/caplin/FlexLayout), [react-mosaic](https://github.com/nomcopter/react-mosaic), [Golden Layout](https://github.com/golden-layout/golden-layout), [react-resizable-panels](https://github.com/bvaughn/react-resizable-panels).

## When another library is the better choice

- **Choose dockview** for an IDE-style docking surface with floating groups, or if your app is built with Vue or Angular.
- **Choose FlexLayout** for a React docking layout with border panels around the edges and tabs that pop out into floating panels.
- **Choose react-mosaic** for a tiling window manager in React where you want to own the tree as controlled state.
- **Choose Golden Layout** for a framework-free layout manager with native popout windows.
- **Choose react-resizable-panels** when you need resizable split panels and nothing more. It is a much smaller dependency than Jali.

## When Jali is the better choice

- People open records from other records, and the layout must stay usable as they do: on a laptop, on a large screen, and on a phone.
- A link should reopen exactly what someone was looking at, and Back should undo a layout change.
- A detail pane should follow the selection in a list.
- You want keyboard access, screen reader announcements and focus handling done for you, and checked by tests.
- You want to ship only the features you use, and test layouts without a browser (`jali-layout/testing`).

## What it costs

Jali does more than a splitter, and it weighs more. Measured with `pnpm size` in this repo (gzipped, minified, production build):

| What the app ships | Jali's core | Jali's React parts | Styles |
| --- | --- | --- | --- |
| The floor: one kind of pane, no features | 51.9 KB | 23.5 KB | 8.3 KB |
| With `defaultFeatures()` | 55.4 KB | 26.2 KB | 8.3 KB |
| Without React (`headless`) | 46.4 KB | | |
| Only the layout tree (`row`, `column`, the `layout` namespace) | 10.3 KB | | |

Each feature's own cost is on [Features](../guides/your-app.md#choose-features).

## Before you choose

### Does it work with server rendering and Next.js?

Yes. `jali-layout/react` is marked `"use client"`, and Jali renders on the server and hydrates without a mismatch when both sides get the same inputs. See [Installation](installation.md#next-js-app-router).

### Does it work with Vue, Svelte or Solid?

Not yet. The core (`jali-layout`) has no framework, and `jali-layout/adapter` holds what an adapter needs, but only the React adapter exists.

### Does it work with React Native?

No. Jali renders to the DOM.

### Can panes float and overlap?

No. Panes tile in rows, columns and tabs. One pane at a time can pop out into a window of its own with `popOut()` (Chrome and Edge on desktop).

### Which versions are stable?

Jali hasn't reached 1.0 yet. The public entries (`jali-layout`, `jali-layout/react`, the feature entries, `jali-layout/page` and `jali-layout/testing`) are the API being stabilised for 1.0. `jali-layout/adapter`, for framework adapters, is outside that promise: it may change in any minor version.
