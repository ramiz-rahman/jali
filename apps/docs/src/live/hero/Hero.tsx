/**
 * The landing's hero: a live workspace with one panel beside it showing its layout tree (the map, the JSON or both),
 * which the reader can close and bring back, and a short scripted tour above it (./tour).
 */
import { useRef, useState } from "react";
import { TreeStructureIcon, XIcon } from "@phosphor-icons/react";
import { hintsFor, Tries } from "../figures/hints";
import { demoLayouts, type DemoLayoutId } from "../shop/layouts";
import { JsonView } from "../tree/JsonView";
import { LayoutMap } from "../tree/LayoutMap";
import { ResetButton, Segmented, SizesToggle } from "../tree/controls";
import { TreeScope } from "../tree/TreeScope";
import { useTreeHover } from "../tree/useTreeHover";
import { LiveWorkspace } from "../workspace/LiveWorkspace";
import { resetLive, useLiveStore } from "../workspace/useLiveStore";
import { TourBar } from "./tour/TourBar";
import { useTour } from "./tour/useTour";
import { useSidePanel, type SideView } from "./useSidePanel";

export interface HeroProps {
  layout: DemoLayoutId;
  /** Height of the workspace: px, or any CSS length such as "min(70vh, 720px)". */
  height: number | string;
}

const VIEWS: readonly { value: Exclude<SideView, "closed">; text: string }[] = [
  { value: "map", text: "Map" },
  { value: "json", text: "JSON" },
  { value: "both", text: "Both" },
];

export function Hero({ layout, height }: HeroProps) {
  // The figure is named for its layout and the workspace for the tour, so the page never repeats a landmark's name.
  // The tour drops a pane on another to make tabs: a reader's own drop there does the same.
  const store = useLiveStore(layout, "A tour of live panes", "tab");
  const wrap = useRef<HTMLDivElement | null>(null);
  const fig = useRef<HTMLElement | null>(null);
  const cursor = useRef<HTMLSpanElement | null>(null);
  const { m, hover, setHover, preview, stage } = useTreeHover(store, wrap);
  const panel = useSidePanel();
  const [sizes, setSizes] = useState(false);
  const reset = () => {
    setHover(null);
    resetLive(store, layout);
  };
  const tour = useTour({
    store,
    fig,
    wrap,
    cursor,
    showPanel: panel.showFor,
    hover: (id) => setHover(id ? { id, from: "tree" } : null),
    reset,
  });
  const view = panel.view;
  const open = view !== "closed";
  const h = typeof height === "number" ? `${height}px` : height;
  const hints = hintsFor(layout, !open ? "none" : view === "map" ? "map" : "json");

  return (
    <figure
      className="live-figure live-tv"
      ref={fig}
      data-live="tree-view"
      data-parts="side"
      data-side={view}
      data-tour={tour.status}
      aria-label={demoLayouts[layout]}
      style={{ ["--live-ws-h" as string]: h }}
    >
      <TourBar tour={tour} store={store} tries={<Tries hints={hints} />} />
      <div className="live-tv-grid">
        <div className="live-stage" {...stage}>
          <LiveWorkspace jali={store.jali} height={h} wrapRef={wrap} status={false} />
          <span className="live-tour-cursor" ref={cursor} aria-hidden />
        </div>
        {open ? (
          <TreeScope store={store} preview={preview}>
            <section className="live-panel live-side" role="group" aria-label="The layout tree">
              <header className="live-panel-head">
                <span className="live-panel-title">
                  <b>Layout tree</b>
                </span>
                <span className="live-panel-tools">
                  {view !== "json" ? <SizesToggle on={sizes} onChange={setSizes} /> : null}
                  <Segmented
                    label="Show the layout tree as"
                    options={VIEWS}
                    value={view}
                    onChange={panel.choose}
                  />
                  <ResetButton onReset={reset} />
                  <button
                    type="button"
                    className="live-icon-btn"
                    aria-label="Close the layout tree"
                    title="Close"
                    onClick={() => {
                      panel.choose("closed");
                      setHover(null);
                    }}
                  >
                    <XIcon size={15} aria-hidden />
                  </button>
                </span>
              </header>
              <div className="live-side-body" data-view={view}>
                {view !== "json" ? (
                  <div className="live-panel-body">
                    <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
                  </div>
                ) : null}
                {view !== "map" ? (
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
          </TreeScope>
        ) : (
          // Closed, the panel leaves a tab where it opens, beside the workspace rather than over it.
          <button type="button" className="live-edge-tab" onClick={() => panel.choose("map")}>
            <TreeStructureIcon size={15} aria-hidden />
            <span>Show the layout tree</span>
          </button>
        )}
      </div>
    </figure>
  );
}
