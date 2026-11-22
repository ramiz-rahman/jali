# Jali's architecture

How Jali is built: the core and the adapter, the ports, the path every action takes, features, what is stored, and how the published package is made. For setup and checks, see [CONTRIBUTING.md](CONTRIBUTING.md); for the reasons behind each choice, [docs/DECISIONS.md](docs/DECISIONS.md).

## Core and adapter

```
packages/core     @jali/core (private)   no framework, no dependencies
  layout/           the layout tree: types, builders, pure operations, fitting, geometry, the link codec, validation
  state/            the store, apply(), the model, settings, pane state, undo, the English messages
  actions/          every action as a pure step, and the public action table
  commands/         the command registry, the keymap, the keyboard
  features/         the feature contract, and the framework-free half of each feature
  dom/, workspace/  the DOM port, focus and drag, edge scrolling, the phone layouts
  ports.ts          the location and storage ports
  agent.ts          the agent bridge (jali/agent)
  testing.ts        what an app's tests need (jali/testing)

packages/react    @jali/react (private)  React 18.2+ only
  JaliRoot.tsx      the one root: renders the panes, dialogs, live region and full-screen layer; starts the instance
  workspace/        the panes, scroll rows, the phone layouts
  pane/, dividers/  a pane's frame, header, tabs and menus; the dividers
  dialogs/          palette, Settings, chooser, the discard question (each brought by its feature)
  features/         the React half of each feature
  styles/           the CSS, in the `jali` cascade layer, on `--jali-*` tokens

packages/jali     jali                   the published package: entries that re-export the two above
```

**The core decides; the adapter draws.** Everything about panes (where they go, what folds, what a key does, what an action refuses) is in the core, as plain TypeScript, so it runs in tests and on a server and a second adapter (Solid, Vue) could reuse it. The React adapter renders the core's model, measures the DOM, and turns pointer gestures into actions. It holds no rules of its own.

`definePane` lives in `jali/react` because a kind carries its React component. The layout and its kinds' data are framework-free.

## Ports

The core reaches the outside world only through small interfaces, so an app or a test can own each one:

- **Location** (`LocationPort`: `search`, `href`, `navigate`, `subscribe`): the address. `browserLocation()` by default, `memoryLocation()` in tests and on a server, or a router adapter. Read and written only by the `urlSync()` feature.
- **Storage** (`StoragePort`: `get`, `set`): what one person keeps on one device. `localStorage` under the instance's `id` in a browser, memory elsewhere.
- **DOM** (`DomPort`, in `jali/adapter`): how the core finds the adapter's elements (the panes' box, a tab at a point, the dividers) for focus, drag and drop, and measuring. The React adapter provides it.
- **Active item** (`ActiveItemPort`): how a list inside a pane reports and follows its current item, for a collection library that keeps its own cursor.

## The action path

Every change, whoever asks (an app's `jali.actions.close(...)`, a key, a ⌘K command, a drag, a menu, an agent), takes the same path:

1. **`store.run(name, ...args)`.** One table of steps (`actions/index.ts`, `STEPS`) holds every action. Each step names the public action it is, so events and refusals say which one ran. The public `jali.actions`, `jali.page` and `jali.dialogs` are thin calls into `run`.
2. **A pure step.** `(snapshot, ...args) => Outcome`. It reads the current state and model and returns what should change: a new layout and view, an announcement, a toast, a deferred step. Or it returns a **typed refusal**, `{ ok: false, reason }`, with one of a fixed set of reasons (`not-found`, `unavailable`, `not-allowed`, `unsaved`, `pending`, …). Nothing throws at a person's click.
3. **Guards.** Before a change that would remove panes or replace what one shows, `beforeClose` and unsaved work are asked. A question holds the action and returns `reason: "pending"` or `"unsaved"` with `settled`, a promise of how it ended. The answer re-runs the change against the state as it is then.
4. **`apply()`** (`state/apply.ts`) commits the outcome once: state, then the address, then the announcement, the toast and DOM focus, as a policy table says for the kind of change. An action is all or nothing: however many steps it is made of, a refusal part way puts back every change before it (nothing of them is announced, written to the address or told as an event), and a question holds the whole action. The one action whose parts are separate on purpose (following several details, where one with unsaved work stays) says so with `each`. Every operation declares what it may do to the geometry (`focus`, `swap`, `reshape`, `direct`), and in development `apply()` checks that a focus or swap change moved nothing.
5. **Events.** Subscribers hear one notification per action. `jali.on` hears `close`, `open`, `pin`, `focus`, `layout` and `toast`, in that order, each carrying `input`: where the change came from (`mouse`, `touch`, `pen`, `keyboard`, `virtual`, `agent` or `code`).

The layout itself is a tree of rows, columns and stacks whose leaves are panes. What isn't shown in its place (folded for room, tucked by the person, hidden by a curated page) is an **overlay** beside the tree, so the tree never changes when a pane folds, and a pane always goes back to its exact slot. Fitting is a pure function from the tree, the overlay and the room to the boxes on screen.

## Features

Everything beyond laying out panes is a feature: a value an app passes in `createJali({ features })`, made by its own entry (`urlSync()` from `jali/url`, `palette()` from `jali/palette`, …). Its code reaches an app only through that import.

A feature (`features/feature.ts`, internal: adapters read it, apps never write one) may bring:

- `words`: its English, merged after the base words and before the app's `messages`;
- `address(storage)`: the URL writer (only `urlSync`);
- `boot(store)` and `start(store) → stop`: work before the first render, and listeners for the instance's life;
- `env`: options it sets (`rename`'s `{ can, run }`);
- `services`: what the core itself calls, each a named, typed field (`popOutWindow`, which "Pop out pane" asks);
- `parts`: what the adapter renders for it, by name (the palette, the settings panel, the rename field). The core never reads them: the adapter reads its own through one typed map (`ReactParts`, read with `partsReader`).

Steps and commands are not a feature's: the few a feature needs stay in the core's tables, refused as `"unavailable"` and left out of ⌘K without their feature. One of each feature id is kept; a later one replaces an earlier one.

A curated page works the same way without being a feature: `definePage` (from `jali/page`) attaches the page's engine and parts to the page value, so an app without a page ships none of that code.

## State and what is stored

- **State** (`jali.get()`) is plain data: the layout, the view (focus, maximise, peek, scroll), selection, settings, the curated page's state, unsaved work and open questions. **The model** (`jali.model()`) is derived from it once per change: panes in order, what is visible and folded, every box on screen. Both are read-only (`DeepReadonly`), and frozen in development.
- **The address** (`urlSync()`): `l` (the layout, as compact JSON of the tree), `preset`, `zoom`, `peek`, `scroll`, and for a curated page `page`, `item`, `tab` and `open`. A prefix keeps two instances' params apart. Only Jali's own params are written; the app's are left alone.
- **Storage**, under the instance's prefix: `settings` (theme, centre drop, pane cap, keys); `pane-state@2` (one record per pane: what `usePaneState` keeps, written 400ms after a change); with `sizes: "local"`, the sizes a person dragged, keyed by the layout's shape, for the last 12 layouts; a curated page's mode and split layout; and the last link that couldn't be read.
- **Links refit.** A link carries content, never the sender's window: it is fitted again to the reader's room, and a curated page opens in the reader's own mode and layout.

## How the package is built

`packages/jali` holds no code of its own: each entry (`src/index.ts`, `src/react.ts`, `src/url.ts`, …) re-exports `@jali/core`, `@jali/core/adapter` or `@jali/react/internal`. `vp pack` (`packages/jali/vite.config.ts`) builds them into `dist/`:

- **Two chunks hold the code:** `core` (everything from `packages/core`) and `react` (everything from `packages/react`). Each entry imports the chunks it needs, so an app's bundler tree-shakes as before, and the size gate can measure each.
- **`"use client"`** starts the `react` chunk and every entry that re-exports it, so a React Server Components host loads them on the client. The framework-free entries (`jali`, `jali/url`, `jali/agent`, `jali/testing`, `jali/adapter`) don't have it.
- **The `layout` namespace** is built as a file of its own and re-exported, so bundlers tree-shake it member by member.
- **React stays an import**, an optional peer. Nothing else is imported at run time.
- **The internals are bundled.** `@jali/core` and `@jali/react` are dev dependencies of `jali`, never published; an app installs `jali` alone.
- **The docs ship inside it.** `pnpm agent-docs` writes every page of the docs site into `packages/jali/docs` as Markdown, so a coding agent reads the docs of the version installed.

In the repo, everything resolves to source through the `"source"` export condition: the examples, the docs site and the tests never read a stale `dist/`. `pnpm pack-check` checks what is actually published: it packs `jali`, builds the minimal app from the tarball, and hydrates a server render.
