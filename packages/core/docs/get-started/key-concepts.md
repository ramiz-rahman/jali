# Key concepts

Every word Jali uses, defined in a sentence or two, most with an example or a picture.

Jali gives an app a workspace of panes: lists, records and editors side by side, which the person can open, move, resize and close. This page names the parts. Each term has its own link, and other pages link here the first time they use a word.

The examples use a support desk: a list of tickets, a ticket, the customer who sent it, and their orders.

## Panes and what they show

<h3 id="pane">Pane</h3>

A pane is one box in the workspace that shows one object, such as a ticket or a customer.

It has a header with its title, and it can be focused, moved, resized, put in tabs and closed. What is inside is your component.

<h3 id="kind">Kind</h3>

A kind is one sort of pane: its name, what it shows, its title, the smallest size it works at, and the component that draws it. You define one with `definePane`.

`ticket.tsx`

```tsx
import { definePane } from "@jali/react";
import { customer } from "./customer";
import { ticketById } from "./data";

export const ticket = definePane("ticket", {
  params: { id: Number },
  title: ({ id }) => `Ticket ${id}`,
  width: {
    min: 320, // narrower than this, the pane folds into a tab
    comfortable: 420, // spare room brings it here first
    max: 640, // past this, spare room goes to its neighbours first
  },
  height: { min: 200 },

  Component: ({ params, openBeside }) => {
    const t = ticketById(params.id);
    if (!t) return <p>Ticket {params.id} was not found.</p>;
    return (
      <article>
        <h3>{t.subject}</h3>
        <p>Status: {t.status}</p>
        <button onClick={() => openBeside(customer({ id: t.customer }))}>
          Customer {t.customer}
        </button>
      </article>
    );
  },
});
```

A kind is data plus a component. Each workspace has its own list of kinds (`createJali({ panes })`), so two workspaces on one page never share them.

<h3 id="ref">Ref</h3>

A ref is what a pane shows: a kind and a few params, small enough to put in a link. The kind makes its refs:

```ts
ticket({ id: 101 }) // { kind: "ticket", params: { id: 101 } }
```

Params are text, numbers and `true`/`false` only. Two refs show the same object when their kind and params match, with ids compared as text, so `101` and `"101"` are the same ticket. A kind can change that rule with `identity`, or say that two kinds show the same objects with `shows`.

## The layout

<h3 id="layout-tree">Layout tree</h3>

A layout is a tree. Its leaves are panes. Its other nodes are a **row** (children side by side), a **column** (children one above the other) or a **stack** (panes as tabs, one shown at a time).

`layouts.ts`

```tsx
import { column, pane, row, tabs } from "@jali/core";
import { customer, customerOrders } from "./customer";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

// A fixed-width list, and a column beside it: the ticket above, two tabs below.
export const triage = row(
  pane(ticketList({ queue: "open" }), { id: "list", px: 360 }),
  column(
    pane(ticket({ id: 101 }), { id: "detail", weight: 2, linkedTo: "list", follows: true }),
    tabs(customer({ id: 7 }), customerOrders({ customer: 7 })),
  ),
);

// One pane: the list alone.
export const listOnly = pane(ticketList({ queue: "open" }), { id: "list" });
```

Every node has a size along its parent: `weight: 2` takes a share of the room in proportion to its siblings, and `px: 360` asks for a fixed length. `row`, `column` and `tabs` build a plain JSON tree, and that tree is what goes in the address.

*Live demo on the site: A row with a column inside it. Hover a node to light its pane.*

<h3 id="overlay">Overlay</h3>

The overlay is a set of notes, kept beside the tree, about panes that are not shown in their own place. A pane can be **folded** (no room), **tucked** (the person put it away) or **hidden** (a curated page's view that is not on screen).

The tree itself never changes when a pane folds, tucks or hides. That is why a pane can always go back exactly where it was.

<h3 id="fitting">Fitting and folding</h3>

Each kind says the narrowest it works at (`width.min`). When the window is too narrow for every pane at its minimum, Jali folds panes into tabs of their neighbours, one at a time, instead of squeezing them. When room returns, they unfold.

*Live demo on the site: Narrow the frame: panes fold into tabs one at a time, and come back as it widens.*

A folded tab is marked as made by the layout: italic, with a fold icon. It needs nothing from the person. [How a layout fits](../learn/fitting.md) explains what folds first.

<h3 id="pane-cap">Pane cap</h3>

The pane cap is the most panes shown at once, 8 by default. Past it, the oldest pane that is not kept or focused becomes a tab, even when there is room.

<h3 id="single-view">Single view</h3>

When even one pane is too wide for the workspace at its minimum, as on a phone, the workspace shows one pane at a time with a switcher at the top. The layout itself is kept, and widening restores it.

<h3 id="tuck">Tuck and the shelf</h3>

Tucking puts a pane away by hand: it becomes a tab of a neighbour (its home), and the home takes its space. Nothing else on screen moves.

A tucked tab has a **Put back** button that restores its slot. The shelf, `<Shelf />`, lists tucked panes by home, then folded ones; you place it in your own chrome, such as a status line.

*Live demo on the site: The shelf lists what is tucked and what is folded.*

## Working in panes

<h3 id="focus">Focus</h3>

One pane at a time holds workspace focus, marked by an accent edge. Keys and commands act on it.

F6 and Shift+F6 move focus between panes. Opening a pane beside keeps focus where it was, so the person keeps working in the list they opened from.

<h3 id="peek">Peek</h3>

A peek is a sheet over the right of the workspace that shows an object without adding a pane. It is not part of the layout.

In a list, Space usually opens it. From the sheet, **Open beside** opens the object as a pane and **Open full** makes it the only pane. Esc closes it.

<h3 id="selection">Selection and the following detail</h3>

A list reports its selected item with `select(ref)`. A detail opened from that item follows the list: move the selection and the detail shows the new item, in place.

The detail waits until the selection rests for 150ms, so holding J doesn't load every row on the way. [Following a list](../learn/following.md) has the rules.

<h3 id="linked">Linked and kept</h3>

A pane opened from another is linked to it (`linkedTo`). A plain link, such as a customer name in a ticket, replaces the earlier link of the same kind from the same pane instead of adding another pane.

A kept pane stays on its object: it never follows and is never reused for another link, and it folds after panes that are not kept. **Keep** in a linked pane's header keeps it.

## Curated pages

<h3 id="curated-page">Curated page and profile</h3>

A curated page is a designed workspace about one item, such as a customer: a list of items at the left, a header, and tabs of views. A profile describes it: its views, what each shows for an item, and its designed layout.

Without a profile, the person builds the layout. With one, the page's design leads and the person adjusts it. [Curated pages](../learn/curated-pages.md) builds one.

<h3 id="role">Role</h3>

A role is one view of a curated page, such as Orders, and a tab in its tab strip. A role is **primary** or **supporting**; supporting views give way first when room runs out.

<h3 id="single-and-split">Single and Split view</h3>

**Single** shows one view at a time, chosen from the tabs, and links open as a peek. **Split view** lets the person lay views out side by side, starting from the profile's design. The person chooses; the mode and their layout stay on their device.

<h3 id="investigation">Investigation</h3>

In Split view, following a link opens an **opened** pane after the page's views. The opened panes together are the investigation. **Back to** the page closes them and returns the layout to how it was before the first link.

<h3 id="viewers">Viewers</h3>

A profile can name two kinds of viewer. One has full access: they may work in Split view and open links beside. The other works in Single and opens links as a peek.

## The workspace and its ports

<h3 id="store">Workspace and actions</h3>

A workspace holds its layout, focus, selection, settings and history. You make it with `createJali`, and everything it does is an action on it.

`actions.ts`

```tsx
import { ticket } from "./ticket";
import { jali } from "./store";

// Everything the workspace can do is an action. The pane id comes from the layout.
jali.actions.openBeside("list", ticket({ id: 103 }));
jali.actions.focus("detail");
jali.actions.preset("list");

// Read state, or subscribe to it.
const unsubscribe = jali.subscribe(() => console.log(jali.get().view.focused));
unsubscribe();
```

Every action is a pure function from one state to the next; the workspace commits the result, writes the address and announces the change to screen readers.

<h3 id="presets">Presets</h3>

A preset is a layout the person can switch to, by id and label. The first opens by default, ⌘K lists them as "Layout: …", and Reset layout rebuilds the last one chosen.

```ts
presets: [{ id: "triage", label: "Triage", layout: triage }]
```

<h3 id="ports">Ports: the address and storage</h3>

A port is a small interface for something outside the workspace, so your app or a test can own it.

- The **location** port is the address. Jali reads and writes only its own search params and keeps every other param as it is. The default is the browser's history; an app with a router passes a small adapter.
- The **storage** port is what one person keeps on one device: settings, pane state, a curated page's mode. The default is `localStorage` under a prefix.

`workspace.ts`

```tsx
import { createJali } from "@jali/core";
import { customer, customerOrders, order } from "./customer";
import { listOnly, triage } from "./layouts";
import { ticket } from "./ticket";
import { ticketList } from "./ticket-list";

export const jali = createJali({
  // The kinds of pane this workspace can show. Each workspace has its own.
  panes: [ticketList, ticket, customer, customerOrders, order],
  // Layouts to start from, in ⌘K as "Layout: Triage". The first opens when no link says otherwise.
  presets: [
    { id: "triage", label: "Triage", layout: triage },
    { id: "list", label: "One list", layout: listOnly },
  ],
  // What this person keeps on this device (settings, pane state, sizes): localStorage under this prefix.
  storage: "support-desk",
  // Rebind or unbind commands. Ids not listed keep their default keys.
  keymap: { "pane.close": "Mod+K Mod+X", "pane.zoom": null },
});
```

`url: { location: memoryLocation() }` and `storage: memoryStorage()` keep both in memory, for tests and for a workspace that must not touch the page's address.

<h3 id="sizes-in-links">Sizes in links</h3>

`url: { sizes }` chooses what a link says about sizes. `"local"`, the default, writes the layout as designed and keeps the sizes the person dragged on their device. `"link"` writes every size, so a link reopens exactly as the sender saw it.

## The pane contract

<h3 id="unsaved-work">Unsaved work</h3>

A pane reports work the person would lose with `useUnsaved("an unsaved reply")`, and clears it with `null`. While it is set, closing the pane, a preset, Back, or showing another object in it asks "Discard unsaved changes?" first.

Moving, tabbing, folding and tucking never ask: the pane's content stays mounted, so the work stays too.

<h3 id="pane-state">Pane state</h3>

`usePaneState(key, initial)` is like `useState`, but the workspace keeps the value through folds, tabs, tucks and reloads. It goes when the pane closes for good or shows another object. Values must be JSON.

```tsx
const [sort, setSort] = usePaneState("sort", { column: "id", dir: "asc" });
```

<h3 id="paused">Paused</h3>

A pane gets `paused: true` while it is out of sight: behind a tab, tucked, folded or behind a maximised pane. It should pause live work, such as polling, and keep its state.

<h3 id="commands">Commands and the keymap</h3>

A command is something the workspace can do, with an id such as `pane.close`. The keymap binds keys to commands; ⌘K (Ctrl+K) opens the command palette and starts a two-key chord, such as ⌘K ⌘Z to restore a closed pane.

Each workspace has its own keymap. Rebind or unbind a command with `createJali({ keymap: { "pane.zoom": null } })`. Your app adds its own commands with `createJali({ commands })`, and a pane adds its own to ⌘K with `useCommands`.

<h3 id="content-first">Content first</h3>

Keys go to the pane's content first. Content claims a key with `event.preventDefault()`, and the workspace leaves it alone; every key the content does not claim bubbles to the workspace. Single letter keys, Enter, Space and the first Esc belong to the content.
