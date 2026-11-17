import { Maximize2, Minimize2, PanelLeftClose, PanelRightClose, PanelTopOpen, X } from "lucide-react";
import { actions } from "../store";
import { useCanMinimise } from "./canMinimise";

interface P { id: string; title: string; zoomed: boolean; collapsed: boolean; single?: boolean; onLeft: boolean }

/**
 * Minimise, maximise, close: always all three, 26px targets, 4px apart.
 * Minimise is a panel glyph whose arrow points at the side the pane's rail sits on (left half: left; right half: right).
 */
export function HeaderActions({ id, title, zoomed, collapsed, single, onLeft }: P) {
  const can = useCanMinimise(id);
  const Min = onLeft ? PanelLeftClose : PanelRightClose;
  return (
    <div className="pane-actions">
      {collapsed ? (
        <button className="icon-btn act-min" onClick={() => actions.setCollapsed(id, false)} aria-label={`Expand ${title}`} title="Expand · ⌥⌘M">
          <PanelTopOpen size={14} strokeWidth={1.5} aria-hidden />
        </button>
      ) : (
        <>
          {single || zoomed ? null : (
            <button
              className="icon-btn act-min"
              aria-label={`Minimise ${title}`}
              aria-disabled={!can || undefined}
              title={can ? "Minimise · ⌥⌘M" : "Only open pane: can't minimise"}
              onClick={() => { if (can) actions.setCollapsed(id, true); }}
            >
              <Min size={14} strokeWidth={1.5} aria-hidden />
            </button>
          )}
          {single ? null : (
            <button className="icon-btn act-zoom" onClick={() => actions.toggleZoom(id)} aria-label={zoomed ? `Restore ${title}` : `Maximise ${title}`} title={zoomed ? "Restore · Esc" : "Maximise · ⇧⌘↵"}>
              {zoomed ? <Minimize2 size={14} strokeWidth={1.5} aria-hidden /> : <Maximize2 size={14} strokeWidth={1.5} aria-hidden />}
            </button>
          )}
        </>
      )}
      <button className="icon-btn act-close" onClick={() => actions.close(id)} aria-label={`Close ${title}`} title="Close · ⌥⌘W">
        <X size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
