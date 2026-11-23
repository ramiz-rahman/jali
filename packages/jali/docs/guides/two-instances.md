# Two instances on one page

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

## Its own name in the DOM

`id` prefixes the instance's element ids (`orders-pane-…` and `notes-pane-…`, and its dialogs' ids) and its saved keys. The default is `"jali"`, so give each instance its own. Focus, dragging and F6 already look only inside their own root.

## Its own name for screen readers

`label` names the instance for assistive technology. Its landmark is called "Orders" instead of "Panes", and each of Jali's landmarks inside it adds the name: the pane "Order 7, Orders", the shelf "Shelf, Orders", and the switcher, the peek and a page's views the same way. Without it, both would have a "Panes" region, and a pane titled the same in each would repeat a name, so a screen-reader user moving by landmarks couldn't tell them apart.

## Its own params in the address

`urlSync({ prefix: "n." })` writes the notes instance's params as `n.l`, `n.zoom` and `n.preset`. Orders keeps the plain names. Each reads and writes only its own, and every other param is left alone, so one link reopens both, and Back and Forward step each one through its own changes.

An instance that must not touch the address at all, such as one in a dialog, leaves `urlSync()` out of its features.

## Its own storage

An instance saves its settings and pane state to `localStorage` under its `id` by default: `orders:settings`, `notes:pane-state`. Each URL sync keeps its own keys under its `prefix`. So two instances with their own ids and prefixes never overwrite each other. Pass `storage` for somewhere else: another prefix (`storage: "my-app"`) or a port such as `memoryStorage()`.

## Its own keys and start-up

`keyboard: { scope: "local" }` makes an instance take only keys from inside its own root and its dialogs, plus keys pressed with nothing focused, when it was the last one used. So F6 in the notes moves between notes panes, and ⌘K then ⌘M maximises a notes pane. The palette renders outside the root, but it is the instance's own, so the chord finishes there. The default, `"page"`, takes every key on the page: right for one instance, wrong for two.

Everything else an instance starts while its `<JaliRoot>` is mounted works for each one: saving settings and pane state, Back and Forward, and the browser's prompt when the page closes with unsaved work.

## Inside a page with its own theme

An instance sets `data-theme` on `<html>` from its theme setting, and on its own root and dialog layer. Inside a page that has its own light and dark (a docs site, an app with its own switch), pass `pageTheme: false`, and it writes none of them and follows the page's `.dark` and `[data-theme]` scopes instead.

## Focus

Mounting `<JaliRoot>` never takes the page's focus. A page with three instances, or one below the fold, keeps its place. Jali moves focus into its panes once the person is in it: when they click or tab into it, or run one of its commands.

## Its own look

To give one instance its own accent, set `--jali-accent` on an element around its `<JaliRoot>`. See [Theming](theming.md).

## Next

- [Keep the layout in the URL](url-and-routers.md)
- [Test your layouts](testing.md): each test makes an instance of its own.
