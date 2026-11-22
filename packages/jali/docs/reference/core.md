# jali

Every function and constant jali exports, with its options, defaults and what it returns.

The framework-free part of Jali: the instance, the layouts it shows, the address and storage ports, commands and keys. Render it with [jali/react](react.md). Types have their own page, [jali types](core/types.md); the pure layout operations are on [The layout namespace](core/layout.md).

```sh
npm install jali
```

Framework adapters import `jali/adapter`: everything on this page, and, by name, what an adapter needs from inside the package, such as the `DomPort` through which the core finds the adapter's elements. Apps need only what is on this page.

## The instance

### createJali

*function*, from `jali`

```ts
createJali(options: JaliOptions): Jali<RefOf<kinds>, PageOf<page>>
```

Example, `jali.ts`:

```ts
import { createJali, memoryLocation, memoryStorage } from "jali";
import { launcherKind, orderKind, ordersKind } from "./kinds";
import { palette } from "jali/palette";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: [ordersKind, orderKind], // the kinds of pane it can show
  layout: ordersKind(), // the layout it opens on (or `presets`)
  launcher: launcherKind, // what Split opens: without one there is no Split
  name: "Sales desk", // in commands such as "Open Sales desk"
  features: [urlSync({ prefix: "a.", sizes: "link" }), palette()], // each a value from its own module
  storage: "sales", // localStorage keys "sales:…", or a StoragePort
  id: "sales", // DOM ids "sales-pane-…"
  keyboard: { scope: "local", keymap: { "pane.close": "Mod+K Mod+X" } }, // only keys pressed inside it
  pageTheme: false, // leave data-theme on <html> to the page
});

// With no browser (a test, the server): the address and storage in memory, a fixed size, DOM focus left alone.
const location = memoryLocation();
export const inMemory = createJali({
  panes: [orderKind],
  layout: orderKind({ id: 1041 }),
  features: [urlSync({ location })],
  storage: memoryStorage(),
  size: { width: 1440, height: 900 },
  moveFocus: false,
});

location.entries; // every address Jali pushed or replaced
location.visit("?tab=2"); // navigation from outside: Jali hears it, as it hears Back and Forward
```

Makes one instance, ready to render: its state, the model derived from it, its actions and its keymap. Each instance has its own; nothing is shared between two on one page.

Before it returns, it reads the address (a layout link opens as it is, a curated page link opens the page, a link that can't be read opens the starting layout with an error toast), adds what is on screen to Recent, fits the layout to the room and focuses the first pane. A page-only app (a `page` with no `layout` and no `presets`) starts with its page open on `firstItem`, and leaving it is refused. It throws `Jali: no layout to start from can be shown` when it has none of them, or when none of them can be shown (a kind it doesn't have, a param it can't read), with the first reason after a colon.

Its type comes from what it is given: `jali.actions` takes refs of these kinds only, events and the model say which kind (`ref.kind` narrows `ref.params`), and `jali.page` is there only with a `page`. Declare it once as `Register` and the React hooks are typed by it too.

Its listeners (keys, Back and Forward, theme and saving) start with `jali.start()`, which returns their stop and can start again; `<JaliRoot>` starts it while mounted and stops it on unmount. `jali.destroy()` is the end.

**Parameters**

- **`options`** (`JaliOptions`, required):

**Fields**

- **`panes`** (`readonly PaneKindBase[]`, required): The kinds of pane it can show, from `definePane`. A layout can only show refs of these kinds.

- **`layout`** (`LayoutInput`): The layout it opens on: a builder's result (`row(...)`), a single ref, or a whole `Layout`. Give this or `presets`.

- **`presets`** (`readonly PresetOptions[]`): Layouts to start from, in menu order, each `{ id, label, layout }`. Each gets a `layout.preset.<id>` command, titled "Layout: label", and "Reset layout" rebuilds the one in use. `layout` may be a function, to build a fresh one each time. `saved` gives back the layout the person left a preset in.

- **`preset`** (`string`): The preset it opens on when no link says otherwise. An id that is not in `presets` also gives the first.

- **`launcher`** (`PaneKindBase`): What Split and "New tab here" open until the person chooses what to show. It closes quietly and its component reads `useLauncher()`. Without one, those commands and the tab strip's "+" are not offered.

- **`page`** (`Page | null`): A curated page this instance can show, from `definePage` (`jali/page`). A page made any other way is refused: `definePage` gives it the code that runs it, which an app without a page never ships. With one, `jali.page` has its actions.

- **`linkMode`** (`"open" | "peek"`): What following a link on the curated page does at first: `"open"` opens a pane beside the views; `"peek"` only peeks, in Single view, for a viewer who may look but not rearrange. `jali.page.setLinkMode` changes it later.

- **`name`** (`string`): Your app's name for the free layout, in command titles such as "Open Data Studio" on a curated page. Without one, the command reads "Leave" and the page's name.

- **`features`** (`readonly Feature[]`): What the instance does beyond laying out panes, each a value from its own entry, so an app ships only what it uses: `[urlSync(), palette(), rename({ run })]`, or `defaultFeatures()` for the address, ⌘K, Settings, the chooser and `data-pressed` at once. A feature given again takes the earlier one's place. See [Features](features.md).

- **`url`** (`UrlWriter`): A writer of your own for the address (a router's), in place of `urlSync()`: Jali writes through it and reads nothing back. Most apps give `urlSync({ location })` instead. See [`UrlWriter`](core/types.md#urlwriter).

- **`storage`** (`string | StoragePort`): What this person keeps on this device: settings, pane state, a curated page's mode and layout, dragged sizes. A string is a `localStorage` prefix; or pass a port, such as `memoryStorage()`. The default prefix is the instance's `id` (`"jali"`), so two instances with their own ids keep their own.

- **`id`** (`string`): Prefix for DOM ids (`jali-pane-orders`). Give each instance on one page its own.

- **`pageTheme`** (`boolean`): Set `data-theme` on `<html>` from the person's theme setting, and on the instance's root and dialog layer too, for rules scoped to the instance. `false` when the instance sits in a page that has its own theme: then it writes none of them.

- **`settings`** (`Partial<Settings>`): Settings for a person who has none saved on this device yet: `{ theme: "dark" }` for a dark-first app. They are not saved; what the person changes is, and wins from then on, setting by setting. See [`Settings`](core/types.md#settings).

- **`commands`** (`readonly Command[]`): Your own commands. They are listed in ⌘K after Jali's, and `keyboard.keymap` can bind them like any other (`{ "orders.refresh": "Mod+K Mod+U" }`). If an id repeats one of Jali's, Jali's wins.

- **`keyboard`** (`KeyboardOptions`):

Jali's keys, in one place. See [`KeyboardOptions`](core/types.md#keyboardoptions).

**Fields**

- **`keyboard.scope`** (`"page" | "local"`): `"page"`: every key on the page. `"local"`: only keys pressed inside it or in its dialogs (the palette, settings and the chooser render outside its root, so a ⌘K chord finishes there), and keys with nothing focused while it was the last one used. Use `"local"` for two on one page.

- **`keyboard.keymap`** (`KeymapOverrides`): Rebind or unbind commands: `{ "pane.zoom": "Mod+K Mod+Enter", "pane.close": null }`. A binding is refused (and reported) when it can't be parsed, is a single character key with no Mod, Ctrl or Alt (those belong to the content), or has more than two steps.

- **`keyboard.prefix`** (`KeyString`): The first step of every default two-step binding, and the palette's key. Move it when your app owns ⌘K: `"Mod+J"` makes "Restore last closed pane" ⌘J ⌘Z. Bindings in `keymap` are used as written.

- **`keyboard.reserved`** (`readonly KeyString[]`): Keys your app uses for itself. Any of Jali's bindings that is one of them, or starts with one, is dropped and reported to `onInvalid` when the instance is made.

- **`keyboard.platform`** (`"mac" | "other"`): The keymap's platform, for tests and the server. Default: the running one.

- **`keyboard.onInvalid`** (`(id, binding, reason) => void`): Hears each binding refused.

- **`keyboard.words`** (`KeyWords`): The words printed keys use ("Ctrl", "Esc"). Default: the instance's `messages.keys`, English unless you translate them.

- **`landmark`** (`"region" | "main"`): What the panes are to screen readers. `"region"`: a `<section>` labelled "Panes", which sits inside your page's own `<main>` and adds no second one. `"main"`: the panes render as the page's `<main>`. Use it when Jali is the whole app and the page has no `<main>` of its own.

- **`label`** (`string`): The instance's name for assistive technology, for a page with more than one instance. Its landmark is named this instead of "Panes", and each of Jali's landmarks inside it adds it (a pane "Order 7, Orders", the shelf "Shelf, Orders", the switcher, the peek, a page's views), so no two instances repeat a landmark. Without it, the names are Jali's own. See [Two instances on one page](../guides/two-workspaces.md).

- **`dir`** (`Direction`): The reading direction. By default the instance reads its page's: the computed `direction` where it renders, so `<html dir="rtl">` is enough, and it follows a later change of `dir`. Give one to fix it; `<JaliRoot>` then sets `dir` on its elements, so the styles agree. Right to left, a row starts at the right, and every left and right a key, command, drop zone or message names is still the screen's. The layout and its links are the same in both. See [`Direction`](core/types.md#direction).

- **`gap`** (`number`): The space between panes, in CSS pixels. The layout measures with it (splits, rows that scroll, the stacked view), and `<JaliRoot>` writes it on its root and its layer as `--jali-gap`, so a style that reads the variable agrees with where the panes are.

- **`inset`** (`number`): The space between the edges of Jali's root and its panes, in CSS pixels, written as `--jali-inset`. Set it apart from the gap to line the panes up with your own bars.

- **`size`** (`{ width: number; height: number }`): A fixed size instead of the window's, for tests and server rendering. `<JaliRoot>` measures the real one once it renders.

- **`moveFocus`** (`boolean`): `false` leaves DOM focus alone: for tests and an instance that is never shown.

- **`onUnstable`** (`(op: string, before: string, after: string) => void`): Called when a focus or swap action moved a pane on screen, which it never should.

- **`beforeClose`** (`BeforeClose`): Asked before a change removes panes or makes a pane show another object: a close, close others, a preset, `setLayout`, Back and Forward, `openHere`. Return `true` to let it happen or `false` to keep the panes, or a promise of either for a check that takes time. Jali's own "Discard unsaved changes?" follows a yes when a pane still reports unsaved work. See [`BeforeClose`](core/types.md#beforeclose).

- **`confirmDiscard`** (`boolean`): `false`: your app asks about unsaved work itself, from `beforeClose`. Panes still report it with `useUnsaved` and show the unsaved mark, but Jali never asks "Discard unsaved changes?" and doesn't hold the page's unload. A following detail with unsaved work still keeps its object.

- **`tabMenu`** (`TabMenu`): Your items for a tab's menu (right-click, Shift+F10 or the menu key on a tab), after Jali's: Close, Close other tabs, Close tabs to the right, Move tab left and right, Move out of tabs, Split right and down, Maximise. Called as the menu opens, with the tab's pane; `undefined` or `[]` for none. See [`TabMenuItem`](core/types.md#tabmenuitem).

- **`allow`** (`WorkspaceAllow`): What may happen to panes: turn controls off for the whole instance (`{ fullScreen: false }`), turn Pop out off (`{ popOut: false }`, with the `popOut()` feature), and `when({ action, pane, presetId, page })` to decide by context; `false` refuses. Each kind's own `allow` is asked first, and only takes away. See [Choose what people can do with panes](../guides/pane-controls.md) and [`WorkspaceAllow`](core/types.md#workspaceallow).

- **`buttons`** (`PaneButtons`): The buttons in a pane's header, as shortcuts: everything allowed is in the pane's menu (right-click, ⋯ or Shift+F10) and ⌘K either way. Leave it out for Jali's: Tuck, Maximise, Pop out (where `allow.popOut` turns it on) and Close, with Full screen in Maximise's place on a lone pane. A list replaces them; a function adjusts them (`(defaults) => defaults.filter((b) => b !== "tuck")`). A kind's own `buttons` win. See [`PaneButtons`](core/types.md#panebuttons).

- **`phone`** (`PhoneOptions`): Phones: below `phone.below` pixels of width (default 600) Jali shows one pane at a time, with a switcher, whatever the panes' minimums. `{ below: 0 }` switches only when even one pane can't fit. See [`PhoneOptions`](core/types.md#phoneoptions).

- **`onPaneError`** (`(error: unknown, info: PaneErrorInfo) => void`): Called when a pane's component throws. That pane shows a failed state with Retry and Close, and the other panes carry on. `info` says which pane ([`PaneErrorInfo`](core/types.md#paneerrorinfo)). Send it to your error reporting.

- **`messages`** (`MessageOverrides`): Words to use instead of Jali's English ones, by area: `{ commands: { close: "Fermer le volet" } }`. Keys you leave out stay English. See `en` and [Translate Jali](../guides/translating.md).

**Returns** `Jali`: The instance. Its members are listed under [`Jali`](core/types.md#jali): `actions`, `page` (with a page), `dialogs`, `get()`, `subscribe()`, `on()`, `model()`, `getLayout()`, `setLayout()`, `keymap`, `env`, `messages`, `href()`, `start()` and `destroy()`.

### actions

*namespace*, from `jali (jali.actions)`

```ts
jali.actions.openBeside(pane: PaneTarget, ref: ObjectRef, options?: OpenBesideOptions): ActionResult
```

Example, `actions.ts`:

```ts
import { orderKind } from "./kinds";
import { store } from "./store";

// Read, subscribe, act. An action says what it did: the pane it opened, or why it did not.
const off = store.subscribe(() => console.log(store.get().view.focused));
const opened = store.actions.openBeside("orders", orderKind({ id: 1042 }));
if (!opened.ok) console.log(opened.reason); // "not-found", "unsaved", …
store.actions.select("orders", orderKind({ id: 1043 }));
store.actions.close(orderKind({ id: 1042 })); // a pane by what it shows
store.on("open", ({ pane, ref }) => console.log("opened", pane, ref.params));
store.model().visible; // panes on screen, reading order
store.on("toast", (t) => console.log(t.title, t.undo ? "(Undo)" : ""));
off();
```

What an app asks the instance to do with panes and layouts; a curated page's actions are `jali.page` ([`JaliPage`](core/types.md#jalipage)) and the dialogs' `jali.dialogs` ([`JaliDialogs`](core/types.md#jalidialogs)). Each action reads the current state, makes its change once (layout, focus, address, announcement, toast) and returns what happened: `{ ok: true, pane }`, or `{ ok: false, reason }` with the reason it did not.

The pane comes first, by its id or by the object it shows: `close("order")` and `close(orderKind({ id: 7 }))` both work. An action that would remove or replace a pane with unsaved work is held instead (`reason: "unsaved"`), and "Discard unsaved changes?" opens. A following detail with unsaved work keeps its object and says so, while the list's other followers move on. Every action is listed under [`JaliActions`](core/types.md#jaliactions).

## Pane params

What a kind's refs hold, in its `params`: `Number`, `String`, `Boolean`, `oneOf(...)` or your own function, each required unless wrapped in `optional` or `appOnly`. The [Pane kinds guide](../guides/pane-kinds.md#params) explains what happens to a ref that is missing a required param.

### optional

*function*, from `jali`

```ts
optional<T extends ParamType>(type: T, options?: ParamOptions): OptionalParam<T>
```

Example, `ticket.tsx`:

```tsx
import { definePane, type PaneProps } from "jali/react";
import { oneOf, optional } from "jali";

// Declared first, so a component written apart from the kind is typed from it.
const ticketParams = {
  id: Number,
  status: optional(oneOf("open", "pending", "closed")),
  internal: optional(Boolean),
};

// params is { id: number; status?: "open" | "pending" | "closed"; internal?: boolean }
function TicketView({ params }: PaneProps<typeof ticketParams>) {
  return (
    <h3>
      Ticket {params.id} · {params.status ?? "any status"}
      {params.internal ? " · internal notes" : ""}
    </h3>
  );
}

export const ticket = definePane("ticket", {
  params: ticketParams,
  title: ({ id }) => `Ticket ${id}`,
  Component: TicketView,
});

ticket({ id: 7 }); // { kind: "ticket", params: { id: 7 } }
ticket({ id: 7, status: "open", internal: true });
```

A param a ref may leave out. The kind's code sees it as optional (`tab?: string`), and its ref maker takes it or not. An optional param given as `undefined` is left out of the ref, as a link would leave it.

**Parameters**

- **`type`** (`ParamType`, required): How to read it when it is there: `Number`, `String`, `Boolean`, `oneOf(...)` or a function.

- **`options.link`** (`false`): The param is the pane's own state for this page load, and stays out of the address: `runId: optional(String, { link: false })`. Jali leaves it out of every link it writes (the address bar, Copy link, Back and Forward). Unlike `appOnly`, it is part of what the pane shows (`chart({ runId: "a" })` and `chart({ runId: "b" })` are two objects), and a link that does carry it still sets it. Back and Forward keep it on a pane that is still open; after a reload the pane has none, unless the preset the address names gave it one. Use it for a value that means nothing in another tab: a run id, a key into memory.

**Returns** `OptionalParam<T>`:

### appOnly

*function*, from `jali`

```ts
appOnly<T extends ParamType>(type: T): AppOnlyParam<T>
```

A param only your app sets, never a link: `params: { sql: String, autorun: appOnly(Boolean) }`. Use it for anything a link must not be able to turn on, such as a query that runs as it opens. Jali leaves it out of every address it writes (the address bar, Copy link, Back and Forward) and drops it from every link it reads, even when the link holds a value it can't read. What the app gave stays where the app gave it: Back and Forward keep it on a pane that is still open, and a reload keeps what the preset the address names gave a pane, when the pane is exactly the preset's (the same id, showing the same object). A link that changes the pane gets none. It is optional, since a pane opened from a link has none, and it is not part of what the pane shows: `query({ sql, autorun: true })` and `query({ sql })` are the same object.

**Parameters**

- **`type`** (`ParamType`, required): How to read it when your app gives it: `Number`, `String`, `Boolean`, `oneOf(...)` or a function.

**Returns** `AppOnlyParam<T>`:

### oneOf

*function*, from `jali`

```ts
oneOf<const V extends readonly (string | number)[]>(...values: V): OneOf<V[number]>
```

A param that is one of a few values: `oneOf("open", "closed")` gives `"open" | "closed"`. Values are compared as text, so `oneOf(10, 25)` reads `"25"` from a link as `25`. Any other value can't be read, and the ref doesn't open.

**Parameters**

- **`...values`** (`(string | number)[]`, required): The values it can be.

**Returns** `OneOf<V[number]>`: A reader, with the values as `values`.

## Layouts

### row

*function*, from `jali`

```ts
row(options?: RowOptions, ...children: (Draft | ObjectRef)[]): Draft
```

Example, `layouts.ts`:

```ts
import { column, pane, row, tabs, toLayout } from "jali";
import { orderKind, ordersKind } from "./kinds";

// A child is a ref, a pane(ref, options), or another row, column or tabs. Options come first when there are any.
export const desk = row(
  pane(ordersKind(), { id: "orders", px: 320 }), // a fixed 320px
  column(
    { weight: 2 }, // twice the share of its siblings
    pane(orderKind({ id: 1041 }), { id: "order", linkedTo: "orders", follows: true }),
    tabs(orderKind({ id: 1042 }), orderKind({ id: 1043 })), // two tabs, the first shown
  ),
);

// The plain layout tree: what the address carries and the layout namespace works on. Ids it was not given are
// named after what they hold ("row", "column", "tabs", "order-2").
export const tree = toLayout(desk);
```

Children side by side. A child is a ref (a pane showing it), a `pane(ref, options)`, or another `row`, `column` or `tabs`. Options come first when there are any: `row({ weight: 2 }, a, b)`.

Nodes without an `id` are named after what they hold: `"row"`, `"column"`, `"tabs"`, or the pane's kind, then `"order-2"` and so on. Give an `id` to a pane another one links to, or that your code names.

**Parameters**

- **`options`** (`RowOptions`): `id`; `weight` (its share of the parent, default 1) or `px` (a fixed length); `scroll: "x"` for a row that scrolls sideways, its children at their own widths, instead of sharing its width and folding what doesn't fit.

- **`children`** (`(Draft | ObjectRef)[]`, required):

**Returns** `Draft`: For `createJali({ layout })`, a preset's `layout`, or `toLayout`.

### column

*function*, from `jali`

```ts
column(options?: SizeOptions, ...children: (Draft | ObjectRef)[]): Draft
```

Children one above the other. Otherwise the same as `row`.

### tabs

*function*, from `jali`

```ts
tabs(options?: TabsOptions, ...panes: (PaneDraft | ObjectRef)[]): Draft
```

Panes as tabs in one place: a stack the person made. `options.active` names the tab shown (default: the first); `id`, `weight` and `px` as for `row`.

### pane

*function*, from `jali`

```ts
pane(ref: ObjectRef, options?: PaneNodeOptions): PaneDraft
```

A pane showing `ref`, with options. A bare ref in a `row` is the same as `pane(ref)`.

**Parameters**

- **`ref`** (`ObjectRef`, required): What it shows: `orderKind({ id: 1 })`.

- **`options`** (`PaneNodeOptions`):

**options**

- **`id`** (`string`): Its node id. Default: its kind's name, then `name-2`, ….

- **`weight`** (`number`): Its share of the parent.

- **`px`** (`number`): A fixed length along the parent's axis instead.

- **`linkedTo`** (`string`): The pane it was opened from. Closing that pane drops the link.

- **`follows`** (`boolean`): With `linkedTo`: it shows whatever is selected in that pane, and moves with the selection.

- **`kept`** (`boolean`): Kept by the person: never reused for another object, never following, the last to fold.

- **`pinned`** (`boolean`): A pinned tab: first in its tab group, left open by Close other tabs and Close tabs to the right, and still pinned if it leaves the group and joins another.

- **`role`** (`string`): The place it fills in a curated page's designed layout (the view's id).

- **`priority`** (`"primary" | "supporting"`): Supporting panes give way first when room runs out.

- **`hidden`** (`boolean`): Off screen at the start, with no slot or tab; showing it brings it back.

**Returns** `PaneDraft`:

### toLayout

*function*, from `jali`

```ts
toLayout(input: LayoutInput): Layout
```

The plain layout tree a builder's result stands for, with an id on every node: what the address carries and the layout namespace works on. A whole `Layout` comes back as it is; a single ref becomes a one-pane layout. You rarely need it: everything that takes a layout takes a builder's result.

**Returns** `Layout`:

### sameRef

*function*, from `jali`

```ts
sameRef(a: ObjectRef | undefined, b: ObjectRef | undefined): boolean
```

Example, `same-ref.ts`:

```ts
import { sameRef } from "jali";

sameRef({ kind: "order", params: { id: 1041 } }, { kind: "order", params: { id: 1041 } }); // true
sameRef({ kind: "order", params: { id: 1041 } }, { kind: "order", params: { id: "1041" } }); // false: 1041 !== "1041"
sameRef(undefined, { kind: "order", params: {} }); // false
```

Whether two refs are exactly the same: the same kind and the same params, compared with `===`, in any key order (a layout read back from Postgres `jsonb` shows the same objects). Jali compares refs with this everywhere. `1` and `"1"` differ here; to ask whether two refs show the same object, use `kinds.sameObject`.

**Parameters**

- **`a`** (`ObjectRef | undefined`, required):
- **`b`** (`ObjectRef | undefined`, required):

**Returns** `boolean`: `false` when either is `undefined`.

## The address and storage

`createJali` makes these for you from its `url` and `storage` options. Pass one yourself for a router, a test or an instance that must not touch the page.

### browserLocation

*function*, from `jali`

```ts
browserLocation(win?: Window): LocationPort
```

The address as the browser's history: `navigate` calls `pushState` or `replaceState` with the same path and hash (and does nothing when the address would not change), and `subscribe` listens to `popstate`.

**Parameters**

- **`win`** (`Window`): The window whose history to use.

**Returns** `LocationPort`:

### memoryLocation

*function*, from `jali`

```ts
memoryLocation(initial?: string): LocationPort & { entries: string[]; visit(search: string): void }
```

Example, `jali.ts`:

```ts
import { createJali, memoryLocation, memoryStorage } from "jali";
import { launcherKind, orderKind, ordersKind } from "./kinds";
import { palette } from "jali/palette";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: [ordersKind, orderKind], // the kinds of pane it can show
  layout: ordersKind(), // the layout it opens on (or `presets`)
  launcher: launcherKind, // what Split opens: without one there is no Split
  name: "Sales desk", // in commands such as "Open Sales desk"
  features: [urlSync({ prefix: "a.", sizes: "link" }), palette()], // each a value from its own module
  storage: "sales", // localStorage keys "sales:…", or a StoragePort
  id: "sales", // DOM ids "sales-pane-…"
  keyboard: { scope: "local", keymap: { "pane.close": "Mod+K Mod+X" } }, // only keys pressed inside it
  pageTheme: false, // leave data-theme on <html> to the page
});

// With no browser (a test, the server): the address and storage in memory, a fixed size, DOM focus left alone.
const location = memoryLocation();
export const inMemory = createJali({
  panes: [orderKind],
  layout: orderKind({ id: 1041 }),
  features: [urlSync({ location })],
  storage: memoryStorage(),
  size: { width: 1440, height: 900 },
  moveFocus: false,
});

location.entries; // every address Jali pushed or replaced
location.visit("?tab=2"); // navigation from outside: Jali hears it, as it hears Back and Forward
```

An address that lives in memory: for tests, server rendering, and an instance in a dialog that must not touch the page's address.

**Parameters**

- **`initial`** (`string`): The first search string.

**Returns** `LocationPort & { entries: string[]; visit(search: string): void }`: `entries` is the history, newest last; `href()` is `memory:` plus the search. `visit(search)` is navigation the instance did not make (Back, a router link): it adds an entry and calls every subscriber. `navigate` does not call subscribers.

### browserStorage

*function*, from `jali`

```ts
browserStorage(prefix: string): StoragePort
```

`localStorage` under `prefix` (keys are `prefix:key`). Reads and writes never throw: in private mode or with storage blocked, nothing is saved and reads give `null`.

**Parameters**

- **`prefix`** (`string`, required): The key prefix. `createJali({ storage: "orders" })` makes one for you.

**Returns** `StoragePort`:

### memoryStorage

*function*, from `jali`

```ts
memoryStorage(initial?: Record<string, string>): StoragePort
```

Storage in a `Map`, for tests, server rendering and embedded instances.

**Parameters**

- **`initial`** (`Record<string, string>`): Keys to start with (`settings`, `pane-state`, …).

**Returns** `StoragePort`:

### linkSearch

*function*, from `jali`

```ts
linkSearch(link: JaliLink, options?: LinkSearchOptions): string
```

The search string that opens an instance on `link`, written as the instance itself writes it: `linkSearch({ page: "visit", item: 7, open: [call({ slug: "demra" })] })` is `"?page=visit&item=7&open=call~slug=demra"`. Reading it back gives exactly that page, item, view, opened panes and peek, or that layout. It needs no instance and no pane kinds, so a server, an email or another app can build links. Put it after the path the instance is on: `` `/visits${linkSearch(link)}` ``.

**Parameters**

- **`link`** (`JaliLink`, required): A [`PageLink`](core/types.md#pagelink) (a curated page: `page`, and optionally `item`, `tab`, `open` and `peek`) or a [`LayoutLink`](core/types.md#layoutlink) (a free layout: `layout`, and optionally `preset`, `zoom` and `peek`).

- **`options`** (`LinkSearchOptions`): `prefix`: the instance's `url.prefix`, when it has one. `search`: a search string whose other params (your app's own) are kept; any instance params in it are replaced. `panes`: the instance's pane kinds, as you pass `createJali({ panes })`. A link never carries a param only the app sets (`appOnly`) or one kept out of the address (`link: false`); `linkSearch` leaves them out of each ref a kind's call built, and, given `panes`, out of any ref, such as those of a live layout (`jali.getLayout()`) or peek.

**Returns** `string`: `"?…"`, or `""` when there is nothing to write.

## Commands and keys

### commandsOf

*function*, from `jali`

```ts
commandsOf(jali: Jali): readonly Command[]
```

Example, `toolbar.ts`:

```ts
import { commandsOf, copyLink, listCommands, runCommand } from "jali";
import { store } from "./store";

// A toolbar button that runs one of Jali's commands and shows its keys.
const zoom = commandsOf(store).find((c) => c.id === "pane.zoom")!;
const disabled = listCommands(store).find((c) => c.id === "pane.zoom")!.disabled;
const tooltip = `${zoom.title} · ${store.keymap.label(zoom.id)}`; // "Maximise or restore pane · ⇧⌘↵"

function onClick() {
  if (!runCommand(store, "pane.zoom")) console.info("refused");
}

copyLink(store); // the address on the clipboard, and "Link copied" read out
export { disabled, tooltip, onClick };
```

Every command the instance has, in palette order: the fixed set, one per preset, and titles in the instance's own words (its name, its page's name and viewers). The same array for the same instance. Every id is on the [Commands](commands.md) page.

**Parameters**

- **`jali`** (`Jali`, required): The instance (only its `env` is read).

**Returns** `readonly Command[]`: Each with `id`, `title`, `group`, an optional `check` that returns a refusal when it can't run now, and `run`.

### listCommands

*function*, from `jali`

```ts
listCommands(jali: Jali): ListedCommand[]
```

Every command a person can run from a menu now, in the palette's order: the focused pane's own commands first (keys `pane:<id>`), then the instance's and your own `commands`. Each has its `title`, `group`, `keys` label for this platform, `disabled` and the `reason`, and `run`. For an app with its own command menu (no `palette()` feature); in React, [`useJaliCommands`](react.md#usejalicommands). Read it again after `jali.subscribe` calls back.

**Returns** `ListedCommand[]`:

### runCommand

*function*, from `jali`

```ts
runCommand(jali: Jali, id: string): boolean
```

Runs a command by id if its check passes. A refusal is not announced here (the keyboard and the palette do that).

**Parameters**

- **`jali`** (`Jali`, required):
- **`id`** (`string`, required): A command id, such as `"pane.zoom"`.

**Returns** `boolean`: Whether it ran: `false` for an unknown id or a refused check.

### edgeScroll

*function*, from `jali`

```ts
edgeScroll(jali: Jali, onScroll?: () => void): EdgeScroll
```

Scrolls a row that scrolls sideways while a drag is held within 56px of its left or right edge, faster the closer it is, so a drag can reach a pane out of view. For an app's own drag; Jali's pane drag (by a header) already does this. Call `move` on every pointer move and `stop` when the drag ends. `onScroll` runs after each step, so the drag can find what is under the pointer again as the panes slide past.

**Parameters**

- **`jali`** (`Jali`, required):
- **`onScroll`** (`() => void`): After each step of scrolling.

**Returns** `EdgeScroll`:

### EdgeScroll

*type*, from `jali`

```ts
interface EdgeScroll { move(clientX: number, clientY: number): void; stop(): void }
```

What `edgeScroll` returns: tell it where the pointer is, and when the drag ends.

### copyLink

*function*, from `jali`

```ts
copyLink(jali: Jali): void
```

Writes `jali.href()` to the clipboard and announces "Link copied", or "Couldn't copy the link" when the browser refuses. Where `navigator.clipboard` is missing it does nothing. The `layout.copy_link` command runs it.

**Parameters**

- **`jali`** (`Jali`, required):

**Returns** `void`:

### DEFAULT_KEYMAP

*constant*, from `jali`

```ts
const DEFAULT_KEYMAP: { readonly "palette.toggle": readonly ["Mod+K"]; … }
```

Example, `keymap.ts`:

```ts
import { DEFAULT_KEYMAP, formatKeys } from "jali";
import { store } from "./store";

// The instance's keymap: the defaults, with `keyboard.keymap`'s overrides applied.
store.keymap.label("pane.close"); // "⌘K ⌘W" (rebound in store.ts)
store.keymap.label("pane.split.down"); // "" (unbound)
store.keymap.sequences("pane.zoom").map((s) => formatKeys(s, "other")); // ["Ctrl+Shift+Enter"]
DEFAULT_KEYMAP["pane.split.right"]; // ["Mod+\\"]
```

The default bindings: command id to one or more binding strings. `Mod` is ⌘ on a Mac and Ctrl elsewhere. Each id and its keys, printed for both platforms, are on the [Commands](commands.md) page.

The defaults keep to three rules:

- single character keys belong to the focused content;
- no keys the browser keeps for itself (⌘W, ⌘T, Ctrl+Tab and the like), no Ctrl+Alt, and no ⌘ or Ctrl with a digit;
- one prefix, ⌘K or Ctrl+K, which opens the palette and starts a two-step chord whose second step keeps Mod held.

### keyBelongsToContent

*function*, from `jali`

```ts
keyBelongsToContent(event: KeyboardEvent): boolean
```

Whether a key event belongs to the focused content: its target is a text field, a contenteditable region, a combobox or search box, inside a dialog, or a control that Space presses (a button, link, tab, checkbox, switch, radio or menu item). Use it in a window-level `keydown` handler that wants a single key such as Space. See [Space in lists](../guides/commands-and-keys.md).

### formatKeys

*function*, from `jali`

```ts
formatKeys(seq: KeySequence, platform?: Platform, words?: KeyWords): string
```

Example, `format.ts`:

```ts
import { formatKeys, keyHint } from "jali";
import { store } from "./store";

keyHint("Alt+Enter", "mac"); // "⌥↵"
keyHint("Alt+Enter", "other"); // "Alt+Enter"
keyHint("Mod+Enter"); // for this platform: "⌘↵" on a Mac, "Ctrl+Enter" elsewhere
store.keymap.sequences("pane.zoom").map((s) => formatKeys(s, store.keymap.platform));
```

A key sequence as people read it: "⌘K ⌘M" on a Mac, "Ctrl+K Ctrl+M" elsewhere. Sequences come from `keymap.sequences(id)`. `jali.keymap.format(seq)` does the same in the instance's own words.

**Parameters**

- **`seq`** (`readonly Chord[]`, required): One binding: a chord, or a prefix chord and a second chord.

- **`platform`** (`Platform`):
- **`words`** (`KeyWords`): The words for modifiers, Esc, Space and the arrows, such as `messages.keys`.

**Returns** `string`:

### altClick

*function*, from `jali`

```ts
altClick(platform?: Platform): string
```

The words for Jali's modifier-click, for hints in your own text: "⌥-click" on a Mac and "Alt-click" elsewhere, as in `` `${altClick()} a tab to open it beside` ``.

**Parameters**

- **`platform`** (`Platform`):

### keyHint

*function*, from `jali`

```ts
keyHint(text: string, platform?: Platform, words?: KeyWords): string
```

A binding string printed for the platform: `keyHint("Alt+Enter")` is "⌥↵" on a Mac and "Alt+Enter" elsewhere. For keys a pane handles itself, which are not in the keymap. Throws on a key or modifier it doesn't know.

**Parameters**

- **`text`** (`string`, required): A binding such as `"Mod+K Mod+M"`.

- **`platform`** (`Platform`):
- **`words`** (`KeyWords`): As for `formatKeys`.

**Returns** `string`:

## Words

### en

*constant*, from `jali`

```ts
const en: Messages
```

Example, `messages.ts`:

```ts
import { createJali, en, type MessageOverrides } from "jali";
import { orderKind } from "./kinds";

const words: MessageOverrides = {
  commands: { close: "Close tab" },
  tabs: { close: (pane) => `Close ${pane} tab` },
};
const jali = createJali({ panes: [orderKind], layout: orderKind({ id: 1 }), messages: words });

jali.messages.commands.close; // "Close tab"
jali.messages.commands.zoom; // "Maximise or restore pane", from `en`
en.announcements.closed("Order 1041"); // "Order 1041 closed · Undo available"
```

Jali's English messages: every word it shows or says, by area (`announcements`, `toasts`, `commands`, `commandGroups`, `keys`, `palette`, `chooser`, `confirmDiscard`, `settings`, `tabs`, `shelf`, `pane`, `peek`, `workspace`, `page`, `drop`). An instance made without `messages` says these words. A curated page's own words (the `page` area, and the announcements, commands and toast only a page uses) come with the page from `definePage`, so an instance without a page has none of them in `jali.messages`, and an app that doesn't import `en` doesn't ship them. Spread it to start a translation. A message that needs values is a function, such as `en.announcements.closed(pane)`; a message with a bold part takes `bold` and returns its parts in order.

## Lists and their detail

### activeItemPort

*function*, from `jali`

```ts
activeItemPort(jali: Jali, pane: NodeId, mapping: ActiveItemMapping): ActiveItemPort
```

Example, `active-item.ts`:

```ts
import { activeItemPort } from "jali";
import { orderKind } from "./kinds";
import { store } from "./store";

// A list in pane "orders" keeps its current row through the port; Jali follows it.
const port = activeItemPort(store, "orders", {
  toRef: (itemId) => orderKind({ id: Number(itemId) }),
  idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
});

port.write("1042", "step"); // the cursor moved: the following detail shows order 1042 once it rests
port.write("1042", "open"); // Space: show it (the following detail if on screen, else the peek sheet)
port.write("1042", "close"); // Esc: close the peek this list opened; the cursor stays
port.itemId; // "1042"
```

Lets a list inside a pane keep its current item through the instance, so the pane's following detail follows it, Space shows it and an open peek steps with it. The shape matches Chakni's Quick Look port, so a Chakni collection plugs in with no dependency either way. In React, `useActiveItemPort`.

`write(id, "step")` reports the selection (the detail follows once it rests, 150 ms). `"open"` also shows the item: in the following detail when it is on screen, else the peek sheet. `"close"` closes the peek only if this pane opened it; the selection stays. `itemId` reads the pane's selection through `idOf`.

**Parameters**

- **`jali`** (`Jali`, required):
- **`pane`** (`NodeId`, required): The pane the list is in.

- **`mapping`** (`ActiveItemMapping`, required):

**mapping**

- **`toRef`** (`(itemId: string) => ObjectRef`, required): The object an item id shows.

- **`idOf`** (`(ref: ObjectRef) => string | null`, required): The item id of an object, or `null` when it is not one of this list's items.

**Returns** `ActiveItemPort`: `{ itemId, write(itemId, action) }`; `write` always returns `{ status: "accepted" }`.

## Geometry

### GAP

*constant*, from `jali`

```ts
const GAP: number
```

The default gap between panes and inset from the edges of Jali's root, in pixels (6); an instance's own are `createJali({ gap, inset })`. For measuring an instance from outside: its usable area is its element's size minus twice its inset (`GAP * 2` by default).

## The layout namespace

### layout

*namespace*, from `jali`

```ts
import { layout } from "jali";
```

Example, `layout.ts`:

```ts
import { GAP, layout, type Layout, type LayoutContext, type ViewState } from "jali";
import { orderKind } from "./kinds";
import { store } from "./store";

// Every operation is pure: a layout in, a new layout out. The context is the room, the gap and the kinds.
const ctx: LayoutContext = {
  fit: { ...store.get().area, gap: GAP, kinds: store.env.kinds.registry() },
  paneCap: store.get().settings.paneCap,
};
const start: Layout = layout.tree.clone(store.getLayout());
const view: ViewState = { focused: "orders", focusHistory: ["orders"] };

const opened = layout.openBeside(start, view, "orders", orderKind({ id: 1043 }), ctx);
opened.mode; // "beside", "replaced" (an earlier link reused) or "tab" (no room)

const closed = layout.close(opened.layout, opened.view, opened.opened, ctx);
const boxes = layout.resolve(closed.layout, closed.view, ctx).panes; // a rect for every pane

const code = layout.encode(closed.layout); // "1.WzEseyJ…": what goes in ?l=
const back = layout.decode(code, store.env.kinds.registry()); // the same layout, or null when it can't be read
export { boxes, back };
```

The pure layout tree API: every operation takes a layout (and usually the view and a `LayoutContext`) and returns a new one; nothing is changed in place. The instance's actions are built on it. To write a layout, use the builders above; these are for working on one. Use it to build or test layouts, or to work out what an action would do. Each member is on [The layout namespace](core/layout.md).
