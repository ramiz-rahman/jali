/** The smallest Jali app: one pane kind, a starting layout, and the workspace filling the window. */
import { createRoot } from "react-dom/client";
import { boot, createPaneKinds, createUiStore, createUrlSync, startUi, type Layout } from "@jali/core";
import { Jali, JaliView, definePaneKind } from "@jali/react";
// The layer order is declared in index.html. Then the app's styles, Jali's, and its faces: Atkinson Hyperlegible
// Next and Mono.
import "./app.css";
import "@jali/react/styles.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-400.css";

// A pane kind: what it shows (a ref), its title, the smallest size it works at, and the component that renders it.
const note = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  minWidth: 240,
  minHeight: 160,
  Component: ({ ref, openBeside }) => (
    <article className="note">
      <h3>Note {ref.params.id}</h3>
      <button onClick={() => openBeside({ kind: "note", params: { id: Number(ref.params.id) + 1 } })}>Open the next note beside</button>
    </article>
  ),
});

// What Split (⌘\) and a stack's "+" open until the person chooses: a transient kind named "launcher" (the store's
// default; createUiStore({ launcher }) names another). Without one, those commands are simply refused.
const launcher = definePaneKind({
  kind: "launcher",
  title: () => "New pane",
  transient: true,
  recordable: false,
  minWidth: 240,
  minHeight: 160,
  Component: ({ openHere }) => (
    <nav className="note" aria-label="Open a note">
      <h3>Open a note</h3>
      {[1, 2, 3, 4, 5].map((id) => (
        <button key={id} onClick={() => openHere({ kind: "note", params: { id } })}>Note {id}</button>
      ))}
    </nav>
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
  kinds: createPaneKinds([note, launcher]),
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
