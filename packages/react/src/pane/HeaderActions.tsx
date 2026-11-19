import { Maximize2, Minimize2, Minus, X } from "lucide-react";
import { checkTuck, tuckHome } from "@jali/core/adapter";
import { useModel, useStore } from "../state/react";
import type { Chrome } from "@jali/core/adapter";

interface P {
  id: string;
  title: string;
  zoomed: boolean;
  chrome: Chrome;
}

/** Tuck, maximise, close: 26px targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join. */
export function HeaderActions({ id, title, zoomed, chrome }: P) {
  const store = useStore();
  const m = useModel();
  const { pane: t, keys } = store.messages;
  const home = tuckHome(store.snapshot(), id);
  // When tuck is refused, the button says why in the announcer's own words (state/messages.ts).
  const tuckLabel = home
    ? keys.withKeys(t.tuckInto(m.title(home)), store.keymap.label("pane.tuck"))
    : (checkTuck(store.snapshot(), id)?.msg ?? t.cantTuck(title));
  const { actions } = store;
  const node = m.pane(id);
  // A curated page's view closes back into the tabs above.
  const closeHint = store.get().page && node?.role ? t.closeViewTip : t.closeTip;
  return (
    <div className="jali-pane-actions">
      {chrome.tuckable && !zoomed ? (
        <button
          className="jali-icon-btn jali-act-tuck"
          aria-label={home ? tuckLabel : t.tuck(title)}
          title={tuckLabel}
          disabled={!home}
          onClick={() => actions.tuck(id)}
        >
          <Minus size={14} strokeWidth={1.5} aria-hidden />
        </button>
      ) : null}
      {chrome.zoomable ? <ZoomButton id={id} title={title} zoomed={zoomed} /> : null}
      <button
        className="jali-icon-btn jali-act-close"
        onClick={() => actions.close(id)}
        aria-label={t.close(title)}
        title={keys.withKeys(closeHint, store.keymap.label("pane.close"))}
      >
        <X size={14} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const { actions, keymap, messages } = useStore();
  const { pane: t, keys } = messages;
  return (
    <button
      className="jali-icon-btn jali-act-zoom"
      onClick={() => actions.toggleZoom(id)}
      aria-label={zoomed ? t.restore(title) : t.maximise(title)}
      title={
        zoomed
          ? keys.withKeys(t.restoreTip, keymap.format([{ key: "Escape" }]))
          : keys.withKeys(t.maximiseTip, keymap.label("pane.zoom"))
      }
    >
      {zoomed ? (
        <Minimize2 size={14} strokeWidth={1.5} aria-hidden />
      ) : (
        <Maximize2 size={14} strokeWidth={1.5} aria-hidden />
      )}
    </button>
  );
}
