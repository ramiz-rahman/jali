/** Size scenario, a peer: FlexLayout. Two tab sets side by side (the left holds two tabs), each resizable, with the
 *  stylesheet it ships. Reported by tooling/size.mjs, never gated. */
import { createRoot } from "react-dom/client";
import { Layout, Model, type TabNode } from "flexlayout-react";
import "flexlayout-react/style/light.css";

const model = Model.fromJson({
  global: {},
  layout: {
    type: "row",
    children: [
      {
        type: "tabset",
        children: [
          { type: "tab", name: "Note 1", component: "note", config: { id: 1 } },
          { type: "tab", name: "Note 2", component: "note", config: { id: 2 } },
        ],
      },
      {
        type: "tabset",
        children: [{ type: "tab", name: "Note 3", component: "note", config: { id: 3 } }],
      },
    ],
  },
});

const factory = (node: TabNode) => <p>Note {node.getConfig().id}</p>;

createRoot(document.getElementById("root")!).render(
  <div style={{ position: "relative", height: "100vh" }}>
    <Layout model={model} factory={factory} />
  </div>,
);
