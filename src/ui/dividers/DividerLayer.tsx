/**
 * The dividers. The pointer drag is ours (`drag.ts`: pointer capture, one rAF per frame, direct DOM writes, one
 * commit on release); keys commit per keypress; double-click resets; the URL is written 120ms after the last change.
 */
import { useRef } from "react";
import { paneDomId } from "../dom/ids";
import { useModel, useStore, useUi } from "../state/react";
import { Divider, dividerKey } from "./Divider";
import { isDividerDragging, startDividerDrag } from "./drag";
import { geometryFor } from "./resize";

export function DividerLayer() {
  const store = useStore();
  const m = useModel();
  const zoomed = useUi((s) => s.view.zoomed);
  // The line shown while dragging: drawn by drag.ts straight onto the DOM, never by React.
  const line = useRef<HTMLDivElement>(null);
  if (zoomed) return null;
  const { actions } = store;
  return (
    <div className="divider-layer">
      {m.resolved.dividers.map((d) => {
        const g = geometryFor(m, d);
        if (!g) return null;
        return (
          <Divider
            key={dividerKey(d)}
            parentId={d.parentId}
            index={d.index}
            axis={g.axis}
            rect={d.rect}
            sizeA={g.a.size}
            minA={g.a.min}
            maxA={g.divider.max}
            total={g.total}
            labelA={g.a.label}
            labelB={g.b.label}
            controls={g.a.ids.map((id) => paneDomId(store.dom.id, id)).join(" ")}
            onDragStart={(e) => startDividerDrag(store, line.current, e, d.parentId, d.index)}
            setSizeA={(size) => isDividerDragging() || actions.setDividerSize(d.parentId, d.index, size)}
            onReset={() => actions.resetDivider(d.parentId, d.index)}
          />
        );
      })}
      <div ref={line} className="divider-visual" data-testid="divider-preview" hidden aria-hidden>
        <span className="divider-line" />
        <span className="divider-tick" hidden />
      </div>
    </div>
  );
}
