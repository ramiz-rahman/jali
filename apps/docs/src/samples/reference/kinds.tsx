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
