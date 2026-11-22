import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useStore, useUi } from "../state/react";

/** Where a menu opens: at a point (the pointer, or under a control); with `end`, `x` is where it ends, not starts. */
export interface MenuAt {
  x: number;
  y: number;
  end?: boolean;
}

interface MenuProps extends HTMLAttributes<HTMLDivElement> {
  /** At a point, in the workspace's layer, kept inside the window. Without one it renders where it is, placed by CSS. */
  at?: MenuAt;
  /** Esc closes with `true` (focus goes back to what opened it); Tab and a press outside with `false`. */
  onClose(refocus: boolean): void;
  /** The item that has focus as it opens. Default: the first. */
  initial?(items: HTMLElement[]): HTMLElement | undefined;
  /** The control that opens it: a press there is that control's toggle, not a press outside. */
  trigger?: RefObject<HTMLElement | null>;
}

const ITEMS = '[role^="menuitem"]';
// React passes events up its own tree, through the portal: the header the menu came from must never see them (a press
// would drag the pane, a double-click maximise it).
const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * A menu (APG menu): focus goes in as it opens; ↓ ↑ move, wrapping, Home and End go to the ends; Enter or Space
 * chooses; Esc closes it and gives focus back; Tab or a press outside closes it. Its items are `role="menuitem"` (or
 * `menuitemcheckbox`) with `tabindex="-1"`. Keys used here are the menu's alone: nothing else in the app acts on them.
 */
export function Menu({ at, onClose, initial, trigger, style, children, ...rest }: MenuProps) {
  const store = useStore();
  const dir = useUi((s) => s.dir);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const items = () => [...(ref.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];

  // At the point, kept inside the window: flipped to the other side of the point when it would cross an edge.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !at) return;
    const { width, height } = el.getBoundingClientRect();
    const x = (dir === "rtl") !== !!at.end ? at.x - width : at.x;
    const left = x + width > window.innerWidth - 8 ? at.x - width : x;
    const top = at.y + height > window.innerHeight - 8 ? at.y - height : at.y;
    const l = Math.max(8, left),
      t = Math.max(8, top);
    setPos((p) => (p?.left === l && p.top === t ? p : { left: l, top: t }));
  }, [at?.x, at?.y, at?.end, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  // Focus goes in once, when the menu is where it shows.
  const ready = !at || !!pos;
  useEffect(() => {
    if (!ready) return;
    const all = items();
    (initial?.(all) ?? all[0])?.focus();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const off = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !trigger?.current?.contains(t)) onClose(false);
    };
    document.addEventListener("pointerdown", off, true);
    return () => document.removeEventListener("pointerdown", off, true);
  }, [onClose, trigger]);

  const menu = (
    <div
      {...rest}
      ref={ref}
      role="menu"
      dir={dir}
      style={at ? (pos ?? { left: at.x, top: at.y, visibility: "hidden" }) : style}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        const list = items();
        const i = list.indexOf(document.activeElement as HTMLElement);
        const go = (n: number) => list[(n + list.length) % list.length]?.focus();
        let used = true;
        if (e.key === "ArrowDown") go(i + 1);
        else if (e.key === "ArrowUp") go(i < 0 ? -1 : i - 1);
        else if (e.key === "Home") go(0);
        else if (e.key === "End") go(list.length - 1);
        // Escape, and Tab too: the menu sits in the dialog layer, after everything else in the page, so Tab from it
        // would leave the workspace. Focus goes back to what opened it, and the next Tab goes on from there.
        else if (e.key === "Escape" || e.key === "Tab") onClose(true);
        else if (e.key === "Enter" || e.key === " ")
          (document.activeElement as HTMLElement)?.click();
        else used = false;
        if (used) {
          e.preventDefault();
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
    >
      {children}
    </div>
  );
  // Into the workspace's layer, beside its dialogs, so tokens set around <JaliRoot> reach the menu too.
  return at ? createPortal(menu, store.dom.layer() ?? document.body) : menu;
}
