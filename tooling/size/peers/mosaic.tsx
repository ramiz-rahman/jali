/** Size scenario, a peer: react-mosaic. Two tiles side by side (the left a tab container of two), each resizable,
 *  with the stylesheet it ships. Reported by tooling/size.mjs, never gated. */
import { createRoot } from "react-dom/client";
import { Mosaic, MosaicWindow, type MosaicNode } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";

const value: MosaicNode<string> = {
  type: "split",
  direction: "row",
  children: [{ type: "tabs", tabs: ["a", "b"], activeTabIndex: 0 }, "c"],
};

createRoot(document.getElementById("root")!).render(
  <div style={{ height: "100vh" }}>
    <Mosaic<string>
      initialValue={value}
      renderTile={(id, path) => (
        <MosaicWindow<string> path={path} title={`Note ${id}`}>
          <p>Note {id}</p>
        </MosaicWindow>
      )}
    />
  </div>,
);
