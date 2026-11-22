import { useLayoutEffect, useRef, useState } from "react";
import type { ModelGeometry } from "@jali/core/adapter";
import { useModelValue, useUi } from "../state/react";
import { DropIndicator } from "./DropIndicator";

/**
 * The chip that follows the pointer: on the pointer's right (its left, right to left), flipped to the other side when
 * it would pass the viewport's edge, and moved below the drop label when it would cover it (a centre drop puts the
 * pointer where the label is).
 */
function DragChip({ x, y, label, rtl }: { x: number; y: number; label: string; rtl: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x + 12, top: y + 12 });
  useLayoutEffect(() => {
    const chip = el.current;
    const host = chip?.offsetParent as HTMLElement | null;
    if (!chip || !host) return setPos({ left: x + 12, top: y + 12 });
    const o = host.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const before = x - 12 - chip.offsetWidth;
    const left = rtl
      ? o.left + before >= 4
        ? before
        : Math.min(viewport - o.left - 4 - chip.offsetWidth, x + 12)
      : o.left + x + 12 + chip.offsetWidth <= viewport - 4
        ? x + 12
        : Math.max(-o.left + 4, before);
    let top = y + 12;
    const lab = host.querySelector(".jali-drop-label")?.getBoundingClientRect();
    if (lab) {
      const c = {
        l: o.left + left,
        t: o.top + top,
        r: o.left + left + chip.offsetWidth,
        b: o.top + top + chip.offsetHeight,
      };
      if (c.l < lab.right && c.r > lab.left && c.t < lab.bottom && c.b > lab.top)
        top = lab.bottom - o.top + 8;
    }
    setPos({ left, top });
  }, [x, y, label, rtl]);
  return (
    <div ref={el} className="jali-drag-chip" data-testid="drag-chip" style={pos} aria-hidden>
      {label}
    </div>
  );
}

/**
 * What a pane drag draws over the panes: the drop indicator on the target and the chip at the pointer. The one part
 * that hears every move of the drag (`dnd`); the instance and its frames hear only where it would land.
 */
export function DragLayer({ m }: { m: ModelGeometry }) {
  const dnd = useUi((s) => s.dnd);
  const rtl = useUi((s) => s.dir === "rtl");
  const name = useModelValue((x) => (dnd ? x.title(dnd.dragged) : ""));
  if (!dnd) return null;
  const dropBox = dnd.target ? m.resolved.panes.find((b) => b.id === dnd.target) : undefined;
  return (
    <>
      {dropBox && dnd.zone ? <DropIndicator rect={dropBox.rect} zone={dnd.zone} /> : null}
      <DragChip x={dnd.x} y={dnd.y} label={dnd.label ?? name} rtl={rtl} />
    </>
  );
}
