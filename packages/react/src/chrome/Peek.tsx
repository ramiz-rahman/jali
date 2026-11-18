import { useEffect, useMemo, useRef } from "react";
import { Maximize, PanelRightOpen, X } from "lucide-react";
import type { PaneNode, Presentation } from "@jali/core/adapter";
import { formatChord } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { PaneBody, peekHost } from "../pane/PaneBody";
import { useStore, useUi } from "../state/react";

export const PEEK_WIDTH = 480;

/** A sheet over the right of main. Not part of the tree; the list stays usable. Animates only on pointer open. */
export function Peek({ presentation }: { presentation: Presentation }) {
  const store = useStore();
  const ref = useUi((s) => s.view.peek);
  const areaW = useUi((s) => s.area.width);
  const page = useUi((s) => s.page);
  const canPin = !page || (page.canInvestigate && page.mode === "multi");
  const host = useMemo(() => peekHost(store), [store]);
  const openedBy = useRef<"pointer" | "keyboard">("keyboard");
  // Observes (never takes) the last input, so only a pointer-opened peek animates.
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
  // The sheet's content is not a pane in the layout: it has a node of its own, outside the tree.
  const node: PaneNode = { id: "peek", type: "pane", size: { weight: 1 }, ref };
  const title = store.env.kinds.title(ref);
  const { actions } = store;
  return (
    <aside
      className={`jali-peek${openedBy.current === "pointer" ? " is-animated" : ""}`}
      style={{ width: presentation === "single" ? "100%" : Math.min(PEEK_WIDTH, areaW) }}
      role="complementary"
      aria-label={`Peek: ${title}`}
      data-testid="peek"
    >
      <header className="jali-peek-header">
        <div className="jali-pane-title">
          <KindIcon kind={ref.kind} />
          <h2>{title}</h2>
          <span className="jali-peek-label">Peek</span>
        </div>
        <div className="jali-pane-actions">
          {/* A curated workspace never replaces its arrangement; a role that only peeks can't pin either. */}
          {canPin ? (
            <button className="jali-text-btn" onClick={() => actions.pinPeek()} title="Pin beside">
              <PanelRightOpen size={14} strokeWidth={1.5} aria-hidden /> Pin beside
            </button>
          ) : null}
          {page ? null : (
            <button
              className="jali-text-btn"
              onClick={() => actions.openPeekFull()}
              title="Open full"
            >
              <Maximize size={14} strokeWidth={1.5} aria-hidden /> Open full
            </button>
          )}
          <button
            className="jali-icon-btn"
            onClick={() => actions.peek(null)}
            aria-label="Close peek"
            title={`Close (${formatChord({ key: "Escape" }, store.keymap.platform)})`}
          >
            <X size={14} strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </header>
      <div className="jali-pane-content">
        <div className="jali-pane-content-inner">
          <PaneBody
            key={JSON.stringify(ref)}
            node={node}
            host={host}
            paused={false}
            focused={false}
            inPeek
          />
        </div>
      </div>
    </aside>
  );
}
