import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon, MinusIcon, XIcon } from "@phosphor-icons/react";
import { checkTuck, tuckHome, formatChord } from "@jali/core/adapter";
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
  const home = tuckHome(store.snapshot(), id);
  // When tuck is refused, the button says why in the announcer's own words (state/messages.ts).
  const hint = (id: string) => (store.keymap.label(id) ? ` · ${store.keymap.label(id)}` : "");
  const tuckLabel = home
    ? `Tuck into ${m.title(home)}${hint("pane.tuck")}`
    : (checkTuck(store.snapshot(), id)?.msg ?? `${title} can't be tucked`);
  const { actions } = store;
  const node = m.pane(id);
  // A curated page's view closes back into the tabs above.
  const closeHint = store.get().page && node?.role ? "Close · it stays in the tabs above" : "Close";
  return (
    <div className="jali-pane-actions">
      {chrome.tuckable && !zoomed ? (
        <button
          className="jali-icon-btn jali-act-tuck"
          aria-label={home ? tuckLabel : `Tuck ${title}`}
          title={tuckLabel}
          disabled={!home}
          onClick={() => actions.tuck(id)}
        >
          <MinusIcon size={14} aria-hidden />
        </button>
      ) : null}
      {chrome.zoomable ? <ZoomButton id={id} title={title} zoomed={zoomed} /> : null}
      <button
        className="jali-icon-btn jali-act-close"
        onClick={() => actions.close(id)}
        aria-label={`Close ${title}`}
        title={`${closeHint}${hint("pane.close")}`}
      >
        <XIcon size={14} aria-hidden />
      </button>
    </div>
  );
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const { actions, keymap } = useStore();
  const zoomKeys = keymap.label("pane.zoom");
  return (
    <button
      className="jali-icon-btn jali-act-zoom"
      onClick={() => actions.toggleZoom(id)}
      aria-label={zoomed ? `Restore ${title}` : `Maximise ${title}`}
      title={
        zoomed
          ? `Restore · ${formatChord({ key: "Escape" }, keymap.platform)}`
          : `Maximise${zoomKeys ? ` · ${zoomKeys}` : ""}`
      }
    >
      {zoomed ? (
        <ArrowsInSimpleIcon size={14} aria-hidden />
      ) : (
        <ArrowsOutSimpleIcon size={14} aria-hidden />
      )}
    </button>
  );
}
