/**
 * A tab's own menu (right-click, Shift+F10 or the menu key on a tab): Jali's items for that tab, then the app's
 * (`createJali({ tabMenu })`). The items act on the tab the menu was opened on, not the focused pane.
 */
import type { NodeId, ObjectRef } from "../layout/types";
import { tabsToClose } from "../actions/close";
import { tabBounds } from "../actions/tabs";
import { canRename } from "../actions/rename";
import { checkTuck } from "../actions/tuck";
import { checkFullScreen, checkZoom } from "../actions/focus";
import { checkSplit } from "../actions/open";
import { allows, type PaneControl } from "../actions/allow";
import type { JaliStore } from "../state/store";

/** One item in a tab's menu. */
export interface TabMenuItem {
  /** Unique in the menu. */
  id: string;
  title: string;
  run(): void;
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

/** `items` when `offered`, else none. */
const when = (offered: boolean, ...items: PaneMenuItem[]): PaneMenuItem[] => (offered ? items : []);

/** Jali's own items for pane `id`'s menu, in groups: close, move and arrange. No app code runs. */
export function paneMenuOf(store: JaliStore, id: NodeId): PaneMenuItem[][] {
  const x = store.snapshot();
  const { m, s } = x;
  const node = m.pane(id);
  const st = m.stackOf(id);
  if (!node) return [];
  const t = store.messages.tabs;
  const a = store.jali.actions;
  const keys = (command: string) => store.keymap.label(command) || undefined;
  const rtl = x.ctx.dir === "rtl";
  const at = st ? st.children.findIndex((c) => c.id === id) : -1;
  const [lo, hi] = st ? tabBounds(st.children, at) : [0, 0];
  const first = at <= lo,
    last = at >= hi;
  const after = tabsToClose(x, id, "after").length;
  const others = tabsToClose(x, id, "others").length;
  const zoomed = s.view.zoomed === id;

  // Only what the app allows for this tab (`allow`) is offered.
  const may = (c: PaneControl) => allows(x, id, c);
  const close = [
    ...when(may("close"), { id: "close", title: t.closeTab, run: () => a.close(id) }),
    // Closing other tabs needs tabs: a pane on its own (its header's menu) has none.
    ...when(
      !!st,
      {
        id: "close-others",
        title: t.closeOtherTabs,
        disabled: !others,
        run: () => a.closeTabs(id, "others"),
      },
      {
        id: "close-after",
        title: t.closeTabsAfter(rtl ? "left" : "right"),
        disabled: !after,
        run: () => a.closeTabs(id, "after"),
      },
    ),
  ];
  const move = [
    ...when(!!st && canRename(x, id), {
      id: "rename",
      title: t.rename,
      keys: keys("pane.rename"),
      run: () => void a.startRename(id),
    }),
    ...when(!!st && may("pin"), {
      id: "pin",
      title: t.pinTab,
      checked: !!node.pinned,
      run: () => a.setPinned(id, !node.pinned),
    }),
    ...when(
      !!st && may("move"),
      {
        id: "move-left",
        title: t.moveTab("left"),
        keys: keys("tab.move.left"),
        disabled: rtl ? last : first,
        run: () => a.moveTab(id, at + (rtl ? 1 : -1)),
      },
      {
        id: "move-right",
        title: t.moveTab("right"),
        keys: keys("tab.move.right"),
        disabled: rtl ? first : last,
        run: () => a.moveTab(id, at + (rtl ? -1 : 1)),
      },
      {
        id: "unmerge",
        title: t.moveOutOfTabs,
        keys: keys("pane.unmerge"),
        run: () => a.unmerge(id),
      },
    ),
  ];
  // A pane in a row that scrolls sideways can leave it from here, whichever pane of the row it is.
  const inStrip = m.resolved.scrollers.some((r) => r.paneIds.includes(id));
  const arrange = [
    ...when(inStrip && may("move"), {
      id: "move-out-of-row",
      title: t.moveOutOfRow,
      keys: keys("pane.move.out"),
      run: () => void a.moveOutOfRow(id),
    }),
    ...when(
      !checkSplit(x, id),
      {
        id: "split-right",
        title: t.splitRight,
        keys: keys("pane.split.right"),
        run: () => void a.split(id, "right"),
      },
      {
        id: "split-down",
        title: t.splitDown,
        keys: keys("pane.split.down"),
        run: () => void a.split(id, "bottom"),
      },
    ),
    ...when(!checkZoom(x, id), {
      id: "zoom",
      title: zoomed ? t.restore : t.maximise,
      keys: keys("pane.zoom"),
      run: () => void a.toggleZoom(id),
    }),
    ...when(!checkFullScreen(x, id), {
      id: "full-screen",
      title: s.fullScreen === id ? t.exitFullScreen : t.fullScreen,
      keys: keys("pane.fullscreen"),
      run: () => void a.toggleFullScreen(id),
    }),
    // A pane on its own (no tabs) can be tucked from its menu; a tab's group is already its neighbour.
    ...when(!st && !zoomed && !checkTuck(x, id), {
      id: "tuck",
      title: t.tuck,
      keys: keys("pane.tuck"),
      run: () => void a.tuck(id),
    }),
  ];
  return [close, move, arrange].filter((g) => g.length);
}
