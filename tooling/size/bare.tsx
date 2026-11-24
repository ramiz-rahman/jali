/** Size scenario: the floor. One kind of pane and a starting layout, with no feature at all: what every app ships.
 *  Each feature's scenario (tooling/size.mjs) is this plus that feature. */
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import "jali-layout/styles.css";

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
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
