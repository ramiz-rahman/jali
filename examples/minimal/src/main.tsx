/** The smallest Jali app: one pane kind, a starting layout, and the workspace filling the window. */
import { createRoot } from "react-dom/client";
import { boot, createPaneKinds, createUiStore, createUrlSync, startUi, type Layout } from "@jali/core";
import { Jali, JaliView, definePaneKind } from "@jali/react";
import "@jali/react/styles.css";
import "./app.css";

// A pane kind: what it shows (a ref), its title, the smallest size it works at, and the component that renders it.
const note = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  ref: (params) => ({ kind: "note", params }),
  minWidth: 240,
  minHeight: 160,
  Component: ({ ref, openBeside }) => (
    <article className="note">
      <h3>Note {ref.params.id}</h3>
      <button onClick={() => openBeside({ kind: "note", params: { id: Number(ref.params.id) + 1 } })}>Open the next note beside</button>
    </article>
  ),
});

// A layout is a tree: rows and columns of panes, each pane showing one ref.
const start = (): Layout => ({
  version: 1,
  root: {
    id: "root", type: "row", size: { weight: 1 }, children: [
      { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } },
      { id: "b", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 2 } } },
    ],
  },
});

const store = createUiStore({
  kinds: createPaneKinds([note]),
  presets: [{ id: "start", label: "Start", build: start }],
  url: createUrlSync(),
});
boot(store);
startUi(store);

createRoot(document.getElementById("root")!).render(
  <Jali store={store} className="app">
    <JaliView />
  </Jali>,
);
