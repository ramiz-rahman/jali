# Define a pane kind

Describe one kind of pane: what it shows, how narrow it can go, the component that draws it, and what people may do with it.

A [pane kind](../get-started/key-concepts.md#kind) is one sort of pane in your app: an orders list, one order, a customer. You define it once with `definePane`, and every pane of that kind uses it.

This guide builds the kinds for a small orders app. The whole file is at the end.

## What a pane shows

Each pane shows one object, named by a **ref**: a kind and some params. The kind you define makes its refs:

```ts
import { orderKind } from "./panes";

orderKind({ id: 12 }); // { kind: "order", params: { id: 12 } }
```

A ref is plain data, so it fits in a link. Params are text, numbers or `true`/`false`. Your component reads them and loads the object itself: Jali never fetches anything.

## The options

### Name it, and say what it shows

The first argument is the kind's name; refs and links carry it. `params` says what each pane of the kind needs, and how to read it back from a link, which turns every value into text:

```tsx
import { definePane } from "jali-layout/react";
import { OrderDetail } from "./order-detail";

export const orderKind = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: OrderDetail,
});
```

With `params`, the component and `title` get `id` as a number, and `orderKind({ id: "12" })` is a type error, as are `orderKind()` and a param the kind doesn't declare. [Params](#params) below covers optional params and the other types.

`title` names the pane in its header, its tab and the shelf. A kind whose panes all have the same name can pass a string: `title: "Orders"`. To name a pane from its data, see [Failures, loading and titles](#failures-loading-and-titles).

### Say how narrow it can go

`width.min` is the narrowest the content still works at. When the panes on screen need more room than there is, a pane folds into a tab of its neighbour instead of being squeezed. It comes back when there is room again. In a tab group the widest tab's `width.min` holds for the whole group, so a wide kind makes its tab group wide. `height.min` is the same for height, in a column. The defaults are 240 and 160.

Two more widths say where spare room goes:

- `width.comfortable`: spare room brings the pane up to this first. Default: `width.min`.
- `width.max`: the widest the content usefully uses. Past it, spare room goes to the neighbours first. It is soft: when every pane is at its max, they all grow on, so a split never leaves an empty gap. A person dragging a divider can pass it too.

`height.comfortable` and `height.max` do the same down a column. A short, wide pane, such as a timeline under a document, says `height: { min: 160, comfortable: 200, max: 240 }` and stays about that tall in any window, while the pane above takes the rest.

Leave `width.max` out for content that uses any width, such as tables and charts. Set it for forms and records, so a field does not stretch across a wide screen.

### Say when two refs are the same object

Jali needs to know when two refs name the same object. Showing an object in a pane (`openHere`, or a choice in the launcher) when it is already open elsewhere focuses the open one instead. Recent lists each object once. On a curated page, a link to an object already on the page goes to it.

By default two refs are the same when all their params match as text, so `{ id: 1 }` and `{ id: "1" }` match.

- `identity` returns what makes an object itself, from its params: `({ id }) => id`.
- `scratch: true` is for kinds where every pane is new (a new query, a draft): such a pane is never matched against another, and stays out of Recent.
- `shows` names the type of object shown, when two kinds show the same objects in different ways. Two kinds with the same `shows` and identity show the same object.

### Draw it

`Component` renders the pane's content. `icon` is shown in the header, the tab and the shelf. Jali's own icons are [Phosphor's](https://phosphoricons.com) regular weight, so a Phosphor icon (`@phosphor-icons/react`, the set Chakni uses) matches them; any component that takes `size` works. Without one, Jali draws a plain square.

More options:

- `holdWhileResizing: true` keeps the content as it is while a divider is dragged, and reflows it once on release. Use it for long lists and grids.
- `inRecent: false` keeps the kind out of Recent. It can also be a function of the params.
- `follow` says what a following pane of this kind shows when its list selects an object of another kind: `follow: (selected) => ({ symbol: selected.params.symbol })` lets a chart follow a watchlist of quotes. See [Following a list](../learn/following.md#followers-of-other-kinds).
- `selects` says, for a list, the kind of the objects it selects: `selects: "quote"` for a watchlist that reports `select(quote(...))`. With no selection yet, the list starts on what its follower of that kind shows. See [Following a list](../learn/following.md#where-a-list-starts).

## Params

`params` lists what a pane of the kind can show, and the type of each:

| Type | The component gets | In a link |
|---|---|---|
| `Number` | a number | `"12"` reads as `12` |
| `String` | text | as written |
| `Boolean` | `true` or `false` | `"true"` and `"false"` read as flags, and so do `1` and `0` |
| `oneOf("open", "closed")` | `"open" \| "closed"` | any other value can't be read |
| `optional(type)` | the type, or `undefined` | may be left out |
| a function | what it returns | it gets the value; it returns `undefined` or `NaN`, or throws, when it can't read it |

A param is required unless it is wrapped in `optional`. For example, a ticket with an optional tab and a flag:

`src/panes/ticket.tsx`

```tsx
import { definePane } from "jali-layout/react";
import { oneOf, optional } from "jali-layout";

export const ticket = definePane("ticket", {
  params: { id: Number, tab: optional(oneOf("thread", "details")), internal: optional(Boolean) },
  title: ({ id }) => `Ticket ${id}`,
  identity: ({ id }) => id,
  Component: ({ params }) => <h3>Ticket {params.id}</h3>,
});

ticket({ id: 7 }); // the tab and the flag can be left out
ticket({ id: 7, tab: "details", internal: true });
```

The component, `title` and the other options get `{ id: number; tab?: "thread" | "details"; internal?: boolean }`. By default every param counts towards which object a pane shows. When an optional param doesn't make it another object, give the kind an `identity`, as here.

### A component written apart from its kind

Declare the params first, and type the component from them with `PaneProps<typeof …>`. The orders file below does this:

```tsx
import { oneOf, optional } from "jali-layout";
import { definePane, type PaneProps } from "jali-layout/react";

const orderParams = { id: Number, tab: optional(oneOf("summary", "history")) };

function OrderDetail({ params }: PaneProps<typeof orderParams>) {
  // params is { id: number; tab?: "summary" | "history" }
  return <h3>Order {params.id}</h3>;
}

export const orderKind = definePane("order", {
  params: orderParams,
  title: ({ id }) => `Order ${id}`,
  Component: OrderDetail,
});
```

`PaneProps<{ id: number }>`, with the params' type written out, still works. `ParamsOf<typeof orderParams>` is the params' type alone.

### When a ref is missing a param

Links are written by people and by older versions of your app, so a ref can arrive without a required param, or with a value its type can't read (`"abc"` for a `Number`). Jali never passes such params to your component:

- A layout link (`?l=`) or a saved layout holding one is treated as broken, like any link that can't be read.
- A pane opened on a curated page is left out of the link it came in.
- A ref your own code opens shows a message in its pane, naming the param, instead of the component. Its title is the kind's name, and it stays out of Recent.

Params a kind doesn't declare are a type error in your code, but a link that carries them still opens: they reach the component as plain values.

Lists and dates are not param types: a link can't carry a list cleanly. Pass a date as text (`"2026-11-19"`) and read it in the component.

## The component's props

Jali passes these to `Component`:

| Prop | What it is for |
|---|---|
| `params` | What to show, typed by the kind's `params`. |
| `node` | The pane in the layout, with the full ref as `node.ref`. In the peek sheet it is a node that is not in the layout. |
| `paused` | True while the pane is hidden: behind a tab, tucked, folded, or behind a maximised pane. |
| `focused` | True while this pane has focus. |
| `inPeek` | True when rendered in the peek sheet rather than a pane. |
| `openBeside(ref)` | Open an object beside this pane. Focus stays here. A pane this one opened earlier for the same kind shows the new object instead. |
| `openHere(ref)` | Show another object in this same pane. If it is open elsewhere, that pane is focused instead. |
| `select(ref)` | Report the item a list is on. A detail that follows this list shows it once the cursor rests. |
| `peek(ref)` | Show an object in the peek sheet; `peek(null)` closes it. With a following detail of that kind on screen, the detail shows the object instead and no sheet opens. |
| `dismiss()` | Close this pane quietly, with no undo toast. For the launcher. |

`openBeside`, `openHere`, `peek` and `select` return what the same `jali.actions` return, an `ActionResult`: `openBeside(ref).pane` is the pane that shows the object, and `ok: false` comes with a `reason` when nothing happened.

A component deeper inside the pane reads the same props with `usePane()`, so you don't have to pass them down.

## The size of the content, and what scrolls

`Component` renders into a box that fills the pane under its header, with a definite width and height. So `height: 100%` works, and so do container queries on size: give your root `container-type: size` (with `height: 100%`) and lay out by `@container (max-height: 300px)`. The box follows the pane as it is resized, folded or maximised.

That box is also the pane's scroller (`overflow: auto`). Content taller than the pane scrolls it, and the pane's header stays put. For `position: sticky`, this means an element sticks to that scroller, with nothing between if your content is its direct child. If your content scrolls itself, give your root `height: 100%` and `overflow: auto`, and put the sticky element inside it. The outer box then has nothing to scroll, and your root is the scroller the element sticks to. The peek sheet has the same box.

## What a pane reports

Three hooks tell Jali about the pane they are called in:

- `useActivity("loading")` shows `"loading"`, `"working"`, `"live"`, `"needs-you"`, `"error"` or `"idle"` in the header, tab and shelf. Use `"working"` for work the person waits on. Use `"live"` for work that is meant to go on, such as a recording or playback: it shows a slowly breathing dot instead of a spinner, and reads "Live".
- `useUnsaved(dirty && "an unsaved note")` reports work the person would lose.
- `useCommands([...])` adds commands to ⌘K while the pane is focused.

The last two are covered in [Unsaved work and pane state](unsaved-work-and-pane-state.md).

## Controls in the header

A control that acts on the whole pane, such as Add, Refresh or a view switch, can sit in the pane's header rather than in a toolbar of your own. Call `useHeaderActions` with the controls, and Jali places them after the title and Following / Kept, before its own buttons:

```tsx
import { useCommands, useHeaderActions } from "jali-layout/react";
import { PlusIcon } from "@phosphor-icons/react";
import { NoteList, useAddNote } from "./notes";

function Notes() {
  const add = useAddNote();
  useCommands([{ id: "add", title: "Add a note", keys: "N", run: add }]);
  useHeaderActions(
    <button type="button" className="notes-add" aria-label="Add a note" onClick={add}>
      <PlusIcon aria-hidden />
    </button>,
  );
  return <NoteList />;
}
```

Jali gives the controls no style: they sit in `.jali-pane-tools`, so your CSS sizes them to the header. Pass them on every render, and pass `null` to take them away.

A header has little room, and the title comes first. In a narrow header, Jali's tuck, maximise and full screen buttons move into the pane's menu (⋯) first. If the title is still cut below a few characters, your controls are hidden too, and the menu lists the pane's commands in their place. That is why the example also gives Add as a command: every control should have one, so that a narrow pane, ⌘K and the keyboard all reach it. Keep the header for a few controls that act on the pane. Controls for the selected row belong with the rows. Keep titles short too: a title from `useTitle` that names a long record takes the header's room, and in an ordinary layout of four or five panes the controls move into ⋯. Put the detail in the pane, and keep the title to what tells the panes apart.

## Failures, loading and titles

Each pane's component renders inside its own error boundary and its own Suspense boundary. One pane that throws or waits for data never blanks the others.

**When a component throws,** that pane shows what failed, with a Retry button and a Close button. The layout keeps its shape. Retry mounts the component again, and it is also in ⌘K while the pane is focused. The pane's activity reads `"error"`. Showing another object in the pane clears the failure. Pass `onPaneError` to `createJali` to send the error to your reporting; by default it is logged in development.

```ts
import { createJali } from "jali-layout";
import { orderKinds, presets } from "./panes";
import { telemetry } from "./telemetry";

const jali = createJali({
  panes: orderKinds,
  presets,
  onPaneError: (error, { pane, ref }) => telemetry.report(error, { pane, kind: ref.kind }),
});
```

**When a component suspends** (it reads data with a Suspense query, or React 19's `use()`), the pane shows a quiet "Loading…" and its activity reads `"loading"`. Give the kind a `Loading` component to show something of your own. It gets the same props as `Component`.

**When the object isn't there,** show it in the kind's own way. Jali may get a ref whose params it can't read: a required one missing, or a value of the wrong type, from a layout in code, a saved layout or an action. That ref never reaches `Component`; Jali shows a message naming the param instead. Give the kind a `Missing` component to show your own instead. It gets the pane's props, with the params as they came, plus `problems` (what Jali couldn't read) and `close`. So it can explain what went wrong and offer a way on, such as a button that shows a list in the pane with `openHere`. A link that holds such a ref is refused as broken before it opens anything.

Params that read can still name nothing: a session that was deleted, an order from another account. Render the same component from `Component`, with no problems, so both cases look alike. In the peek sheet, which has no pane of its own, `openHere` is refused, so offer `close` there:

```tsx
import { definePane, useJali, type MissingProps, type PaneProps } from "jali-layout/react";
import { Session, library, useSession } from "./sessions";

const sessionParams = { id: String };

function NoSession({ problems, inPeek, openHere, close }: MissingProps) {
  return (
    <div role="status">
      <p>{problems.length ? "This link can't name a session." : "This session is gone."}</p>
      {inPeek ? (
        <button onClick={close}>Close</button>
      ) : (
        <button onClick={() => openHere(library())}>Show the library</button>
      )}
    </div>
  );
}

function SessionView(props: PaneProps<typeof sessionParams>) {
  const jali = useJali();
  const session = useSession(props.params.id);
  if (!session) {
    // In the peek sheet, close the peek; in a pane, close that pane.
    const close = () => (props.inPeek ? jali.actions.closePeek() : jali.actions.close(props.node.id));
    return <NoSession {...props} problems={[]} close={() => void close()} />;
  }
  return <Session session={session} />;
}

export const session = definePane("session", {
  params: sessionParams,
  title: ({ id }) => `Session ${id}`,
  Component: SessionView,
  Missing: NoSession,
});
```

**To name a pane from its data,** call `useTitle(name)` in the pane. "Ada Okafor" then replaces "Customer 7" in the header, the tab, the shelf, ⌘K and announcements. The kind's `title` comes back when the component unmounts, when the pane shows another object, or when you pass `null`. The title is not saved. In the peek sheet, the sheet's own content's `useTitle` names it first, then a pane showing the same object, then the kind's `title` ([`useTitle`](../reference/react.md#usetitle)).

`src/panes/customer.tsx`

```tsx
import { use } from "react";
import { definePane, useTitle, type PaneProps } from "jali-layout/react";

interface Customer {
  id: number;
  name: string;
  email: string;
}

// Your data layer. Keep one promise per customer, so a re-render reads the same one.
const requests = new Map<number, Promise<Customer>>();
function fetchCustomer(id: number): Promise<Customer> {
  if (!requests.has(id))
    requests.set(
      id,
      fetch(`/api/customers/${id}`).then((r) => {
        if (!r.ok) throw new Error(`Customer ${id} could not be loaded (${r.status})`);
        return r.json() as Promise<Customer>;
      }),
    );
  return requests.get(id)!;
}

function CustomerDetail({ params }: PaneProps<{ id: number }>) {
  const customer = use(fetchCustomer(params.id)); // suspends: the pane shows `Loading` until it resolves
  useTitle(customer.name); // "Ada Okafor" in the header, tab and ⌘K, rather than "Customer 7"
  return (
    <dl>
      <dt>Email</dt>
      <dd>{customer.email}</dd>
    </dl>
  );
}

export const customerKind = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`, // until the data names it, and in the peek sheet
  Loading: ({ params }) => <p>Loading customer {params.id}…</p>,
  Component: CustomerDetail,
});
```

**To mark a pane from its data,** call `usePaneAttributes` with `data-*` attributes, such as `{ "data-connection": "production" }` on a query that runs against production. Jali puts them on the pane, its tab, its shelf chip, its switcher entry, and the peek sheet while it shows the same object. It styles none of them, so your CSS decides what a production pane looks like: `[data-connection="production"] { border-top: 2px solid crimson; }`. Like a title, they go when the pane shows another object or closes, and are not saved.

## Pause hidden panes

Every pane in the layout stays mounted, even when it is folded or behind a tab, so its state survives. That also means its timers and subscriptions keep running. Stop live work while `paused` is true, and keep the state:

```tsx
import { useEffect } from "react";
import { usePane } from "jali-layout/react";
import { refresh } from "./orders";

function OrderStatus() {
  const { paused } = usePane();
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [paused]);
  return null;
}
```

With TanStack Query, pass `enabled: !paused`, and leave `subscribed` on. The hidden pane then fetches nothing, but still hears answers other panes fetch for the same query, so it shows them the moment it comes back, with no fetch and no loading state. Turning `subscribed` off too would leave it on whatever it last saw: a pane that shares a query with something on screen could come back "loading" for a read that finished long ago.

Some work is meant to go on while nobody looks at it: a recording, a stream, music playing. Keep that going while `paused`, and stop only what draws it (meters, a moving playhead). Report `useActivity("live")`, so the pane's tab, the shelf and the "N folded" chip show that it is still running.

## Lists: select, peek and open beside

A list pane tells Jali where its cursor is with `select(ref)`. Call it as the cursor moves. Then:

- the detail panes that follow this list show the item once the cursor rests, each one of its own kind if the kind has `follow`;
- Space can call `peek(ref)` to show it in a sheet;
- Alt+Enter can call `openBeside(ref)` to open it in a pane of its own.

Report the selection before opening it, so the opened pane is linked to the list. Keys are covered in [Commands and keys](commands-and-keys.md).

## The launcher

Split (⌘\\) and "New tab here" open a pane for the person to choose what goes in it: the launcher. Without one, Jali offers neither.

Define it like any kind, usually with `scratch: true`, and pass it as `launcher`. It closes quietly, and its component reads what to offer with `useLauncher()`: `recent` (objects opened this session), `isOpen(ref)` and `titleOf(ref)`. Choosing calls `openHere(ref)`, which fills the pane.

## Give the kinds to `createJali`

Pass every kind to `createJali`, and the launcher on its own. Each instance has its own kinds: nothing is shared between instances or tests.

```ts
import { createJali } from "jali-layout";
import { launcher, orderKinds, presets } from "./panes";

const jali = createJali({ panes: orderKinds, launcher, presets });
```

## The whole file

`src/panes/orders.tsx`

```tsx
import { useEffect, useState, type KeyboardEvent } from "react";
import { definePane, useLauncher, type PaneProps } from "jali-layout/react";
import { oneOf, optional } from "jali-layout";
import { ClipboardTextIcon, FileTextIcon, NoteIcon, PlusIcon } from "@phosphor-icons/react";

// Your data. Jali never fetches anything: a pane is told which object to show, and shows it.
interface Order {
  id: number;
  customer: string;
  total: string;
  status: string;
}
const ORDERS: Order[] = [
  { id: 1, customer: "Ada Okafor", total: "$120.00", status: "Paid" },
  { id: 2, customer: "Lin Park", total: "$48.50", status: "Shipped" },
  { id: 3, customer: "Sam Reyes", total: "$310.00", status: "Refunded" },
];

/** The list. J/K move the cursor, Space peeks, Alt+Enter opens the order beside the list. */
function OrderList({ select, peek, openBeside, paused }: PaneProps) {
  const [at, setAt] = useState(0);
  const [checkedAt, setCheckedAt] = useState(() => new Date());

  // Live work stops while the pane is hidden (behind a tab, tucked, folded or behind a maximised pane).
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCheckedAt(new Date()), 30_000);
    return () => clearInterval(timer);
  }, [paused]);

  const move = (to: number) => {
    const next = Math.max(0, Math.min(ORDERS.length - 1, to));
    setAt(next);
    select(orderKind({ id: ORDERS[next]!.id })); // a following detail shows it once the cursor rests
  };

  // Content first: claim the keys you use with preventDefault, and let the rest reach Jali.
  const onKeyDown = (e: KeyboardEvent) => {
    const order = orderKind({ id: ORDERS[at]!.id });
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "j" || e.key === "ArrowDown") move(at + 1);
    else if (e.key === "k" || e.key === "ArrowUp") move(at - 1);
    else if (e.key === " ") peek(order);
    else if (e.key === "Enter" && e.altKey) openBeside(order);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <ul role="listbox" aria-label="Orders" tabIndex={0} onKeyDown={onKeyDown}>
        {ORDERS.map((o, i) => (
          <li key={o.id} role="option" aria-selected={i === at} onClick={() => move(i)}>
            Order {o.id} · {o.customer} · {o.total}
          </li>
        ))}
      </ul>
      <p>Checked at {checkedAt.toLocaleTimeString()}</p>
    </div>
  );
}

// What an order pane shows: its id, read back as a number, so "1" in a link and 1 in code are the same order, and,
// optionally, which tab of the order is open. Declared first, so the component below is typed from it.
const orderParams = { id: Number, tab: optional(oneOf("summary", "history")) };

/** One order, read from its typed params: { id: number; tab?: "summary" | "history" }. */
function OrderDetail({ params }: PaneProps<typeof orderParams>) {
  const order = ORDERS.find((o) => o.id === params.id);
  if (!order) return <p>Order {params.id} was not found.</p>;
  if (params.tab === "history")
    return (
      <p>
        Order {order.id} was placed by {order.customer}.
      </p>
    );
  return (
    <dl>
      <dt>Customer</dt>
      <dd>{order.customer}</dd>
      <dt>Total</dt>
      <dd>{order.total}</dd>
      <dt>Status</dt>
      <dd>{order.status}</dd>
    </dl>
  );
}

export const orderList = definePane("orders", {
  title: "Orders",
  icon: ClipboardTextIcon,
  width: {
    min: 440, // narrower than this, the pane folds into a tab
    comfortable: 560, // spare room brings it up to here first
  },
  height: { min: 240 },
  holdWhileResizing: true, // a long list: keep it as it is during a divider drag, reflow on release
  Component: OrderList,
});

export const orderKind = definePane("order", {
  params: orderParams,
  title: ({ id, tab }) => (tab === "history" ? `Order ${id} history` : `Order ${id}`),
  icon: FileTextIcon,
  width: { min: 360, comfortable: 440, max: 600 }, // past max, spare room goes to the neighbours first
  height: { min: 200 },
  shows: "order", // another kind that shows orders counts as the same object
  identity: ({ id }) => id, // the open tab doesn't make it another order
  Component: OrderDetail,
});

export const customerKind = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => `Customer ${id}`,
  width: { min: 360, max: 600 },
  height: { min: 200 },
  Component: ({ params }) => <h3>Customer {params.id}</h3>, // no icon: Jali draws a plain square
});

/** A scratch pad: every one is new, so it is never matched against an open pane, and stays out of Recent. */
export const scratchNote = definePane("scratch", {
  title: "Scratch note",
  icon: NoteIcon,
  width: { min: 280 },
  scratch: true,
  Component: () => <textarea aria-label="Scratch note" />,
});

/** What Split and "New tab here" open until the person chooses: the `launcher`. */
export const launcher = definePane("launcher", {
  title: "New pane",
  icon: PlusIcon,
  width: { min: 320 },
  height: { min: 200 },
  scratch: true,
  Component: function Launcher({ openHere, dismiss }) {
    const { recent, titleOf } = useLauncher();
    return (
      <nav aria-label="Open in this pane">
        <button onClick={() => openHere(orderList())}>All orders</button>
        {recent.map((ref) => (
          <button key={JSON.stringify(ref)} onClick={() => openHere(ref)}>
            {titleOf(ref)}
          </button>
        ))}
        <button onClick={dismiss}>Cancel</button>
      </nav>
    );
  },
});

export const orderKinds = [orderList, orderKind, customerKind, scratchNote];
```

## Choose what people can do with panes

Turn a pane's controls on or off, open, close, tuck, maximise, full screen, move, resize, pin and pop out, for a kind, for every pane, or for one layout.

A pane can open others, and be closed, tucked, maximised, put full screen, moved, resized and pinned, and popped out into its own window. Not every app wants every one of these everywhere. With `allow`, your app decides, for a kind of pane, for every pane, or depending on the layout:

`src/jali.tsx`

```tsx
import { createJali, row } from "jali-layout";
import { definePane } from "jali-layout/react";

// What the content can handle: a toolbar can't fill a screen, so the kind says so.
const toolbar = definePane("toolbar", {
  title: "Tools",
  allow: { fullScreen: false },
  Component: () => <div>…</div>,
});
const report = definePane("report", {
  params: { id: Number },
  title: ({ id }) => `Report ${id}`,
  Component: () => <div>…</div>,
});

export const jali = createJali({
  panes: [toolbar, report],
  presets: [
    { id: "review", label: "Review", layout: () => row(toolbar(), report({ id: 1 })) },
    { id: "free", label: "Free", layout: () => row(report({ id: 1 }), report({ id: 2 })) },
  ],
  allow: {
    // For every pane: maximise, but not full screen.
    fullScreen: false,
    // It depends: on the Review layout, people arrange panes as they like but never remove one.
    when: ({ action, presetId }) =>
      !(presetId === "review" && (action === "close" || action === "tuck")),
  },
});
```

### The controls

| Control | What it covers |
|---|---|
| `open` | Opening new panes from it: a link (`openBeside`) shows its object in the peek sheet instead, and Split, New tab here, `addTab` and the peek's Open beside are refused. Showing another object in the same pane (`openHere`) isn't covered |
| `close` | Closing the pane: its ×, a tab's ×, middle-click, Delete on a tab, ⌘K, Close other tabs (which then leaves it open) |
| `tuck` | Tucking it into its neighbour |
| `maximise` | Maximising it (restoring is always allowed) |
| `fullScreen` | Putting it on the whole screen (leaving is always allowed) |
| `move` | Dragging it, the move keys, swapping, merging into tabs, pulling a tab out, reordering tabs |
| `resize` | The dividers beside it |
| `pin` | Pinning its tab |
| `popOut` | Popping it out into a floating window (with the `popOut()` feature) |

With every control that rearranges off, people can look without changing the layout. Links open as a peek, and nothing can be closed, moved, resized or tucked:

```tsx
import { createJali } from "jali-layout";

const viewer = createJali({
  panes,
  layout,
  allow: { open: false, move: false, resize: false, tuck: false, close: false },
});
```

Folding isn't a control: it is how a layout fits the room it has, so it always happens. Renaming has its own switch: the `rename({ can, run })` feature.

### Who decides

Three levels, and each can only take away. A control is allowed when none of them says `false`:

1. **Jali's own rules.** A lone pane has nothing to maximise into; a phone shows one pane at a time and has nothing to drag; a curated page has rules of its own.
2. **The kind**, `definePane("chart", { allow })`, for what its content can handle.
3. **Every pane**, `createJali({ allow })`: defaults for all panes, and `when`, a function asked for each action, with the pane, the preset the layout came from and the curated page, if one is open.

Everything is allowed by default. Pop out comes with its feature, `popOut()` from `jali-layout/pop-out`. Adding it also adds a Pop out button to the header, before Close, and **Pop out pane** (`pane.pop_out`) to ⌘K. It has no key until you bind one.

Because the levels only take away, `createJali({ allow })`'s `true` can't turn back on what a kind turned off. `when` is your code, not part of the layout, so the rule itself never travels in a link. What it reads can: a layout's preset and its panes come from the address. These controls shape what people are offered; they are not a security boundary. A rule that must hold, such as who may delete a record, belongs in your app's own checks too.

### What people see

Jali's actions check `allow` themselves, so every way of asking gets the same answer: a button, a key, ⌘K, a tab's menu, a drag, or an [agent](your-app.md#let-an-agent-arrange-panes). Each action names the controls it uses and on which panes (a swap, both panes; a divider, every pane beside it; Back to the page, every opened pane), and Jali asks them before anything else. Whatever offers an action asks the action's own check first, so nothing offers what the action would refuse.

- **Buttons and menu items** for a control that isn't allowed aren't drawn: no ×, no grip, no divider handle, no Pin tab. On a curated page, no drop target, ⌥ preview or ⌥-click hint for a view that can't be placed there.
- **⌘K** lists the command greyed out, with the reason ("Board can't be closed here").
- **Keys** are refused, and screen readers hear the same reason.
- **Agents** see what isn't allowed for each pane in their snapshot (`notAllowed`), and are refused if they ask.

For a decision that depends on the moment, such as unsaved work in your app's own data, use `beforeClose`, which is asked as the pane is about to close.

### Header buttons

`allow` decides what can happen; `buttons` decides which of those get a button in the pane's header. The buttons are shortcuts. Everything allowed is always in the pane's menu, which opens from a right-click on the header, from the ⋯ button, or with Shift+F10, and in ⌘K.

You don't have to set `buttons`. Jali's choice is Tuck, Maximise, Pop out (where it is allowed) and Close, with Full screen in Maximise's place on a lone pane, and only Close on a phone. A ⋯ button shows whenever the menu offers more than the buttons do, so nothing is out of reach on a touch screen.

To change them, give a list, which replaces Jali's, or a function, which adjusts them. A kind's `buttons` win over `createJali`'s:

```tsx
import { createJali } from "jali-layout";
import { definePane } from "jali-layout/react";
import { Chart } from "./chart-view";

// Charts: Jali's buttons, without Tuck (Tuck stays in the menu).
const chart = definePane("chart", {
  title: "Chart",
  buttons: (defaults) => defaults.filter((b) => b !== "tuck"),
  Component: Chart,
});

// Every other pane: only Maximise and Close.
const jali = createJali({ panes: [chart], layout: chart(), buttons: ["maximise", "close"] });
```

`allow` still filters the list: a button for something that isn't allowed isn't drawn. And the way out of a state always shows, whatever the list says: Restore while a pane is maximised, Exit full screen while it is full screen.

In a narrow pane, the title comes first. Before it gets shorter than a few characters, Tuck, Maximise, Full screen and Pop out move from the header into the pane's menu, where they keep their names and keys. Close and ⋯ stay. The header takes them back once there is room. `data-narrow` on the header and `data-count` on its buttons let a theme follow this (see [Parts](../reference/parts.md)).

A header holds, in order: the grip, the title (or tabs), Following / Kept, the pane's own controls, and these buttons. A pane's content puts its own controls there with `useHeaderActions` (see [Controls in the header](pane-kinds.md#controls-in-the-header)).

## Next

- [Lay out panes](layouts.md): put your kinds in the layouts your app opens on.
- [Unsaved work and pane state](unsaved-work-and-pane-state.md): a pane that edits something.
- [Examples](../examples.md): six apps' pane kinds, running.
