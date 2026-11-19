/**
 * The dividers. The pointer drag is ours (`drag.ts`: pointer capture, one rAF per frame, direct DOM writes, one
 * commit on release); keys commit per keypress; double-click resets; the URL is written 120ms after the last change.
 */
import { useRef } from "react";
import {
  paneDomId,
  dividerKey,
  isDividerDragging,
  startDividerDrag,
  geometryFor,
  dividerAllowed,
} from "@jali/core/adapter";
import { useModel, useStore, useUi } from "../state/react";
import { Divider } from "./Divider";

export function DividerLayer() {
  const store = useStore();
  const m = useModel();
  const zoomed = useUi((s) => s.view.zoomed);
  const rtl = useUi((s) => s.dir === "rtl");
  // The line shown while dragging: drawn by drag.ts straight onto the DOM, never by React.
  const line = useRef<HTMLDivElement>(null);
  if (zoomed) return null;
  const { actions } = store;
  return (
    <div className="jali-divider-layer">
      {m.resolved.dividers.map((d) => {
        const g = geometryFor(m, d);
        // A divider beside a pane the app doesn't let resize (`allow: { resize: false }`) isn't drawn: no handle.
        if (!g || !dividerAllowed(store.snapshot(), d.parentId, d.index)) return null;
        // In a row that scrolls, a divider scrolled out of the strip's window isn't drawn over the panes beside it.
        if (
          d.clip &&
          (d.rect.x < d.clip.x - 0.5 || d.rect.x + d.rect.width > d.clip.x + d.clip.width + 0.5)
        )
          return null;
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
            rtl={rtl && g.axis === "row"}
            onDragStart={(e) => startDividerDrag(store, line.current, e, d.parentId, d.index)}
            setSizeA={(size) =>
              isDividerDragging() || actions.setDividerSize(d.parentId, d.index, size)
            }
            onReset={() => actions.resetDivider(d.parentId, d.index)}
          />
        );
      })}
      <div
        ref={line}
        className="jali-divider-visual"
        data-testid="divider-preview"
        hidden
        aria-hidden
      >
        <span className="jali-divider-line" />
        <span className="jali-divider-tick" hidden />
      </div>
    </div>
  );
}
