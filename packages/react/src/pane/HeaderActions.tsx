import { buttonsOf, checkTuck, tabMenuOf, tuckHome, type PaneButton } from "@jali/core/adapter";
import { allows } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import { useModel, useStore, useUi } from "../state/react";
import { bringBack, canPopOut, popOut, usePopOutTarget } from "./PopOut";
import type { Chrome } from "@jali/core/adapter";

interface P {
  id: string;
  title: string;
  zoomed: boolean;
  chrome: Chrome;
  /** The header shows a tab strip. */
  tabs: boolean;
  /** Open the pane's menu, from the ⋯ button. */
  onMenu: (at: { x: number; y: number; end: boolean }) => void;
}

/** The menu items each button stands for: the ⋯ shows when the menu offers something no button does. */
const COVERS: Record<PaneButton, string> = {
  close: "close",
  maximise: "zoom",
  fullScreen: "full-screen",
  tuck: "tuck",
  popOut: "pop-out",
};

/**
 * The header's buttons (`buttons`: Jali's choice unless the app's), then ⋯ for the rest of the pane's menu: 26px
 * targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join.
 */
export function HeaderActions({ id, title, zoomed, chrome, tabs, onMenu }: P) {
  const icon = useJaliIcons();
  const store = useStore();
  const m = useModel();
  const { pane: t, keys } = store.messages;
  const x = store.snapshot();
  const home = tuckHome(x, id);
  // When tuck is refused, the button says why in the announcer's own words (state/messages.ts).
  const tuckLabel = home
    ? keys.withKeys(t.tuckInto(m.title(home)), store.keymap.label("pane.tuck"))
    : (checkTuck(x, id)?.msg ?? t.cantTuck(title));
  const { actions } = store;
  const node = m.pane(id);
  // A curated page's view closes back into the tabs above.
  const closeHint = store.get().page && node?.role ? t.closeViewTip : t.closeTip;
  // On the whole screen, the way back is Exit full screen; Maximise's Restore would leave half of it.
  const full = useUi((s) => s.fullScreen === id);
  const popped = !!usePopOutTarget(store, id);
  const pop = canPopOut();
  const buttons = buttonsOf(x, id, { chrome, zoomed, full, tabs }).filter(
    (b) => b !== "popOut" || pop,
  );
  // ⋯ when the menu has more than the buttons: everything allowed is always one click away, on touch too.
  const shown = new Set(buttons.map((b) => COVERS[b]));
  const items = tabMenuOf(store, id).flat();
  if (pop && allows(x, id, "popOut")) items.push({ id: "pop-out", title: "", run: () => {} });
  const more = items.some((i) => !shown.has(i.id));
  if (!buttons.length && !more) return null;
  const button = (b: PaneButton) => {
    switch (b) {
      case "tuck":
        return (
          <button
            key={b}
            className="jali-icon-btn jali-act-tuck jali-pane-action"
            data-action="tuck"
            aria-label={home ? tuckLabel : t.tuck(title)}
            title={tuckLabel}
            disabled={!home}
            onClick={() => actions.tuck(id)}
          >
            <icon.tuck size={14} aria-hidden />
          </button>
        );
      case "maximise":
        return <ZoomButton key={b} id={id} title={title} zoomed={zoomed} />;
      case "fullScreen":
        return <FullScreenButton key={b} id={id} title={title} />;
      case "popOut":
        return (
          <button
            key={b}
            className="jali-icon-btn jali-act-popout jali-pane-action"
            data-action="popout"
            aria-label={popped ? t.bringBackPane(title) : t.popOut(title)}
            aria-pressed={popped}
            title={popped ? t.bringBack : t.popOutTip}
            onClick={() => (popped ? bringBack() : void popOut(store.jali, id))}
          >
            <icon.popOut size={14} aria-hidden />
          </button>
        );
      case "close":
        return (
          <button
            key={b}
            className="jali-icon-btn jali-act-close jali-pane-action"
            data-action="close"
            onClick={() => actions.close(id)}
            aria-label={t.close(title)}
            title={keys.withKeys(closeHint, store.keymap.label("pane.close"))}
          >
            <icon.close size={14} aria-hidden />
          </button>
        );
    }
  };
  const all = buttons.map(button);
  // ⋯ sits before Close, so Close stays in the corner.
  if (more) {
    const at = buttons.indexOf("close");
    all.splice(
      at < 0 ? all.length : at,
      0,
      <button
        key="menu"
        className="jali-icon-btn jali-act-menu jali-pane-action"
        data-action="menu"
        aria-label={t.menu(title)}
        aria-haspopup="menu"
        title={keys.withKeys(t.menuTip, "Shift+F10")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onMenu({ x: store.get().dir === "rtl" ? r.left : r.right, y: r.bottom + 2, end: true });
        }}
      >
        <icon.menu size={14} aria-hidden />
      </button>,
    );
  }
  return <div className="jali-pane-actions">{all}</div>;
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const icon = useJaliIcons();
  const { actions, keymap, messages } = useStore();
  const { pane: t, keys } = messages;
  return (
    <button
      className="jali-icon-btn jali-act-zoom jali-pane-action"
      data-action="zoom"
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
      className="jali-icon-btn jali-act-fullscreen jali-pane-action"
      data-action="fullscreen"
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
