import { ArrowDown, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUp, SquarePlus } from "lucide-react";
import type { Edge, Rect } from "../../layout-core/types";
import { dropText } from "../state/messages";
import { useModel, useUi } from "../state/react";
import { zoneRect } from "./dnd";

/** The tinted part of the target pane that the drop will fill. */
export function DropIndicator({ rect, zone }: { rect: Rect; zone: Edge | "centre" }) {
  const r = zoneRect(rect, zone);
  return <div className={`drop-indicator zone-${zone}`} data-drop-zone={zone} style={{ left: r.x, top: r.y, width: r.width, height: r.height }} aria-hidden />;
}

const ICONS = { swap: ArrowLeftRight, tab: SquarePlus, left: ArrowLeft, right: ArrowRight, top: ArrowUp, bottom: ArrowDown };
const INSET: Record<Edge | "centre", string> = { centre: "0", right: "0 0 0 50%", bottom: "50% 0 0 0", left: "0 50% 0 0", top: "0 0 50% 0" };

/** Centred inside the part of the target pane that the drop will fill: icon plus the outcome in words. */
export function DropZoneLabel({ paneId }: { paneId: string }) {
  const zone = useUi((s) => (s.dnd?.target === paneId ? s.dnd.zone : undefined));
  // A view dragged from a page's tabs always joins the group in the centre.
  const centreDrop = useUi((s) => (s.dnd?.label ? "tab" : s.settings.centreDrop));
  const m = useModel();
  if (!zone) return null;
  const Icon = ICONS[zone === "centre" ? centreDrop : zone];
  return (
    <div className="drop-label-zone" style={{ inset: INSET[zone] }} aria-hidden>
      <span className="drop-label">
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        {dropText(zone, m.title(paneId), centreDrop)}
      </span>
    </div>
  );
}
