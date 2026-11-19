import type { Edge, Rect } from "@jali/core/adapter";
import { dropText, zoneRect } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import type { JaliIconName } from "../icons/types";
import { useMessages, useModel, useUi } from "../state/react";

/** The tinted part of the target pane that the drop will fill. */
export function DropIndicator({ rect, zone }: { rect: Rect; zone: Edge | "centre" }) {
  const r = zoneRect(rect, zone);
  return (
    <div
      className={`jali-drop-indicator jali-zone-${zone}`}
      data-drop-zone={zone}
      style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
      aria-hidden
    />
  );
}

const ICONS: Record<"swap" | "tab" | Edge, JaliIconName> = {
  swap: "dropSwap",
  tab: "dropTab",
  left: "dropLeft",
  right: "dropRight",
  top: "dropTop",
  bottom: "dropBottom",
};
const INSET: Record<Edge | "centre", string> = {
  centre: "0",
  right: "0 0 0 50%",
  bottom: "50% 0 0 0",
  left: "0 50% 0 0",
  top: "0 0 50% 0",
};

/** Centred inside the part of the target pane that the drop will fill: icon plus the outcome in words. */
export function DropZoneLabel({ paneId }: { paneId: string }) {
  const zone = useUi((s) => (s.dnd?.target === paneId ? s.dnd.zone : undefined));
  // A view dragged from a page's tabs always joins the group in the centre.
  const centreDrop = useUi((s) => (s.dnd?.label ? "tab" : s.settings.centreDrop));
  const m = useModel();
  const words = useMessages().drop;
  const icons = useJaliIcons();
  if (!zone) return null;
  const Icon = icons[ICONS[zone === "centre" ? centreDrop : zone]];
  return (
    <div className="jali-drop-label-zone" style={{ inset: INSET[zone] }} aria-hidden>
      <span className="jali-drop-label">
        <Icon size={16} aria-hidden />
        {dropText(zone, m.title(paneId), centreDrop, words)}
      </span>
    </div>
  );
}
