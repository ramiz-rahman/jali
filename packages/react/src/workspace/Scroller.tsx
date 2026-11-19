/**
 * Rows that scroll sideways (`row({ scroll: "x" }, …)`, docs/research/scrolling-rows.md), on screen. The model
 * already places a strip's panes at its scroll position and cuts them to its window (`scrolled` in core), so this
 * only moves that position: a sideways wheel or trackpad swipe over the strip (Shift turns an upright wheel
 * sideways), its scrollbar, and focus, which brings the focused pane wholly into view. The offset lives in the view
 * state (`view.scroll`), by the strip's id.
 */
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { layout as core, type JaliModel, type ScrollerBox } from "@jali/core";
import { useModel, useStore, useUi } from "../state/react";

type Store = ReturnType<typeof useStore>;

const offsetOf = (store: Store, id: string) => store.get().view.scroll?.[id] ?? 0;
function setOffset(store: Store, s: ScrollerBox, offset: number) {
  const next = core.clampOffset(s, offset);
  const view = store.get().view;
  if (Math.abs((view.scroll?.[s.id] ?? 0) - next) < 0.5) return;
  store.set({ view: { ...view, scroll: { ...view.scroll, [s.id]: next } } });
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Glide a strip to an offset (instantly when motion is reduced). Returns a cancel. */
function glide(store: Store, s: ScrollerBox, to: number): () => void {
  const from = offsetOf(store, s.id);
  if (reducedMotion() || Math.abs(to - from) < 1) {
    setOffset(store, s, to);
    return () => {};
  }
  const start = performance.now();
  const ms = Math.min(420, 180 + Math.abs(to - from) / 6);
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / ms);
    const ease = 1 - Math.pow(1 - t, 3);
    setOffset(store, s, from + (to - from) * ease);
    if (t < 1) frame = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(frame);
}

/** The strip the point is over (workspace coordinates), if any: innermost last, so it wins. */
const stripAt = (m: JaliModel, x: number, y: number) =>
  [...m.resolved.scrollers]
    .reverse()
    .find(
      (s) =>
        x >= s.rect.x &&
        x <= s.rect.x + s.rect.width &&
        y >= s.rect.y &&
        y <= s.rect.y + s.rect.height,
    );

/** Can this element, or one between it and the strip, scroll sideways itself? Then the wheel is its own. */
function scrollsItself(target: EventTarget | null, stop: Element, deltaX: number): boolean {
  for (let el = target as HTMLElement | null; el && el !== stop; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const o = getComputedStyle(el).overflowX;
    if (o !== "auto" && o !== "scroll") continue;
    if (deltaX < 0 ? el.scrollLeft > 0 : el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
      return true;
  }
  return false;
}

/**
 * The strips' scrollbars and edge fades, drawn over the workspace, and the wheel and focus that move them.
 * `host` is the box the panes are positioned in (`.jali-workspace-inner`), which the model's rects are relative to.
 */
export function Scrollers({ host }: { host: RefObject<HTMLElement | null> }) {
  const store = useStore();
  const m = useModel();
  const focused = useUi((s) => s.view.focused);
  const dir = useUi((s) => s.dir) === "rtl" ? "rtl" : "ltr";
  const model = useRef(m);
  model.current = m;

  // A sideways wheel or swipe over a strip scrolls it, unless what is under the pointer scrolls sideways itself or
  // already took the wheel (a map zooms with it).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey) return;
      const box = el.getBoundingClientRect();
      const s = stripAt(model.current, e.clientX - box.left, e.clientY - box.top);
      if (!s || core.maxOffset(s) <= 0) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? s.rect.width : 1;
      // An upright wheel scrolls sideways only with Shift; a trackpad's sideways swipe always does.
      const dx =
        (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0) * unit;
      if (!dx || scrollsItself(e.target, el, dx)) return;
      e.preventDefault();
      setOffset(store, s, offsetOf(store, s.id) + (dir === "rtl" ? -dx : dx));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [host, store, dir]);

  // Focus brings the focused pane wholly into view, with the least movement: a click, F6, a link, an undo. Keyed on
  // the strip's shape, not the model (which changes on every step of a scroll, and would restart the glide).
  const s = focused ? m.content.scrollers.find((x) => x.paneIds.includes(focused)) : undefined;
  const box = s ? m.content.panes.find((b) => b.id === focused && !b.hidden) : undefined;
  const shape =
    s && box ? `${s.id} ${s.rect.width} ${s.contentWidth} ${box.rect.x} ${box.rect.width}` : "";
  useEffect(() => {
    if (!s || !box) return;
    const to = core.offsetToShow(s, box.rect, offsetOf(store, s.id), dir);
    if (Math.abs(to - offsetOf(store, s.id)) < 1) return;
    return glide(store, s, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, shape]);

  return (
    <>
      {m.resolved.scrollers.map((s) => (
        <StripChrome key={s.id} strip={s} dir={dir} />
      ))}
    </>
  );
}

/** A strip's fades at the edges where there is more, and its scrollbar, along its foot. */
function StripChrome({ strip: s, dir }: { strip: ScrollerBox; dir: "ltr" | "rtl" }) {
  const store = useStore();
  const offset = useUi((st) => core.clampOffset(s, st.view.scroll?.[s.id] ?? 0));
  const max = core.maxOffset(s);
  if (max <= 0) return null;
  const share = s.rect.width / s.contentWidth;
  const thumb = Math.max(40, s.rect.width * share);
  const along = (offset / max) * (s.rect.width - thumb);
  const start = offset > 1;
  const end = offset < max - 1;
  const left = dir === "rtl" ? end : start;
  const right = dir === "rtl" ? start : end;

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX,
      o0 = offset;
    const perPx = max / Math.max(1, s.rect.width - thumb);
    const move = (ev: PointerEvent) =>
      setOffset(store, s, o0 + (ev.clientX - x0) * perPx * (dir === "rtl" ? -1 : 1));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  // A press on the track pages towards it, a window at a time.
  const page = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = dir === "rtl" ? r.right - e.clientX : e.clientX - r.left;
    glide(store, s, offset + (x < along ? -1 : 1) * s.rect.width * 0.85);
  };

  return (
    <div
      className="jali-strip"
      data-strip={s.id}
      style={{ left: s.rect.x, top: s.rect.y, width: s.rect.width, height: s.rect.height }}
      aria-hidden
    >
      {left ? <div className="jali-strip-fade" data-edge="left" /> : null}
      {right ? <div className="jali-strip-fade" data-edge="right" /> : null}
      <div className="jali-strip-track" onPointerDown={page}>
        <div
          className="jali-strip-thumb"
          style={{ width: thumb, [dir === "rtl" ? "right" : "left"]: along }}
          onPointerDown={drag}
        />
      </div>
    </div>
  );
}
