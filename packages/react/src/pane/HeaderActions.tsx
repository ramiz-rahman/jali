import { appMenuOf, can, chooseMenuItem, own } from "@jali/core/adapter";
import { buttonsOf, tuckHome, type PaneButton } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import { useDerived, useStore, useUi } from "../state/react";
import { useCanPopOut, usePoppedOut } from "./popped";
import { paneActionsOf, popOutItem, type PaneActionId } from "./actions";
import { useKeymap } from "../state/hydrated";
import type { Chrome } from "@jali/core/adapter";
import { ICON } from "../icons/sized";
import type { NarrowLevel } from "./header-width";

interface P {
  id: string;
  title: string;
  zoomed: boolean;
  chrome: Chrome;
  /** The header shows a tab strip. */
  tabs: boolean;
  /** How far a narrow header has given way (header-width.ts): 1 or more, the buttons the menu also offers move into it. */
  narrow?: NarrowLevel;
  /** Open the pane's menu, from the ⋯ button. */
  onMenu: (at: { x: number; y: number; end: boolean }, opener: HTMLElement) => void;
}

/** The menu item each button stands for: the ⋯ shows when the menu offers something no button does. */
const COVERS: Record<PaneButton, PaneActionId> = {
  close: "close",
  maximise: "zoom",
  fullScreen: "full-screen",
  tuck: "tuck",
  popOut: "pop-out",
};

/** What a narrow header moves into ⋯; Close and ⋯ itself stay. */
const MOVES: ReadonlySet<PaneButton> = /* @__PURE__ */ new Set([
  "tuck",
  "maximise",
  "fullScreen",
  "popOut",
]);

/**
 * The header's buttons (`buttons`: Jali's choice unless the app's), then ⋯ for the rest of the pane's menu: 26px
 * targets, 4px apart. Tuck is a plain minus: it puts the pane behind the pane it would join.
 */
/** What the header shows, worked out from the whole instance: compared by value, so a change elsewhere (a divider
 *  moved, another pane's title) doesn't re-render every pane's header. */
interface Plan {
  home: boolean;
  tuckLabel: string;
  closeHint: string;
  buttons: PaneButton[];
  /** The menu offers something no button does. */
  menuMore: boolean;
}
const samePlan = (a: Plan, b: Plan) =>
  a.home === b.home &&
  a.tuckLabel === b.tuckLabel &&
  a.closeHint === b.closeHint &&
  a.menuMore === b.menuMore &&
  a.buttons.length === b.buttons.length &&
  a.buttons.every((x, i) => x === b.buttons[i]);

export function HeaderActions({ id, title, zoomed, chrome, tabs, narrow = 0, onMenu }: P) {
  const icon = useJaliIcons();
  const store = useStore();
  const { pane: t, keys } = store.messages;
  const { actions } = store;
  // On the whole screen, the way back is Exit full screen; Maximise's Restore would leave half of it.
  const full = useUi((s) => s.fullScreen === id);
  const popped = usePoppedOut(store, id).out;
  const pop = useCanPopOut(store);
  // Key labels as the server printed them until hydration, then the reader's own.
  const keymap = useKeymap();
  const { home, tuckLabel, closeHint, buttons, menuMore } = useDerived(
    (): Plan => {
      const x = store.snapshot();
      const home = tuckHome(x, id);
      // When tuck is refused, the button says why in the announcer's own words (state/messages.ts).
      const tuckLabel = home
        ? keys.withKeys(t.tuckInto(x.m.title(home)), keymap.label("pane.tuck"))
        : (can(store, "tuck", id).message ?? t.cantTuck(title));
      // A curated page's view closes back into the tabs above.
      const closeHint = x.s.page && x.m.pane(id)?.role ? t.closeViewTip : t.closeTip;
      // Jali's own items in the menu (pane/actions.ts): Pop out or Bring back, as the button is now.
      const items = paneActionsOf(store, id, pop).flat();
      // A narrow header keeps its title: what the menu also offers moves into it, and a tuck that can't happen goes.
      const inMenu = new Set(items.map((i) => i.id));
      const buttons = buttonsOf(x, id, { chrome, zoomed, full, tabs, popped }).filter(
        (b) =>
          (b !== "popOut" || pop) &&
          !(narrow && MOVES.has(b) && (inMenu.has(COVERS[b]) || (b === "tuck" && !home))),
      );
      const shown = new Set(buttons.map((b) => COVERS[b]));
      // The app's items are asked for only when Jali's alone don't already show ⋯.
      const menuMore = items.some((i) => !shown.has(i.id)) || appMenuOf(store, id).length > 0;
      return { home: !!home, tuckLabel, closeHint, buttons, menuMore };
    },
    samePlan,
    [store, id, title, zoomed, chrome, tabs, narrow, full, pop, popped, keymap],
  );
  // With the app's controls hidden too, the menu lists the pane's commands in their place.
  const commands = useUi((s) => (narrow === 2 ? (own(s.paneCommands, id)?.length ?? 0) : 0));
  // ⋯ when the menu has more than the buttons: everything allowed is always one click away, on touch too.
  const more = commands > 0 || menuMore;
  if (!buttons.length && !more) return null;
  const button = (b: PaneButton) => {
    switch (b) {
      case "tuck":
        return (
          <button
            type="button"
            key={b}
            className="jali-icon-btn jali-act-tuck jali-pane-action"
            data-action="tuck"
            aria-label={home ? tuckLabel : t.tuck(title)}
            title={tuckLabel}
            // Reachable when it can't tuck, so its reason (the name and tooltip) can be read.
            aria-disabled={!home || undefined}
            onClick={() => home && actions.tuck(id)}
          >
            <icon.tuck {...ICON.header} aria-hidden />
          </button>
        );
      case "maximise":
        return <ZoomButton key={b} id={id} title={title} zoomed={zoomed} />;
      case "fullScreen":
        return <FullScreenButton key={b} id={id} title={title} />;
      case "popOut":
        return (
          <button
            type="button"
            key={b}
            className="jali-icon-btn jali-act-popout jali-pane-action"
            data-action="popout"
            aria-label={popped ? t.bringBackPane(title) : t.popOut(title)}
            aria-pressed={popped}
            title={popped ? t.bringBack : t.popOutTip}
            // The menu's own action (pane/actions.ts), so the button and ⋯ can't disagree on what it does.
            onClick={() => {
              const item = popOutItem(store, id, pop);
              if (item) chooseMenuItem(store, id, item);
            }}
          >
            <icon.popOut {...ICON.header} aria-hidden />
          </button>
        );
      case "close":
        return (
          <button
            type="button"
            key={b}
            className="jali-icon-btn jali-act-close jali-pane-action"
            data-action="close"
            onClick={() => actions.close(id)}
            aria-label={t.close(title)}
            title={keys.withKeys(closeHint, keymap.label("pane.close"))}
          >
            <icon.close {...ICON.header} aria-hidden />
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
        type="button"
        key="menu"
        className="jali-icon-btn jali-act-menu jali-pane-action"
        data-action="menu"
        aria-label={t.menu(title)}
        aria-haspopup="menu"
        title={keys.withKeys(t.menuTip, "Shift+F10")}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onMenu(
            { x: store.get().dir === "rtl" ? r.left : r.right, y: r.bottom + 2, end: true },
            e.currentTarget,
          );
        }}
      >
        <icon.menu {...ICON.header} aria-hidden />
      </button>,
    );
  }
  return (
    <div className="jali-pane-actions" data-count={all.length}>
      {all}
    </div>
  );
}

function ZoomButton({ id, title, zoomed }: { id: string; title: string; zoomed: boolean }) {
  const icon = useJaliIcons();
  const { actions, messages } = useStore();
  const keymap = useKeymap();
  const { pane: t, keys } = messages;
  return (
    <button
      type="button"
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
      {zoomed ? (
        <icon.restore {...ICON.header} aria-hidden />
      ) : (
        <icon.maximise {...ICON.header} aria-hidden />
      )}
    </button>
  );
}

function FullScreenButton({ id, title }: { id: string; title: string }) {
  const icon = useJaliIcons();
  const { actions, messages } = useStore();
  const keymap = useKeymap();
  const full = useUi((s) => s.fullScreen === id);
  const { pane: t, keys } = messages;
  return (
    <button
      type="button"
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
        <icon.exitFullScreen {...ICON.header} aria-hidden />
      ) : (
        <icon.fullScreen {...ICON.header} aria-hidden />
      )}
    </button>
  );
}
