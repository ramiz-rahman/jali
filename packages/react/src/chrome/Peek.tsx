import { own } from "@jali/core/adapter";
import type { PaneNode } from "@jali/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import { sameRef, type PaneReportPatch, type Presentation } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { PaneBody, peekHost } from "../pane/PaneBody";
import { UnsavedMark } from "../pane/Unsaved";
import { useStore, useUi } from "../state/react";
import { useKeymap } from "../state/hydrated";
import { ICON } from "../icons/sized";
import { landmarkName } from "../a11y/landmark";

export const PEEK_WIDTH = 480;

/** A sheet over the right of main. Not part of the tree; the list stays usable. Animates only on pointer open. */
export function Peek({ presentation }: { presentation: Presentation }) {
  const icon = useJaliIcons();
  const store = useStore();
  const keymap = useKeymap();
  const ref = useUi((s) => s.view.peek);
  const areaW = useUi((s) => s.area.width);
  const page = useUi((s) => s.page);
  const canPin = !page || (page.canInvestigate && page.mode === "split");
  // The sheet's own content may name its object (useTitle), for this object only: a new object starts unnamed.
  const shows = ref ? JSON.stringify(ref) : "";
  const [ownTitle, setOwnTitle] = useState<{ shows: string; title: string | null }>();
  const host = useMemo(() => {
    const base = peekHost(store);
    const titles = new Map<string, { seq: number; title: string }>();
    return {
      ...base,
      // Merged as a pane's are: the last caller in order that gives one.
      report: (caller: string, seq: number, patch: PaneReportPatch | null) => {
        if (patch && !Object.hasOwn(patch, "title")) return;
        const title = patch?.title;
        if (title) titles.set(caller, { seq: titles.get(caller)?.seq ?? seq, title });
        else titles.delete(caller);
        const last = [...titles.values()].sort((a, b) => a.seq - b.seq).at(-1);
        setOwnTitle({ shows, title: last?.title ?? null });
      },
    };
  }, [store, shows]);
  // The sheet stands for a pane while it shows that pane's object: it carries the pane's data-* attributes.
  const marks = useUi((s) => {
    if (!s.view.peek) return undefined;
    const ref = s.view.peek;
    const shown = Object.keys(s.paneAttributes).find((id) => {
      const p = store.model().pane(id);
      return !!p && sameRef(p.ref, ref);
    });
    return own(s.paneAttributes, shown);
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
  // And for its title: a pane showing this object may have named it from its data (useTitle), when the sheet's own
  // content has not.
  const named = useUi((s) => {
    const ref = s.view.peek;
    if (!ref) return undefined;
    const id = Object.keys(s.titles).find((id) => {
      const p = store.model().pane(id);
      return !!p && sameRef(p.ref, ref);
    });
    return own(s.titles, id);
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
  // Its own content's useTitle first, then a pane's showing the same object, then the kind's.
  const title =
    (ownTitle?.shows === shows ? ownTitle.title : null) ?? named ?? store.env.kinds.title(ref);
  const { actions } = store;
  const t = store.messages.peek;
  return (
    <aside
      {...marks}
      className={`jali-peek${openedBy.current === "pointer" ? " is-animated" : ""}`}
      style={{ width: presentation === "single" ? "100%" : Math.min(PEEK_WIDTH, areaW) }}
      role="complementary"
      aria-label={landmarkName(store, t.label(title))}
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
          {/* A curated workspace never replaces its arrangement; a role that only peeks can't keep either. */}
          {canPin ? (
            <button
              className="jali-text-btn"
              onClick={() => actions.openPeekBeside()}
              title={t.openBeside}
            >
              <icon.openBeside {...ICON.header} aria-hidden /> {t.openBeside}
            </button>
          ) : null}
          {page ? null : (
            <button
              className="jali-text-btn"
              onClick={() => actions.openPeekFull()}
              title={t.openFull}
            >
              <icon.openFull {...ICON.header} aria-hidden /> {t.openFull}
            </button>
          )}
          <button
            className="jali-icon-btn"
            onClick={() => actions.peek(null)}
            aria-label={t.close}
            title={t.closeTip(keymap.format([{ key: "Escape" }]))}
          >
            <icon.close {...ICON.header} aria-hidden />
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
