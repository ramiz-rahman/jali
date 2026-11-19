# The standard for the example apps

Each example is a concept, not a product: it shows what Jali makes possible in one domain, with few features. Within what it does, it has no bugs, it is a pleasure to use, and its code is how we want people to write with Jali. An example that does less and meets this page is better than one that does more and does not.

Every example meets all of this. Where a check can prove a point, the check is named; the rest is read by a reviewer who did not write the code.

## What it does

- **It says what it is.** Its README opens with what the example shows about Jali, lists what it leaves out on purpose, and says how to run it.
- **Every layout works at every width**, from a phone (360px) to a wide screen (2200px), in light and dark. Nothing is cut off, overlaps or scrolls sideways. _Check: the example's width sweep._
- **Everything works from the keyboard**, focus is always visible, and Jali's keys still work. _Check: the example's smoke test._
- **No accessibility violations.** _Check: the axe scan, in every layout and both themes._
- **Nothing in the console**: no errors, no warnings, in use and in the tests.
- **Loading, empty and failed states are designed**, not left to chance. A failure says what happened and what to do.
- **Made-up data says so**, on screen. Real data and media are credited on screen, with their licences in the example's folder.
- **It shows who made it**: `<Maker />` in the status line and `makerCommand` in ⌘K (`examples/shared/src/maker`).

## How it is written

- **Jali's public API only.** Imports come from `@jali/core` and `@jali/react`, never from a package's `src`. Styles reach Jali through its documented parts and `--jali-*` tokens. Where a private class name is the only way, the line says so and the gap is recorded in the example's `FINDINGS.md`.
- **The same shape in every example**: `main.tsx` (start), `workspace.ts` (pane kinds, layouts, commands), `panes/` (one file a pane), `shell/` (the app's chrome round `<JaliRoot>`), `styles/`, and the domain's own folder. Someone who has read one example can find their way in another.
- **Nothing temporary.** No comparison switches, no feature flags, no commented-out code, no code nothing calls.
- **Comments say why**, not what. Each file opens with what it is for.
- **One way to do each thing.** A preference, a command, a pane, a follower: each is done the same way everywhere in the example, and the way Jali's docs teach.
- **State lives where Jali expects it**: in the layout and the address when it is part of the layout, in pane state when it is the pane's, in the app's own stores when it is the domain's.
- **Typed strictly**, with no `any` and no non-null `!` where a check would do. _Check: `pnpm typecheck`._

## How it is checked

- **Unit tests** for the domain logic and for the workspace (its layouts are valid, its commands run). _`pnpm test`._
- **Its own browser tests**, on its own port: a smoke test of every layout, the width sweep and the axe scan. _`pnpm exec playwright test -c examples/<name>`._
- **A review by someone who did not build it**, using the app before reading the code, against this page.

## When an example falls short

Fix it, or cut the feature. A known flaw is not left in with a note. What Jali itself makes hard goes in the example's `FINDINGS.md`, for Jali to fix.
