/** Size scenario: the floor and a curated page (`definePage` from jali/page), with no feature. */
import { createRoot } from "react-dom/client";
import { createJali, pane, row } from "jali";
import { JaliRoot, definePane } from "jali/react";
import { definePage } from "jali/page";
import "jali/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});
const Icon = () => null;

const notes = definePage({
  id: "notes",
  name: "Notes",
  itemNoun: "note",
  roles: [
    { id: "body", label: "Body", priority: "primary", icon: Icon },
    { id: "next", label: "Next", priority: "supporting", icon: Icon },
  ],
  home: "body",
  firstItem: 1,
  bind: (item) => ({ body: note({ id: item }), next: note({ id: item + 1 }) }),
  build: (item) =>
    row(
      pane(note({ id: item }), { id: "body", role: "body", priority: "primary" }),
      pane(note({ id: item + 1 }), { id: "next", role: "next", priority: "supporting" }),
    ),
  Header: ({ item }) => <h1>Note {item}</h1>,
});

const jali = createJali({ panes: [note], page: notes });

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
