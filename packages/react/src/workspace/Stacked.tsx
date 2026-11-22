/**
 * Stacked view's parts (a portrait phone with `phone.stack`): the divider between the two panes, how much of the
 * height the top one takes, and whether the on-screen keyboard is up (then the focused pane shows alone, so a field
 * in the lower pane isn't under the keyboard).
 */
import { paneDomId, stackSplit, type Hinge, type JaliStore } from "@jali/core/adapter";
import type { ModelGeometry } from "@jali/core/adapter";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useModelValue, useStore } from "../state/react";

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
export function useStackAnnouncement(store: JaliStore, m: ModelGeometry, shown: boolean) {
  const key = shown && m.stacked ? `${m.stacked.top} ${m.stacked.bottom}` : "";
  const was = useRef("");
  useEffect(() => {
    if (key && key !== was.current && m.stacked) {
      const said = store.messages.announcements;
      // The names as they are now: the geometry has none of its own.
      const { title } = store.model();
      const [a, b] = [title(m.stacked.top), title(m.stacked.bottom)];
      store.announce(m.stacked.hinge ? said.foldSplit(a, b) : said.stacked(a, b));
    }
    was.current = key;
  }, [key]);
}

/** The divider between the stacked panes: drag it, or use the arrow keys; it settles on a third, a half or two thirds. */
export function StackDivider({
  m,
  at,
  setRatio,
  height,
}: {
  m: ModelGeometry;
  /** Where it sits and the top pane's share it shows, from the same split as the frames (placement.ts). */
  at: { share: number; y: number; height: number };
  setRatio: (r: number) => void;
  /** The stack's height. */
  height: number;
}) {
  const store = useStore();
  const t = store.messages.panes;
  const pair = m.stacked!;
  const drag = useRef<{ startY: number; start: number } | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const ratio = at.share;
  const shown = live ?? ratio;
  // The divider is the room between the panes, all of it and no more: it never covers either pane's rows. While
  // dragged, it follows the pointer ahead of the panes, which move when it settles.
  const { y, height: room } = live === null ? at : stackSplit(height, live, store.env.spacing.gap);
  const top = useModelValue((x) => x.title(pair.top));
  const bottom = useModelValue((x) => x.title(pair.bottom));
  // A step goes to the next stop the way the key says, from wherever the share is (it may sit between stops).
  const onKey = (e: KeyboardEvent) => {
    const next =
      e.key === "ArrowUp"
        ? (SNAPS.findLast((s) => s < ratio - 0.005) ?? SNAPS[0])
        : e.key === "ArrowDown"
          ? (SNAPS.find((s) => s > ratio + 0.005) ?? SNAPS.at(-1))
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
  // Released, it settles on the nearest stop; cancelled (the browser took the pointer), it goes back.
  const end = (e: PointerEvent) => {
    if (live !== null && e.type !== "pointercancel") setRatio(nearest(live));
    drag.current = null;
    setLive(null);
  };
  // The range holds every share it can show: the stops while at rest, as far as a drag goes while dragged.
  const now = Math.round(shown * 100);
  return (
    <div
      className="jali-stack-divider"
      role="separator"
      aria-orientation="horizontal"
      aria-label={t.divider(top, bottom)}
      aria-controls={paneDomId(store.dom.id, pair.top)}
      aria-valuenow={now}
      aria-valuemin={Math.min(20, now)}
      aria-valuemax={Math.max(80, now)}
      aria-valuetext={t.stackValue(top, now)}
      tabIndex={0}
      data-dragging={live !== null || undefined}
      style={{ top: y, height: room }}
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

/** A fold's hinge, drawn as a hairline where the halves meet (a seamless fold has no gap of its own). */
export function FoldLine({
  hinge,
  origin,
}: {
  hinge: Hinge;
  origin: { left: number; top: number };
}) {
  const row = hinge.axis === "row";
  const at = hinge.start + hinge.size / 2 - (row ? origin.left : origin.top);
  return (
    <div
      className="jali-fold-line"
      aria-hidden
      style={
        row ? { left: at, top: 0, bottom: 0, width: 1 } : { top: at, left: 0, right: 0, height: 1 }
      }
    />
  );
}
