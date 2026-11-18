import { createRoot } from "react-dom/client";
import {
  boot, browserStorage, createPaneKinds, createUiStore, createUrlSync, installKeyboard, type UiStore, type UrlSync,
} from "@jali/core";
import { Jali, JaliView } from "@jali/react";
import "@jali/react/styles.css";
import { orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";
import { ticketNote } from "../unsaved/note-editor";

// The orders workspace: the address's plain params (l, zoom, peek), localStorage keys "orders:…".
const ordersStorage = browserStorage("orders");
const ordersUrl = createUrlSync({ storage: ordersStorage });
const orders = createUiStore({
  id: "orders", // DOM ids "orders-pane-…"
  kinds: createPaneKinds(orderKinds),
  presets,
  url: ordersUrl,
  storage: ordersStorage,
});

// The notes workspace: params "n.l", "n.zoom", "n.peek", localStorage keys "notes:…".
const notesStorage = browserStorage("notes");
const notesUrl = createUrlSync({ prefix: "n.", storage: notesStorage });
const notes = createUiStore({
  id: "notes",
  kinds: createPaneKinds([ticketNote]),
  initial: {
    layout: { version: 1, root: { id: "note", type: "pane", size: { weight: 1 }, ref: { kind: "ticket-note", params: { id: 42 } } } },
  },
  url: notesUrl,
  storage: notesStorage,
});

boot(orders);
boot(notes);

// Keys: each store takes only keys from inside its own root, and keys on the page body when it was used last.
const rootOf = (store: UiStore) => () => {
  const root = store.dom.root(); // the document until <Jali> has rendered
  return root instanceof Element ? root : null;
};
installKeyboard(orders, { root: rootOf(orders) });
installKeyboard(notes, { root: rootOf(notes) });

// Back and Forward: each workspace reads its own params again.
const followHistory = (store: UiStore, url: UrlSync) =>
  url.onPop(() => {
    const read = url.read(store.env.kinds.registry());
    if (read && "layout" in read) store.actions.arrive(read.layout, read.view);
  });
followHistory(orders, ordersUrl);
followHistory(notes, notesUrl);

createRoot(document.getElementById("root")!).render(
  <div className="page">
    <Jali store={orders} className="orders"><JaliView /></Jali>
    <Jali store={notes} className="notes"><JaliView /></Jali>
  </div>,
);
