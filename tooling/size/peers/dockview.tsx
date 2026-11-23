/** Size scenario, a peer: Dockview. Two groups side by side (the left holds two tabs), each resizable, with the
 *  stylesheet it ships. Reported by tooling/size.mjs, never gated. */
import { createRoot } from "react-dom/client";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";

const Note = ({ params }: IDockviewPanelProps<{ id: number }>) => <p>Note {params.id}</p>;

const onReady = ({ api }: DockviewReadyEvent) => {
  api.addPanel({ id: "a", component: "note", title: "Note 1", params: { id: 1 } });
  api.addPanel({ id: "b", component: "note", title: "Note 2", params: { id: 2 } });
  api.addPanel({
    id: "c",
    component: "note",
    title: "Note 3",
    params: { id: 3 },
    position: { referencePanel: "a", direction: "right" },
  });
};

createRoot(document.getElementById("root")!).render(
  <div className="dockview-theme-light" style={{ height: "100vh" }}>
    <DockviewReact components={{ note: Note }} onReady={onReady} />
  </div>,
);
