# Start from presets

Give the workspace named layouts to open on and switch between.

A preset is a named layout: "Orders", "Orders and detail", "Customer desk". The workspace opens on one, ⌘K lists them all, and the person can switch at any time. Your app can switch too.

## Write a layout

A [layout](../get-started/key-concepts.md#layout-tree) is a tree of rows, columns, tabs and panes. Write it the way it looks:

- `row(a, b)` puts its children side by side; `column(a, b)` stacks them top to bottom.
- `tabs(a, b)` puts panes as tabs in one place, the first shown.
- A child is a ref (`orderKind({ id: 12 })`), or `pane(ref, options)` when the pane needs options, or another row, column or tabs.
- Options go first: `column({ weight: 2 }, a, b)`. `weight` shares the room with siblings (default 1); `px: 480` asks for a fixed length.

Every node gets an id, named after what it holds (`"orders"`, `"row"`, `"order-2"`). Give one yourself with `id` when something refers to it: a pane that another one links to, or one your code focuses.

A pane opened from a list can follow it. Give it `linkedTo` (the list's pane id) and `follows: true`, and it shows whatever the list's cursor is on.

## Write the presets

`src/layouts.ts`

```tsx
import { column, pane, row, tabs, type PresetOptions } from "jali";
import { customerKind, orderKind, orderList } from "../pane-kinds/orders";

export const presets: PresetOptions[] = [
  {
    id: "orders",
    label: "Orders",
    layout: orderList(),
  },
  {
    id: "triage",
    label: "Orders and detail",
    layout: row(
      pane(orderList(), { id: "orders", weight: 1.4 }),
      // Shows whichever order is selected in "orders", and follows the cursor.
      pane(orderKind({ id: 1 }), { id: "order", linkedTo: "orders", follows: true }),
    ),
  },
  {
    id: "customer-desk",
    label: "Customer desk",
    layout: row(
      pane(orderList(), { id: "orders", px: 480 }),
      column(customerKind({ id: 7 }), tabs(orderKind({ id: 12 }), orderKind({ id: 15 }))),
    ),
  },
];
```

A preset's `layout` can also be a function, to build a fresh layout each time it is chosen.

Sizes are a starting point. With weights, each pane first gets its kind's `width.min`, then spare room brings it up to `width.comfortable`, then it is shared by weight. Panes that don't fit fold into tabs. See [Define a pane kind](pane-kinds.md) for the widths. A tab group (`tabs(...)`) is as narrow as its widest tab allows: every tab must fit in it, whichever one is shown, so a group holding a chart that needs 360px never goes below 360px.

### A pane in more than one preset

Give a pane the same `id` in two presets, showing the same object, and it is the same pane in both. Switching between them keeps it mounted: its [pane state](unsaved-work-and-pane-state.md#keep-the-panes-own-state) and its unsaved work come along, and the switch doesn't ask, because nothing is lost. A half-written order ticket stays half-written when the person moves to another layout that has the ticket.

If the other preset has that id showing another object, or doesn't have it, the switch asks first when the pane has unsaved work, and the pane starts afresh there.

A list that is in both presets keeps its selection. When the new preset puts a follower beside it, the list and the follower agree, and the preset's word wins: a follower of the selected item's kind resets the list's selection to what the preset gives it. The person sees the item the preset names. If the preset gives the list no follower of that kind, its followers show the list's selection. See [A new layout beside a list](../learn/following.md#a-new-layout-beside-a-list).

## Give them to the workspace

`src/workspace.ts`

```tsx
import { createJali } from "jali";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "./layouts";

export const jali = createJali({
  panes: orderKinds,
  presets, // in menu order: ⌘K lists each one as "Layout: <label>"
  preset: "triage", // the one to open on when the address has no layout. Default: the first
});

// Switch from your own buttons or menus. With unsaved work in a pane that would go, the person is asked first.
export const showCustomerDesk = () => jali.actions.preset("customer-desk");
// Rebuild the preset in use, as ⌘K "Reset layout" does.
export const resetLayout = () => jali.actions.resetLayout();
```

- `presets` is the list, in menu order. ⌘K shows each as "Layout: *label*".
- `preset` is the one to open on. Without it, the first. A link with a layout in it wins over both: see [Keep the layout in the URL](url-and-routers.md).
- `jali.actions.preset(id)` switches. If a pane that would go has unsaved work, the person is asked first.
- `jali.actions.resetLayout()` rebuilds the preset in use, as written. ⌘K "Reset layout" does the same.
- `jali.get().presetId` is the preset in use, the last one chosen. A layout link names it (`preset=` beside `l=`), so a colleague who opens the link has the same preset marked in your menu, and Reset rebuilds it.

Switching to a preset is a new step in the browser's history, so Back returns to the layout before it.

## Your own preset menu

Jali lists presets in ⌘K. If you want them in your top bar too, read them from the workspace. Render this inside `<JaliRoot>`:

`src/PresetMenu.tsx`

```tsx
import { useJali, useJaliState } from "jali/react";

/** The presets as buttons in your own top bar. Render it inside <JaliRoot>. */
export function PresetMenu() {
  const { env, actions } = useJali();
  const current = useJaliState((s) => s.presetId);
  return (
    <nav aria-label="Layouts">
      {env.presets.map((p) => (
        <button key={p.id} aria-pressed={p.id === current} onClick={() => actions.preset(p.id)}>
          {p.label}
        </button>
      ))}
    </nav>
  );
}
```

## Save a person's layout

To keep each person's layout on your server, save it when it changes and give it back when the workspace is made:

```ts
const saved = await api.loadLayout(user.id); // what you saved last time, or null
const jali = createJali({ panes, presets, ...(saved ? { layout: saved } : {}) });

jali.on("layout", ({ layout, source }) => {
  if (source === "action") void api.saveLayout(user.id, layout);
});
```

- `"layout"` fires once per change. `source` is `"action"` for the person's own changes and `"address"` for Back, Forward or a link. `action` names the action that made it (`"resetLayout"`, `"preset"`), when one did. Fitting to a new window size does not fire it.
- `jali.getLayout()` is the layout on screen, as JSON, at any time.
- A link in the address still wins over `layout`, so a shared link opens what was shared.
- A layout that arrives after the workspace is made goes through `jali.setLayout(saved)`. It fits the layout to the room, asks before losing unsaved work, and adds a history entry, so Back returns. It returns `{ ok: false, reason: "invalid" }` for a layout with a pane kind the workspace no longer has.

## Keep each preset as it was left

By default, choosing a preset builds its layout afresh, so a person who rearranges one preset, moves to another and comes back finds their changes gone. To bring each preset back as it was left, keep its layout as it changes and give it back with `saved`:

```ts
const left = new Map<string, LayoutInput>(); // or localStorage, or your server
const jali = createJali({
  panes,
  presets: presets.map((p) => ({ ...p, saved: () => left.get(p.id) })),
});

jali.on("layout", ({ layout }) => {
  const id = jali.get().presetId;
  if (id) left.set(id, layout);
});
```

- `saved` is asked every time the preset is chosen: from your menu, ⌘K or a key. Return `undefined` to build `layout`.
- "Reset layout" (`jali.actions.resetLayout()`) always builds the preset's own `layout`, so the person can get back to it.
- A saved layout naming a pane kind the workspace no longer has is ignored, and `layout` is built.
- The switch is still one step in history, and still asks before losing unsaved work.

The Markets example keeps its desks this way, in `localStorage`, with a button that resets every desk.

## No presets: one starting layout

A workspace that doesn't need presets passes one `layout`. It needs one or the other: with neither, `createJali` throws.

`src/workspace.ts`

```tsx
import { createJali } from "jali";
import { orderKinds, orderList } from "../pane-kinds/orders";

// A workspace with no presets opens on one layout: here, the order list alone.
export const jali = createJali({
  panes: orderKinds,
  layout: orderList(),
});
```

Without presets, ⌘K "Reset layout" is unavailable.

## Let Jali arrange the panes

When the panes a person opened have piled up, `jali.actions.autoLayout()` arranges them from the room there is and each kind's size hints, with no layout to write. It puts as many panes side by side as fit, linked panes next to each other, and adds a second row only for what doesn't fit across. The rest become tabs of the pane they were opened from, so a detail stays with its list. It keeps the same panes, so nothing reloads, and Back returns to the arrangement before. People find it in ⌘K as "Arrange panes automatically". See [Auto layout](auto-layout.md) for how it decides.

```tsx
<button onClick={() => jali.actions.autoLayout()}>Tidy up</button>
```

An agent can call it too, or leave the workspace to arrange itself after each of its turns: see [Let an agent use the workspace](agents.md).

## Next

- [Keep the layout in the URL](url-and-routers.md)
- [Test a workspace](testing.md): presets make good fixtures.
