import type { Layout } from "@jali/core";

// A layout is a tree: rows and columns of panes, each pane showing one ref.
export const start = (): Layout => ({
  version: 1,
  root: {
    id: "root", type: "row", size: { weight: 1 }, children: [
      { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } },
      { id: "b", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 2 } } },
    ],
  },
});
