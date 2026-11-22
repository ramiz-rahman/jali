import { definePane } from "jali/react";

// A kind of pane: what it shows (its params), its title, and the component that renders it.
export const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,

  Component: ({ params }) => (
    <article className="note">
      <h3>Note {params.id}</h3>
    </article>
  ),
});
