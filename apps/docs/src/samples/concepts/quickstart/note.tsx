import { definePaneKind } from "@jali/react";

// A pane kind: what it shows (a ref), its title, the smallest size it works at, and the component that renders it.
export const note = definePaneKind({
  kind: "note",
  title: (ref) => `Note ${ref.params.id}`,
  ref: (params) => ({ kind: "note", params }),
  minWidth: 240,
  minHeight: 160,
  Component: ({ ref }) => (
    <article className="note">
      <h3>Note {ref.params.id}</h3>
    </article>
  ),
});
