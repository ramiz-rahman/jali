# Jali: product brief

## What Jali is

Jali is a layout library for web apps where people work on several things at once. It lays out an app's panes (lists, records, editors) in rows, columns and tabs, and keeps that layout usable on every screen. It ships as one package, `jali`: a framework-free core with no dependencies, rendered by React from `jali/react`.

## Who it is for

Teams building tools that people spend their working day in: support desks, credit and case review, operations consoles, data browsers, trading screens, editors. Their users keep a record open beside the list it came from, compare two objects, and follow a chain of links (an order, its customer, their other orders) without losing their place.

## The problem

Web apps mostly show one view at a time. People work around it with browser tabs, lose their place and copy details between windows. Building split views by hand is a lot of work that every team repeats: splitting and resizing, deciding what happens when the window narrows, keeping focus and the keyboard right, remembering the layout, and doing all of it accessibly. Docking libraries solve part of it, but leave the hard case open: what to show when there isn't room for everything.

## What Jali promises

1. **Panes fold; they are never squeezed.** Each kind of pane declares the smallest size it works at. When the window is too small, panes fold into tabs of their neighbours, in an order that protects what the person is working on, and come back to their exact place when there is room. On a phone, one pane at a time.
2. **Panes show objects.** A pane is a kind plus a few params, so a layout fits in a link, a detail follows a list's selection, and one object has one pane.
3. **The layout is in the address.** A link reopens the same panes in the same places; Back and Forward step through deliberate changes. An app with a router keeps its router in charge.
4. **Nothing is lost by accident.** A pane reports unsaved work, and every change that would lose it asks first. Closing and tucking can be undone. Moving, folding and tabbing never remount a pane.
5. **Everything works from the keyboard and with a screen reader.** Every action has a key and a menu item; dividers, tabs, menus and dialogs follow the WAI-ARIA patterns; changes are announced. Checked in a real browser on every change.
6. **Every action says what happened.** Actions return a result or a typed refusal with its reason; nothing throws at a person's click. An app, a key, a command and an AI agent all take the same path.
7. **An app ships only what it uses.** Everything beyond laying out panes (the address, the palette, Settings, renaming, Pop out, curated pages) is a feature the app imports, and a size gate holds each to its budget.
8. **It fits the app it lives in.** Styles sit in their own cascade layer on `--jali-*` tokens, so an app's CSS or Tailwind theme wins without `!important`. Jali draws no app shell: the app's chrome goes around the panes.

## Two ways to use it

- **A free layout:** the person builds it, from presets or from scratch, opening what they need beside what they have.
- **A curated page:** a designed page about one item, with its views as tabs, read one view at a time (Single view) or laid out side by side (Split view).

## What Jali is not

- Not a window manager: panes tile, they don't float or overlap (one pane can pop out into its own window).
- Not a dashboard grid of fixed tiles.
- Not a data layer: panes load their own data, through the app's cache.
- Not tied to one framework at its core, though React is the only adapter today.

## How it is checked

- Unit tests for the core's rules and the React adapter, with seeded fuzzing of the actions.
- Browser suites for Jali and each example app, with axe scans and forced-colours checks.
- A size gate per feature, a packed-package check that builds and hydrates from the tarball, and a React 18 run.
- Docs whose code samples typecheck, whose reference tables are compared with the types, and which ship inside the package for coding agents.

## The examples

Five apps show Jali on real work: Data Studio (a database browser where the person builds the layout), Loan review (a curated page over a queue of applications), Markets (a trading screen with live data), Studio (an audio editor that follows one playhead) and Trips (a map-first trip planner). Each is in `examples/`.

## Where the details are

- [ARCHITECTURE.md](../ARCHITECTURE.md): how it is built.
- [DECISIONS.md](DECISIONS.md): every decision, dated, with its reason.
- [API-REVIEW.md](API-REVIEW.md): the public API as approved before 1.0.
- [MIGRATION.md](MIGRATION.md): the moves an app made between API versions.
- [reviews/](reviews): dated reviews and what came of them.
