/**
 * A tab's own menu (right-click, Shift+F10 or the menu key on a tab): Jali's items for that tab, then the app's
 * (`createJali({ tabMenu })`). The items act on the tab the menu was opened on, not the focused pane.
 *
 * A menu shows what was true when it opened, and each item runs an intent worked out when it is chosen: Move right is
 * "move this tab one place right of where it is now", Pin sets pinned, never toggles. An intent the layout has moved
 * past (the tab closed, already at the end) is refused by its step, typed, like any other action. Whether an item is
 * offered is its step's own answer (`can`): the menu only chooses hiding or greying it out.
 */
import type { NodeId, ObjectRef } from "../layout/types";
import { can } from "../actions";
import type { ActionResult } from "../state/apply";
import type { JaliStore } from "../state/store";

/** One item in a tab's menu. */
export interface TabMenuItem {
  /** Unique in the menu. */
  id: string;
  title: string;
  /** Run it, when chosen: `pane` is the pane the menu is for, as it is now (it may show another object than when the
   *  menu opened). Not run when the pane is gone. */
  run(pane: { id: NodeId; ref: ObjectRef }): void;
  /** Greyed out; text says why, and screen readers read it. */
  disabled?: boolean | string;
  /** A checkbox item: shown ticked when true, unticked when false. Leave it out for a plain item. */
  checked?: boolean;
  /** A key hint shown beside the title, such as `keyHint("Mod+D")`. A label only. */
  keys?: string;
}

/** The app's items for a tab's menu, after Jali's. `undefined` or `[]`: none for this pane. */
export type TabMenu = (pane: { id: NodeId; ref: ObjectRef }) => readonly TabMenuItem[] | undefined;

/** The ids of Jali's own items in a pane's menu. */
export type PaneMenuId =
  | "close"
  | "close-others"
  | "close-after"
  | "rename"
  | "pin"
  | "move-left"
  | "move-right"
  | "unmerge"
  | "move-out-of-row"
  | "split-right"
  | "split-down"
  | "zoom"
  | "full-screen"
  | "tuck";

/** One of Jali's own items in a pane's menu. */
export interface PaneMenuItem extends TabMenuItem {
  id: PaneMenuId;
}

/** The menu for tab `id`, in groups (a separator between each): Jali's (paneMenuOf), then the app's (appMenuOf). */
export function tabMenuOf(store: JaliStore, id: NodeId): TabMenuItem[][] {
  const own: TabMenuItem[][] = paneMenuOf(store, id);
  const app = appMenuOf(store, id);
  return app.length ? [...own, app] : own;
}

/** The app's items for pane `id`'s menu (`createJali({ tabMenu })`): its code runs, so ask only for a menu. */
export function appMenuOf(store: JaliStore, id: NodeId): TabMenuItem[] {
  const node = store.model().pane(id);
  return node ? [...(store.env.tabMenu?.({ id, ref: node.ref }) ?? [])] : [];
}

/** Choose `item` of pane `id`'s menu: it runs with the pane as it is now, or not at all when the pane is gone. */
export function chooseMenuItem(store: JaliStore, id: NodeId, item: TabMenuItem): void {
  const node = store.model().pane(id);
  if (node && !item.disabled) item.run({ id, ref: node.ref });
}

/** Jali's own items for pane `id`'s menu, in groups: close, move and arrange. No app code runs. */
export function paneMenuOf(store: JaliStore, id: NodeId): PaneMenuItem[][] {
  const { m, s } = store.snapshot();
  const node = m.pane(id);
  const st = m.stackOf(id);
  if (!node) return [];
  const t = store.messages.tabs;
  const a = store.actions;
  const keys = (command: string) => store.keymap.label(command) || undefined;
  const zoomed = s.view.zoomed === id;
  const rtl = store.ctx().dir === "rtl";
  // An item whose step refuses: left out where the app turns it off or the instance can't do it at all; greyed out,
  // saying why, where it can't now.
  const items: PaneMenuItem[] = [];
  const offer = (
    answer: ActionResult,
    item: Omit<PaneMenuItem, "disabled">,
    hide = (r: ActionResult) => r.reason === "not-allowed" || r.reason === "unavailable",
  ) => {
    if (answer.ok) return void items.push(item);
    if (!hide(answer)) items.push({ ...item, disabled: answer.message ?? true });
  };
  const group = () => items.splice(0);
  const always = () => false;

  offer(can(store, "close", id), { id: "close", title: t.closeTab, run: () => void a.close(id) });
  // Closing other tabs needs tabs: a pane on its own (its header's menu) has none.
  if (st) {
    for (const which of ["others", "after"] as const)
      offer(
        can(store, "closeTabs", id, which),
        {
          id: which === "others" ? "close-others" : "close-after",
          title: which === "others" ? t.closeOtherTabs : t.closeTabsAfter(rtl ? "left" : "right"),
          run: () => void store.run("closeTabs", id, which),
        },
        always,
      );
  }
  const close = group();
  if (st) {
    offer(
      can(store, "startRename", id),
      {
        id: "rename",
        title: t.rename,
        keys: keys("pane.rename"),
        run: () => void a.startRename(id),
      },
      () => true,
    );
    // Pin and Unpin set what the menu showed: chosen after the tab was pinned elsewhere, Pin changes nothing.
    const pinned = !!node.pinned;
    offer(can(store, "setPinned", id, !pinned), {
      id: "pin",
      title: t.pinTab,
      checked: pinned,
      run: () => void store.run("setPinned", id, !pinned),
    });
    for (const side of ["left", "right"] as const)
      offer(
        can(store, "moveTabToward", side, id),
        {
          id: side === "left" ? "move-left" : "move-right",
          title: t.moveTab(side),
          keys: keys(`tab.move.${side}`),
          run: () => void a.moveTabToward(side, id),
        },
        (r) => r.reason === "not-allowed",
      );
    offer(can(store, "unmerge", id), {
      id: "unmerge",
      title: t.moveOutOfTabs,
      keys: keys("pane.unmerge"),
      run: () => void a.unmerge(id),
    });
  }
  const move = group();
  // A pane in a row that scrolls sideways can leave it from here, whichever pane of the row it is.
  offer(can(store, "moveOutOfRow", id), {
    id: "move-out-of-row",
    title: t.moveOutOfRow,
    keys: keys("pane.move.out"),
    run: () => void a.moveOutOfRow(id),
  });
  for (const dir of ["right", "bottom"] as const)
    offer(
      can(store, "split", id, dir),
      {
        id: dir === "right" ? "split-right" : "split-down",
        title: dir === "right" ? t.splitRight : t.splitDown,
        keys: keys(dir === "right" ? "pane.split.right" : "pane.split.down"),
        run: () => void a.split(id, dir),
      },
      () => true,
    );
  offer(
    can(store, "toggleZoom", id),
    {
      id: "zoom",
      title: zoomed ? t.restore : t.maximise,
      keys: keys("pane.zoom"),
      // What the menu showed, set: never a toggle of whatever is maximised by the time it is chosen.
      run: () => void store.run("setZoom", id, !zoomed),
    },
    () => true,
  );
  offer(
    can(store, "toggleFullScreen", id),
    {
      id: "full-screen",
      title: s.fullScreen === id ? t.exitFullScreen : t.fullScreen,
      keys: keys("pane.fullscreen"),
      run: () => void store.run("setFullScreen", id, s.fullScreen !== id),
    },
    () => true,
  );
  // A pane on its own (no tabs) can be tucked from its menu; a tab's group is already its neighbour.
  if (!st && !zoomed)
    offer(
      can(store, "tuck", id),
      { id: "tuck", title: t.tuck, keys: keys("pane.tuck"), run: () => void a.tuck(id) },
      () => true,
    );
  const arrange = group();
  return [close, move, arrange].filter((g) => g.length);
}
