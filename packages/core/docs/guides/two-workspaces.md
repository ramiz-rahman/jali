# Two workspaces on one page

Put two workspaces side by side, or one in a dialog, without their links, saved settings or keys getting mixed up.

Two workspaces on one page share nothing, except three things that belong to the page: the address, the browser's storage and the keyboard. Give each workspace its own share of those, and they work side by side.

This page puts an orders workspace beside a notes workspace.

`src/main.tsx`

```tsx
import { createRoot } from "react-dom/client";
import { createJali } from "@jali/core";
import { JaliRoot } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek). Its id names its DOM ids ("orders-pane-…")
// and its localStorage keys ("orders:…").
const orders = createJali({
  id: "orders",
  label: "Orders", // its landmark's name, and part of each pane's, for screen readers
  keyboard: { scope: "local" }, // only keys pressed inside it and its dialogs, or on the page body after it was used last
  panes: orderKinds,
  presets,
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", DOM ids "notes-pane-…", localStorage keys "notes:…".
// The orders workspace sets the page's theme; this one leaves it alone.
const notes = createJali({
  id: "notes",
  label: "Notes",
  keyboard: { scope: "local" },
  pageTheme: false,
  panes: [ticketNote],
  layout: ticketNote({ id: 42 }),
  url: { prefix: "n." },
});

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <JaliRoot jali={orders} className="orders" />
    <JaliRoot jali={notes} className="notes" />
  </div>,
);
```

## Its own name in the DOM

`id` prefixes the workspace's element ids (`orders-pane-…` and `notes-pane-…`, and its dialogs' ids) and its saved keys. The default is `"jali"`, so give each workspace its own. Focus, dragging and F6 already look only inside their own workspace's root.

## Its own name for screen readers

`label` names the workspace for assistive technology. Its landmark is called "Orders" instead of "Panes", and each of Jali's landmarks inside it adds the name: the pane "Order 7, Orders", the shelf "Shelf, Orders", and the switcher, the peek and a page's views the same way. Without it, both workspaces would have a "Panes" region, and a pane titled the same in each would repeat a name, so a screen-reader user moving by landmarks couldn't tell them apart.

## Its own params in the address

`url: { prefix: "n." }` writes the notes workspace's params as `n.l`, `n.zoom` and `n.peek`. The orders workspace keeps the plain names. Each reads and writes only its own, and every other param is left alone, so one link reopens both, and Back and Forward step each one through its own changes.

A workspace that must not touch the address at all, such as one in a dialog, passes `url: false`.

## Its own storage

A workspace saves its settings and pane state to `localStorage` under its `id` by default: `orders:settings`, `notes:pane-state`. Each URL sync keeps its own keys under its `prefix`. So two workspaces with their own ids and prefixes never overwrite each other. Pass `storage` for somewhere else: another prefix (`storage: "my-app"`) or a port such as `memoryStorage()`.

## Its own keys and start-up

`keys: "scoped"` makes a workspace take only keys from inside its own root and its dialogs, plus keys pressed with nothing focused, when it was the last one used. So F6 in the notes moves between notes panes, and ⌘K then ⌘M maximises a notes pane. The palette renders outside the root, but it is the workspace's own, so the chord finishes there. The default, `"page"`, takes every key on the page: right for one workspace, wrong for two.

Everything else a workspace starts while its `<JaliRoot>` is mounted works for each one: saving settings and pane state, Back and Forward, and the browser's prompt when the page closes with unsaved work.

## Inside a page with its own theme

A workspace sets `data-theme` on `<html>` from its theme setting, and on its own root and dialog layer. Inside a page that has its own light and dark (a docs site, an app with its own switch), pass `pageTheme: false`, and the workspace writes none of them and follows the page's `.dark` and `[data-theme]` scopes instead.

## Focus

Mounting a workspace never takes the page's focus. A page with three workspaces, or one below the fold, keeps its place. A workspace moves focus into its panes once the person is in it: when they click or tab into it, or run one of its commands.

## Its own look

To give one workspace its own accent, set `--jali-accent` on an element around its `<JaliRoot>`. See [Theming](theming.md).

## Next

- [Keep the layout in the URL](url-and-routers.md)
- [Test a workspace](testing.md): each test is a workspace of its own.
