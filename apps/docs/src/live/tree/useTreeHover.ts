/**
 * A workspace and its tree, kept in step: the box or JSON under the pointer lights its panes (and dims the rest), a
 * pane under the pointer lights its box, every pane wears its identity colour, and the map follows a divider drag.
 */
import { useMemo, useState, useSyncExternalStore, type PointerEvent, type RefObject } from "react";
import { layout as jl, type JaliStore, type LayoutNode } from "jali-layout/adapter";
import { colourOf } from "./colours";
import { useLitPanes, usePaneColours } from "./light";
import { panesUnder, type Hover } from "./nodes";
import { useDragPreview } from "./useDragPreview";

export function useTreeHover(store: JaliStore, wrap: RefObject<HTMLElement | null>) {
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const [hover, setHover] = useState<Hover | null>(null);
  const lit = useMemo(() => {
    if (hover?.from !== "tree") return null;
    const node = jl.tree.find(m.layout.root, hover.id);
    return node ? panesUnder(node as LayoutNode) : null;
  }, [hover, m.layout.root]);
  useLitPanes(wrap, lit, m);
  usePaneColours(wrap, colourOf, m);
  const preview = useDragPreview(wrap);

  /** Props for the box around the workspace: the pane or tab under the pointer is the one its box lights for. */
  const stage = {
    onPointerOver: (e: PointerEvent) => {
      const t = e.target as Element;
      const id =
        t.closest<HTMLElement>("[data-tab]")?.dataset.tab ??
        t.closest<HTMLElement>("[data-pane]")?.dataset.pane;
      if (id && (hover?.id !== id || hover.from !== "ws")) setHover({ id, from: "ws" });
      else if (!id && hover?.from === "ws") setHover(null);
    },
    onPointerLeave: () => hover?.from === "ws" && setHover(null),
  };
  return { m, hover, setHover, preview, stage };
}
