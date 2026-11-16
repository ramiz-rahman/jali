import { useEffect, useRef } from "react";
import { PanelRightOpen, Maximize, X } from "lucide-react";
import type { PaneNode } from "../layout-core/types";
import { PaneBody, KindIcon } from "./PaneFrame";
import { paneTitle } from "./pane-kinds";
import { actions, useUi } from "./store";

export const PEEK_WIDTH = 480;

/** A sheet over the right of main. Not part of the tree; the list stays usable. Animates only on pointer open. */
export function Peek() {
  const ref = useUi((s) => s.view.peek);
  const areaW = useUi((s) => s.area.width);
  const openedBy = useRef<"pointer" | "keyboard">("keyboard");
  useEffect(() => {
    const onDown = () => (openedBy.current = "pointer");
    const onKey = () => (openedBy.current = "keyboard");
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);
  if (!ref) return null;
  const node: PaneNode = { id: "peek", type: "pane", size: { weight: 1 }, ref };
  const title = paneTitle(ref);
  const width = Math.min(PEEK_WIDTH, areaW);
  return (
    <aside
      className={`peek${openedBy.current === "pointer" ? " is-animated" : ""}`}
      style={{ width }}
      role="complementary"
      aria-label={`Peek: ${title}`}
      data-testid="peek"
    >
      <header className="peek-header">
        <div className="pane-title">
          <KindIcon kind={ref.kind} />
          <h2>{title}</h2>
          <span className="peek-label">Peek</span>
        </div>
        <div className="pane-actions">
          <button className="text-btn" onClick={() => actions.pinPeek()} title="Pin beside">
            <PanelRightOpen size={14} strokeWidth={1.5} aria-hidden /> Pin beside
          </button>
          <button className="text-btn" onClick={() => actions.openPeekFull()} title="Open full">
            <Maximize size={14} strokeWidth={1.5} aria-hidden /> Open full
          </button>
          <button className="icon-btn" onClick={() => actions.peek(null)} aria-label="Close peek" title="Close (Esc)">
            <X size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </header>
      <div className="pane-content">
        <div className="pane-content-inner">
          <PaneBody key={JSON.stringify(ref)} node={node} paused={false} focused={false} inPeek />
        </div>
      </div>
    </aside>
  );
}
