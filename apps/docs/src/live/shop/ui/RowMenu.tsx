/**
 * A row's menu: a small APG menu in Jali's own menu style, over the panes and in the workspace's theme.
 * ↓ ↑ Home End move, Enter or Space chooses, Esc closes and gives focus back, Tab or a press outside closes.
 * Jali keeps its own menu internal, so this one draws with Jali's menu classes and opens in Jali's layer
 * (both in ../../workspace/jali-gaps.ts and FINDINGS.md).
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { layerOf, MENU_CLASS } from "../../workspace/jali-gaps";

export interface RowMenuItem {
  id: string;
  title: string;
  /** The shortcut that does the same, as the reader's keyboard writes it. */
  keys?: string;
  run(): void;
}

export interface RowMenuProps {
  /** Where it opens, in client pixels: the pointer, or under the row. */
  at: { x: number; y: number };
  /** Something inside the workspace, to find its layer. */
  from: Element;
  label: string;
  /** Groups of items, drawn with a line between them. */
  groups: RowMenuItem[][];
  /** `refocus`: give focus back to what opened it (Esc), rather than leave it where the reader pressed. */
  onClose(refocus: boolean): void;
}

export function RowMenu({ at, from, label, groups, onClose }: RowMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);
  const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Kept inside the window: flipped to the other side of the point when it would cross an edge.
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, at.x + width > innerWidth - 8 ? at.x - width : at.x),
      y: Math.max(8, at.y + height > innerHeight - 8 ? at.y - height : at.y),
    });
    items()[0]?.focus();
  }, [at.x, at.y]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose(false);
    };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [onClose]);
  const onKey = (e: KeyboardEvent) => {
    const all = items();
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => all[(n + all.length) % all.length]?.focus();
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Escape") onClose(true);
    else if (e.key === "Tab") onClose(false);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const host = layerOf(from);
  if (!host) return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={`${MENU_CLASS.menu} live-row-menu`}
      style={{ left: pos.x, top: pos.y }}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
    >
      {groups.map((group, g) => (
        <div key={g} role="group">
          {g ? <div role="separator" className={MENU_CLASS.separator} /> : null}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={MENU_CLASS.item}
              data-menu-item={item.id}
              onClick={() => {
                onClose(false);
                item.run();
              }}
            >
              <span className={MENU_CLASS.title}>{item.title}</span>
              {item.keys ? <kbd className={MENU_CLASS.keys}>{item.keys}</kbd> : null}
            </button>
          ))}
        </div>
      ))}
    </div>,
    host,
  );
}
