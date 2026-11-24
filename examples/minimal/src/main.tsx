/** The smallest Jali app: one kind of pane, a starting layout, and the workspace filling the window. */
import { createRoot } from "react-dom/client";
import { createJali } from "jali";
import { JaliRoot, definePane } from "jali/react";
// The layer order is declared in index.html. Then the app's styles, Jali's, and its faces: Atkinson Hyperlegible
// Next and Mono.
import "./app.css";
import "jali/styles.css";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-mono/latin-400.css";
import { urlSync } from "jali/url";

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

// What Split (⌘\) and a stack's "+" open until the person chooses what to show. Without a launcher, those
// commands are simply not offered.
const launcher = definePane("launcher", {
  title: "New pane",
  scratch: true,
  Component: ({ openHere }) => (
    <nav className="note" aria-label="Open a note">
      <h3>Open a note</h3>
      {[1, 2, 3, 4, 5].map((id) => (
        <button key={id} onClick={() => openHere(note({ id }))}>
          Note {id}
        </button>
      ))}
    </nav>
  ),
});

// A workspace: its kinds of pane, the launcher, and the layout it opens on (note 1; its button opens the next). It is the whole
// page, so its panes are the page's <main> landmark.
//
// The small path: an app picks the features it uses, and ships only those. This one keeps its layout in the address
// (`urlSync()`: a link reopens it, Back and Forward step through it) and nothing else, so it has no ⌘K palette,
// Settings or chooser. `defaultFeatures()` from "jali/features" turns on all of Jali's usual ones in one line.
const jali = createJali({
  panes: [note],
  launcher,
  layout: note({ id: 1 }),
  landmark: "main",
  features: [urlSync()],
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} className="app" />);
