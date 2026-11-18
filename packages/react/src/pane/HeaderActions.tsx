import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { checkTuck, tuckHome } from "@jali/core";
import { formatChord } from "@jali/core";
import { useModel, useStore } from "../state/react";
import type { Chrome } from "@jali/core";

interface P { id: string; title: string; zoomed: boolean; chrome: Chrome }

/** Tuck, maximise, close: 26px targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join. */
export function HeaderActions({ id, title, zoomed, chrome }: P) {
  const store = useStore();
  const m = useModel();
  const home = tuckHome(store.snapshot(), id);
  // When tuck is refused, the button says why in the announcer's own words (state/messages.ts).
  const hint = (id: string) => (store.keymap.label(id) ? ` · ${store.keymap.label(id)}` : "");
  const tuckLabel = home ? `Tuck into ${m.title(home)}${hint("pane.tuck")}` : (checkTuck(store.snapshot(), id)?.msg ?? `${title} can't be tucked`);
  const { actions } = store;
  const node = m.pane(id);
  // A curated page's view closes back into the tabs above.
  const closeHint = store.get().review && node?.role ? "Close · it stays in the tabs above" : "Close";
  return (
    <div className="pane-actions">
      {chrome.tuckable && !zoomed ? (
        <button className="icon-btn act-tuck" aria-label={home ? tuckLabel : `Tuck ${title}`} title={tuckLabel} disabled={!home} onClick={() => actions.tuck(id)}>
          <Minus size={14} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
      {chrome.zoomable ? <ZoomButton id={id} title={title} zoomed={zoomed} /> : null}
      <button className="icon-btn act-close" onClick={() => actions.close(id)} aria-label={`Close ${title}`} title={`${closeHint}${hint("pane.close")}`}>
        <X size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const { actions, keymap } = useStore();
  const zoomKeys = keymap.label("pane.zoom");
  return (
    <button
      className="icon-btn act-zoom"
      onClick={() => actions.toggleZoom(id)}
      aria-label={zoomed ? `Restore ${title}` : `Maximise ${title}`}
      title={zoomed ? `Restore · ${formatChord({ key: "Escape" }, keymap.platform)}` : `Maximise${zoomKeys ? ` · ${zoomKeys}` : ""}`}
    >
      {zoomed ? <Minimize2 size={14} strokeWidth={1.5} aria-hidden /> : <Maximize2 size={14} strokeWidth={1.5} aria-hidden />}
    </button>
  );
}
