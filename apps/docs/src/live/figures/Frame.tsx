/**
 * A live workspace in a frame the reader can resize, to watch panes fold and come back. Above it, the frame's width
 * and what is folded now, and a ruler that flags where each pane folds, with that pane's own icon and the width,
 * before the reader gets there, down to where one pane shows at a time. "Watch it fold" narrows the frame through
 * those widths and back, for a reader who would rather see it than drag.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowsInLineHorizontalIcon,
  DeviceMobileIcon,
  PlayIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  GAP as JALI_GAP,
  PHONE_BELOW,
  layout as jl,
  type Layout,
  type JaliStore,
  type Model,
} from "jali-layout/adapter";
import { KindIcon } from "jali-layout/react";
import { demoLayouts, type DemoLayoutId } from "../shop/layouts";
import { colourOf } from "../tree/colours";
import { JaliProvider } from "../workspace/jali-gaps";
import { LiveWorkspace } from "../workspace/LiveWorkspace";
import { resetLive, useLiveStore } from "../workspace/useLiveStore";
import { useWidth } from "./useWidth";

export interface FrameProps {
  layout: DemoLayoutId;
  /** Starting width in px; the reader can drag between minWidth and the column. */
  width?: number;
  minWidth?: number;
  height?: number;
  caption?: string;
}

const STEP = 16,
  STEP_BIG = 64;

/**
 * A point on the ruler where what is on screen changes: below `width`, the panes `folds` fold (as well as those
 * folded above it), or (`single`) one pane shows at a time.
 */
interface Mark {
  width: number;
  folds: string[];
  single: boolean;
}

/**
 * Where folding changes, found by fitting the same layout at each width from widest to narrowest, as a reader
 * narrowing the frame would (refit keeps what it folded before, so each width starts from the one above it). One
 * pane at a time is decided as the model decides it: below the phone width, or a pane too wide even folded. It is the
 * last mark: below it the switcher lists every pane, so a fold there changes nothing on screen. It needs the
 * workspace's height: before the workspace is measured, every pane is too short and everything "folds".
 */
function foldMarks(
  store: JaliStore,
  base: Layout,
  inset: number,
  min: number,
  max: number,
): Mark[] {
  const view = { focusHistory: [] };
  const ctx0 = store.ctx();
  const phone = store.env.phone?.below ?? PHONE_BELOW;
  const marks: Mark[] = [];
  let l = base,
    before: string[] | null = null;
  for (let w = max; w >= min; w -= 2) {
    const width = w - inset;
    if (!(width > 0)) break;
    const ctx = { ...ctx0, fit: { ...ctx0.fit, width } };
    l = jl.refit(l, view, ctx);
    const r = jl.resolve(l, view, ctx);
    const folded = r.shelf.filter((e) => e.reason === "folded").map((e) => e.paneId);
    const single =
      width < phone ||
      r.panes.some((b) => !b.hidden && !b.clip && b.rect.x + b.rect.width > width + 0.5);
    if (before && (single || folded.join() !== before.join()))
      marks.push({ width: w + 1, folds: folded.filter((id) => !before!.includes(id)), single });
    if (single) break;
    before = folded;
  }
  return marks;
}

/** A pane by its kind's icon, in its own colour, as the workspace marks it. */
function PaneIcon({ m, id, size = 14 }: { m: Model; id: string; size?: number }) {
  const kind = m.panes.find((p) => p.id === id)?.ref.kind;
  return (
    <span className="live-frame-icon" style={{ ["--live-id" as string]: colourOf(id) }}>
      {kind ? <KindIcon kind={kind} size={size} /> : null}
    </span>
  );
}

/** What a mark does, in words: "Notes on Huda folds", "one pane shows at a time, as on a phone". */
function markWords(k: Mark, m: Model) {
  if (k.single) return "one pane shows at a time, as on a phone";
  const names = k.folds.map((id) => m.title(id));
  return `${names.join(" and ") || "a pane"} ${names.length > 1 ? "fold" : "folds"}`;
}

/** What returns as the frame widens past a mark: "Notes on Huda comes back", "panes show side by side again". */
function returnWords(k: Mark, m: Model) {
  if (k.single) return "panes show side by side again";
  const names = k.folds.map((id) => m.title(id));
  return `${names.join(" and ") || "a pane"} ${names.length > 1 ? "come" : "comes"} back`;
}

/**
 * "Watch it fold": the frame narrows to just past the last mark and widens back, eased, then stops; with reduced
 * motion it steps from mark to mark instead. Anything the reader does with the frame stops it.
 */
function useSweep(set: (w: number) => void, cur: () => number, max: number, stops: number[]) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef(0);
  const stopNow = () => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(frame.current);
    setPlaying(false);
  };
  useEffect(() => stopNow, []);
  const low = (stops.at(-1) ?? max) - 48;
  const play = () => {
    stopNow();
    if (!max || !stops.length) return;
    setPlaying(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const steps = [...stops.map((w) => w - 2), max];
      let i = 0;
      const next = () => {
        set(steps[i]!);
        i += 1;
        if (i < steps.length) frame.current = window.setTimeout(next, 1400);
        else setPlaying(false);
      };
      next();
      return;
    }
    // Down from where it is to just past the last mark, a breath there, and back to the full width.
    const from = cur();
    const legs = [
      { a: from, b: low, ms: 2800 },
      { a: low, b: low, ms: 800 },
      { a: low, b: max, ms: 2400 },
    ];
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    let leg = 0,
      start = performance.now();
    const tick = (now: number) => {
      const { a, b, ms } = legs[leg]!;
      const t = Math.min(1, (now - start) / ms);
      set(a + (b - a) * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else if (++leg < legs.length) {
        start = now;
        frame.current = requestAnimationFrame(tick);
      } else setPlaying(false);
    };
    frame.current = requestAnimationFrame(tick);
  };
  return { playing, play, stop: stopNow };
}

export function Frame({ layout, width, minWidth = 260, height = 320, caption }: FrameProps) {
  const store = useLiveStore(layout, caption ?? demoLayouts[layout]);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const track = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  // The most the frame can be: the column it sits in.
  const max = useWidth(track);
  const [w, setW] = useState<number | null>(width ?? null);
  const [dragging, setDragging] = useState(false);
  const lo = Math.min(minWidth, max || minWidth);
  const cur = max ? Math.max(lo, Math.min(max, w ?? max)) : (w ?? 0);
  const curRef = useRef(cur);
  curRef.current = cur;

  // The workspace's inset (its padding and border) between the frame's width and the room panes get: Jali's inset
  // around the panes plus the frame's own border.
  const main = box.current?.querySelector<HTMLElement>(".jali-layout");
  const inset =
    (box.current && main ? box.current.offsetWidth - main.clientWidth : 2) + JALI_GAP * 2;
  const shape = JSON.stringify(m.layout.root);
  const areaHeight = store.get().area.height;
  const marks = useMemo(() => {
    if (!max || !areaHeight) return [];
    try {
      return foldMarks(store, { version: 1, root: m.layout.root }, inset, lo, max);
    } catch {
      return []; // the ruler is a guide; a fit it cannot work out never takes the page down
    }
  }, [store, shape, inset, lo, max, areaHeight]);

  const set = (v: number) => setW(Math.round(Math.max(lo, Math.min(max, v))));
  const sweep = useSweep(
    set,
    () => curRef.current,
    max,
    marks.map((k) => k.width),
  );
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? STEP_BIG : STEP;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") set(cur - step);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") set(cur + step);
    else if (e.key === "Home") set(lo);
    else if (e.key === "End") set(max);
    else return;
    e.preventDefault();
    sweep.stop();
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    sweep.stop();
    const start = e.clientX,
      from = cur;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus({ preventScroll: true });
    setDragging(true);
    const move = (ev: globalThis.PointerEvent) => set(from + ev.clientX - start);
    const up = () => {
      setDragging(false);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("live-frame-resizing");
    return () => document.body.classList.remove("live-frame-resizing");
  }, [dragging]);

  const folded = m.folded;
  const ticks = max ? Array.from({ length: Math.floor(max / 100) }, (_, i) => (i + 1) * 100) : [];
  // A width's number steps aside where a flag's pole or the frame's edge runs through it.
  const crossed = (t: number) =>
    Math.abs(cur - t) < 20 || marks.some((k) => Math.abs(k.width - t) < 20);
  // The next change either way: the widest mark below the frame's width, and the narrowest above it.
  const nextFold = marks.find((k) => k.width <= cur);
  const nextBack = [...marks].reverse().find((k) => k.width > cur);
  // Nothing to watch where the frame is one pane at every width it can be (a phone's column).
  const still = !!max && !marks.length;

  return (
    <figure
      className="live-figure live-frame"
      data-live="frame"
      data-dragging={dragging || undefined}
      data-playing={sweep.playing || undefined}
      aria-label={caption ?? demoLayouts[layout]}
    >
      <JaliProvider jali={store.jali}>
        <div className="live-frame-bar">
          <div className="live-frame-width" aria-live="off">
            <b>{Math.round(cur)}</b>
            <span>px wide</span>
          </div>
          <div className="live-frame-folds" aria-live="polite">
            {!max ? (
              // Not measured yet (the prerender, and hydration): one quiet line, so the bar keeps its height.
              <span className="live-frame-note" aria-hidden>
                {" "}
              </span>
            ) : m.onePane ? (
              <span className="live-frame-label">
                <DeviceMobileIcon size={13} aria-hidden /> One pane at a time, as on a phone
              </span>
            ) : folded.length ? (
              <>
                <span className="live-frame-label">
                  <ArrowsInLineHorizontalIcon size={13} aria-hidden /> Folded
                </span>
                {folded.map((id) => (
                  <span className="live-frame-chip" key={id}>
                    <PaneIcon m={m} id={id} size={12} />
                    {m.title(id)}
                  </span>
                ))}
              </>
            ) : (
              <span className="live-frame-note">Everything fits</span>
            )}
          </div>
          {still ? null : (
            <button
              type="button"
              className="live-frame-play"
              aria-pressed={sweep.playing}
              onClick={sweep.playing ? sweep.stop : sweep.play}
              disabled={!marks.length}
            >
              {sweep.playing ? (
                <StopIcon size={12} weight="fill" aria-hidden />
              ) : (
                <PlayIcon size={12} weight="fill" aria-hidden />
              )}
              {sweep.playing ? "Stop" : "Watch it fold"}
            </button>
          )}
          <button
            type="button"
            className="live-icon-btn"
            aria-label="Reset the layout and width"
            title="Reset"
            onClick={() => {
              sweep.stop();
              setW(width ?? null);
              resetLive(store, layout);
            }}
          >
            <ArrowCounterClockwiseIcon size={13} aria-hidden />
          </button>
        </div>

        <div className="live-frame-track" ref={track}>
          <div className="live-ruler" aria-hidden>
            {ticks.map((t) => (
              <span
                key={t}
                className="live-ruler-tick"
                data-crossed={crossed(t) || undefined}
                style={{ left: t }}
              >
                <i>{t}</i>
              </span>
            ))}
            {marks.map((k) => (
              <span
                key={k.width}
                className="live-ruler-mark"
                data-passed={k.width > cur || undefined}
                data-start={k.width < 72 || undefined}
                style={{ left: k.width } as CSSProperties}
                title={`Below ${k.width}px, ${markWords(k, m)}`}
              >
                <span className="live-ruler-flag">
                  {k.single ? (
                    <span className="live-ruler-phone">
                      <DeviceMobileIcon size={12} aria-hidden />
                    </span>
                  ) : (
                    k.folds.map((id) => <PaneIcon key={id} m={m} id={id} size={12} />)
                  )}
                  <b>{k.width}</b>
                </span>
              </span>
            ))}
            <span className="live-ruler-cursor" style={{ left: cur }} />
          </div>
          <div className="live-frame-room">
            <div className="live-frame-box" ref={box} style={{ width: cur || "100%" }}>
              <LiveWorkspace jali={store.jali} height={height} />
              <div
                className="live-frame-handle"
                role="separator"
                tabIndex={0}
                aria-orientation="vertical"
                aria-label="Frame width"
                aria-valuemin={Math.round(lo)}
                aria-valuemax={Math.round(max)}
                aria-valuenow={Math.round(cur)}
                aria-valuetext={`${Math.round(cur)} pixels${folded.length ? `, ${folded.length} folded` : ""}`}
                onKeyDown={onKey}
                onPointerDown={onDown}
              >
                <span aria-hidden />
              </div>
            </div>
          </div>
        </div>
      </JaliProvider>
      <p className="live-frame-hint">
        {still ? (
          "A column this narrow shows one pane at a time. On a wider screen, panes fold one by one as the frame narrows."
        ) : (
          <>
            Drag the frame's edge, or watch it fold.
            {nextFold ? ` Narrower than ${nextFold.width}px, ${markWords(nextFold, m)}` : ""}
            {nextBack
              ? `${nextFold ? "; wider" : " Wider"} than ${nextBack.width}px, ${returnWords(nextBack, m)}`
              : ""}
            {nextFold || nextBack ? "." : ""}
          </>
        )}
      </p>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}
