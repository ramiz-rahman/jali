import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";
import { splitterAria, type AdapterDividerProps, type DividerAdapter } from "./types";

function RrpDivider(p: AdapterDividerProps) {
  const aRef = usePanelRef();
  // Constraint props must stay stable: changing defaultSize/minSize mid-drag re-registers the panel and drops the drag.
  const [initial] = useState(() => p.sizeA);
  const active = useRef(false);
  const latest = useRef(p);
  latest.current = p;

  // Model -> library: keep the ghost panel at layout-core's size (keyboard, snap, clamp, window resize).
  // Not during a pointer drag: an imperative resize() mid-drag cancels rrp's drag.
  useLayoutEffect(() => {
    const h = aRef.current;
    if (!h || p.dragging) return;
    if (Math.abs(h.getSize().inPixels - p.sizeA) > 0.5) h.resize(`${p.sizeA}px`);
  }, [p.sizeA, p.total, p.dragging, aRef]);

  // rrp writes its own aria-valuenow (percent of group) and aria-controls (ghost panel id) and ignores ours,
  // so patch the DOM after each render to point at the real pane regions.
  const sepEl = useRef<HTMLDivElement>(null);
  const ariaRef = useRef(splitterAria(p));
  ariaRef.current = splitterAria(p);
  useLayoutEffect(() => {
    const el = sepEl.current;
    if (!el) return;
    const apply = () => {
      for (const [k, v] of Object.entries(ariaRef.current)) if (k.startsWith("aria-") && el.getAttribute(k) !== String(v)) el.setAttribute(k, String(v));
    };
    apply();
    // rrp re-writes its own values after layout changes; re-apply ours when it does.
    const mo = new MutationObserver(apply);
    mo.observe(el, { attributes: true, attributeFilter: ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-controls", "aria-valuetext"] });
    return () => mo.disconnect();
  });

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
        defaultSize={`${initial}px`}
        minSize={`${p.minA}px`}
        maxSize={`${p.maxA}px`}
        onResize={(s) => {
          if (active.current) latest.current.onDrag(s.inPixels);
        }}
      />
      <Separator
        className={p.className}
        style={row ? { width: p.gap } : { height: p.gap }}
        elementRef={sepEl}
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
      </Separator>
      <Panel id="b" className="ghost-panel" minSize={`${p.total - p.maxA}px`} />
    </Group>
  );
}

export const rrpAdapter: DividerAdapter = { id: "rrp", label: "react-resizable-panels 4.24.0", Divider: RrpDivider };
