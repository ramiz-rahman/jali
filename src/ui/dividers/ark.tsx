import { Splitter } from "@ark-ui/react/splitter";
import { DividerHandle } from "./Handle";
import { splitterAria, type AdapterDividerProps, type DividerAdapter } from "./types";

/**
 * Ark UI Splitter as a separator shell only: its ResizeTrigger renders the element and takes our ARIA as props.
 * The pointer drag is ours: onPointerDownCapture starts it and stops propagation, so Ark's own onPointerDown never
 * runs (no zag drag state, no document listeners). Keys are ours too (capture phase, propagation stopped).
 * Ark is controlled from layout-core's size, so it only moves after the commit on release.
 */
function ArkDivider(p: AdapterDividerProps) {
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
      size={[pct(p.sizeA), 100 - pct(p.sizeA)]}
    >
      <Splitter.Panel id="a" className="ghost-panel" />
      <Splitter.ResizeTrigger
        id="a:b"
        className={p.className}
        data-divider={p.dividerKey}
        style={row ? { width: p.gap, minWidth: p.gap } : { height: p.gap, minHeight: p.gap }}
        onPointerDownCapture={(e) => {
          e.stopPropagation();
          p.onPointerDown(e);
        }}
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
        <DividerHandle sizeA={p.sizeA} total={p.total} labelA={p.labelA} labelB={p.labelB} />
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="b" className="ghost-panel" />
    </Splitter.Root>
  );
}

export const arkAdapter: DividerAdapter = { id: "ark", label: "Ark UI Splitter 5.40 (element and ARIA only)", Divider: ArkDivider };
