---
name: jali
description: Build with Jali (the `jali` package: jali, jali/react, its features), split views for React apps. Use when adding a Jali workspace to an app, defining pane kinds, opening panes beside each other, theming Jali, or fixing a Jali layout, focus, keys or unsaved-work problem.
---

# Jali

Jali lays out panes of an app side by side, in rows, columns and tabs, and keeps the layout usable at every size. Its docs ship inside the package, for the installed version. Work from them, not from memory.

## Before writing code

1. Find the docs: `node_modules/jali/docs/README.md` lists every page. If the package isn't installed yet, install it first: `npm install jali`.
2. Read `docs/get-started/coding-agents.md` in full. Its ten rules are the contract a pane's content must keep: kinds as data plus a component, typed params, keys that bubble, select before open, unsaved work through `useUnsaved`, `usePaneState`, `useCommands`, pausing while hidden, one shared data cache, theming through tokens.
3. Read `docs/get-started/key-concepts.md` for the words, and `docs/get-started/quickstart.md` for the smallest app.
4. For the task at hand, read the guide it names (`docs/guides/*.md`), then look up every function, prop and type you use in `docs/reference/` (`core.md`, `core/types.md`, `react.md`). Don't guess an option's name or default.

## While writing

- One module per kind: `definePane("kind", { params, title, width, height, Component })` from `jali/react`, passed to `createJali({ panes })` from `jali`.
- Turn on what the app uses as features, each from its own entry: `createJali({ features: [urlSync(), palette()] })`, or `defaultFeatures()` from `jali/features` for Jali's usual set (`docs/reference/features.md`). Without `urlSync()` the layout isn't in the address; without `palette()` there is no ⌘K.
- Name objects with the kind: `order({ id: 1041 })`, never a hand-written `{ kind, params }`.
- Change the workspace through `jali.actions` or the pane hooks (`usePane`), never by editing a layout object you hold.
- Style Jali with `--jali-*` tokens (`docs/reference/tokens.md`) or the parts in `docs/reference/parts.md`, in a cascade layer after `jali`. No Tailwind classes on Jali's parts, no `!important`.

## Before you finish

- Check the work against each of the ten rules in `coding-agents.md`, and say which you checked.
- Run the app's typecheck: Jali's types catch a wrong param, a missing icon or an unknown option.
- If the app has tests, test layouts and pane rules without a browser with `jali/testing` (`createTestJali`, `reportUnsaved`), as `docs/guides/testing.md` shows. Never import `jali/adapter` in an app.
