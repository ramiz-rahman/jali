import { definePaneKind } from "@jali/react";

// A list of orders, and one order. Each kind says what it shows, its title and the narrowest it works at.
export const ordersKind = definePaneKind({
  kind: "orders",
  title: () => "Orders",
  ref: (params) => ({ kind: "orders", params }),
  minWidth: 320,
  minHeight: 200,
  Component: ({ select, openBeside }) => (
    <ul role="listbox" aria-label="Orders">
      {[1041, 1042, 1043].map((id) => {
        const ref = { kind: "order", params: { id } };
        return (
          <li key={id} role="option" aria-selected={false} onClick={() => select(ref)} onDoubleClick={() => openBeside(ref)}>
            Order {id}
          </li>
        );
      })}
    </ul>
  ),
});

export const orderKind = definePaneKind({
  kind: "order",
  title: (ref) => `Order ${ref.params.id}`,
  ref: (params) => ({ kind: "order", params }),
  minWidth: 280,
  comfortableWidth: 420,
  maxWidth: 720,
  minHeight: 200,
  Component: ({ ref }) => <article>Order {ref.params.id}</article>,
});

// Split and "New tab here" open a pane of kind "launcher" until the person chooses what to show.
export const launcherKind = definePaneKind({
  kind: "launcher",
  title: () => "New pane",
  ref: (params) => ({ kind: "launcher", params }),
  transient: true,
  identity: () => undefined,
  minWidth: 240,
  minHeight: 160,
  Component: ({ recent = [], openHere, titleFor }) => (
    <ul aria-label="Recent">
      {recent.map((r, i) => <li key={i}><button onClick={() => openHere(r)}>{titleFor?.(r) ?? r.kind}</button></li>)}
    </ul>
  ),
});
