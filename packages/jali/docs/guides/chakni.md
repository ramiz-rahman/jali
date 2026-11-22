# Use Jali with Chakni

Let a list inside a pane drive the pane's following detail through the active-item port, and share one theme.

Chakni is Jali's sister library for collections, such as lists and tables, with Quick Look to show the item a list is on. Jali lays out the panes around them. The two meet in two places: the **active item** and the **theme**. Neither package imports the other.

> **Note: What works today.** Jali's side is built: the active-item port, and a Tailwind bridge that reads Chakni's token names. Chakni's side is not built yet. Chakni has no public port, and its collections don't accept one. Until then, the port drives any list you write yourself, as in the example below.

## The active item

The active item is the one item a list is on: its cursor, the row J and K move to. It is not the set of checked rows, and it is not DOM focus.

In Jali, a list reports its active item with `select(ref)`. A detail pane that follows the list shows it. In Chakni, a collection keeps its active item through a small port, and Quick Look shows it. The two are the same idea, so Jali implements Chakni's port shape for a pane:

```ts
interface ActiveItemPort {
  readonly itemId: string | null;
  readonly write: (itemId: string | null, action: "open" | "close" | "step") => { status: "accepted" };
}
```

The types match by shape, so a collection that takes this port works with Jali's, with no shared dependency.

## What each action does

- **`step`**: the cursor moved. The list's following detail shows the item once the cursor rests. An open peek sheet moves at once.
- **`open`**: show the item, for example on Space. If the list has a following detail on screen, the item shows there at once. Otherwise it opens in the peek sheet.
- **`close`**: stop showing it, for example on Esc. It closes a peek sheet this list opened. The cursor stays where it is.

`itemId` reads the cursor Jali has, whoever set it. It is `null` when Jali's selection is not one of this list's items.

## Make a port in a pane

`useActiveItemPort(mapping)` makes the port for the pane the component renders in. The mapping turns the collection's item ids into refs and back:

`src/panes/order-queue.tsx`

```tsx
import type { KeyboardEvent } from "react";
import type { ActiveItemMapping, ActiveItemPort } from "jali";
import { definePane, useActiveItemPort } from "jali/react";

const ORDER_IDS = ["1", "2", "3", "4"];

// Item ids are the collection's; refs are Jali's. The mapping turns one into the other.
// Keep it outside the component: the port keeps the mapping it was first given.
const orders: ActiveItemMapping = {
  toRef: (id) => ({ kind: "order", params: { id: Number(id) } }),
  idOf: (ref) => (ref.kind === "order" ? String(ref.params.id) : null),
};

/**
 * Any list that keeps its cursor through the port. A Chakni collection would take the port in place of this one,
 * once Chakni accepts it (not built yet).
 */
function CursorList({ ids, port }: { ids: string[]; port: ActiveItemPort | null }) {
  const at = port?.itemId ? ids.indexOf(port.itemId) : -1;
  const onKeyDown = (e: KeyboardEvent) => {
    if (!port || e.metaKey || e.ctrlKey || e.altKey) return;
    const step = e.key === "j" ? 1 : e.key === "k" ? -1 : 0;
    if (step) port.write(ids[Math.max(0, Math.min(ids.length - 1, at + step))] ?? null, "step");
    else if (e.key === " " && at >= 0) port.write(ids[at]!, "open");
    else return;
    e.preventDefault();
  };
  return (
    <ul role="listbox" aria-label="Orders" tabIndex={0} onKeyDown={onKeyDown}>
      {ids.map((id, i) => (
        <li key={id} role="option" aria-selected={i === at} onClick={() => port?.write(id, "step")}>
          Order {id}
        </li>
      ))}
    </ul>
  );
}

export const orderQueue = definePane("order-queue", {
  title: "Order queue",
  width: { min: 320 },
  height: { min: 240 },
  Component: function OrderQueue() {
    // The port for the pane this renders in; null in the peek sheet, which has no list of its own.
    const port = useActiveItemPort(orders);
    return <CursorList ids={ORDER_IDS} port={port} />;
  },
});
```

- `toRef(itemId)` gives the object an item shows.
- `idOf(ref)` gives the item id of an object, or `null` when it isn't one of this list's items.

The port is the same object for the pane's life, and it always uses the mapping of the latest render, so an inline mapping is fine.

The hook returns `null` in the peek sheet, which has no list of its own. The component re-renders when the list's item changes, so `itemId` is always fresh.

Outside React, `activeItemPort(jali, paneId, mapping)` from `jali` makes the same port.

## When Chakni accepts the port

The plan is for a Chakni collection in a Jali pane to take this port as where it keeps its Quick Look item. Its cursor would then drive the pane's following detail, with the actions above. The prop's name and the details are Chakni's to settle; this page will show them once they are built.

Chakni's docked rail is not built either.

## One theme for both

Jali's Tailwind bridge reads the token names Chakni reads: `--color-primary`, `--color-card`, `--color-border`, `--radius-card` and the rest. Import it, and an app themed for Chakni gets Jali in the same theme:

```css
@layer theme, base, jali, components, utilities;
@import "tailwindcss";
@import "jali/styles.css";
@import "jali/tailwind.css";
```

Jali's dark mode also follows Chakni's `.dark` and `.light` classes. See [Theming](theming.md).

## Next

- [Define a pane kind](pane-kinds.md): lists, `select` and the following detail.
- [Theming](theming.md)
