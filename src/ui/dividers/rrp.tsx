import { useEffect, useLayoutEffect, useRef } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { splitterAria, type AdapterDividerProps, type DividerAdapter } from "./types";

function RrpDivider(p: AdapterDividerProps) {
  const aRef = usePanelRef();
  const active = useRef(false);
  const latest = useRef(p);
  latest.current = p;

  // Model -> library: keep the ghost panel at layout-core's size (keyboard, snap, clamp, window resize).
  useLayoutEffect(() => {
    const h = aRef.current;
    if (!h) return;
    if (Math.abs(h.getSize().inPixels - p.sizeA) > 0.5) h.resize(`${p.sizeA}px`);
  }, [p.sizeA, p.total, aRef]);

  useEffect(() => {
    const end = () => {
      if (!active.current) return;
      active.current = false;
      latest.current.onDragEnd();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const row = p.axis === "row";
  return (
    <Group
      orientation={row ? "horizontal" : "vertical"}
      className="ghost-group"
      style={{ position: "absolute", left: p.pair.x, top: p.pair.y, width: p.pair.width, height: p.pair.height }}
      resizeTargetMinimumSize={{ fine: 12, coarse: 24 }}
    >
      <Panel
        id="a"
        panelRef={aRef}
        className="ghost-panel"
        defaultSize={`${p.sizeA}px`}
        minSize={`${p.minA}px`}
        maxSize={`${p.maxA}px`}
        onResize={(s) => {
          if (active.current) latest.current.onDrag(s.inPixels);
        }}
      />
      <Separator
        className={p.className}
        style={row ? { width: p.gap } : { height: p.gap }}
        disableDoubleClick
        onDoubleClick={p.onReset}
        onPointerDown={() => {
          active.current = true;
          p.onDragStart();
        }}
        onKeyDownCapture={(e) => {
          p.onKeyDown(e);
          if (e.defaultPrevented) e.stopPropagation();
        }}
        {...splitterAria(p)}
      >
        <span className="divider-line" aria-hidden />
        {p.snapped && p.dragging ? <span className="divider-tick" aria-hidden /> : null}
      </Separator>
      <Panel id="b" className="ghost-panel" minSize={`${p.total - p.maxA}px`} />
    </Group>
  );
}

export const rrpAdapter: DividerAdapter = { id: "rrp", label: "react-resizable-panels 4.24.0", Divider: RrpDivider };
