/** The smallest Jali app: one kind of pane, a starting layout, and the workspace filling the window. */
import { createRoot } from "react-dom/client";
import { createWorkspace, row } from "@jali/core";
import { Jali, definePane } from "@jali/react";
// The layer order comes first (app.css), then Jali's styles, then its faces: Atkinson Hyperlegible Next and Mono.
import "./app.css";
import "@jali/react/styles.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-400.css";

// A kind of pane: what it shows (its params), its title, and the component that renders it.
const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,

  Component: ({ params, openBeside }) => (
    <article className="note">
      <h3>Note {params.id}</h3>
      <button onClick={() => openBeside(note({ id: params.id + 1 }))}>
        Open the next note beside
      </button>
    </article>
  ),
});

// A workspace: its kinds of pane, and the layout it opens on (two notes side by side).
const workspace = createWorkspace({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
});

createRoot(document.getElementById("root")!).render(<Jali workspace={workspace} className="app" />);
