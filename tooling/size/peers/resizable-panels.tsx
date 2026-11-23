/** Size scenario, a peer: react-resizable-panels. Two panels side by side with a draggable separator. The library
 *  has no tabs and ships no stylesheet. Reported by tooling/size.mjs, never gated. */
import { createRoot } from "react-dom/client";
import { Group, Panel, Separator } from "react-resizable-panels";

createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100vh" }}>
    <Group orientation="horizontal">
      <Panel defaultSize="50%" minSize="10%">
        <p>Note 1</p>
      </Panel>
      <Separator style={{ width: 4, background: "#ccc" }} />
      <Panel minSize="10%">
        <p>Note 2</p>
      </Panel>
    </Group>
  </div>,
);
