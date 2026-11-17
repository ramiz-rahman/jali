import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { actions } from "../store";
import { tuck, useTuck } from "./tuck";

interface P { id: string; title: string; zoomed: boolean; single?: boolean }

/** Tuck, maximise, close: 26px targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join. */
export function HeaderActions({ id, title, zoomed, single }: P) {
  const { can, homeTitle } = useTuck(id);
  const label = can ? `Tuck into ${homeTitle ?? "another pane"} · ⌥⌘M` : "Only open pane";
  return (
    <div className="pane-actions">
      {single || zoomed ? null : (
        <button
          className="icon-btn act-tuck"
          aria-label={can ? `Tuck into ${homeTitle ?? "another pane"} · ⌥⌘M` : `Tuck ${title}: only open pane`}
          title={label}
          disabled={!can}
          onClick={() => tuck(id)}
        >
          <Minus size={14} strokeWidth={1.5} aria-hidden />
        </button>
      )}
      {single ? null : (
        <button className="icon-btn act-zoom" onClick={() => actions.toggleZoom(id)} aria-label={zoomed ? `Restore ${title}` : `Maximise ${title}`} title={zoomed ? "Restore · Esc" : "Maximise · ⇧⌘↵"}>
          {zoomed ? <Minimize2 size={14} strokeWidth={1.5} aria-hidden /> : <Maximize2 size={14} strokeWidth={1.5} aria-hidden />}
        </button>
      )}
      <button className="icon-btn act-close" onClick={() => actions.close(id)} aria-label={`Close ${title}`} title="Close · ⌥⌘W">
        <X size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}
