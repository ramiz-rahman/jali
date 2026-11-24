import { useEffect, useRef, useState } from "react";
import { layout as jl, type Edge, type JaliStore } from "jali-layout/adapter";
import { demoLayouts, type DemoLayoutId } from "../shop/layouts";
import { LiveWorkspace } from "../workspace/LiveWorkspace";
import { useLiveStore } from "../workspace/useLiveStore";

/** A live workspace dimmed except one part. */
export interface SpotlightProps {
  layout: DemoLayoutId;
  /** What to light: a named part (./Spotlight.tsx's NAMED), or any CSS selector inside the workspace. */
  target: NamedTarget | (string & {});
  height?: number;
  caption?: string;
  /** The short label beside the lit part. Default: one for each named part; none for a selector. */
  label?: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Place {
  left: number;
  top: number;
  side: "below" | "above" | "right" | "left" | "inside";
}

/** Where the label goes: under the part, else over it, else beside it, else inside its lower edge. */
function place(b: Box, lw: number, lh: number, W: number, H: number): Place {
  const gap = 8,
    edge = 6;
  const left = Math.max(edge, Math.min(b.x, W - lw - edge));
  if (b.y + b.h + gap + lh <= H - edge) return { left, top: b.y + b.h + gap, side: "below" };
  if (b.y - gap - lh >= edge) return { left, top: b.y - gap - lh, side: "above" };
  const top = Math.max(edge, Math.min(b.y + b.h / 2 - lh / 2, H - lh - edge));
  if (b.x + b.w + gap + lw <= W - edge) return { left: b.x + b.w + gap + 2, top, side: "right" };
  if (b.x - gap - lw >= edge) return { left: b.x - gap - lw - 2, top, side: "left" };
  return {
    left: Math.max(edge, b.x + gap),
    top: Math.max(edge, b.y + b.h - lh - gap),
    side: "inside",
  };
}
const PAD = 4;

const reducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The part, measured against the stage: the first match for a named part, every match for a selector. */
function measure(stage: HTMLElement, selector: string, all: boolean): Box | null {
  let els: Element[] = [];
  try {
    els = [...stage.querySelectorAll(selector)].filter(
      (el) => el.getClientRects().length && el.getBoundingClientRect().width > 0,
    );
  } catch {
    return null;
  }
  if (!all) els = els.slice(0, 1);
  if (!els.length) return null;
  const o = stage.getBoundingClientRect();
  const rs = els.map((el) => el.getBoundingClientRect());
  const l = Math.min(...rs.map((r) => r.left)),
    t = Math.min(...rs.map((r) => r.top));
  const r = Math.max(...rs.map((b) => b.right)),
    b = Math.max(...rs.map((x) => x.bottom));
  const x = Math.max(0, l - o.left - PAD),
    y = Math.max(0, t - o.top - PAD);
  return {
    x,
    y,
    w: Math.min(o.width - x, r - l + PAD * 2),
    h: Math.min(o.height - y, b - t + PAD * 2),
  };
}

/** Puts something on the shelf when nothing is there yet: the last pane is tucked behind its neighbour. */
function stageShelf(store: JaliStore) {
  const m = store.model();
  if (m.resolved.shelf.length || m.onePane) return;
  const id = m.visible[m.visible.length - 1];
  if (!id) return;
  const r = jl.tuck(store.get().layout, store.get().view, id, store.ctx());
  if (r.ok) store.set({ layout: r.layout });
}

const ZONES: Edge[] = ["right", "bottom", "left"];

/** A drag held mid-air so its drop zone shows: the first pane over the second, moving between zones. */
function stageDrop(store: JaliStore, step: number) {
  const m = store.model();
  const boxes = m.resolved.panes.filter((b) => !b.hidden);
  const from = boxes[0],
    to = boxes[1];
  if (!from || !to) return;
  const zone = ZONES[step % ZONES.length]!;
  const r = to.rect;
  const at = { right: [0.86, 0.55], left: [0.14, 0.55], bottom: [0.5, 0.86], top: [0.5, 0.14] }[
    zone
  ];
  store.set({
    dnd: {
      dragged: from.id,
      target: to.id,
      zone,
      x: r.x + r.width * at[0]!,
      y: r.y + r.height * at[1]!,
    },
  });
}

/** Runs `fn` once the workspace has its size (at once, if it has): returns what stops waiting. */
function whenSized(store: JaliStore, fn: () => void): () => void {
  if (store.get().area.width > 0) {
    fn();
    return () => {};
  }
  const off = store.subscribe(() => {
    if (store.get().area.width === 0) return;
    off();
    fn();
  });
  return off;
}

/** The drag held over a pane, moving from zone to zone (still, with reduced motion): returns what puts it away. */
function cycleDrops(store: JaliStore): () => void {
  let step = 0;
  const run = () => {
    if (store.get().area.width > 0) stageDrop(store, step++);
  };
  const first = setTimeout(run, 50);
  const loop = reducedMotion() ? undefined : setInterval(run, 2200);
  return () => {
    clearTimeout(first);
    clearInterval(loop);
    store.set({ dnd: null });
  };
}

/**
 * A part a page can light by name: where it is in Jali's DOM, the label beside it, and, when the part isn't there
 * by itself, the scene that shows it (set once the workspace has its size; it returns what undoes it). `inside` is
 * whether the reader's pointer is in the figure: the drag stops for them.
 */
interface NamedPart {
  selector: string;
  label: string;
  stage?(store: JaliStore, inside: boolean): (() => void) | undefined;
}

const NAMED = {
  shelf: {
    selector: "[data-shelf]",
    label: "The shelf: panes you tucked away, one click from coming back",
    stage: (store) => whenSized(store, () => stageShelf(store)),
  },
  folded: {
    selector: ".jali-tab-folded",
    label: "Folded: the panes there wasn't room for, one click from showing",
  },
  follow: {
    selector: ".jali-follow-toggle",
    label: "Following: this pane shows whatever is selected in the list",
  },
  "drop-zones": {
    selector: ".jali-drop-indicator",
    label: "Drop zone: where the pane lands when you let go",
    stage: (store, inside) => (inside ? undefined : cycleDrops(store)),
  },
  tabs: { selector: ".jali-tabbar", label: "Tabs: panes that share one place" },
  divider: { selector: ".jali-divider", label: "A divider: drag it to share the room differently" },
} satisfies Record<string, NamedPart>;

export type NamedTarget = keyof typeof NAMED;

export function Spotlight({ layout, target, height = 320, caption, label }: SpotlightProps) {
  const store = useLiveStore(layout, caption ?? demoLayouts[layout]);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [at, setAt] = useState<Place | null>(null);
  const labelEl = useRef<HTMLDivElement>(null);
  const [inside, setInside] = useState(false);
  const named: NamedPart | undefined = Object.hasOwn(NAMED, target)
    ? NAMED[target as NamedTarget]
    : undefined;
  const selector = named?.selector ?? target;
  const text = label ?? named?.label;

  // The part's scene, when it needs one: something on the shelf, a drag held over a pane.
  useEffect(() => named?.stage?.(store, inside), [store, named, inside]);

  // Follow the part as it moves (a reshape slides it, a drag carries it): measured each frame while on screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let raf = 0,
      visible = true;
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) tick();
    });
    io.observe(el);
    let last = "";
    const tick = () => {
      cancelAnimationFrame(raf);
      if (!visible) return;
      const b = measure(el, selector, !named);
      const lab = labelEl.current;
      const lw = lab?.offsetWidth ?? 0,
        lh = lab?.offsetHeight ?? 0;
      const key = b
        ? `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)},${lw},${lh}`
        : "";
      if (key !== last) {
        last = key;
        setBox(b);
        setAt(b ? place(b, lw, lh, el.clientWidth, el.clientHeight) : null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [selector, named]);

  return (
    <figure
      className="live-figure live-spot"
      data-live="spotlight"
      data-target={target}
      aria-label={caption ?? demoLayouts[layout]}
    >
      <div
        className="live-stage live-spot-stage"
        ref={stage}
        data-inside={inside || undefined}
        onPointerEnter={() => setInside(true)}
        onPointerLeave={() => setInside(false)}
      >
        <LiveWorkspace jali={store.jali} height={height} />
        <div className="live-spot-layer" aria-hidden data-on={box ? "" : undefined}>
          {box ? (
            <div
              className="live-spot-hole"
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            />
          ) : null}
          {box && text ? (
            <div
              className="live-spot-label"
              ref={labelEl}
              data-side={at?.side}
              style={
                at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: "hidden" }
              }
            >
              {text}
            </div>
          ) : null}
        </div>
      </div>
      {text ? <p className="live-sr">{text}</p> : null}
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}
