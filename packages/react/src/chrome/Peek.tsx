import { own } from "@jali/core/adapter";
import type { NodeId, ObjectRef, PaneNode } from "@jali/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useJaliIcons } from "../icons/context";
import { sameRef, type PaneReportPatch, type Presentation } from "@jali/core/adapter";
import { KindIcon } from "../pane/icons";
import { PaneBody, peekHost } from "../pane/PaneBody";
import { UnsavedMark } from "../pane/Unsaved";
import { shallow, useEntriesOf, useJaliModel, useStore, useUi } from "../state/react";
import { useKeymap } from "../state/hydrated";
import { ICON } from "../icons/sized";
import { useLandmarkName } from "../a11y/landmark";

export const PEEK_WIDTH = 480;

const NONE: NodeId[] = [];

/**
 * Which object the sheet shows, as a number that changes only when it shows another one by `sameRef` (a ref read back
 * with its params in another order is the same object), or opens or closes. What belongs to one object (its content,
 * the title it gave) is keyed by it.
 */
function useShown(ref: ObjectRef | undefined): number {
  const [held, setHeld] = useState({ ref, n: 0 });
  if (held.ref === ref || sameRef(held.ref, ref)) return held.n;
  const next = { ref, n: held.n + 1 };
  // Updated while rendering, as React allows for a value worked out from the previous render's.
  setHeld(next);
  return next.n;
}

/** A sheet over the right of main. Not part of the tree; the list stays usable. Animates only on pointer open. */
export function Peek({ presentation }: { presentation: Presentation }) {
  const icon = useJaliIcons();
  const store = useStore();
  const landmarkName = useLandmarkName();
  const keymap = useKeymap();
  const ref = useUi((s) => s.view.peek);
  const areaW = useUi((s) => s.area.width);
  const page = useUi((s) => s.page);
  const canPin = !page || (page.linkMode === "open" && page.mode === "split");
  // The sheet's own content may name its object (useTitle), for this object only: a new object starts unnamed.
  const shows = useShown(ref);
  const [ownTitle, setOwnTitle] = useState<{ shows: number; title: string | null }>();
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
  // The panes showing the sheet's object, in tree order: it stands for them, and hears what they report and no other
  // pane's. Compared item by item, so the list is the same value until a pane starts or stops showing it.
  const ids = useJaliModel(
    (m): NodeId[] => (ref ? m.panes.filter((p) => sameRef(p.ref, ref)).map((p) => p.id) : NONE),
    shallow,
  );
  const attributes = useEntriesOf((s) => s.paneAttributes, ids);
  const unsaved = useEntriesOf((s) => s.unsaved, ids);
  const titles = useEntriesOf((s) => s.titles, ids);
  const first = <T,>(record: Readonly<Record<NodeId, T>>) =>
    own(
      record,
      ids.find((id) => Object.hasOwn(record, id)),
    );
  // It carries the data-* attributes of the first of them that set some;
  const marks = first(attributes);
  // has unsaved work while one of them does;
  const dirty = ids.some((id) => Object.hasOwn(unsaved, id));
  // and is named by the first that named it from its data (useTitle), when the sheet's own content has not.
  const named = first(titles);
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
      aria-label={landmarkName(t.label(title))}
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
          {/* A curated page never replaces its arrangement; a role that only peeks can't keep either. */}
          {canPin ? (
            <button
              type="button"
              className="jali-text-btn"
              onClick={() => actions.openPeekBeside()}
              title={t.openBeside}
            >
              <icon.openBeside {...ICON.header} aria-hidden /> {t.openBeside}
            </button>
          ) : null}
          {page ? null : (
            <button
              type="button"
              className="jali-text-btn"
              onClick={() => actions.openPeekFull()}
              title={t.openFull}
            >
              <icon.openFull {...ICON.header} aria-hidden /> {t.openFull}
            </button>
          )}
          <button
            type="button"
            className="jali-icon-btn"
            onClick={() => actions.closePeek()}
            aria-label={t.close}
            title={t.closeTip(keymap.format([{ key: "Escape" }]))}
          >
            <icon.close {...ICON.header} aria-hidden />
          </button>
        </div>
      </header>
      <div className="jali-pane-content">
        <div className="jali-pane-content-inner">
          <PaneBody key={shows} node={node} host={host} paused={false} focused={false} inPeek />
        </div>
      </div>
    </aside>
  );
}
