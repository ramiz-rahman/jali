import { useRef } from "react";
import { Splitter } from "@ark-ui/react/splitter";
import { splitterAria, type AdapterDividerProps, type DividerAdapter } from "./types";

function ArkDivider(p: AdapterDividerProps) {
  const active = useRef(false);
  const total = Math.max(1, p.total);
  const pct = (v: number) => (v / total) * 100;
  const row = p.axis === "row";
  return (
    <Splitter.Root
      className="ghost-group"
      orientation={row ? "horizontal" : "vertical"}
      style={{ position: "absolute", left: p.pair.x, top: p.pair.y, width: p.pair.width, height: p.pair.height, display: "flex", flexDirection: row ? "row" : "column" }}
      panels={[
        { id: "a", minSize: pct(p.minA), maxSize: pct(p.maxA) },
        { id: "b", minSize: pct(p.total - p.maxA) },
      ]}
      // Controlled: layout-core's size is the truth; the library proposes, the controller clamps and snaps.
      size={[pct(p.sizeA), 100 - pct(p.sizeA)]}
      keyboardResizeBy={16}
      onResizeStart={() => {
        active.current = true;
        p.onDragStart();
      }}
      onResize={(d) => {
        if (active.current && d.size[0] !== undefined) p.onDrag((d.size[0] / 100) * total);
      }}
      onResizeEnd={() => {
        if (!active.current) return;
        active.current = false;
        p.onDragEnd();
      }}
    >
      <Splitter.Panel id="a" className="ghost-panel" />
      <Splitter.ResizeTrigger
        id="a:b"
        className={p.className}
        style={row ? { width: p.gap, minWidth: p.gap } : { height: p.gap, minHeight: p.gap }}
        onDoubleClick={(e) => {
          e.preventDefault();
          p.onReset();
        }}
        onKeyDownCapture={(e) => {
          p.onKeyDown(e);
          if (e.defaultPrevented) e.stopPropagation();
        }}
        {...splitterAria(p)}
      >
        <span className="divider-line" aria-hidden />
        {p.snapped && p.dragging ? <span className="divider-tick" aria-hidden /> : null}
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="b" className="ghost-panel" />
    </Splitter.Root>
  );
}

export const arkAdapter: DividerAdapter = { id: "ark", label: "Ark UI Splitter 5.40", Divider: ArkDivider };
