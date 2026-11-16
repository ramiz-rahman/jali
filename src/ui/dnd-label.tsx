import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, SquarePlus } from "lucide-react";
import { dropOutcome } from "./dnd";
import { useUi } from "./store";

const ICONS = { swap: ArrowLeftRight, tab: SquarePlus, left: ArrowLeft, right: ArrowRight, top: ArrowUp, bottom: ArrowDown };

/** Centred inside the part of the target pane that the drop will fill: icon plus the outcome in words. */
export function DropZoneLabel({ paneId }: { paneId: string }) {
  const zone = useUi((s) => (s.dnd?.target === paneId ? s.dnd.zone : undefined));
  if (!zone) return null;
  const o = dropOutcome(zone, paneId);
  const Icon = ICONS[o.icon];
  const inset = zone === "centre" ? "0" : zone === "right" ? "0 0 0 50%" : zone === "bottom" ? "50% 0 0 0" : zone === "left" ? "0 50% 0 0" : "0 0 50% 0";
  return (
    <div className="drop-label-zone" style={{ inset }} aria-hidden>
      <span className="drop-label">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        {o.text}
      </span>
    </div>
  );
}
