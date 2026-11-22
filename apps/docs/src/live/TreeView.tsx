import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowsHorizontalIcon,
  CursorClickIcon,
  HandGrabbingIcon,
  HandIcon,
  TreeStructureIcon,
  XIcon,
} from "@phosphor-icons/react";
import { layout as jl, type LayoutNode, type Rect, type JaliModel } from "jali/adapter";
// The tree's side panels read the live workspace beside its root, so they use the root's own provider, which
// jali/react keeps internal (the docs site lives in this repo).
import { JaliProvider } from "../../../../packages/react/src/JaliRoot";
import type { DemoLayoutId } from "./demo";
import { demoLayouts } from "./demo";
import { colourOf } from "./colours";
import { JsonView } from "./JsonView";
import { LayoutMap } from "./LayoutMap";
import { OverlayCard, PreviewRects, panesUnder, type Hover } from "./LayoutTree";
import { LiveWorkspace, resetLive, useLiveStore } from "./LiveWorkspace";
import { useLitPanes, usePaneColours } from "./light";
import { TourBar, useTour } from "./Tour";
import { ClientOnly } from "./ClientOnly";

/** A live workspace beside its layout tree, kept in step. */
export interface TreeViewProps {
  layout: DemoLayoutId;
  /** Show the JSON toggle. Default true. `false` is `panels="map"`. */
  json?: boolean;
  /** Height of the workspace: px, or any CSS length such as "min(76vh, 760px)". Default 360. */
  height?: number | string;
  caption?: string;
  /** Start on the JSON view instead of the map. */
  showJson?: boolean;
  /** For pages that teach the model: sizes shown from the start, and the overlay card under the map. Default false. */
  detail?: boolean;
  /** The row of things to try under the figure. Default true. */
  tries?: boolean;
  /**
   * What sits beside the workspace. "auto" (default): the map and the JSON side by side when the figure is about
   * 1200px wide or more, else one of them with a Map | JSON toggle. "map" or "json": only that one.
   * "map+json": both, side by side when there is room, else one above the other.
   * "side" (a hero): the workspace takes most of the width with no bars above or below it; one panel beside it shows
   * the map, the JSON or both (a switch in its header), and can be closed and brought back. The choice is remembered.
   * "collapsed" is an older name for "side".
   */
  panels?: "auto" | "map" | "json" | "map+json" | "side" | "collapsed";
  /**
   * A short scripted tour of the workspace (with `panels="side"`, the hero): it plays once a session when the figure
   * is first in view, stops for good when the reader touches anything inside, and has Play and Replay controls. It
   * never plays by itself on a phone or with reduced motion. Default false.
   */
  tour?: boolean;
}

/** Wide enough (px) for the workspace, the map and the JSON side by side. */
const THREE_UP = 1200;

/** What a reader can do in the workspace as it is now (a phone shows one pane, so there is no gap to drag). */
function triesFor(m: JaliModel, json: boolean, tree = true): { icon: ReactNode; text: string }[] {
  const list = m.panes.find((p) => p.ref.kind === "orders" && m.visible.includes(p.id));
  const follows =
    !!list && m.panes.some((p) => p.linkedTo === list.id && p.follows && m.visible.includes(p.id));
  return [
    ...(follows
      ? [
          {
            icon: <CursorClickIcon size={15} aria-hidden />,
            text: "Click an order, and the detail follows",
          },
        ]
      : []),
    // Tabs and titles drag only with panes side by side (a phone shows one at a time).
    ...(!m.onePane && m.visible.length > 1
      ? [
          {
            icon: <HandGrabbingIcon size={15} aria-hidden />,
            text: "Drag a tab or a title onto another pane",
          },
        ]
      : []),
    ...(m.resolved.dividers.length
      ? [
          {
            icon: <ArrowsHorizontalIcon size={15} aria-hidden />,
            text: "Drag the divider between panes",
          },
        ]
      : []),
    ...(m.panes.length > 1
      ? [{ icon: <XIcon size={15} aria-hidden />, text: "Close a pane" }]
      : []),
    tree
      ? {
          icon: <HandIcon size={15} aria-hidden />,
          text: json
            ? "Point at a box or a JSON block to find its pane"
            : "Point at a box to find its pane",
        }
      : {
          icon: <TreeStructureIcon size={15} aria-hidden />,
          text: "Show the layout tree to see how it is built",
        },
  ];
}

export function TreeView({
  layout,
  json = true,
  height = 360,
  caption,
  showJson = false,
  detail = false,
  tries = true,
  panels,
  tour = false,
}: TreeViewProps) {
  // Named for the figure, so two on one page never repeat a landmark; the tour is the landing's own.
  const name = caption ?? (tour ? "A tour of live panes" : demoLayouts[layout]);
  // The hero's tour drops a pane on another to make tabs: a reader's own drop there does the same.
  const store = useLiveStore(layout, name, tour ? "tab" : undefined);
  const m = useSyncExternalStore(store.subscribe, store.model, store.model);
  const [hover, setHover] = useState<Hover | null>(null);
  const [mode, setMode] = useState<"map" | "json">(showJson ? "json" : "map");
  const [sizes, setSizes] = useState(detail);
  const wrap = useRef<HTMLDivElement | null>(null);
  const fig = useRef<HTMLElement | null>(null);
  const width = useWidth(fig);

  const want = panels ?? (json ? "auto" : "map");
  const collapsed = want === "collapsed" || want === "side";
  const [side, setSide, showSide] = useSidePanel();
  const cursor = useRef<HTMLSpanElement | null>(null);
  const tourOn = tour && collapsed;
  const guide = useTour({
    enabled: tourOn,
    store,
    fig,
    wrap,
    cursor,
    showPanel: (v) => showSide(v),
    reset: () => {
      setHover(null);
      resetLive(store, layout);
    },
  });
  const three = (want === "auto" && width >= THREE_UP) || (want === "map+json" && width >= 56 * 16);
  const both = want === "map+json" || three;
  const toggle = !both && want === "auto";
  const showMap = both || want === "map" || (toggle && mode === "map");
  const showJsonPanel = both || want === "json" || (toggle && mode === "json");

  // A box in the map lights the panes under it and dims the rest; a pane under the pointer lights its box.
  const lit = useMemo(() => {
    if (!hover) return null;
    const node = jl.tree.find(m.layout.root, hover.id);
    return node ? panesUnder(node as LayoutNode) : null;
  }, [hover, m.layout.root]);
  useLitPanes(wrap, hover?.from === "tree" ? lit : null, true, m);
  usePaneColours(wrap, colourOf, m);
  const preview = useDragPreview(wrap);

  const fromWs = (e: PointerEvent) => {
    const t = e.target as Element;
    const id =
      t.closest<HTMLElement>("[data-tab]")?.dataset.tab ??
      t.closest<HTMLElement>("[data-pane]")?.dataset.pane;
    if (id && (hover?.id !== id || hover.from !== "ws")) setHover({ id, from: "ws" });
    else if (!id && hover?.from === "ws") setHover(null);
  };
  const reset = (
    <button
      type="button"
      className="live-icon-btn"
      aria-label="Reset the layout"
      title="Reset the layout"
      onClick={() => {
        setHover(null);
        guide.fullRoom();
        resetLive(store, layout);
      }}
    >
      <ArrowCounterClockwiseIcon size={14} aria-hidden />
    </button>
  );
  const switcher = toggle ? (
    <span className="live-seg" role="group" aria-label="Show the layout as">
      <button type="button" aria-pressed={mode === "map"} onClick={() => setMode("map")}>
        Map
      </button>
      <button type="button" aria-pressed={mode === "json"} onClick={() => setMode("json")}>
        JSON
      </button>
    </span>
  ) : null;
  const h = typeof height === "number" ? `${height}px` : height;
  const mapPanel = (
    <section
      className="live-panel"
      data-panel="map"
      role="group"
      aria-label="Layout tree, drawn as a map"
    >
      <header className="live-panel-head">
        <span className="live-panel-title">
          <b>Layout tree</b>
          <span>drawn as a map of the panes</span>
        </span>
        <span className="live-panel-tools">
          <button
            type="button"
            className="live-toggle"
            aria-pressed={sizes}
            onClick={() => setSizes((v) => !v)}
          >
            Sizes
          </button>
          {switcher}
          {collapsed ? null : reset}
        </span>
      </header>
      <div className="live-panel-body">
        <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
        {detail ? <OverlayCard m={m} /> : null}
      </div>
    </section>
  );
  const jsonPanel = (
    <section
      className="live-panel"
      data-panel="json"
      role="group"
      aria-label="Layout tree, as JSON"
    >
      <header className="live-panel-head">
        <span className="live-panel-title">
          <b>{both ? "JSON" : "Layout tree"}</b>
          <span>{both ? "the same tree, as data" : "as JSON, the same tree as data"}</span>
        </span>
        <span className="live-panel-tools">
          {switcher}
          {showMap || collapsed ? null : reset}
        </span>
      </header>
      <div className="live-panel-body is-json">
        <JsonView
          value={m.layout}
          hover={hover}
          setHover={setHover}
          label="The layout as JSON"
          compact={three && width < 1560}
        />
      </div>
    </section>
  );

  if (collapsed) {
    const open = side !== "closed";
    const seg = (
      <span className="live-seg" role="group" aria-label="Show the layout tree as">
        {(["map", "json", "both"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={side === v} onClick={() => setSide(v)}>
            {v === "map" ? "Map" : v === "json" ? "JSON" : "Both"}
          </button>
        ))}
      </span>
    );
    return (
      <figure
        className="live-figure live-tv"
        ref={fig}
        data-live="tree-view"
        data-parts="side"
        data-side={side}
        data-tour={tourOn ? guide.status : undefined}
        aria-label={caption ?? demoLayouts[layout]}
        style={{ ["--live-ws-h" as string]: h }}
      >
        {tourOn ? (
          <TourBar
            tour={guide}
            store={store}
            tries={
              tries ? (
                <Tries items={triesFor(m, side === "json" || side === "both", open)} />
              ) : (
                <span />
              )
            }
          />
        ) : tries ? (
          <Tries items={triesFor(m, side === "json" || side === "both", open)} />
        ) : null}
        <div className="live-tv-grid">
          <div
            className="live-stage"
            onPointerOver={fromWs}
            onPointerLeave={() => hover?.from === "ws" && setHover(null)}
          >
            <LiveWorkspace store={store} height={h} wrapRef={wrap} status={false} />
            {tourOn ? <span className="live-tour-cursor" ref={cursor} aria-hidden /> : null}
            {open ? null : (
              <button type="button" className="live-edge-tab" onClick={() => setSide("map")}>
                <TreeStructureIcon size={15} aria-hidden />
                <span>Show the layout tree</span>
              </button>
            )}
          </div>
          {open ? (
            <ClientOnly>
              <JaliProvider jali={store.jali}>
                <PreviewRects.Provider value={preview}>
                  <section
                    className="live-panel live-side"
                    role="group"
                    aria-label="The layout tree"
                  >
                    <header className="live-panel-head">
                      <span className="live-panel-title">
                        <b>Layout tree</b>
                      </span>
                      <span className="live-panel-tools">
                        {side !== "json" ? (
                          <button
                            type="button"
                            className="live-toggle"
                            aria-pressed={sizes}
                            onClick={() => setSizes((v) => !v)}
                          >
                            Sizes
                          </button>
                        ) : null}
                        {seg}
                        {reset}
                        <button
                          type="button"
                          className="live-icon-btn"
                          aria-label="Close the layout tree"
                          title="Close"
                          onClick={() => {
                            setSide("closed");
                            setHover(null);
                          }}
                        >
                          <XIcon size={15} aria-hidden />
                        </button>
                      </span>
                    </header>
                    <div className="live-side-body" data-view={side}>
                      {side !== "json" ? (
                        <div className="live-panel-body">
                          <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
                        </div>
                      ) : null}
                      {side !== "map" ? (
                        <div className="live-panel-body is-json">
                          <JsonView
                            value={m.layout}
                            hover={hover}
                            setHover={setHover}
                            label="The layout as JSON"
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                  </section>
                </PreviewRects.Provider>
              </JaliProvider>
            </ClientOnly>
          ) : null}
        </div>
        {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <figure
      className="live-figure live-tv"
      ref={fig}
      data-live="tree-view"
      data-detail={detail || undefined}
      data-parts={three ? "3" : both ? "2+" : "2"}
      aria-label={caption ?? demoLayouts[layout]}
      style={{ ["--live-ws-h" as string]: h }}
    >
      {tries ? (
        <ul className="live-tries" aria-label="Things to try">
          {triesFor(m, showJsonPanel).map((t) => (
            <li key={t.text}>
              {t.icon}
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="live-tv-grid">
        <div
          className="live-stage"
          onPointerOver={fromWs}
          onPointerLeave={() => hover?.from === "ws" && setHover(null)}
        >
          <LiveWorkspace store={store} height={h} wrapRef={wrap} />
        </div>
        <ClientOnly>
          <JaliProvider jali={store.jali}>
            <PreviewRects.Provider value={preview}>
              {both ? (
                three ? (
                  <>
                    {mapPanel}
                    {jsonPanel}
                  </>
                ) : (
                  <div className="live-panels">
                    {mapPanel}
                    {jsonPanel}
                  </div>
                )
              ) : showMap ? (
                mapPanel
              ) : showJsonPanel ? (
                jsonPanel
              ) : null}
            </PreviewRects.Provider>
          </JaliProvider>
        </ClientOnly>
      </div>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}

function Tries({ items }: { items: { icon: ReactNode; text: string }[] }) {
  return (
    <ul className="live-tries" aria-label="Things to try">
      {items.map((t) => (
        <li key={t.text}>
          {t.icon}
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  );
}

type Side = "map" | "json" | "both" | "closed";
const SIDE_KEY = "jali-docs:tree-panel";

/** The side panel's view, remembered on this device (the page works the same when storage is blocked). */
function useSidePanel(): [Side, (s: Side) => void, (s: "json" | null) => void] {
  const [side, setSide] = useState<Side>("map");
  const chosen = useRef<Side>("map");
  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDE_KEY);
      if (v === "map" || v === "json" || v === "both" || v === "closed") {
        chosen.current = v;
        setSide(v);
      }
    } catch {
      /* storage blocked: keep the default */
    }
  }, []);
  // For a while (the tour): a view that shows the JSON, not remembered; `null` goes back to the reader's choice.
  const show = (v: "json" | null) =>
    setSide(v === null ? chosen.current : chosen.current === "both" ? "both" : v);
  const set = (v: Side) => {
    chosen.current = v;
    setSide(v);
    try {
      localStorage.setItem(SIDE_KEY, v);
    } catch {
      /* storage blocked */
    }
  };
  return [side, set, show];
}

/** The figure's width, measured (0 before the first measure, as on the server). */
function useWidth(ref: { current: HTMLElement | null }): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/**
 * A divider drag moves the panes on the DOM each frame and commits once on release, so the store does not change
 * while it runs. The map reads the panes' boxes from the DOM meanwhile, so its shares move with the pointer.
 */
function useDragPreview(wrap: { current: HTMLElement | null }): Record<string, Rect> | null {
  const [rects, setRects] = useState<Record<string, Rect> | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      if (!el.querySelector(".jali-divider.is-dragging")) {
        setRects(null);
        raf = 0;
        return;
      }
      const next: Record<string, Rect> = {};
      el.querySelectorAll<HTMLElement>("[data-pane]").forEach((p) => {
        if (p.style.display === "none") return;
        next[p.dataset.pane!] = {
          x: parseFloat(p.style.left),
          y: parseFloat(p.style.top),
          width: parseFloat(p.style.width),
          height: parseFloat(p.style.height),
        };
      });
      setRects((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      raf = requestAnimationFrame(read);
    };
    const onDown = (e: Event) => {
      if (!(e.target as Element).closest?.(".jali-divider")) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    el.addEventListener("pointerdown", onDown);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(raf);
    };
  }, [wrap]);
  return rects;
}
