# Commands and keys

Rebind the workspace's keys, share ⌘K and the keyboard with your app, let your content keep the keys it needs, and show the right shortcut.

Every workspace action is a command with an id, such as `pane.close` or `pane.zoom`. ⌘K opens the palette, which lists them all. A keymap binds ids to keys, and each workspace has its own.

## The default keys

⌘K (Ctrl+K on Windows and Linux) opens the palette and starts a two-step chord: hold ⌘, press K, then the second key. Most pane commands are ⌘K then a second key with ⌘ still held, so the second key never types into the palette's search.

| Command | Keys on a Mac | Elsewhere |
|---|---|---|
| Open the palette | ⌘K | Ctrl+K |
| Focus next / previous pane | F6 / ⇧F6 | F6 / Shift+F6 |
| Focus the pane left, right, up, down | ⌘K ⌘←, ⌘→, ⌘↑, ⌘↓ | Ctrl+K Ctrl+Left, … |
| Move the pane | ⌘K ⇧⌘← and so on | Ctrl+K Ctrl+Shift+Left, … |
| Maximise or restore | ⇧⌘↵, or ⌘K ⌘M | Ctrl+Shift+Enter, or Ctrl+K Ctrl+M |
| Close pane | ⌘K ⌘⌫ | Ctrl+K Ctrl+Backspace |
| Undo last close or tuck | ⌘K ⌘Z | Ctrl+K Ctrl+Z |
| Split right / down | ⌘\\ / ⌘K ⌘\\ | Ctrl+\\ / Ctrl+K Ctrl+\\ |
| Tuck / put back | ⌘K ⌘[ / ⌘K ⌘] | Ctrl+K Ctrl+[ / Ctrl+K Ctrl+] |
| Resize mode (arrows, then Esc) | ⌘K ⌘R | Ctrl+K Ctrl+R |
| Add to tabs of… / Move out of tabs | ⌘K ⌘G / ⌘K ⇧⌘G | Ctrl+K Ctrl+G / Ctrl+K Ctrl+Shift+G |
| Move tab left / right | ⌘K ⇧PageUp / ⌘K ⇧PageDown | Ctrl+K Shift+PageUp / Ctrl+K Shift+PageDown |
| Rename (with `rename`) | F2 | F2 |

Every command and its id is in the [Commands reference](../reference/commands.md). Esc closes the peek sheet, then restores a maximised pane, once the content has had its turn.

In a tab strip, ← and → move focus between the tabs (Home and End to the ends) and Enter or Space shows the focused one. A focused tab takes two keys of its own: Delete or Backspace closes it, and on a tucked tab ⌘K ⌘] puts that tab back. Closing this way asks about unsaved work, as the close button does. A tab's close and put back buttons are for the pointer: they are not in the Tab order, and screen readers hear the keys in the tab's description instead.

## Rebind and unbind

Pass `keymap` to `createJali`. Each entry is a command id and its new bindings:

`src/workspace.ts`

```tsx
import { createJali } from "jali";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

export const jali = createJali({
  panes: orderKinds,
  presets,
  keyboard: {
    keymap: {
      "pane.close": "Mod+K Mod+X", // rebind: replaces the default
      "pane.zoom": ["Mod+Shift+Enter", "Mod+K Mod+Enter"], // several bindings: the first is the one shown
      "pane.split.down": null, // unbind
      "palette.toggle": ["Mod+K", "Mod+Shift+Space"], // the palette
      "pane.close_others": "Mod+K Shift+Mod+Backspace", // a command with no default key
    },
    // A refused binding (a bare letter, three steps, an unknown key) is reported here. Default: console.warn.
    onInvalid: (id, binding, reason) =>
      console.error(`Keymap: ${id} "${binding}" ignored: ${reason}`),
  },
});

// What a tooltip or menu prints: "⌘K ⌘X" on a Mac, "Ctrl+K Ctrl+X" elsewhere; "" when unbound.
export const closeLabel = jali.keymap.label("pane.close");
```

- A string or a list of strings replaces the defaults for that id. The first binding is the one tooltips and the palette show.
- `null` unbinds it. The command stays in the palette.
- Ids you don't list keep their defaults.
- A command with no default key, such as `pane.close_others`, can be bound too.
- The palette itself is in the keymap as `"palette.toggle"`.

Write keys the way people read them. `Mod` is ⌘ on a Mac and Ctrl elsewhere; `Ctrl` is the Control key everywhere. A space separates the two steps of a chord: `"Mod+K Mod+X"`. Letters, digits and punctuation match the physical key, so a binding means the same key on any keyboard layout.

Some bindings are refused, and reported through `keyboard.onInvalid` (by default, a console warning):

- a single printable key with no ⌘, Ctrl or Alt, such as `"J"`: those belong to the focused content;
- a sequence of more than two steps;
- a key or modifier Jali doesn't know.

Avoid keys the browser keeps for itself, such as ⌘W, ⌘T and ⌘N: the browser acts before the page sees them.

`keyboard.platform` (`"mac"` or `"other"`) fixes how keys are matched and printed. Pass it in tests and on the server.

## Content first

A key goes to the focused content before the workspace. That way a list can use J and K, and an editor can use Enter and ⌘Z.

1. **Your content sees the key first.** To keep it, call `event.preventDefault()` (or stop it bubbling). The workspace then leaves it alone.
2. **The workspace acts on what's left:** the keymap's bindings, then Esc.

So claim the keys you use and let the rest through. The orders list in [Define a pane kind](pane-kinds.md) does this:

`src/panes/orders.tsx`

```tsx
import { useEffect, useState, type KeyboardEvent } from "react";
import { definePane, useLauncher, type PaneProps } from "jali/react";
import { oneOf, optional } from "jali";
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

  // Content first: claim the keys you use with preventDefault, and let the rest reach the workspace.
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

/** What Split and "New tab here" open until the person chooses: the workspace's `launcher`. */
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

Single character keys (J, K, Space) must act only while your content has focus. Put the handler on the focused element, as above, not on `window`.

### Space in lists

Jali binds no single keys. By convention its lists use Space or Shift+Space to peek, each in its own `onKeyDown`. An app that wants Space for itself (play and pause, say) should listen on `window` in the bubble phase, so content has had its turn, and skip the key when `keyBelongsToContent(event)` is true. That check is true in text fields, editable regions, comboboxes, dialogs, and on buttons, tabs and other controls that Space presses.

```ts

window.addEventListener("keydown", (e) => {
  if (e.key === " " && !e.defaultPrevented && !keyBelongsToContent(e)) togglePlayback();
});
```

If a list in your app should keep peek, move the app's key to another one, as Studio does with Shift+Space for peek.

## Content that needs every key

An editor or a terminal needs every key, ⌘K included. Mark it `data-pane-keys="content"`. Inside it, the workspace takes only F6 and ⇧F6, so a keyboard user can always move focus out.

`src/panes/reply.tsx`

```tsx
import { definePane } from "jali/react";

/**
 * An editor needs every key, so it marks itself: inside it, the workspace takes only F6 and Shift+F6, so focus can
 * always leave. Here ⌘K goes to the editor and does not open the palette.
 */
export const replyKind = definePane("reply", {
  params: { id: Number },
  title: ({ id }) => `Reply to ticket ${id}`,
  width: { min: 360 },
  height: { min: 220 },

  Component: ({ params }) => (
    <div data-pane-keys="content" className="reply-editor">
      <textarea aria-label={`Reply to ticket ${params.id}`} />
    </div>
  ),
});
```

## Show the right shortcut

Your keymap may differ from the defaults, and the keys print differently on each platform. Read the label from the workspace instead of writing it by hand:

`src/CloseButton.tsx`

```tsx
import { useJaliShortcut, useJali } from "jali/react";

/** A button in your own chrome that runs a workspace action and shows the workspace's key for it. */
export function CloseButton() {
  const { actions } = useJali();
  const keys = useJaliShortcut("pane.close"); // "⌘K ⌘⌫", or "" when unbound
  return (
    <button onClick={() => actions.close()} title={keys ? `Close pane · ${keys}` : "Close pane"}>
      Close {keys ? <kbd>{keys}</kbd> : null}
    </button>
  );
}
```

- `useJaliShortcut(id)` gives "⌘K ⌘⌫" on a Mac and "Ctrl+K Ctrl+Backspace" elsewhere, or `""` when the command is unbound.
- Outside React, `jali.keymap.label(id)` does the same.

For keys your content handles itself, `keyHint("Mod+Enter")` prints them the same way ("⌘↵" or "Ctrl+Enter").

## Your app's own commands

Commands that belong to your app rather than to one pane, such as "Refresh orders", go in `createJali({ commands })`. They are listed in ⌘K after the workspace's, and `keymap` binds them like any other:

`src/workspace.ts`

```tsx
import { createJali, type Command } from "jali";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

// Your app's own commands: listed in ⌘K after Jali's, under a group of your own.
const commands: Command[] = [
  {
    id: "orders.refresh",
    title: "Refresh orders",
    group: "Orders",
    run: () => void fetch("/api/orders/refresh", { method: "POST" }),
  },
  {
    id: "orders.export",
    title: "Export orders as CSV",
    group: "Orders",
    run: () => window.open("/api/orders.csv"),
  },
];

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  commands,
  // Bound like any of Jali's commands.
  keyboard: { keymap: { "orders.refresh": "Mod+K Mod+U" } },
});
```

Give them ids of your own (`orders.refresh`), not one of Jali's prefixes. If an id repeats one of Jali's, Jali's wins.

### Commands that ask for something

Some commands need an argument first: "Open chart for…", "Open latest order for…". Call `jali.actions.choose` in the command's `run`, with the items to choose from. Jali's chooser opens over the workspace, the same dialog as "Add to tabs of…": the person types to filter, moves with the arrow keys, presses Enter to choose and Esc to close. Screen readers hear a field over a list of choices, as in ⌘K.

`src/commands.ts`

```tsx
import type { Command } from "jali";
import { orderKind } from "../pane-kinds/orders";

interface Customer {
  id: number;
  name: string;
  city: string;
}
declare const customers: Customer[];
declare function latestOrderOf(customer: Customer): number;

// "Open latest order for…": asks for a customer in Jali's chooser, then opens their latest order.
export const openLatestOrder: Command = {
  id: "orders.latest-for",
  title: "Open latest order for…",
  group: "Orders",
  run: (jali) =>
    jali.dialogs.choose({
      title: "Open latest order for…",
      items: customers,
      label: (c) => c.name,
      hint: (c) => c.city,
      placeholder: "Customer name or city",
      onChoose: (c) => {
        const focused = jali.get().view.focused;
        if (focused) jali.actions.openBeside(focused, orderKind({ id: latestOrderOf(c) }));
      },
    }),
};
```

- `label` names each item in the list, and `hint` adds words beside it. Typing matches both, and items whose label starts with the text come first.
- `onChoose` gets the chosen item once the chooser has closed and focus is back in the pane it came from. Esc, or a click outside, chooses nothing.
- `current` is the item in use, one of `items` itself (compared with `Object.is`). The chooser opens with it selected and marks its row with `data-current`, `aria-current="true"` and a tick.
- `title` names the dialog and its field. The title, labels, hints and `placeholder` are your words. Jali's own (the default placeholder, the list's name for screen readers, and "Nothing matches") are `messages.chooser`, so they follow your translation; see [Translate Jali](translating.md).
- A key or button of your own can run the same command: `runCommand(jali, "orders.latest-for")`.

## Inside an app with its own ⌘K and keys

Most apps already have a command menu on ⌘K and shortcuts of their own. Three options let Jali fit in, and the rule below says who gets a key when both want it.

`src/workspace.ts`

```tsx
import { createJali } from "jali";
import { launcher, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { chooser } from "jali/chooser";
import { settings } from "jali/settings";
import { urlSync } from "jali/url";

export const jali = createJali({
  panes: orderKinds,
  launcher,
  presets,
  // No palette() among the features: your app's ⌘K menu lists Jali's commands (HostCommandMenu.tsx)
  features: [urlSync(), settings(), chooser()],
  keyboard: {
    prefix: "Mod+J", // Jali's two-step keys start with ⌘J: ⌘J ⌘Z restores a closed pane
    reserved: ["Mod+K", "Mod+/", "Mod+Shift+F"], // your app's own: Jali never binds these
    scope: "local", // only keys pressed inside the panes
    // Each of Jali's bindings that a reserved key pushed out is reported here, once, at start-up.
    onInvalid: (id, binding, reason) =>
      console.warn(`Jali: ${id} "${binding}" not bound: ${reason}`),
  },
});
```

### One command menu: yours

Leaving `palette()` out of the workspace's features tells Jali your app has the command menu. Jali renders no palette and leaves ⌘K alone. `useJaliCommands()` gives your menu everything Jali's palette would have listed: the focused pane's own commands first, then the workspace's and your own `commands`, each with its `title`, `group`, `keys` label, whether it is `disabled` now and the `reason`, and `run`.

`src/HostCommandMenu.tsx`

```tsx
import { useState } from "react";
import { useJaliCommands } from "jali/react";

/**
 * Jali's commands inside your app's own command menu. This is a plain list; with cmdk, each entry becomes a
 * <Command.Item> and `run` goes in `onSelect`. Render it inside <JaliRoot>, next to your app's own commands.
 */
export function HostCommandMenu({ onClose }: { onClose: () => void }) {
  const commands = useJaliCommands(); // the focused pane's own first, then the workspace's
  const [query, setQuery] = useState("");
  const shown = commands.filter((c) =>
    `${c.title} ${c.group}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div role="dialog" aria-label="Commands">
      <input
        aria-label="Search commands"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul role="listbox" aria-label="Commands">
        {shown.map((c) => (
          <li
            key={c.key}
            role="option"
            aria-selected={false}
            aria-disabled={c.disabled}
            title={c.reason}
          >
            <button
              disabled={c.disabled}
              onClick={() => {
                onClose(); // close first: some commands move focus into a pane
                c.run();
              }}
            >
              {c.title} <small>{c.group}</small> {c.keys ? <kbd>{c.keys}</kbd> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Close your menu before calling `run`: some commands move focus into a pane. Outside React, `listCommands(jali)` returns the same list; read it again after `jali.subscribe` calls back.

### Move Jali's keys off yours

Jali's two-step keys all start with one prefix, ⌘K by default. `keyboard: { prefix: "Mod+J" }` moves every one of them at once, so ⌘K ⌘Z becomes ⌘J ⌘Z, and the palette's own key with them. Bindings you write in `keymap` are used as you wrote them. Without `palette()`, the prefix still starts a chord; it just opens nothing on its own.

`keyboard.reserved` lists keys your app uses for itself. Jali drops any of its bindings that is one of them or starts with one, and reports each to `keyboard.onInvalid` when the workspace is made. So a clash shows up once, in the console at start-up, instead of when someone presses the key. Jali can't see your app's shortcuts, so name them here.

### Who gets a key

1. **Whoever handles the key first and calls `event.preventDefault()` keeps it.** Jali listens on `window`, so a handler on your document, your chrome or an element runs before it, and Jali leaves a key it finds handled alone. That is the same rule your pane content follows.
2. **The second step of a chord is Jali's.** Once someone has pressed the prefix, Jali takes the next key before anything else (in the capture phase), so ⌘K ⌘Z never also runs your app's ⌘Z.
3. **With `keyboard: { scope: "local" }`, keys pressed outside the panes are never Jali's**, apart from keys pressed with nothing focused right after using the panes. In an app where the panes are one region among many, use it.

Jali's defaults already stay out of the way: no single letters (they belong to whatever has focus), no keys the browser keeps (⌘W, ⌘T, Ctrl+Tab), no Ctrl+Alt and no ⌘ with a digit. Its only direct keys are F6, ⇧F6, ⌘\\ and ⇧⌘↵.

## A pane's own commands

A pane can add its own commands to ⌘K while it is focused, such as "Save note" or "Run query", with `useCommands`. Their keys are labels only: the content handles the key. See [Unsaved work and pane state](unsaved-work-and-pane-state.md#add-the-panes-commands-to-k).

## Next

- [Two workspaces on one page](two-workspaces.md): keep each workspace's keys inside it.
- [Commands reference](../reference/commands.md)
