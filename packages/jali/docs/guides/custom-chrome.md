# Build your own chrome

Put a top bar, a status line, the shelf and toasts around Jali's panes, inside one JaliRoot, so the panes take the room your chrome leaves.

`<JaliRoot jali={jali} />` on its own is a whole app: panes, dialogs, keys. Most apps add their own chrome around the panes: a top bar with the app's name and its layouts, a status line, toasts. This guide builds all three.

## Chrome goes inside `<JaliRoot>`

Pass your chrome as children of `<JaliRoot>`, and put `<JaliView />` where the panes go. The panes take whatever room your chrome leaves.

`src/App.tsx`

```tsx
import { useState } from "react";
import type { Toast } from "jali";
import {
  IconButton,
  JaliRoot,
  JaliView,
  Shelf,
  useJali,
  useJaliEvent,
  useJaliModel,
  useJaliShortcut,
  useJaliState,
} from "jali/react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { jali } from "./jali";

/** The top bar: the app's name, the presets, and a button that shows its key. */
function TopBar() {
  const { env, actions } = useJali();
  const current = useJaliState((s) => s.presetId);
  const resetKeys = useJaliShortcut("layout.reset"); // its keys in this keymap, or "" until you bind one
  return (
    <header className="top-bar" data-jali-chrome>
      <strong>Orders</strong>
      <nav aria-label="Layouts">
        {env.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === current}
            onClick={() => actions.preset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <IconButton
        label="Reset layout"
        title={resetKeys ? `Reset layout (${resetKeys})` : "Reset layout"}
        onClick={() => actions.resetLayout()}
      >
        <ArrowCounterClockwiseIcon size={16} aria-hidden />
      </IconButton>
    </header>
  );
}

/** The status line: what is focused, and the shelf of tucked panes. */
function StatusLine() {
  const focused = useJaliState((s) => s.view.focused);
  const model = useJaliModel();
  return (
    <footer className="status-line" data-jali-chrome>
      <span>{focused ? model.title(focused) : "No pane focused"}</span>
      <Shelf />
    </footer>
  );
}

/** Jali sends toasts as events and draws none: show them your way. With Sonner, call toast() here instead. */
function Toasts() {
  const { actions } = useJali();
  const [toasts, setToasts] = useState<(Toast & { key: number })[]>([]);
  useJaliEvent("toast", (t) => {
    const key = Date.now();
    setToasts((all) => [...all, { ...t, key }]);
    setTimeout(() => setToasts((all) => all.filter((x) => x.key !== key)), 5000);
  });
  return (
    <ol className="toasts" aria-label="Notifications">
      {toasts.map((t) => (
        <li key={t.key} role={t.error ? "alert" : "status"}>
          {t.title}
          {t.undo ? (
            <button type="button" onClick={() => actions.undo()}>
              Undo
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function App() {
  return (
    <JaliRoot jali={jali} className="app" overlays={<Toasts />}>
      <TopBar />
      <JaliView />
      <StatusLine />
    </JaliRoot>
  );
}
```

Keeping everything inside one root matters. `<JaliRoot>` is what renders the dialogs (the palette, Settings, the chooser, "Discard unsaved changes?"), the live region screen readers hear, and the full-screen layer, and it starts and stops the instance. Hooks such as `useJali` and `useJaliState` work anywhere inside it.

Give the root a size and lay the chrome out with your own CSS:

`src/app.css`

```css
/* Your bars take the room they need; the panes take the rest. */
.app {
  height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}
.top-bar,
.status-line {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 12px;
}
```

## What each part does

- **`data-jali-chrome`** marks your bars. After a layout change, Jali moves keyboard focus back to the focused pane, but never out of an element marked this way, so a person using your top bar stays there.
- **The shelf**, `<Shelf />`, lists tucked panes as chips, so they can come back with a click. Without it, tucked panes come back only through their tab's **Put back**, the keys, or ⌘K "Show a pane from the shelf". Put it somewhere always visible, such as the status line.
- **Toasts** arrive as the `toast` event, and Jali draws none, so they look like the rest of your app. `useJaliEvent("toast", show)` hears them. A toast with `undo: true` offers Undo, which runs `jali.actions.undo()` (⌘K ⌘Z does the same). Render your toaster in `overlays`: it sits outside the panes, and while one of Jali's dialogs is open it is inert, as the panes are.
- **Keys in tooltips:** `useJaliShortcut(id)` returns a command's keys as this person's keymap and platform print them ("⌘K ⌘M", "Ctrl+K Ctrl+M"), or `""` when the command has none.
- **`IconButton`** draws a button as Jali's header buttons are drawn, so it matches in every theme.

## A curated page's bar

When the instance has a [curated page](../learn/curated-pages.md), put `<PageBar />` in your top bar. It holds the switch between Single view and Split view, **Back to** the page, and Reset. `<JaliView />` renders the page itself while it is open.

## Your own command menu

If your app already has a command menu (cmdk, say), leave the `palette()` feature out and list Jali's commands in yours with `useJaliCommands()`. ⌘K is then yours. See [Commands and keys](commands-and-keys.md#one-command-menu-yours).

## Names for screen readers

Your bars are part of your page, not of the panes, so give them your own landmarks (`<header>`, `<footer>`, `<nav aria-label>`). Jali's panes are a region named "Panes" inside your page's `<main>`, or the page's `<main>` itself with `createJali({ landmark: "main" })`. See [Accessibility](../learn/accessibility.md).

## Next

- [Theming](theming.md): make your chrome and Jali's parts agree.
- [`jali/react` reference](../reference/react.md): every component and hook used here.
