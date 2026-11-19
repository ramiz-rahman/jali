/**
 * Stacked view's parts (a portrait phone with `phone.stack`): the divider between the two panes, how much of the
 * height the top one takes, and whether the on-screen keyboard is up (then the focused pane shows alone, so a field
 * in the lower pane isn't under the keyboard).
 */
import { STACK_GAP, type UiStore } from "@jali/core/adapter";
import type { JaliModel } from "@jali/core";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useStore } from "../state/react";

/** The heights the top pane snaps to, as a share of the stack. */
const SNAPS = [1 / 3, 1 / 2, 2 / 3];
const nearest = (r: number) =>
  SNAPS.reduce((a, b) => (Math.abs(b - r) < Math.abs(a - r) ? b : a), SNAPS[1]!);

/** True while the on-screen keyboard (or anything else) takes a quarter or more of the window's height. */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!vv) return;
    const check = () => setUp(vv.height < window.innerHeight * 0.75);
    check();
    vv.addEventListener("resize", check);
    return () => vv.removeEventListener("resize", check);
  }, []);
  return up;
}

/** Says once when two panes stack, naming them. */
export function useStackAnnouncement(store: UiStore, m: JaliModel, shown: boolean) {
  const key = shown && m.stacked ? `${m.stacked.top} ${m.stacked.bottom}` : "";
  const was = useRef("");
  useEffect(() => {
    if (key && key !== was.current && m.stacked)
      store.announce(
        store.messages.announcements.stacked(m.title(m.stacked.top), m.title(m.stacked.bottom)),
      );
    was.current = key;
  }, [key]);
}

/** The divider between the stacked panes: drag it, or use the arrow keys; it settles on a third, a half or two thirds. */
export function StackDivider({
  m,
  ratio,
  setRatio,
  height,
}: {
  m: JaliModel;
  ratio: number;
  setRatio: (r: number) => void;
  /** The stack's height. */
  height: number;
}) {
  const store = useStore();
  const t = store.messages.workspace;
  const pair = m.stacked!;
  const drag = useRef<{ startY: number; start: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const shown = live ?? ratio;
  const y = Math.round((height - STACK_GAP) * shown);
  const top = m.title(pair.top);
  const bottom = m.title(pair.bottom);
  const onKey = (e: KeyboardEvent) => {
    const i = SNAPS.indexOf(nearest(ratio));
    const next =
      e.key === "ArrowUp"
        ? SNAPS[Math.max(0, i - 1)]
        : e.key === "ArrowDown"
          ? SNAPS[Math.min(SNAPS.length - 1, i + 1)]
          : e.key === "Home"
            ? SNAPS[0]
            : e.key === "End"
              ? SNAPS.at(-1)
              : undefined;
    if (next === undefined) return;
    e.preventDefault();
    setRatio(next);
  };
  const move = (e: PointerEvent) => {
    if (!drag.current) return;
    const r = drag.current.start + (e.clientY - drag.current.startY) / Math.max(1, height);
    setLive(Math.min(0.8, Math.max(0.2, r)));
  };
  const end = () => {
    if (live !== null) setRatio(nearest(live));
    drag.current = null;
    setLive(null);
  };
  return (
    <div
      className="jali-stack-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-label={t.divider(top, bottom)}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuemin={33}
      aria-valuemax={67}
      aria-valuetext={t.stackValue(top, Math.round(shown * 100))}
      tabIndex={0}
      data-dragging={live !== null || undefined}
      style={{ top: y + STACK_GAP / 2 }}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { startY: e.clientY, start: ratio };
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}
