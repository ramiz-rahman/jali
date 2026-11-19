import { allows, checkTuck, tuckHome } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import { useModel, useStore, useUi } from "../state/react";
import type { Chrome } from "@jali/core/adapter";

interface P {
  id: string;
  title: string;
  zoomed: boolean;
  chrome: Chrome;
  /** The header shows a tab strip. */
  tabs: boolean;
}

/** Tuck, maximise, close: 26px targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join. */
export function HeaderActions({ id, title, zoomed, chrome, tabs }: P) {
  const icon = useJaliIcons();
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
  // On the whole screen, the way back is Exit full screen; Maximise's Restore would leave half of it.
  const full = useUi((s) => s.fullScreen === id);
  // What the app allows for this pane (`allow`): a control it turns off has no button.
  const x = store.snapshot();
  const canTuck = chrome.tuckable && !zoomed && allows(x, id, "tuck");
  const canZoom = chrome.zoomable && !full && (zoomed || allows(x, id, "maximise"));
  const canFull = chrome.fullScreenable && (full || allows(x, id, "fullScreen"));
  const showClose = (chrome.closeWithTabs || !tabs) && allows(x, id, "close");
  if (!canTuck && !canZoom && !canFull && !showClose) return null;
  return (
    <div className="jali-pane-actions">
      {canTuck ? (
        <button
          className="jali-icon-btn jali-act-tuck"
          aria-label={home ? tuckLabel : t.tuck(title)}
          title={tuckLabel}
          disabled={!home}
          onClick={() => actions.tuck(id)}
        >
          <icon.tuck size={14} aria-hidden />
        </button>
      ) : null}
      {canZoom ? <ZoomButton id={id} title={title} zoomed={zoomed} /> : null}
      {canFull ? <FullScreenButton id={id} title={title} /> : null}
      {showClose ? (
        <button
          className="jali-icon-btn jali-act-close"
          onClick={() => actions.close(id)}
          aria-label={t.close(title)}
          title={keys.withKeys(closeHint, store.keymap.label("pane.close"))}
        >
          <icon.close size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const icon = useJaliIcons();
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
      {zoomed ? <icon.restore size={14} aria-hidden /> : <icon.maximise size={14} aria-hidden />}
    </button>
  );
}

function FullScreenButton({ id, title }: { id: string; title: string }) {
  const icon = useJaliIcons();
  const { actions, keymap, messages } = useStore();
  const full = useUi((s) => s.fullScreen === id);
  const { pane: t, keys } = messages;
  return (
    <button
      className="jali-icon-btn jali-act-fullscreen"
      onClick={() => actions.toggleFullScreen(id)}
      aria-label={full ? t.exitFullScreen(title) : t.fullScreen(title)}
      aria-pressed={full}
      title={
        full
          ? keys.withKeys(t.exitFullScreenTip, keymap.format([{ key: "Escape" }]))
          : keys.withKeys(t.fullScreenTip, keymap.label("pane.fullscreen"))
      }
    >
      {full ? (
        <icon.exitFullScreen size={14} aria-hidden />
      ) : (
        <icon.fullScreen size={14} aria-hidden />
      )}
    </button>
  );
}
