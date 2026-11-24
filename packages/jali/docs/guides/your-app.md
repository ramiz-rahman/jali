# Fit Jali into your app

Choose the features you ship, put your own chrome around the panes, run two instances on one page, and let an agent arrange panes.

Jali fits into the app around it. This page shows how to:

- [choose the features](#choose-features) you ship, and pay only for those;
- put your own top bar and status line [around the panes](#build-your-own-chrome);
- run [two instances](#two-instances-on-one-page) on one page;
- let [an agent](#let-an-agent-arrange-panes) open panes within the limits you set.

## Choose features

Choose what Jali does beyond laying out panes, feature by feature, and see what each one adds to your bundle.

Without any features, Jali lays out panes, fits them, folds them, moves focus, undoes, follows a list, and runs every command from its keys. Everything else is a feature: a value you pass in `createJali({ features })`, imported from its own entry. An app ships only the features it imports, their words included.

```ts
import { createJali } from "jali";
import { urlSync } from "jali/url";
import { palette } from "jali/palette";

const jali = createJali({ panes, layout, features: [urlSync(), palette()] });
```

For Jali's usual set in one line, use `defaultFeatures()`:

```ts
import { createJali } from "jali";
import { defaultFeatures } from "jali/features";
import { rename } from "jali/rename";
import { saveName } from "./names";

const jali = createJali({
  panes,
  layout,
  features: [...defaultFeatures(), rename({ run: ({ ref }, text) => saveName(ref, text) })],
});
```

A feature given again takes the earlier one's place, so `[...defaultFeatures(), urlSync({ location })]` keeps the defaults with the address in a router's hands.

### Every feature

The sizes are what each feature adds to the floor (one kind of pane, a starting layout, no features), gzipped, in a production build. They come from `pnpm size` in Jali's repo (`tooling/size.mjs`), which measures every feature on its own and fails when one grows past its budget.

| Feature | Import | What the person gets | Adds (gzipped) | In `defaultFeatures()` |
|---|---|---|---|---|
| `urlSync()` | `jali/url` | The layout in the address: links reopen it, Back and Forward step through it, a reload keeps it | 3.1 KB | Yes |
| `palette()` | `jali/palette` | The ⌘K command palette | 1.5 KB | Yes |
| `settings()` | `jali/settings` | The settings panel: theme, centre drop, pane cap, keys | 1.3 KB | Yes |
| `chooser()` | `jali/chooser` | "Add to tabs of…", and `jali.dialogs.choose` for your own commands | 1.5 KB | Yes |
| `pressed()` | `jali/pressed` | `data-pressed` on Jali's controls while they are held, for a theme that draws it | 0.6 KB | Yes |
| `rename({ run })` | `jali/rename` | Renaming a pane in place: double-click or F2 on a tab | 0.6 KB | No: it needs your `run` |
| `popOut()` | `jali/pop-out` | A pane in its own floating window (Chrome and Edge on desktop) | 1.3 KB | No |
| `defaultFeatures()` | `jali/features` | The first five together | 7.1 KB | |

A curated page is not a feature but a value you pass as `createJali({ page })`, made with `definePage` from `jali/page`. It adds about 6.1 KB, and an app without one ships none of it.

The floor itself is 57.6 KB of core, 24.1 KB of React parts and 8.3 KB of styles. Without React, the instance alone is 53.0 KB; the layout builders alone (`row`, `column`, `tabs`, `pane`) are 10.9 KB. These are the numbers of 23 Nov 2026; the size gate keeps them from growing unnoticed.

### Without a feature

Leaving a feature out removes what it draws and what it adds to ⌘K, and refuses what asks for it, with the reason `"unavailable"`:

- **No `urlSync()`:** Jali leaves the address alone. Back and Forward belong to your app, and a reload opens the starting layout. Your own writer still works through `createJali({ url })`.
- **No `palette()`:** no palette, and ⌘K is your app's, unless `keyboard.keymap` binds `"palette.toggle"`. `jali.dialogs.openPalette()` is refused. Your own menu can list Jali's commands with `listCommands(jali)`.
- **No `settings()`:** no settings panel, and "Open settings" is not in ⌘K. `jali.dialogs.openSettings()` is refused. Pass `createJali({ settings })` for the first settings a person gets.
- **No `chooser()`:** "Add to tabs of…" is not offered, and `jali.dialogs.choose()` is refused.
- **No `rename()`:** nothing offers renaming, and `jali.actions.startRename()` is refused.
- **No `popOut()`:** no Pop out button, menu item or command.
- **No `pressed()`:** Jali's controls carry no `data-pressed`. Jali's own styles never read it.

### What every app has

No feature is needed for: the layout and fitting, focus and F6, undo, following a list, the keyboard and its commands, tabs and their menus, the shelf, peek, the phone layout (one pane at a time, and two stacked), rows that scroll sideways, maximise and full screen. All of their words are in every app.

## Build your own chrome

Put a top bar, a status line, the shelf and toasts around Jali's panes, inside one JaliRoot, so the panes take the room your chrome leaves.

`<JaliRoot jali={jali} />` on its own is a whole app: panes, dialogs, keys. Most apps add their own chrome around the panes: a top bar with the app's name and its layouts, a status line, toasts. This guide builds all three.

### Chrome goes inside `<JaliRoot>`

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
  const { presets, actions } = useJali();
  const current = useJaliState((s) => s.presetId);
  const resetKeys = useJaliShortcut("layout.reset"); // its keys in this keymap, or "" until you bind one
  return (
    <header className="top-bar" data-jali-chrome>
      <strong>Orders</strong>
      <nav aria-label="Layouts">
        {presets.map((p) => (
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
  const focused = useJaliModel((m) => m.panes.find((p) => p.focused)?.title);
  return (
    <footer className="status-line" data-jali-chrome>
      <span>{focused ?? "No pane focused"}</span>
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

### What each part does

- **`data-jali-chrome`** marks your bars. After a layout change, Jali moves keyboard focus back to the focused pane, but never out of an element marked this way, so a person using your top bar stays there.
- **The shelf**, `<Shelf />`, lists tucked panes as chips, so they can come back with a click. Without it, tucked panes come back only through their tab's **Put back**, the keys, or ⌘K "Show a pane from the shelf". Put it somewhere always visible, such as the status line.
- **Toasts** arrive as the `toast` event, and Jali draws none, so they look like the rest of your app. `useJaliEvent("toast", show)` hears them. A toast with `undo: true` offers Undo, which runs `jali.actions.undo()` (⌘K ⌘Z does the same). Render your toaster in `overlays`: it sits outside the panes, and while one of Jali's dialogs is open it is inert, as the panes are.
- **Keys in tooltips:** `useJaliShortcut(id)` returns a command's keys as this person's keymap and platform print them ("⌘K ⌘M", "Ctrl+K Ctrl+M"), or `""` when the command has none.
- **`IconButton`** draws a button as Jali's header buttons are drawn, so it matches in every theme.

### A curated page's bar

When the instance has a [curated page](../learn/curated-pages.md), put `<PageBar />` in your top bar. It holds the switch between Single view and Split view, **Back to** the page, and Reset. `<JaliView />` renders the page itself while it is open.

### Your own command menu

If your app already has a command menu (cmdk, say), leave the `palette()` feature out and list Jali's commands in yours with `listCommands(jali)`. ⌘K is then yours. See [Commands and keys](commands-and-keys.md#one-command-menu-yours).

### Names for screen readers

Your bars are part of your page, not of the panes, so give them your own landmarks (`<header>`, `<footer>`, `<nav aria-label>`). Jali's panes are a region named "Panes" inside your page's `<main>`, or the page's `<main>` itself with `createJali({ landmark: "main" })`. See [Accessibility](../learn/accessibility.md).

## Two instances on one page

Put two sets of panes side by side, or one in a dialog, without their links, saved settings or keys getting mixed up.

Two instances of Jali on one page share nothing, except three things that belong to the page: the address, the browser's storage and the keyboard. Give each one its own share of those, and they work side by side.

This page puts orders beside notes, each its own instance.

`src/main.tsx`

```tsx
import { createRoot } from "react-dom/client";
import { createJali } from "jali";
import { JaliRoot } from "jali/react";
import "jali/styles.css";
import "./page.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";
import { urlSync } from "jali/url";

// Orders: the address's plain params (l, zoom, peek). Its id names its DOM ids ("orders-pane-…")
// and its localStorage keys ("orders:…").
const orders = createJali({
  id: "orders",
  label: "Orders", // its landmark's name, and part of each pane's, for screen readers
  keyboard: { scope: "local" }, // only keys pressed inside it and its dialogs, or on the page body after it was used last
  panes: orderKinds,
  presets,
  features: [urlSync()],
});

// Notes: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage keys "notes:…".
// Orders sets the page's theme; notes leaves it alone.
const notes = createJali({
  id: "notes",
  label: "Notes",
  keyboard: { scope: "local" },
  pageTheme: false,
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  features: [urlSync({ prefix: "n." })],
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <JaliRoot jali={orders} className="orders" />
    <JaliRoot jali={notes} className="notes" />
  </div>,
);
```

Each `<JaliRoot>` fills the box it is given, so each box needs a definite height:

`src/page.css`

```css
/* Two instances side by side. Each fills the box it is given, so each box needs a definite height. */
@layer base, jali;

@layer base {
  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }
}

.page {
  height: 100%;
  display: grid;
  grid-template-columns: 3fr 2fr;
  gap: 12px;
}
/* A grid item's height comes from its row; min-height: 0 lets it shrink below its content. */
.orders,
.notes {
  min-height: 0;
}
```

### Its own name in the DOM

`id` prefixes the instance's element ids (`orders-pane-…` and `notes-pane-…`, and its dialogs' ids) and its saved keys. The default is `"jali"`, so give each instance its own. Focus, dragging and F6 already look only inside their own root.

### Its own name for screen readers

`label` names the instance for assistive technology. Its landmark is called "Orders" instead of "Panes", and each of Jali's landmarks inside it adds the name. The pane is "Order 7, Orders", the shelf is "Shelf, Orders", and the switcher, the peek and a page's views follow the same pattern. Without it, both would have a "Panes" region, and a pane titled the same in each would repeat a name, so a screen-reader user moving by landmarks couldn't tell them apart.

### Its own params in the address

`urlSync({ prefix: "n." })` writes the notes instance's params as `n.l`, `n.zoom` and `n.preset`. Orders keeps the plain names. Each reads and writes only its own, and every other param is left alone, so one link reopens both, and Back and Forward step each one through its own changes.

An instance that must not touch the address at all, such as one in a dialog, leaves `urlSync()` out of its features.

### Its own storage

An instance saves its settings and pane state to `localStorage` under its `id` by default: `orders:settings`, `notes:pane-state`. Each URL sync keeps its own keys under its `prefix`. So two instances with their own ids and prefixes never overwrite each other. Pass `storage` for somewhere else: another prefix (`storage: "my-app"`) or a port such as `memoryStorage()`.

### Its own keys and start-up

`keyboard: { scope: "local" }` makes an instance take only keys from inside its own root and its dialogs, plus keys pressed with nothing focused, when it was the last one used. So F6 in the notes moves between notes panes, and ⌘K then ⌘M maximises a notes pane. The palette renders outside the root, but it is the instance's own, so the chord finishes there. The default, `"page"`, takes every key on the page: right for one instance, wrong for two.

Everything else an instance starts while its `<JaliRoot>` is mounted works for each one: saving settings and pane state, Back and Forward, and the browser's prompt when the page closes with unsaved work.

### Inside a page with its own theme

An instance sets `data-theme` on `<html>` from its theme setting, and on its own root and dialog layer. Inside a page that has its own light and dark, such as a docs site or an app with its own switch, pass `pageTheme: false`. The instance then writes none of them, and follows the page's `.dark` and `[data-theme]` scopes instead.

### Focus

Mounting `<JaliRoot>` never takes the page's focus. A page with three instances, or one below the fold, keeps its place. Jali moves focus into its panes once the person is in it: when they click or tab into it, or run one of its commands.

### Its own look

To give one instance its own accent, set `--jali-accent` on an element around its `<JaliRoot>`. See [Theming](theming.md).

## Let an agent arrange panes

Give an AI model two tools of your own, built on jali.model() and jali.actions, so it can read what is open and open panes within the limits your app sets.

A model working beside a person can use the panes the way the person does. Jali has no agent code to install: you write the tools your model needs, over the two things an app already has, `jali.model()` to read the panes and `jali.actions` to change them.

This is for a model inside your app. For a coding agent that writes Jali code, see [Using Jali with coding agents](../get-started/coding-agents.md).

`src/agent.ts`

```tsx
import type { Allow, Jali, ObjectRef } from "jali";

// Your model client: anything that takes tools and runs a conversation with them.
declare function runModel(options: {
  prompt: string;
  tools: {
    name: string;
    description: string;
    inputSchema: object;
    execute(input: never): unknown;
  }[];
}): Promise<string>;

// Limits, for the model and the person alike: pass as `createJali({ allow })`. A page keeps its panes.
export const allow: Allow = { when: ({ action, page }) => !(page && action === "close") };

export function agentTools(jali: Jali) {
  const listPanes = {
    name: "list_panes",
    description: "The panes: id, title, the object each shows, and whether it is on screen.",
    inputSchema: { type: "object", properties: {} },
    execute() {
      return jali.model().panes.map((p) => ({
        id: p.id,
        title: p.title,
        ref: p.ref,
        shown: p.where === "shown",
      }));
    },
  };

  const openBeside = {
    name: "open_beside",
    description: "Open an object beside a pane. Says why when it cannot.",
    inputSchema: {
      type: "object",
      properties: { pane: { type: "string" }, ref: { type: "object" } },
      required: ["pane", "ref"],
    },
    execute({ pane, ref }: { pane: string; ref: ObjectRef }) {
      const r = jali.actions.openBeside(pane, ref);
      return r.ok ? { ok: true, pane: r.pane } : { ok: false, reason: r.reason };
    },
  };

  return [listPanes, openBeside];
}

export const ask = (jali: Jali, prompt: string) => runModel({ prompt, tools: agentTools(jali) });

// A person's changes carry their pointer or key as `input`; the agent's run in your code, so it is `code`.
export const watch = (jali: Jali) =>
  jali.on("open", ({ ref, input }) => {
    if (input === "code") console.info("opened by code", ref);
  });
```

### What the sample does

- **Reading:** `jali.model()` is the layout as it is on screen. `list_panes` returns each pane's id, title and object, and whether it is shown. Return only what the model needs.
- **Acting:** every action in `jali.actions` returns a typed result. `r.ok` is true, or `r.reason` says why not (`not-found`, `invalid`, `not-allowed`, `last-pane` and the rest of [`RefusalReason`](../reference/core/types.md)). Hand the reason back to the model, which can then try something else. A ref the model invents is refused as `invalid`, and nothing changes.
- **Limits:** `allow` is the one place the app says what may happen, to the model and the person alike. Here a curated page keeps its panes: `close` is refused with `not-allowed` while one is open. A close that would lose unsaved work still asks the person.
- **Telling who did it:** every event carries `input`. A person's change has their pointer or key, `mouse`, `touch`, `pen` or `keyboard`; a change from your code, tool calls included, has `code`.

Offer only the actions you are willing to run for the model. A tool is a function you wrote, so it can open, arrange or pin panes and leave closing, renaming and settings to the person.

## Next

- [Theme and words](theming.md): make the panes look like the chrome around them.
- [Test your layouts](testing.md)
- [Troubleshooting](troubleshooting.md)
