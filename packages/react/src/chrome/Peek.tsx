import type { PaneNode } from "@jali/core";
import { useEffect, useMemo, useRef } from "react";
import { useJaliIcons } from "../icons/context";
import { sameRef, type Presentation } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { PaneBody, peekHost } from "../pane/PaneBody";
import { UnsavedMark } from "../pane/Unsaved";
import { useStore, useUi } from "../state/react";

export const PEEK_WIDTH = 480;

/** A sheet over the right of main. Not part of the tree; the list stays usable. Animates only on pointer open. */
export function Peek({ presentation }: { presentation: Presentation }) {
  const icon = useJaliIcons();
  const store = useStore();
  const ref = useUi((s) => s.view.peek);
  const areaW = useUi((s) => s.area.width);
  const page = useUi((s) => s.page);
  const canPin = !page || (page.canInvestigate && page.mode === "split");
  const host = useMemo(() => peekHost(store), [store]);
  // The sheet stands for a pane while it shows that pane's object: it carries the pane's data-* attributes.
  const marks = useUi((s) => {
    if (!s.view.peek) return undefined;
    const ref = s.view.peek;
    const shown = Object.keys(s.paneAttributes).find((id) => {
      const p = store.model().pane(id);
      return !!p && sameRef(p.ref, ref);
    });
    return shown ? s.paneAttributes[shown] : undefined;
  });
  // The same for unsaved work: the pane showing this object has some.
  const dirty = useUi((s) => {
    const ref = s.view.peek;
    return (
      !!ref &&
      Object.keys(s.unsaved).some((id) => {
        const p = store.model().pane(id);
        return !!p && sameRef(p.ref, ref);
      })
    );
  });
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
  const t = store.messages.peek;
  return (
    <aside
      {...marks}
      className={`jali-peek${openedBy.current === "pointer" ? " is-animated" : ""}`}
      style={{ width: presentation === "single" ? "100%" : Math.min(PEEK_WIDTH, areaW) }}
      role="complementary"
      aria-label={t.label(title)}
      data-testid="peek"
    >
      <header className="jali-peek-header">
        <div className="jali-pane-title">
          <KindIcon kind={ref.kind} />
          <h2>{title}</h2>
          {dirty ? <UnsavedMark labelled /> : null}
          <span className="jali-peek-label">{t.badge}</span>
        </div>
        <div className="jali-pane-actions">
          {/* A curated workspace never replaces its arrangement; a role that only peeks can't pin either. */}
          {canPin ? (
            <button className="jali-text-btn" onClick={() => actions.pinPeek()} title={t.pinBeside}>
              <icon.pinBeside size={14} aria-hidden /> {t.pinBeside}
            </button>
          ) : null}
          {page ? null : (
            <button
              className="jali-text-btn"
              onClick={() => actions.openPeekFull()}
              title={t.openFull}
            >
              <icon.openFull size={14} aria-hidden /> {t.openFull}
            </button>
          )}
          <button
            className="jali-icon-btn"
            onClick={() => actions.peek(null)}
            aria-label={t.close}
            title={t.closeTip(store.keymap.format([{ key: "Escape" }]))}
          >
            <icon.close size={14} aria-hidden />
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
