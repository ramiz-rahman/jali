import { definePane } from "@jali/react";

export const note = definePane("note", {
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
