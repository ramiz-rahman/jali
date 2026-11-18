import { definePaneKind } from "@jali/react";

export const note = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  ref: (params) => ({ kind: "note", params }),
  minWidth: 240,
  minHeight: 160,
  Component: ({ ref, openBeside }) => (
    <article className="note">
      <h3>Note {ref.params.id}</h3>
      <button onClick={() => openBeside({ kind: "note", params: { id: Number(ref.params.id) + 1 } })}>
        Open the next note beside
      </button>
    </article>
  ),
});
