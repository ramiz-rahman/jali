import type { NodeId } from "@jali/core";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { allows } from "@jali/core/adapter";
import { canPopOut, popOut } from "./PopOut";
import { tabMenuOf, titleOf, type TabMenuItem } from "@jali/core/adapter";
import { useJaliIcons } from "../icons/context";
import { useStore, useUi } from "../state/react";
import { ICON } from "../icons/sized";

/** Where a tab's menu opens: at the pointer, or under the tab from the keyboard. */
export interface TabMenuAt {
  pane: NodeId;
  x: number;
  y: number;
  /** `x` is where the menu ends, not starts: under a button at the end of the header. */
  end?: boolean;
}

/**
 * A tab's own menu (APG menu): Jali's items for that tab, then the app's, in groups. Arrows move, Enter or Space
 * chooses, Esc closes and returns focus to the tab; a disabled item can be reached and says why, but does nothing.
 */
export function TabMenu({ at, onClose }: { at: TabMenuAt; onClose: (refocus: boolean) => void }) {
  const store = useStore();
  const icon = useJaliIcons();
  const dir = useUi((s) => s.dir);
  const titles = useUi((s) => s.titles);
  const menu = useRef<HTMLDivElement>(null);
  // Built once as the menu opens: what the tab could do then.
  const groups = useMemo(() => {
    const g = tabMenuOf(store, at.pane);
    // Pop out, where the browser can and the app allows it: beside Maximise and Full screen.
    if (canPopOut() && allows(store.snapshot(), at.pane, "popOut")) {
      const item: TabMenuItem = {
        id: "pop-out",
        title: store.messages.tabs.popOut,
        run: () => void popOut(store.jali, at.pane),
      };
      const near = g.find((group) => group.some((i) => i.id === "full-screen" || i.id === "zoom"));
      if (near) near.push(item);
      else g.push([item]);
    }
    return g;
  }, [store, at.pane]);
  const node = store.model().pane(at.pane);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // At the point, kept inside the window: flipped to the other side of the point when it would cross an edge.
  useLayoutEffect(() => {
    const el = menu.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const x = (dir === "rtl") !== !!at.end ? at.x - width : at.x;
    const left = x + width > window.innerWidth - 8 ? at.x - width : x;
    const top = at.y + height > window.innerHeight - 8 ? at.y - height : at.y;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [at, dir]);
  useEffect(() => {
    if (pos) menu.current?.querySelector<HTMLElement>("[data-menu-item]")?.focus();
  }, [pos]);
  useEffect(() => {
    const off = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) onClose(false);
    };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [onClose]);

  const choose = (item: TabMenuItem) => {
    if (item.disabled) return;
    onClose(true);
    item.run();
  };
  const onKey = (e: KeyboardEvent) => {
    // Keys here belong to the menu: nothing else in the app may act on them.
    const items = [...(menu.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => items[(n + items.length) % items.length]?.focus();
    let used = true;
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") onClose(true);
    else if (e.key === "Tab") onClose(false);
    else if (e.key === "Enter" || e.key === " ") (document.activeElement as HTMLElement)?.click();
    else used = false;
    if (used) {
      if (e.key !== "Tab") e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
    }
  };

  if (!node) return null;
  return createPortal(
    <div
      ref={menu}
      className="jali-tab-menu jali-tab-actions-menu"
      role="menu"
      dir={dir}
      aria-label={store.messages.tabs.tabMenuLabel(titleOf(store.env, node, titles))}
      style={pos ?? { left: at.x, top: at.y, visibility: "hidden" }}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
    >
      {groups.map((group, g) => (
        <div key={g} role="group">
          {g ? <div role="separator" className="jali-menu-sep" /> : null}
          {group.map((item) => {
            const why = typeof item.disabled === "string" ? item.disabled : undefined;
            return (
              <button
                key={item.id}
                type="button"
                data-menu-item={item.id}
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                aria-disabled={item.disabled ? true : undefined}
                aria-description={why}
                title={why}
                tabIndex={-1}
                className="jali-tab-menu-item"
                onClick={() => choose(item)}
              >
                <span className="jali-tab-menu-check" aria-hidden>
                  {item.checked ? <icon.current {...ICON.menuMark} /> : null}
                </span>
                <span className="jali-tab-menu-title">{item.title}</span>
                {item.keys ? <kbd className="jali-menu-keys">{item.keys}</kbd> : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>,
    // Into the workspace's layer, beside its dialogs, so tokens set around <JaliRoot> reach the menu too.
    store.dom.layer() ?? document.body,
  );
}
