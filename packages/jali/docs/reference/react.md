# jali/react

Every component, hook and type jali/react exports, with its props, defaults and what it returns.

React components and hooks for an instance made with [jali](core.md). React 18.2 or later (18 or 19) is a peer dependency; nothing else is. Jali's icons are in the package. See [Icons](#icons).

```sh
npm install jali
```

Styles: `jali/styles.css` is Jali's default theme and the instance's styles; `jali/theme.css` is the theme alone; `jali/tailwind.css` points the tokens at your Tailwind theme. See [Tokens](tokens.md).

## Start here

### JaliRoot

*component*, from `jali/react`

```ts
<JaliRoot jali={jali} icons? overlays? settingsExtra?>{children?}</JaliRoot>
```

Example, `App.tsx`:

```tsx
import { JaliRoot, JaliView, PageBar } from "jali/react";
import { store } from "./store";

// <JaliRoot> draws the panes and their dialogs. Your chrome goes inside it, with <JaliView /> where the panes go.
export function App() {
  return (
    <JaliRoot jali={store} className="app" overlays={<div id="toasts" />}>
      <header className="topbar" data-jali-chrome="">
        <strong>Sales desk</strong>
        <PageBar />
      </header>
      <JaliView />
    </JaliRoot>
  );
}
```

Draws an instance: its panes, "Discard unsaved changes?", the live region, and the dialogs of the features it has: the command palette (`palette()`), Settings (`settings()`) and the "Add to tabs of…" chooser (`chooser()`). See [Features](features.md). While it is mounted, it starts the instance's keys, Back and Forward, theme and saving ([`Jali`](core/types.md#jali)'s `start`), and stops them when it unmounts.

`<JaliRoot jali={jali} />` is a whole app. To add your own chrome, pass children and put `<JaliView />` where the panes go.

The root is a `<div data-jali>` that the instance attaches to, so focus, drag and F6 stay inside it. The dialogs render after it, in a `<div data-jali-layer>` (styled `display: contents`), which counts as the instance's for its keys. Each dialog is modal: focus goes into it, Tab stays inside it, the root is `inert` while it is open, and focus goes back where it was when it closes. Mark your own chrome inside it with `data-jali-chrome` and Jali never pulls focus out of it.

Two things are yours to render. **The shelf** (tucked panes as chips): put `Shelf` in your status line or footer, or tucked panes have nowhere to come back from but ⌘K "Show a pane from the shelf". **Toasts**: Jali sends them as the `toast` event, `useJaliEvent("toast", show)` (closes and tucks come with Undo, which ⌘K ⌘Z also runs) and shows none itself; render them with your toaster in `overlays`.

**Props**

- **`jali`** (`Jali`, required): The instance, from `createJali`.

- **`children`** (`ReactNode`): Rendered inside the root: `<JaliView>` and your chrome.

- **`overlays`** (`ReactNode`): Rendered after the root: things that must sit outside the instance, such as a toaster. Focus is never pulled back from outside the root. While one of Jali's dialogs is open they are inert, as the instance behind it is, so a toast's Undo can't be reached until it closes; Jali's own announcements are still heard. They sit in an element of their own (`[data-jali-overlays]`, `display: contents`), so a toaster lays out as it would without it.

- **`icons`** (`Partial<JaliIcons>`): Your own icons for any of the names Jali draws (`{ close: MyClose }`); the others stay Jali's. See [Icons](#icons).

- **`settingsExtra`** (`ReactNode`): Your own settings, as `<fieldset>`s with a `<legend>`, shown at the end of the Settings panel. Store their values yourself. A row that is a radio or checkbox and its words matches Jali's as `<label className="jali-setting">` (the `settingRow` part).

- **`aria-label`** (`string`): The instance's name, over `createJali({ label })`, read at every render. It names Jali's landmark, and each landmark inside carries it.

- **`aria-labelledby`** (`string`): The id of a visible heading that names the instance; the landmarks inside carry its text.

- **`onError`** (`(error: unknown) => void`): Hears a throw in your code inside the root or in Jali's own parts. The root shows "… could not be shown" with Retry in place of what failed, and your app around it stays. A pane's own failures go to `onPaneError`.

- **`...rest`** (`HTMLAttributes<HTMLDivElement>`): Passed to the root `<div>` (`className`, `style`, `id`). `ref` and `data-jali` are Jali's.

### JaliView

*component*, from `jali/react`

```ts
<JaliView />
```

Example, `App.tsx`:

```tsx
import { JaliRoot, JaliView, Shelf } from "jali/react";
import { store } from "./store";

// Chrome of your own: children of <JaliRoot>, with <JaliView /> where the panes go. The root still renders the
// dialogs, the live region and the full-screen layer, and starts and stops the instance.
export function App() {
  return (
    <JaliRoot jali={store} className="app">
      <JaliView />
      <footer className="status">
        <Shelf />
      </footer>
    </JaliRoot>
  );
}
```

The panes, or the curated page while one is open. Takes no props. `<JaliRoot>` renders it when it has no children; place it yourself when you add chrome.

## Defining panes and pages

### definePane

*function*, from `jali/react`

```ts
definePane(kind: string, options: PaneOptionsReact): Pane
```

Example, `kinds.tsx`:

```tsx
import { definePane, useLauncher } from "jali/react";

// A list of orders, and one order. Each says what it shows, its title and the narrowest it works at.
export const ordersKind = definePane("orders", {
  title: "Orders",
  width: { min: 320 },
  height: { min: 200 },

  // A native list of buttons: Tab reaches each order, Enter or a click selects it, and a double-click opens it.
  Component: ({ select, openBeside }) => (
    <ul aria-label="Orders">
      {[1041, 1042, 1043].map((id) => (
        <li key={id}>
          <button
            type="button"
            onClick={() => select(orderKind({ id }))}
            onDoubleClick={() => openBeside(orderKind({ id }))}
          >
            Order {id}
          </button>
        </li>
      ))}
    </ul>
  ),
});

export const orderKind = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 280, comfortable: 420, max: 720 },
  height: { min: 200 },

  Component: ({ params }) => <article>Order {params.id}</article>,
});

// What Split and "New tab here" open until the person chooses: the `launcher`.
export const launcherKind = definePane("launcher", {
  title: "New pane",
  scratch: true,

  Component: ({ openHere }) => {
    const { recent, titleOf } = useLauncher();
    return (
      <ul aria-label="Recent">
        {recent.map((ref, i) => (
          <li key={i}>
            <button onClick={() => openHere(ref)}>{titleOf(ref)}</button>
          </li>
        ))}
      </ul>
    );
  },
});
```

Defines a kind of pane: what it shows (its params), its title and sizes, and the component that renders it. Pass your kinds to `createJali({ panes })`.

The result is also how you name an object of the kind: `orderKind({ id: 1041 })` is the [ref](../get-started/key-concepts.md#ref) `{ kind: "order", params: { id: 1041 } }`, to open, peek, select or put in a layout. When the kind declares `params`, the call is typed: a missing required param, a wrongly typed one or one the kind doesn't declare is a type error. Params are declared with `Number`, `String`, `Boolean`, [`oneOf`](core.md#oneof) and [`optional`](core.md#optional), imported from `jali`.

**Parameters**

- **`kind`** (`string`, required): The kind's name. Every pane of this kind carries it, and links name it.

- **`options`** (`PaneOptionsReact`, required):

Everything in [`PaneOptions`](core/types.md#paneoptions) (`params`, `title`, `width`, `height`, `shows`, `identity`, `scratch`, `inRecent`, `holdWhileResizing`, `follow`, `selects`), and:

**view fields**

- **`Component`** (`ComponentType<PaneProps<P>>`, required): Renders the pane's content. It stays mounted while the pane is folded, tabbed, tucked or moved.

- **`Loading`** (`ComponentType<PaneProps<P>>`): Shown while `Component` suspends (for example, it reads data with `use()`). It gets the same props. Default: a quiet "Loading…". The pane's activity is `"loading"` meanwhile.

- **`Missing`** (`ComponentType<MissingProps>`): Shown in place of `Component` when the pane's params can't be read: a required one missing, or a value its type can't read. It gets `MissingProps`, so it can explain in the kind's own words and offer a way on. Render it from `Component` too, for params that read but name nothing. Default: Jali's own message, naming the param.

- **`icon`** (`JaliIcon`): The kind's icon in the header, tab and shelf: any component that takes `{ size, className, "aria-hidden" }`, such as Phosphor's `FileTextIcon`, which matches Jali's own. Jali passes `size` and `aria-hidden`, never a weight, so your icon set's default or its context decides it. Without one, the `defaultKind` icon (a square).

**Returns** `Pane<P>`: The kind, callable: `(params) => ObjectRef`.

### Pane

*type*, from `jali/react`

```ts
type Pane<P = any> = PaneKindDef & {
  (params: P): ObjectRef;
  readonly kind: string;
}
```

A kind made with `definePane`. `P` is its params' type; `Pane` alone is any kind, for a list of them.

### PaneKindDef

*type*, from `jali/react`

```ts
interface PaneKindDef extends PaneKindBase {
  icon?: JaliIcon;
  Component: ComponentType<PaneProps<any>>;
  Loading?: ComponentType<PaneProps<any>>;
  Missing?: ComponentType<MissingProps>;
}
```

A kind as an instance keeps it: its options and its React parts. A `Pane` is one of these you can call.

### PaneOptionsReact

*type*, from `jali/react`

```ts
interface PaneOptionsReact<P> extends PaneOptions<P> {
  icon?: JaliIcon;
  Component: ComponentType<PaneProps<P>>;
  Loading?: ComponentType<PaneProps<P>>;
  Missing?: ComponentType<MissingProps>;
}
```

The options of `definePane`.

### MissingProps

*type*, from `jali/react`

```ts
interface MissingProps extends PaneProps<Params> {
  problems: readonly ParamProblem[];
  close: () => void;
}
```

What a kind's `Missing` gets: everything `PaneProps` has, with `params` as the ref gave them (a value Jali couldn't read stays as it came, a missing one is absent), and:

**Props**

- **`problems`** (`readonly ParamProblem[]`, required): Each param that is missing (`value` undefined) or holds a value its type can't read. Empty when your own `Component` renders `Missing` for params that read but name nothing.

- **`close`** (`() => void`, required): Close the pane, with Undo; in the peek sheet, close the peek.

It renders inside the pane, so the pane's hooks (`useTitle`, `useCommands`, `useActivity`) work in it.

### PaneProps

*type*, from `jali/react`

```ts
interface PaneProps<P = Params>
```

Example, `order-note.tsx`:

```tsx
import { useState } from "react";
import { definePane, useActivity, useCommands, useUnsaved, type PaneProps } from "jali/react";
import { FileTextIcon } from "@phosphor-icons/react";

// Declared before the component, so the component is typed from it: params is { id: number }.
const orderNoteParams = { id: Number };

function OrderNote({ params, paused }: PaneProps<typeof orderNoteParams>) {
  const [draft, setDraft] = useState("");
  // Unsaved work: closing or replacing this pane asks first while it is set.
  useUnsaved(draft && "a note that is not saved");
  // Commands in ⌘K while the pane is focused.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: "Mod+S",
      disabled: draft ? false : "Nothing to save",
      run: () => setDraft(""),
    },
  ]);
  // What the pane is doing, for its header, tab and the shelf.
  useActivity(paused ? "idle" : "working");
  return (
    <textarea
      aria-label={`Note on order ${params.id}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

export const orderNoteKind = definePane("order-note", {
  params: orderNoteParams,
  title: ({ id }) => `Note on order ${id}`,
  icon: FileTextIcon,
  width: { min: 280, max: 640 },
  Component: OrderNote,
});
```

What a kind's `Component` gets. Components below it read the same with `usePane`. To type a component written apart from its kind, declare the params first and pass their declaration: `const orderParams = { id: Number }`, then `PaneProps<typeof orderParams>` (`params` is `{ id: number }`). `PaneProps<{ id: number }>`, the params' own type, also works.

Keys: content first. Claim the keys you use with `event.preventDefault()` (J and K, Space, Enter, ⌘Z for your own undo, the first Esc) and let the rest bubble; single character keys must act only while your content has focus. Content that needs every key (an editor) marks itself `data-pane-keys="content"`; the instance then takes only F6 and Shift+F6 there.

**Props**

- **`params`** (`P`, required): What the pane shows, read with the kind's `params` types. A ref missing a required param, or holding a value its type can't read, never gets here: its pane shows the kind's `Missing`, or a message naming the param.

- **`node`** (`PaneNode`, required): The layout node, with the full ref (`node.ref`). In the peek sheet, a node that is not in the layout.

- **`paused`** (`boolean`, required): The pane is hidden: tabbed away, tucked, folded, or behind a maximised pane. Pause subscriptions and timers; keep state.

- **`focused`** (`boolean`, required): The pane has focus.

- **`inPeek`** (`boolean`, required): Rendered in the peek sheet rather than a pane.

- **`openBeside`** (`(ref: ObjectRef, options?: OpenBesideOptions) => ActionResult`, required): Open `ref` beside this pane; focus stays here. The selected item opens a following detail (kept if one already follows); another link replaces this pane's earlier plain link of the same kind. `{ edge: "bottom" }` opens it below this pane; any edge, as on screen (see [`OpenBesideOptions`](core/types.md#openbesideoptions)). Returns what `jali.actions.openBeside` does: `pane` is the pane that shows `ref`.

- **`openHere`** (`(ref: ObjectRef) => ActionResult`, required): Show `ref` in this pane. If it is open elsewhere, that pane is focused instead. In the peek sheet, which has no pane of its own, `{ ok: false, reason: "unavailable" }`.

- **`peek`** (`(ref: ObjectRef | null) => ActionResult`, required): Open or move the peek sheet; `null` closes it. When this pane has a following detail of the ref's kind on screen, the detail shows the item instead of the peek sheet, and no sheet opens (see [`JaliActions`](core/types.md#jaliactions)).

- **`select`** (`(ref: ObjectRef | null, options?: { inResults?: boolean }) => ActionResult`, required): Report the item a list is on. An open peek from this pane follows it at once; this pane's following detail once it rests. `{ inResults: false }`: the filter no longer shows `ref`. Report the selection before opening it, so the opened pane is linked to it.

- **`dismiss`** (`() => void`, required): Close this pane quietly, with no undo toast: for the launcher.

### definePage

*function*, from `jali/page`

```ts
definePage(page: Page): Page
```

Example, `loan-review.tsx`:

```tsx
import { FileTextIcon, UserIcon } from "@phosphor-icons/react";
import { pane, row } from "jali";
import { definePage } from "jali/page";
import { definePane } from "jali/react";

const borrower = definePane("borrower", {
  params: { application: Number },
  title: "Borrower",
  Component: () => null,
});
const documents = definePane("documents", {
  params: { application: Number },
  title: "Documents",
  Component: () => null,
});

// A curated page about one loan application: two views, a queue at the left and a header over the tabs.
export const loanReview = definePage({
  id: "loan-review",
  name: "Loan review",
  itemNoun: "application",
  viewers: { full: "credit reviewer", limited: "loan officer" },
  roles: [
    { id: "borrower", label: "Borrower", priority: "primary", icon: UserIcon },
    { id: "documents", label: "Documents", priority: "supporting", icon: FileTextIcon },
  ],
  home: "borrower",
  firstItem: 1,
  // What each view shows for an application.
  bind: (item) => ({
    borrower: borrower({ application: item }),
    documents: documents({ application: item }),
  }),
  // Split view's designed layout. A view's pane has the view's id as its id and its role.
  build: (item) =>
    row(
      pane(borrower({ application: item }), {
        id: "borrower",
        role: "borrower",
        priority: "primary",
      }),
      pane(documents({ application: item }), {
        id: "documents",
        role: "documents",
        priority: "supporting",
      }),
    ),
  Rail: ({ item, showItem }) => (
    <nav aria-label="Applications">
      {[1, 2, 3].map((n) => (
        <button key={n} aria-current={n === item} onClick={() => showItem(n)}>
          Application {n}
        </button>
      ))}
    </nav>
  ),
  Header: ({ item }) => <h1>Application {item}</h1>,
});
```

Defines a curated page: one item at a time (a loan application, a customer), its views as tabs, the item's header above the tabs (`Header`) and, optionally, a list of items at the left (`Rail`, which calls `showItem(item)` to show another). Pass it to `createJali({ page })`. It returns a copy of `page` that carries the code that runs a page and the parts that draw it. That code comes only with `definePage`, so an app without a curated page ships none of it.

**Returns** `Page`:

### Page

*type*, from `jali/page`

```ts
interface Page<I extends ItemId = any> extends ProfileBase<PageView, I> {
  Rail?: ComponentType<{ item: I; showItem: (item: I) => void }>;
  Header: ComponentType<{ item: I }>;
}
```

A curated page for React: [`ProfileBase`](core/types.md#profilebase) with its header and, if it has one, its rail. Without a `Rail`, the header, tabs and panes take the whole width. `I` is the item id's type, `number` or `string`, as in `firstItem`.

### PageView

*type*, from `jali/page`

```ts
interface PageView extends RoleBase { icon: JaliIcon }
```

One of a curated page's views, with the icon for its tab.

## Inside a pane

Each of these acts for the pane it is called in, from any depth inside the kind's component.

### usePane

*hook*, from `jali/react`

```ts
usePane(kind?: Pane): PaneProps<params of kind>
```

The pane's `PaneProps`, for components below the kind's own: `const { params, openBeside } = usePane(order)`, with `params` typed from the kind, no cast. In development, a component in a pane of another kind is an error. Without a kind, the params are plain values (`Params`), for a component any kind renders. Throws outside a pane.

**Returns** `PaneProps<P>`:

### useActivity

*hook*, from `jali/react`

```ts
useActivity(activity: PaneActivity | undefined): void
```

Report what the pane is doing (`"loading"`, `"working"`, `"live"`, `"needs-you"`, `"error"` or `"idle"`), for its header, its tab, the shelf and the status line. `"working"` is work the person waits for; `"live"` is ongoing, healthy work that is meant to go on, such as recording, streaming or playback, and reads "Live" rather than "Working". `undefined` clears it, the same as `"idle"`, and so does the component unmounting. Reported again whenever it changes.

Several components in a pane may each report: the pane shows the most pressing (error, needs you, working, loading, live), and one unmounting clears only its own.

### useUnsaved

*hook*, from `jali/react`

```ts
useUnsaved(what: string | null | false | undefined): void
```

Report unsaved work in words (`"an unsaved query"`), or a falsy value once it is saved, so `useUnsaved(dirty && "an unsaved note")` works. While a pane has some, closing it, closing others, a preset or showing another object in it asks first; a following detail keeps its object. Moving, tabbing, folding and tucking never ask. Cleared when the component unmounts.

Several components in a pane may each report: the pane has unsaved work while any of them has some, and the question lists every distinct text. One saving or unmounting clears only its own.

### useTitle

*hook*, from `jali/react`

```ts
useTitle(title: string | null | undefined): void
```

Name the pane from its data: `useTitle(customer.data?.name)` shows "Acme Ltd" rather than the kind's "Customer 12". While set, it replaces the kind's `title` in the header, the tab, the shelf, the palette, the switcher, announcements and `jali.model().title(id)`, and the peek sheet while it shows the same object. In a curated page, the view's label still names the pane, and this title is shown beside it. `null` or `undefined` goes back to the kind's title.

When several components in a pane set a title, the innermost one wins (after the first mount, the one mounted last); one unmounting goes back to the next.

It is cleared when the component unmounts and when the pane shows another object, then set again from the next render. It is not saved, so a reload shows the kind's title until the data loads.

In the peek sheet's own content, it names the sheet, for the object the sheet shows: on a curated page in Single view, where links peek, the sheet says "Acme Ltd" rather than "Customer 12" even when no pane shows that customer. The sheet takes, in order: its own content's `useTitle`, then that of a pane in the layout showing the same object, then the kind's `title`. Its own name goes when the sheet closes or shows another object.

### usePaneAttributes

*hook*, from `jali/react`

```ts
usePaneAttributes(attributes: Record<\`data-\${string}\`, string> | null | undefined): void
```

Mark the pane from its data with `data-*` attributes, so your styles can tell it apart: `usePaneAttributes({ "data-connection": "production" })` on a query pane connected to production. Jali puts them on everything that stands for the pane: its section, its tab in any strip (folded and tucked too), its shelf chip, its entry in the phone's pane switcher, the tab and shelf menus, and the peek sheet while it shows the pane's object. Jali gives them no style of its own.

When several components in a pane set attributes, the innermost one's are used (after the first mount, the one mounted last); one unmounting goes back to the next.

Only `data-*` names are kept, and not the ones Jali's own parts use (`data-pane`, `data-tab`, `data-focused`, `data-jali-*` and the rest). `null` or `undefined` clears them. They are cleared when the component unmounts and when the pane closes or shows another object, then set again from the next render. They are not saved. The peek sheet's own content can't set them.

### useHeaderActions

*hook*, from `jali/react`

```ts
useHeaderActions(controls: ReactNode): void
```

Put the pane's own controls in its header. Jali places them in `.jali-pane-tools`, in this order: the grip, the title (or tabs), Following / Kept, your controls, then Jali's buttons. Pass them on every render, like any JSX. `null` takes them away, as does the component unmounting. Each pane has one set, and the last call wins.

They render inside the pane's context, so the pane's hooks work in them, as do providers above `<JaliRoot>`. A provider inside your own component doesn't reach them.

A narrow header gives way before its title gets shorter than a few characters: first Jali's tuck, maximise, full screen and pop out move into the pane's menu, then your controls are hidden too (`data-narrow="tools"`) and the menu lists the pane's commands (`useCommands`) in their place. So give each control a command as well, or it can't be reached in a very narrow pane. The peek sheet has no header, so the controls aren't shown there.

### useCommands

*hook*, from `jali/react`

```ts
useCommands(commands: readonly PaneCommand[]): void
```

The commands this pane lists first in the palette while it is focused. Pass them on every render: they are listed again only when an id, title, keys label or disabled reason changes, and each runs the latest `run` it was given, so `run` can close over current state. Removed when the component unmounts.

Several components in a pane may each add commands: they are listed in render order (a parent's before its children's), the first of a repeated id kept, and one unmounting removes only its own.

### useLauncher

*hook*, from `jali/react`

```ts
useLauncher(): LauncherSources
```

For the instance's launcher: what the person can choose from.

**Returns** `LauncherSources`:

### LauncherSources

*type*, from `jali/react`

```ts
interface LauncherSources {
  recent: ObjectRef[];
  isOpen(ref: ObjectRef): boolean;
  titleOf(ref: ObjectRef): string;
}
```

Recent (newest first), whether an object is already open in another pane, and an object's title.

### usePaneState

*hook*, from `jali/react`

```ts
usePaneState<T>(key: string, initial: T, options?: PaneStateOptions<T>): [T, (next: T | ((prev: T) => T)) => void]
```

Example, `OrdersTable.tsx`:

```tsx
import { usePaneState } from "jali/react";

type Sort = { column: "id" | "total"; dir: "asc" | "desc" };

// Kept by Jali: through folds, tabs and reloads. Dropped when the pane closes or shows another object.
export function OrdersTable() {
  const [sort, setSort] = usePaneState<Sort>("sort", { column: "id", dir: "asc" });
  const flip = () => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }));
  return (
    <button onClick={flip}>
      Sorted by {sort.column}, {sort.dir}
    </button>
  );
}
```

State the instance keeps for a pane: it survives the pane being tabbed, folded, tucked or moved, and a reload (saved on this device 400 ms after it changes). It is dropped when the pane closes for good or shows another object, and when the person discards the pane's unsaved work. It belongs to the object the pane shows, not to the pane's id: a pane that shows another object under the same id (after a reload, or a new pane under a closed pane's id) starts from `initial`, and an undo that brings the pane back brings its state back. Use it for what a person expects back (a sort, a draft, a scroll position) and React state for the rest.

In the peek sheet there is no pane, so the state is local and goes with the sheet.

**Parameters**

- **`key`** (`string`, required): The value's name within the pane.

- **`initial`** (`T`, required): Used until a value is set. Read once, as with `useState`: a new object on each render doesn't change the value, and an updater's `prev` is the first `initial` while nothing is stored. Must be JSON.

- **`options`** (`PaneStateOptions<T>`): `parse`, to check what was stored before it is used as `T`.

**Returns** `[T, (next: T | ((prev: T) => T)) => void]`: The value, and a setter that takes a value or an updater. Values must be JSON.

### PaneStateOptions

*type*, from `jali/react`

```ts
interface PaneStateOptions<T> {
  parse?: (stored: unknown) => T | undefined;
}
```

How `usePaneState` reads a stored value. Stored state was written by an earlier version of the app, or edited by hand, so it isn't trusted as `T`: `parse` gets what storage held and returns the value to use, or `undefined` to use `initial`. A parse that throws counts as `undefined`. A rejected value stays stored until the pane sets its own. Each stored value is parsed once, so a parse that builds a new object still gives the same value on every render.

### useActiveItemPort

*hook*, from `jali/react`

```ts
useActiveItemPort(mapping: ActiveItemMapping): ActiveItemPort | null
```

Example, `OrdersPane.tsx`:

```tsx
import type { ActiveItemPort } from "jali";
import { useActiveItemPort } from "jali/react";
import { orderKind } from "./kinds";

// Any list that keeps its current item through an ActiveItemPort.
declare function OrderList(props: { activeItem: ActiveItemPort | null }): React.ReactNode;

export function OrdersPane() {
  const port = useActiveItemPort({
    toRef: (itemId) => orderKind({ id: Number(itemId) }),
    idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
  });
  return <OrderList activeItem={port} />;
}
```

The active-item port for the pane this content is in (see [`activeItemPort`](core.md#activeitemport)). Re-renders when the pane's selection changes, so `itemId` reads fresh.

**Parameters**

- **`mapping`** (`ActiveItemMapping`, required): `toRef(itemId)` and `idOf(ref)`. The port always uses the latest render's mapping and stays the same object, so an inline object is fine.

**Returns** `ActiveItemPort | null`: `null` in the peek sheet.

## The instance in React

### useJali

*hook*, from `jali/react`

```ts
useJali(): Jali
```

The instance from the nearest `<JaliRoot>`: its `actions`, `on`, `getLayout` and `setLayout`, `keymap`, `env` (kinds, presets, page) and state. Reading it does not subscribe; use `useJaliState` or `useJaliModel` for values that change. Throws outside `<JaliRoot>`.

**Returns** `Jali`:

### useJaliState

*hook*, from `jali/react`

```ts
useJaliState<T>(select: (s: JaliState) => T, isEqual?: (a: T, b: T) => boolean): T
```

Example, `StatusLine.tsx`:

```tsx
import { useJaliShortcut, useJali, useJaliModel, useJaliState } from "jali/react";

// A status line: reads exactly what it shows, so it re-renders only when that changes.
export function StatusLine() {
  const focused = useJaliState((s) => s.view.focused);
  const m = useJaliModel();
  const { actions } = useJali();
  const keys = useJaliShortcut("pane.zoom");
  return (
    <footer>
      {m.visible.length} panes on screen · {m.title(focused)}
      <button title={keys ? `Maximise · ${keys}` : "Maximise"} onClick={() => actions.toggleZoom()}>
        Maximise
      </button>
    </footer>
  );
}
```

Subscribes to one value of the state. The component re-renders when that value changes, compared with `isEqual` (`Object.is` unless given). A selector may return a new object or array; pass `shallow` to re-render only when one of its values changed.

**Parameters**

- **`select`** (`(s: JaliState) => T`, required): Picks the value.

- **`isEqual`** (`(a: T, b: T) => boolean`): Whether two picks are the same. Default `Object.is`.

**Returns** `T`:

### useJaliModel

*hook*, from `jali/react`

```ts
useJaliModel(): JaliModel
useJaliModel<T>(select: (m: JaliModel) => T, isEqual?: (a: T, b: T) => boolean): T
```

Example, `OpenPanes.tsx`:

```tsx
import { Activity, KindIcon, useJaliModel, useJaliState } from "jali/react";

// Your own list of open panes, with Jali's icon and activity marks.
export function OpenPanes() {
  const m = useJaliModel();
  const activity = useJaliState((s) => s.activity);
  return (
    <ul>
      {m.panes.map((p) => (
        <li key={p.id}>
          <KindIcon kind={p.ref.kind} size={14} /> {m.title(p.id)}{" "}
          <Activity activity={activity[p.id]} />
        </li>
      ))}
    </ul>
  );
}
```

The instance as it is on screen, subscribed: the panes, their boxes and titles, the groups, the shelf. A new object only when something it depends on changed (the layout, the maximised pane, the area, the kinds, the page or the pane cap); focus alone does not change it. With a selector, only what it picks, re-rendering when that changes by `isEqual`.

**Returns** `JaliModel`:

### useJaliEvent

*hook*, from `jali/react`

```ts
useJaliEvent(event: JaliEvent, handler: (e: JaliEvents[event]) => void): void
```

Hear one of the instance's events while the component is mounted: `useJaliEvent("open", ({ ref }) => …)`, `useJaliEvent("toast", show)`. It always calls the latest `handler`, so an inline function is fine, and stops listening on unmount. Typed by the app's instance once it is registered (`Register`). See [`JaliEvents`](core/types.md#jalievents).

### shallow

*function*, from `jali/react`

```ts
shallow<T>(a: T, b: T): boolean
```

The same keys (or items) with the same values by `Object.is`, one level deep: the equality for a selector that picks several values, `useJaliState((s) => ({ focused: s.view.focused, cap: s.settings.paneCap }), shallow)`.

### useJaliTheme

*hook*, from `jali/react`

```ts
useJaliTheme(): "light" | "dark"
```

The theme in use: the person's setting, or the system's when they chose "System". For a toaster or anything else of yours that needs to match.

### useJaliCommands

*hook*, from `jali/react`

```ts
useJaliCommands(): ListedCommand[]
```

Jali's commands for your app's own command menu, when the instance has no `palette()` feature: [`listCommands`](core.md#listcommands), re-rendering whenever the list can change (focus, the layout, what panes report). See [Commands and keys](../guides/commands-and-keys.md#inside-an-app-with-its-own-k-and-keys).

**Returns** `ListedCommand[]`:

### useJaliShortcut

*hook*, from `jali/react`

```ts
useJaliShortcut(id: string): string
```

A command's keys in this instance's keymap, for a tooltip ("⌘K ⌘[" or "Ctrl+K Ctrl+["); `""` when unbound. Safe to prerender: on a server and while the page hydrates it prints keys for `"other"` ("Ctrl+K Ctrl+["), since a server can't know the reader's platform, then React renders it again with the reader's. A page rendered only in the browser gets the reader's keys on its first render.

**Parameters**

- **`id`** (`string`, required): A command id.

**Returns** `string`:

## Parts

Chrome of your own goes inside `<JaliRoot>`, around `<JaliView />`: the root renders the dialogs, the live region and the full-screen layer for every way of using Jali. These parts are for that chrome; each must be inside `<JaliRoot>`, and none takes props unless shown.

### CuratedPage

*component*, from `jali/react`

```ts
<CuratedPage />
```

A curated page: the page's `Rail` at the left, when it has one; its `Header`, the page tabs and the panes beside it, or across the whole width without a rail. Renders only while a page is open (it reads it without checking).

### PageBar

*component*, from `jali/react`

```ts
<PageBar />
```

A curated page's controls, for your top bar: the Single / Split view switch (Split view disabled for a limited viewer), in Split view the "N opened panes" group with Back to the page, and Reset. Renders nothing while no page is open.

### Shelf

*component*, from `jali/react`

```ts
<Shelf />
```

The panes the person tucked, as chips grouped by home (with Put back), for a status line. Folded panes are not here: they wait behind their tab strip's **N folded** chip. Arrow keys move between chips, Enter shows one, Shift+Enter puts it back. Renders nothing when no pane is tucked.

### KindIcon

*component*, from `jali/react`

```ts
<KindIcon kind={kind} size={16} />
```

Example, `OpenPanes.tsx`:

```tsx
import { Activity, KindIcon, useJaliModel, useJaliState } from "jali/react";

// Your own list of open panes, with Jali's icon and activity marks.
export function OpenPanes() {
  const m = useJaliModel();
  const activity = useJaliState((s) => s.activity);
  return (
    <ul>
      {m.panes.map((p) => (
        <li key={p.id}>
          <KindIcon kind={p.ref.kind} size={14} /> {m.title(p.id)}{" "}
          <Activity activity={activity[p.id]} />
        </li>
      ))}
    </ul>
  );
}
```

A kind's icon at `size`, `aria-hidden`; the `defaultKind` icon (a square unless you replaced it) for an unknown kind or one without an icon.

**Props**

- **`kind`** (`string`, required): The kind's name.

- **`size`** (`number`): Pixels. Left out, the icon is sized as a pane title's, from `--jali-icon-header` + 2px (16px by default).

- **`className`** (`string`): Passed to the icon.

### Activity

*component*, from `jali/react`

```ts
<Activity activity={activity} shape? />
```

A pane's activity mark. Renders nothing for `idle` or `undefined`.

**Props**

- **`activity`** (`PaneActivity | undefined`, required): What the pane reported (`useActivity`).

- **`shape`** (`boolean`): `false`: a coloured dot labelled for screen readers ("Loading", "Working", "Live", "Needs you", "Error"). `true`: the shelf's mark, a shape as well as a colour (a ring for loading and working, a dot in a halo for live, breathing slowly, "!" for needs-you, a cross for error), hidden from screen readers.

### IconButton

*component*, from `jali/react`

```ts
<IconButton label="Copy link" onClick={copy}>{icon}</IconButton>
```

A button that is only an icon, drawn as Jali's header buttons are (the `iconButton` part, `.jali-icon-btn`): for your top bar, a pane's own controls or a sheet's close, so they match the instance in every theme. It is held down like Jali's controls (`data-pressed`) inside an instance.

```tsx
import { IconButton, JaliRoot } from "jali/react";
import { defaultIcons } from "jali/icons";
import { GearSixIcon } from "@phosphor-icons/react";

<IconButton label="Settings" onClick={() => jali.dialogs.openSettings()}>
  <GearSixIcon size={16} aria-hidden />
</IconButton>;
```

**Props**

- **`label`** (`string`, required): What it does, in words: its accessible name, and its tooltip unless `title` gives another.

- **`children`** (`ReactNode`, required): The icon, with `aria-hidden`.

- **`title`** (`string`): The tooltip, when it should say more than the name ("Copy link (⌘L)").

- **`className`** (`string`): Added after `jali-icon-btn`, for your own rules.

- **`type`** (`"button" | "submit" | "reset"`): The button's type.

- **`...rest`** (`ButtonHTMLAttributes<HTMLButtonElement>`): Every other prop of a `<button>` (`onClick`, `disabled`, `aria-pressed`, `ref`), passed on.

### IconButtonProps

*type*, from `jali/react`

```ts
interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> { label: string; children: ReactNode }
```

The props of `IconButton`.

### JaliRootProps

*type*, from `jali/react`

```ts
interface JaliRootProps extends HTMLAttributes<HTMLDivElement> {
  jali: Jali; children?: ReactNode; overlays?: ReactNode;
  settingsExtra?: ReactNode; icons?: Partial<JaliIcons>;
  onError?: (error: unknown) => void;
  "aria-label"?: string; "aria-labelledby"?: string;
}
```

The props of `JaliRoot`.

## Icons

Jali draws its own chrome icons from a map of names (`JaliIcons`). Its defaults are in the package (Phosphor's regular weight, copied, so you install no icon library), and `<JaliRoot icons>` replaces any of them. A kind's icon is the kind's own (`definePane({ icon })`). The host's buttons (your top bar, ⌘K, settings, a switcher) are yours and use your icons already. See [Your own icons](../guides/theming.md#your-own-icons).

```ts
 // Jali's icons; icons={...} replaces any of them
 // Jali's full set, to spread under your own
```

### JaliIcons

*type*, from `jali/react`

```ts
type JaliIcons = Record<JaliIconName, JaliIcon>
```

One icon per name Jali draws. `<JaliRoot icons>` takes any part of it; type your own set as `JaliIcons` to have the types check it names every icon.

- **`icons.close`**, `close: JaliIcon`: Close a pane, a tab, the peek and Settings. Default: Phosphor's `X`.

- **`icons.maximise`**, `maximise: JaliIcon`: Maximise a pane. Default: Phosphor's `ArrowsOutSimple`.

- **`icons.restore`**, `restore: JaliIcon`: Restore a maximised pane. Default: Phosphor's `ArrowsInSimple`.

- **`icons.fullScreen`**, `fullScreen: JaliIcon`: Put a pane on the whole screen. Default: Phosphor's `CornersOut`.

- **`icons.exitFullScreen`**, `exitFullScreen: JaliIcon`: Leave full screen. Default: Phosphor's `CornersIn`.

- **`icons.tuck`**, `tuck: JaliIcon`: Tuck a pane into the shelf. Default: Phosphor's `Minus`.

- **`icons.putBack`**, `putBack: JaliIcon`: Put a tucked or folded pane back, on its tab and shelf chip. Default: Phosphor's `ArrowUUpLeft`.

- **`icons.newTab`**, `newTab: JaliIcon`: A tab group's "New tab". Default: Phosphor's `Plus`.

- **`icons.more`**, `more: JaliIcon`: The tab-overflow menu's button. Default: Phosphor's `CaretDown`.

- **`icons.menu`**, `menu: JaliIcon`: The ⋯ button in a pane's header, which opens the pane's menu. Default: Phosphor's `DotsThree`.

- **`icons.popOut`**, `popOut: JaliIcon`: The Pop out button, when a pane's `buttons` include it (Bring back while popped out). Default: Phosphor's `PictureInPicture`.

- **`icons.current`**, `current: JaliIcon`: The shown tab in the tab-overflow menu. Default: Phosphor's `Check`.

- **`icons.fold`**, `fold: JaliIcon`: Marks a folded pane: the strip's **N folded** chip, and the tab of a folded pane while it is shown. Default: Phosphor's `ArrowsInLineHorizontal`.

- **`icons.grip`**, `grip: JaliIcon`: The drag handle on a pane's header. Default: Phosphor's `DotsSix`.

- **`icons.follow`**, `follow: JaliIcon`: A linked pane's toggle while it follows (**Following**). Default: Phosphor's `LinkSimpleHorizontal`.

- **`icons.keep`**, `keep: JaliIcon`: A kept pane's toggle (**Kept**). Default: Phosphor's `AnchorSimple`.

- **`icons.pin`**, `pin: JaliIcon`: A pinned tab's mark. Default: Phosphor's `PushPin`.

- **`icons.activityError`**, `activityError: JaliIcon`: The cross in an error activity mark (8px). Default: Phosphor's `X, bold`.

- **`icons.defaultKind`**, `defaultKind: JaliIcon`: A kind without an icon. Default: Phosphor's `Square`.

- **`icons.openBeside`**, `openBeside: JaliIcon`: The peek's "Open beside". Default: Phosphor's `SidebarSimple, mirrored`.

- **`icons.openFull`**, `openFull: JaliIcon`: The peek's "Open full". Default: Phosphor's `CornersOut`.

- **`icons.addToTabs`**, `addToTabs: JaliIcon`: Each group in the "Add to tabs of…" chooser. Default: Phosphor's `Stack`.

- **`icons.singleView`**, `singleView: JaliIcon`: A curated page's "Single view". Default: Phosphor's `Square`.

- **`icons.splitView`**, `splitView: JaliIcon`: A curated page's "Split view". Default: Phosphor's `SquareSplitHorizontal`.

- **`icons.back`**, `back: JaliIcon`: "Back to" the curated page. Default: Phosphor's `ArrowUUpLeft`.

- **`icons.reset`**, `reset: JaliIcon`: Reset a curated page's layout. Default: Phosphor's `ArrowCounterClockwise`.

- **`icons.dropLeft`**, `dropLeft: JaliIcon`: A drop that puts the pane left of its target. Default: Phosphor's `ArrowLeft`.

- **`icons.dropRight`**, `dropRight: JaliIcon`: A drop to the right. Default: Phosphor's `ArrowRight`.

- **`icons.dropTop`**, `dropTop: JaliIcon`: A drop above. Default: Phosphor's `ArrowUp`.

- **`icons.dropBottom`**, `dropBottom: JaliIcon`: A drop below. Default: Phosphor's `ArrowDown`.

- **`icons.dropSwap`**, `dropSwap: JaliIcon`: A centre drop that swaps the two panes. Default: Phosphor's `ArrowsLeftRight`.

- **`icons.dropTab`**, `dropTab: JaliIcon`: A centre drop that adds the pane as a tab. Default: Phosphor's `PlusSquare`.

### JaliIconName

*type*, from `jali/react`

```ts
type JaliIconName = "close" | "maximise" | "restore" | … | "dropTab"
```

The names above.

### JaliIcon

*type*, from `jali/react`

```ts
type JaliIcon = ComponentType<JaliIconProps>
```

An icon Jali can draw: any component that takes `JaliIconProps`. Also the type of a kind's `icon`.

### JaliIconProps

*type*, from `jali/react`

```ts
interface JaliIconProps {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}
```

What Jali passes an icon: its default size in pixels, the class that sizes it from its place's token (`--jali-icon-header`, `-tab`, `-menu` or `-shelf`; put it on the icon's element), and `aria-hidden` (a label always sits beside it, or on its button).

### defaultIcons

*constant*, from `jali/icons`

```ts
const defaultIcons: JaliIcons
```

Jali's icon for every name: Phosphor's regular weight, copied into the package. Spread it under a few of your own (`{ ...defaultIcons, close: MyClose }`), or draw your own chrome with it.

### useJaliIcons

*hook*, from `jali/react`

```ts
useJaliIcons(): JaliIcons
```

The icons this instance draws with, for chrome of your own that should match Jali's: `const { close } = useJaliIcons()`. Inside `<JaliRoot>`.
