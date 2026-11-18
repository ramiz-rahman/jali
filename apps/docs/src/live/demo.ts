/**
 * Demo pane kinds and layouts for the live parts. STUB: the live agent fills this in.
 * Layout ids are the contract with pages: <TreeView layout="chain" />.
 */
export type DemoLayoutId = "two" | "chain" | "nested" | "stack" | "crowded";
export const demoLayouts: Record<DemoLayoutId, string> = {
  two: "Two panes side by side",
  chain: "A list, its detail, and a related record",
  nested: "A row with a column inside it",
  stack: "Tabs: a stack of three panes",
  crowded: "More panes than fit, so some fold",
};
