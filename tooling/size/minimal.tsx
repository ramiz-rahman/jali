/** Size scenario: examples/minimal without its fonts. One kind of pane, a starting layout, the address
 *  (`urlSync()`), no curated page, no launcher. */
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali";
import { JaliRoot, definePane } from "jali/react";
import { urlSync } from "jali/url";
import "jali/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params, openBeside }) => (
    <button onClick={() => openBeside(note({ id: params.id + 1 }))}>Note {params.id}</button>
  ),
});

const jali = createJali({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
  features: [urlSync()],
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
