# Keep the layout in the URL

Put the layout in the address so links reopen it and Back steps through it, with or without a router.

With the layout in the address, a person can send a link to what they are looking at, reload without losing it, and use Back and Forward to step through their changes. A workspace does this by default.

## It is on by default

In a browser, `createJali` keeps the layout in the address with no options at all. Its `url` option configures how:

`src/workspace.ts`

```tsx
import { createJali } from "@jali/core";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({
  panes: orderKinds,
  presets,
  url: {
    // "local" (the default): a link carries the layout as designed; sizes the person dragged stay on their device.
    // "link": a link carries every size too, so it reopens exactly as it was sent.
    sizes: "local",
  },
  // localStorage keys start "orders-app:". The address keeps dragged sizes, and any link it could not read, here too.
  storage: "orders-app",
});
```

The workspace reads the address when it is made, so the first render already shows the linked layout, and follows Back and Forward while its `<JaliRoot>` is mounted. `url: false` leaves the address alone.

When the page opens:

- an address with a layout opens that layout, fitted to the window;
- an address without one opens the preset;
- a link that can't be read (damaged, or naming a kind this app doesn't have) opens the preset instead. Jali keeps a copy of the code in storage and tells the person, with a screen reader announcement and a toast for your app to show (`jali.onToast`).

## What goes in the address

Jali writes only its own search params and keeps every other part of the address as it is. Your own params, the path and the hash are left alone.

| Param | Holds |
|---|---|
| `l` | The layout. |
| `preset` | The preset the layout came from, in a workspace with presets. A link opens with that preset marked, and Reset layout rebuilds it. A link without it opens on the first preset, as links did before. |
| `zoom` | The maximised pane, if any. |
| `peek` | The object in the peek sheet, if any. |
| `page`, `item`, `tab`, `open` | A curated page: which one, its item, the view in use, and panes opened from it. |

A page link writes each object (`open`, `peek`) as its kind and params: `call~slug=demra~t=#12` is a `call` with `slug: "demra"` and `t: 12`. You don't need to write this yourself; build links with `linkSearch`, below.

Deliberate changes (opening, closing, moving, choosing a preset) add a history entry. A detail following a list replaces the entry, so Back skips the rows passed through. A divider drag replaces it once the drag settles.

## Build a link from outside the workspace

Your app often needs a link to something before any workspace shows it: a row in a search result, an email, a page on the server. `linkSearch` builds the same search string the workspace would write, with no workspace running:

```ts

// A curated page: its item, the view in use, a pane opened from it and the peek.
const href = `/customers${linkSearch({
  page: "customer",
  item: 7,
  tab: "orders",
  open: [order({ id: 1041 })],
  peek: order({ id: 1042 }),
})}`;

// A free workspace: a layout, and what rides with it.
const layoutHref = `/desk${linkSearch({ layout: row(order({ id: 1041 }), customer({ id: 7 })) })}`;
```

Reading the link gives exactly what you built it from. A page link may leave out `item` and `tab`, and the reader gets the item and view they saw last. With `prefix`, it writes a prefixed workspace's params; with `search`, it keeps your own params from that search string. Pane kinds are not needed: each object is written from its kind's name and params.

## Sizes: "local" or "link"

`sizes` says what a link carries about the sizes a person dragged.

- **`"local"`** (the default): the address holds the layout as designed. Every divider the person moved is put back in the link, and their sizes are kept on their device, keyed by the layout's shape. Their own reloads and Back and Forward keep their sizes. A colleague opening the link sees the designed proportions.
- **`"link"`**: the address holds every size, so a link reopens exactly as it was sent.

Choose `"local"` when a link means "look at this": the sender's proportions are rarely right on the reader's screen. Choose `"link"` when the arrangement itself is the work, and a colleague should see it to the pixel.

With `"local"`, sizes are kept in the workspace's `storage`, for the last 12 layouts. Only sizes are read back from there, and only values a size can hold; if what is kept would make the layout invalid, the link opens as it is.

## Two workspaces in one address

`prefix` names one workspace's params apart from another's. `url: { prefix: "n." }` writes `n.l`, `n.zoom` and so on. See [Two workspaces on one page](two-workspaces.md).

## With a router

By default the workspace uses the browser's history. An app with a router should let the router own the address, so its guards, scroll restoration and typed search params keep working. Pass `url: { location }`: a port of four functions.

```ts
interface LocationPort {
  search(): string;                                         // "?a=1" or ""
  href(): string;                                           // the whole address, for "Copy link"
  navigate(search: string, mode: "push" | "replace"): void; // same path, this search string
  subscribe(fn: () => void): () => void;                    // the address changed, not by navigate
}
```

`subscribe` must report only changes Jali did not make: Back, Forward, a router link. Most routers report every navigation, Jali's own included, so a small wrapper skips those. It works with any router:

`src/router-location.ts`

```tsx
import type { LocationPort } from "@jali/core";

/** What a router gives you: read the search string, go to a new one, and hear about changes. */
export interface RouterHooks {
  search(): string;
  navigate(search: string, replace: boolean): void;
  listen(onChange: () => void): () => void;
}

/**
 * A location port over a router. Jali expects `subscribe` to hear only changes it did not make (Back, Forward, a
 * router link). Most routers tell you about every navigation, Jali's own included, so this skips those.
 */
export function routerLocation(router: RouterHooks): LocationPort {
  let mine: string | null = null; // the search Jali last asked for
  let last = router.search();
  return {
    search: () => router.search(),
    href: () => window.location.href,
    navigate(search, mode) {
      mine = search;
      router.navigate(search, mode === "replace");
    },
    subscribe(fn) {
      return router.listen(() => {
        const now = router.search();
        if (now === last) return; // something else changed (a loader finished), not the address
        last = now;
        if (now === mine) {
          mine = null; // Jali's own write coming back
          return;
        }
        fn();
      });
    },
  };
}
```

Pass the router's location when you create the workspace, so the first render already shows the linked layout.

> **Warning: Check these against your router's version.** The two adapters below are written against each router's public API, but this site doesn't install either router, so they are not compiled here. Check them against the version you use.

### React Router

With a data router (`createBrowserRouter`), the router object can read, navigate and subscribe outside components:

```ts

export const router = createBrowserRouter(routes);

const location = routerLocation({
  search: () => router.state.location.search,
  navigate: (search, replace) => {
    const { pathname, hash } = router.state.location;
    void router.navigate({ pathname, search, hash }, { replace });
  },
  listen: (onChange) => router.subscribe(() => onChange()),
});

export const jali = createJali({ panes, presets, url: { location } });
```

`router.subscribe` calls back on every router state change, including loaders finishing. The wrapper only passes on a change of the search string.

### TanStack Router

TanStack Router keeps its history object public. Writing through it keeps the router in step:

```ts

export const router = createRouter({ routeTree });

const location = routerLocation({
  search: () => router.history.location.search,
  navigate: (search, replace) => {
    const { pathname, hash } = router.history.location;
    const to = `${pathname}${search}${hash}`;
    if (replace) router.history.replace(to);
    else router.history.push(to);
  },
  listen: (onChange) => router.history.subscribe(() => onChange()),
});

export const jali = createJali({ panes, presets, url: { location } });
```

If a route validates its search params, let unknown keys through: Jali's keys (`l`, `preset`, `zoom`, `peek`, and the page keys) are not in your schema.

## In tests and dialogs

`url: { location: memoryLocation() }` is an address that lives in memory. Use it in tests, on the server, and for a workspace in a dialog that must not touch the page's address. See [Test a workspace](testing.md).

## Next

- [Unsaved work and pane state](unsaved-work-and-pane-state.md): Back and Forward ask before losing work too.
- [Two workspaces on one page](two-workspaces.md)
