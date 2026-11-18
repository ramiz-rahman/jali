import type { Layout } from "@jali/core";

// A row with a fixed-width list, and a column beside it: the ticket above, a stack of two tabs below.
export const triage = (): Layout => ({
  version: 1,
  root: {
    id: "root", type: "row", size: { weight: 1 }, children: [
      { id: "list", type: "pane", size: { px: 360 }, ref: { kind: "tickets", params: { queue: "open" } } },
      {
        id: "work", type: "column", size: { weight: 1 }, children: [
          { id: "detail", type: "pane", size: { weight: 2 }, ref: { kind: "ticket", params: { id: 101 } }, linkedTo: "list", follows: true },
          {
            id: "context", type: "stack", size: { weight: 1 }, active: "who", children: [
              { id: "who", type: "pane", size: { weight: 1 }, ref: { kind: "customer", params: { id: 7 } } },
              { id: "bought", type: "pane", size: { weight: 1 }, ref: { kind: "orders", params: { customer: 7 } } },
            ],
          },
        ],
      },
    ],
  },
});

// One pane: the list alone.
export const listOnly = (): Layout => ({
  version: 1,
  root: { id: "list", type: "pane", size: { weight: 1 }, ref: { kind: "tickets", params: { queue: "open" } } },
});
