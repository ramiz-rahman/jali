# Findings: what building Markets taught us about Jali's public API

Markets is built on the public API alone (`@jali/core`, `@jali/react`). Each finding says what the app wanted, what happened, what the app does instead, and a suggested change. The most important come first. Written 21 Nov 2026, from the quality pass (QUALITY-REVIEW C11, C13, P9, P20, P21).

## 1. A refusal for unsaved work doesn't say how the question ended

**Wanted.** Reset every desk: put the current desk back to its preset and forget the other desks' saved layouts, but only if the reset actually happens.

**What happened.** With unsaved work in a pane, `jali.actions.resetLayout()` returns `{ ok: false, reason: "unsaved" }` and Jali asks the person. The refusal has no promise or callback, so the app can't learn whether the person discarded (the reset then lands) or kept editing (nothing happens).

**Workaround.** `resetAll` in `src/desks.ts` listens for the next `layout` event and infers the answer: the reset landed if the change came from an action, the desk is unchanged, fewer panes are unsaved, and the panes are the preset's own. It works, but it is a guess built from four signals.

**Suggested change.** Give a refusal that asks a question a `settled: Promise<Change | null>`, resolving with the change when the person goes ahead and `null` when they don't.

## 2. The `layout` event doesn't say which action caused it

**Wanted.** Tell a reset apart from any other change that happens to land next (finding 1), and generally react to particular actions.

**What happened.** `jali.on("layout", ({ layout, source }))` says whether the change came from an action, a link or history, but not which action.

**Suggested change.** Add the action's name (`"resetLayout"`, `"openBeside"`, …) to the event.

## 3. There is no public icon button

**Wanted.** Buttons in the top bar and panes that look and behave like Jali's own header buttons.

**What happened.** Jali draws them with `.jali-icon-btn`, which is private: the class isn't a documented part and can change. Markets used it anyway until 20 Nov.

**Workaround.** Markets and the shared shell have their own `.icon-btn` (`src/styles/shell.css`, `examples/shared/src/shell/styles/shell.css`), copying Jali's look.

**Suggested change.** Export an `IconButton` from `@jali/react`, or make the icon button a documented part with its states.

## 4. The stacked view's divider target covers the pane above it

**What happened.** In the stacked view, a divider's 44px touch target overlaps the last row of the pane above it, so a tap there can start a resize instead of choosing the row.

**Workaround.** None in the app. The shared width sweep (`examples/shared/e2e/quality.ts`) leaves dividers' touch targets out of its "covered" check.

**Suggested change.** Keep the touch target inside the gap, or let a pane's own controls win the overlap.

## 5. Kept stores are checked; preset layouts already were

**What happened.** Markets kept its watchlists, paper book and desk layouts in local storage and trusted what it read back: `markets:lists = {}` crashed the watchlist (C13).

**Now.** Every kept value goes through the shared store (`examples/shared/src/store.ts`): a version and a `parse` per store, falling back to defaults when the data is bad. Every `usePaneState` in Markets passes `parse`. The desks' saved layouts needed nothing extra, because Jali already checks any layout it is given. The docs could say so, so that apps don't add a second check.
