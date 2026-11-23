# Keep the layout in the URL

Put the layout in the address so links reopen it and Back steps through it, with or without a router.

With the layout in the address, a person can send a link to what they are looking at, reload without losing it, and use Back and Forward to step through their changes. The `urlSync()` feature does this. Without it, Jali leaves the address alone.

## Turn it on

Pass `urlSync()`, from `jali/url`, in `features`. It is in `defaultFeatures()` too.

`src/jali.ts`

```tsx
import { createJali } from "jali";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: orderKinds,
  presets,
  features: [
    urlSync({
      // "local" (the default): a link carries the layout as designed; sizes the person dragged stay on their device.
      // "link": a link carries every size too, so it reopens exactly as it was sent.
      sizes: "local",
    }),
  ],
  // localStorage keys start "orders-app:". The address keeps dragged sizes, and any link it could not read, here too.
  storage: "orders-app",
});
```

`createJali` reads the address before it returns, so the first render already shows the linked layout. Jali follows Back and Forward while its `<JaliRoot>` is mounted.

When the page opens:

- an address with a layout opens that layout, fitted to this window;
- an address without one opens the preset, or the starting `layout`;
- a link that can't be read (damaged, or naming a kind this app doesn't have) opens the preset instead. Jali keeps a copy of the code in storage and tells the person, with a screen reader announcement and a `toast` event for your app to show (`jali.on("toast", show)`).

## What goes in the address

Jali writes only its own search params. Your own params, the path and the hash are left alone. (One exception, for links from before pages had ids: without a `prefix`, `?app=review` and its `arr` are read as a page link and cleared.)

| Param | Holds |
|---|---|
| `l` | The layout. |
| `preset` | The preset the layout came from. A link opens with that preset marked, and Reset layout rebuilds it. |
| `zoom` | The maximised pane, if any. |
| `peek` | The object in the peek sheet, if any. |
| `scroll` | Where each [row that scrolls sideways](scrolling-rows.md) came to rest, when it isn't at its start. |
| `page`, `item`, `tab`, `open` | A curated page: which one, its item, the view in use, and the panes opened from it. |

A page link writes each object (`open`, `peek`) as its kind and params: `call~slug=demra~t=#12` is a `call` with `slug: "demra"` and `t: 12`. You don't write this yourself: Jali writes it, and **Copy link** copies it.

Deliberate changes (opening, closing, moving, choosing a preset) add a history entry. A detail following a list replaces the entry, so Back skips the rows passed through. A divider drag replaces it once the drag settles.

## What a link brings back, and what it doesn't

A link reopens the same panes, showing the same objects, in the same arrangement. Some things are the reader's, not the sender's:

| | Comes from the link | Stays the reader's |
|---|---|---|
| Panes, their objects and the tree | Yes | |
| The maximised pane, the peek, the preset | Yes | |
| Sizes the sender dragged | Only with `sizes: "link"` | With `"local"` (the default), the reader's own |
| How the layout fits | | Refitted to the reader's window: panes may fold |
| A curated page's mode (Single view, Split view) and split layout | | Yes: the reader's own, from their device |
| A curated page's item and view, when the link leaves them out | | The reader's last, else `firstItem` and `home` |
| Params a kind keeps out of links (`appOnly`, `link: false`) | Never written | Your app sets them again |

**Copy link** (in ⌘K, and `copyLink(jali)` from `jali`) copies the address as Jali writes it, so it follows these rules already.

## Sizes: "local" or "link"

`sizes` says what a link carries about the sizes a person dragged.

- **`"local"`** (the default): the address holds the layout as designed, without the sizes the person dragged. Those sizes are kept on their device instead, keyed by the layout's shape. Their own reloads and Back and Forward keep their sizes. A colleague opening the link sees the designed proportions.
- **`"link"`**: the address holds every size, so a link reopens exactly as it was sent.

Choose `"local"` when a link means "look at this": the sender's proportions are rarely right on the reader's screen. Choose `"link"` when the arrangement itself is the work, and a colleague should see it to the pixel.

With `"local"`, sizes are kept in `storage`, for the last 12 layouts. Only sizes are read back from there, and only values a size can hold; if what is kept would make the layout invalid, the link opens as it is.

## Two instances in one address

`prefix` names one instance's params apart from another's. `urlSync({ prefix: "n." })` writes `n.l`, `n.zoom` and so on. See [Two instances on one page](two-instances.md).

## With a router

By default `urlSync()` uses the browser's history. An app with a router should let the router own the address, so its guards, scroll restoration and typed search params keep working. Pass `urlSync({ location })`: a port of four functions.

```ts nocheck
interface LocationPort {
  search(): string;                                         // "?a=1" or ""
  href(): string;                                           // the whole address, for "Copy link"
  navigate(search: string, mode: "push" | "replace"): void; // same path, this search string
  subscribe(fn: () => void): () => void;                    // the address changed, not by navigate
}
```

`subscribe` must report only changes Jali did not make: Back, Forward, a router link. Most routers report every navigation, Jali's own included, so a small wrapper skips those. It skips only the one write Jali is waiting for: any other change of the search, including a write the router blocked or replaced, clears it and is reported. It works with any router, and its test covers a blocked write, a later visit to the same address, and Back and Forward:

`src/router-location.ts`

```tsx
import type { LocationPort } from "jali";

/** What a router gives you: read the search string, go to a new one, and hear about changes. */
export interface RouterHooks {
  search(): string;
  navigate(search: string, replace: boolean): void;
  listen(onChange: () => void): () => void;
}

/**
 * A location port over a router. Jali expects `subscribe` to hear only changes it did not make (Back, Forward, a
 * router link). Most routers tell you about every navigation, Jali's own included, so this skips the one write Jali
 * is waiting for. Any other change of the search clears that wait: a write the router blocked or replaced never
 * swallows a later navigation, even one to the same address.
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
        const own = now === mine; // Jali's own write coming back
        mine = null; // either way, stop waiting: a blocked write must not hide a later visit
        if (!own) fn();
      });
    },
  };
}
```

Pass the router's location to `urlSync` when you call `createJali`, so the first render already shows the linked layout.

> **Warning: Check these against your router's version.** The two adapters below are written against each router's public API (React Router 7, TanStack Router 1), but this site doesn't install either router, so their code is not compiled here. Check them against the version you use.

### React Router

With a data router (`createBrowserRouter`), the router object can read, navigate and subscribe outside components:

```ts nocheck
import { createBrowserRouter } from "react-router";
import { routerLocation } from "./router-location";

export const router = createBrowserRouter(routes);

const location = routerLocation({
  search: () => router.state.location.search,
  navigate: (search, replace) => {
    const { pathname, hash } = router.state.location;
    void router.navigate({ pathname, search, hash }, { replace });
  },
  listen: (onChange) => router.subscribe(() => onChange()),
});

export const jali = createJali({ panes, presets, features: [urlSync({ location })] });
```

`router.subscribe` calls back on every router state change, including loaders finishing. The wrapper only passes on a change of the search string.

### TanStack Router

TanStack Router keeps its history object public. Writing through it keeps the router in step:

```ts nocheck
import { createRouter } from "@tanstack/react-router";
import { routerLocation } from "./router-location";

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

export const jali = createJali({ panes, presets, features: [urlSync({ location })] });
```

If a route validates its search params, let unknown keys through: Jali's keys (`l`, `preset`, `zoom`, `peek`, and the page keys) are not in your schema.

## In tests and dialogs

`urlSync({ location: memoryLocation() })` is an address that lives in memory. Use it in tests, on the server, and for panes in a dialog that must not touch the page's address. See [Test your layouts](testing.md).

## When the route goes away

If the instance belongs to one route, and your app drops it for good when the person leaves that route (outside React, or in a router's loader cache), call `jali.destroy()`. It cancels every pending question, timer and listener. Inside React, `<JaliRoot>` stops the listeners on unmount, so an instance made in a component needs nothing more.

## Next

- [Unsaved work and pane state](unsaved-work-and-pane-state.md): Back and Forward ask before losing work too.
- [Two instances on one page](two-instances.md)
