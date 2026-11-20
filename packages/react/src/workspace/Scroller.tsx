import { own } from "@jali/core/adapter";
/**
 * Rows that scroll sideways (`row({ scroll: "x" }, …)`, docs/research/scrolling-rows.md), on screen.
 *
 * Each strip is a real scrolling element at its window, and its panes and dividers are drawn inside it at their
 * place along its content. So the browser does the scrolling, on the compositor: a sideways swipe, Shift and the
 * wheel, momentum and snapping cost no React and no layout work while they run. Jali only hears where the strip has
 * come to rest, once it rests, and keeps it in the view state (`view.scroll`), where drag hit-tests and pausing read
 * it. The scrollbar thumb and the edge fades follow the scroll straight on the DOM.
 *
 * The content box starts at the workspace's left edge (shifted back by the strip's x), so a pane's place inside it
 * is its place in the workspace, unscrolled: what a divider drag writes onto the DOM as it goes.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { layout as core, type ScrollerBox } from "@jali/core";
import { useModel, useStore, useUi } from "../state/react";

type Store = ReturnType<typeof useStore>;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The class of a strip's scrolling element; a pane in a strip finds it with `closest`. */
export const STRIP_VIEWPORT = "jali-strip-viewport";

/**
 * A row that scrolls: its window, the content inside it that the browser scrolls, and its own chrome. `children` are
 * its pane frames and its dividers.
 */
export function Strip({
  strip: s,
  zoomed,
  children,
}: {
  strip: ScrollerBox;
  zoomed: boolean;
  children: ReactNode;
}) {
  const store = useStore();
  const rtl = useUi((st) => st.dir) === "rtl";
  const view = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const max = core.maxOffset(s);
  // Right to left the content starts at its right end: Jali's offset counts from there, the browser's from the left.
  const geometry = useRef({ s, max, rtl });
  geometry.current = { s, max, rtl };
  const fromDom = (left: number) => (geometry.current.rtl ? geometry.current.max - left : left);
  const toDom = (offset: number) => (rtl ? max - offset : offset);

  /** The thumb and fades, written straight onto the DOM from where the strip is now. */
  const paint = () => {
    const el = view.current;
    if (!el) return;
    const { s, max } = geometry.current;
    const left = el.scrollLeft;
    const t = thumb.current;
    if (t && max > 0) {
      const w = Math.max(40, (s.rect.width * s.rect.width) / s.contentWidth);
      t.style.width = `${w}px`;
      t.style.transform = `translateX(${(left / max) * (s.rect.width - w)}px)`;
    }
    const host = el.parentElement!;
    host.toggleAttribute("data-more-left", max > 0 && left > 1);
    host.toggleAttribute("data-more-right", max > 0 && left < max - 1);
  };

  // Where the strip comes to rest goes to the view state, once it rests (scrollend, or 120ms after the last step):
  // telling Jali on every frame would rebuild the model, and re-render every pane that reads it, while the browser
  // is trying to scroll. The thumb and fades follow every frame, on the DOM.
  useEffect(() => {
    const el = view.current;
    if (!el) return;
    let timer = 0;
    const settle = () => {
      clearTimeout(timer);
      timer = 0;
      const { s } = geometry.current;
      // Into the view state and the link (history replaced): a reload or a shared link reopens here.
      store.actions.setScroll(s.id, fromDom(el.scrollLeft));
    };
    const onScroll = () => {
      paint();
      clearTimeout(timer);
      timer = window.setTimeout(settle, 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", settle);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // The other way: an offset Jali set (a link, a maximised pane put back) moves the element there.
  const offset = useUi((st) => core.clampOffset(s, own(st.view.scroll, s.id) ?? 0));
  useLayoutEffect(() => {
    const el = view.current;
    if (!el || zoomed) return;
    if (Math.abs(el.scrollLeft - toDom(offset)) > 1) el.scrollLeft = toDom(offset);
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, zoomed, s.rect.width, s.contentWidth, rtl]);

  const drag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = view.current;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.currentTarget;
    t.setPointerCapture(e.pointerId);
    const x0 = e.clientX,
      l0 = el.scrollLeft;
    const perPx = max / Math.max(1, s.rect.width - t.offsetWidth);
    const move = (ev: PointerEvent) => {
      el.scrollLeft = l0 + (ev.clientX - x0) * perPx;
    };
    const up = () => {
      t.removeEventListener("pointermove", move);
      t.removeEventListener("pointerup", up);
      t.removeEventListener("pointercancel", up);
    };
    t.addEventListener("pointermove", move);
    t.addEventListener("pointerup", up);
    t.addEventListener("pointercancel", up);
  };
  // A press on the track pages towards it, most of a window at a time.
  const page = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = view.current;
    if (!el || e.target !== e.currentTarget || !thumb.current) return;
    const t = thumb.current.getBoundingClientRect();
    const dir = e.clientX < t.left ? -1 : e.clientX > t.right ? 1 : 0;
    el.scrollBy({ left: dir * s.rect.width * 0.85, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const box: CSSProperties = {
    left: s.rect.x,
    top: s.rect.y,
    width: s.rect.width,
    height: s.rect.height,
  };
  return (
    <div className="jali-strip" data-strip={s.id} data-zoomed={zoomed || undefined} style={box}>
      <div ref={view} className={STRIP_VIEWPORT} data-strip-viewport={s.id}>
        <div
          className="jali-strip-content"
          dir={rtl ? "rtl" : undefined}
          style={{
            left: -s.rect.x,
            top: -s.rect.y,
            width: s.rect.x + s.contentWidth,
            height: s.rect.y + s.rect.height,
          }}
        >
          {children}
        </div>
      </div>
      {max > 0 && !zoomed ? (
        <>
          <div className="jali-strip-fade" data-edge="left" aria-hidden />
          <div className="jali-strip-fade" data-edge="right" aria-hidden />
          <div className="jali-strip-track" onPointerDown={page} aria-hidden>
            <div ref={thumb} className="jali-strip-thumb" onPointerDown={drag} />
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Focus brings the focused pane wholly into view in its strip, with the least movement: a click, F6, a link, an
 * undo. A pane that joins a strip (opened beside a pane in it, or dropped there) comes into view too, with the
 * focused pane when both fit, else on its own. The browser glides there (at once with reduced motion).
 */
export function useFocusIntoStrip(store: Store) {
  const m = useModel();
  const focused = useUi((s) => s.view.focused);
  const dir = useUi((s) => s.dir) === "rtl" ? "rtl" : "ltr";
  const boxOf = (id: string | undefined) =>
    id ? m.content.panes.find((b) => b.id === id && !b.hidden) : undefined;

  // The panes each strip held last time: a pane not among them has just joined it.
  const seen = useRef(new Map<string, ReadonlySet<string>>());
  let joined: { strip: ScrollerBox; id: string } | undefined;
  for (const strip of m.content.scrollers) {
    const was = seen.current.get(strip.id);
    if (was) for (const id of strip.paneIds) if (!was.has(id)) joined = { strip, id };
  }
  useEffect(() => {
    seen.current = new Map(m.content.scrollers.map((x) => [x.id, new Set(x.paneIds)]));
  });

  // What to show: the pane that joined (and the focused pane beside it, when both fit), else the focused pane.
  let s = focused ? m.content.scrollers.find((x) => x.paneIds.includes(focused)) : undefined;
  let rect = s ? boxOf(focused)?.rect : undefined;
  let key = "focus";
  const joinedBox = joined ? boxOf(joined.id) : undefined;
  if (joined && joinedBox) {
    s = joined.strip;
    const source = focused && s.paneIds.includes(focused) ? boxOf(focused) : undefined;
    const left = Math.min(joinedBox.rect.x, source?.rect.x ?? Infinity);
    const right = Math.max(
      joinedBox.rect.x + joinedBox.rect.width,
      source ? source.rect.x + source.rect.width : -Infinity,
    );
    rect =
      source && right - left <= s.rect.width
        ? { ...joinedBox.rect, x: left, width: right - left }
        : joinedBox.rect;
    key = `joined ${joined.id}`;
  }
  // Keyed on the strip's shape, not the model, which changes as the strip scrolls.
  const shape =
    s && rect ? `${key} ${s.id} ${s.rect.width} ${s.contentWidth} ${rect.x} ${rect.width}` : "";
  useEffect(() => {
    if (!s || !rect) return;
    const now = own(store.get().view.scroll, s.id) ?? 0;
    const to = core.offsetToShow(s, rect, now, dir);
    if (Math.abs(to - now) < 1) return;
    const el = store.dom.pane(s.paneIds[0]!)?.closest<HTMLElement>(`.${STRIP_VIEWPORT}`);
    if (!el) return;
    el.scrollTo({
      left: dir === "rtl" ? core.maxOffset(s) - to : to,
      behavior: reducedMotion() ? "auto" : "smooth",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, shape]);
}
