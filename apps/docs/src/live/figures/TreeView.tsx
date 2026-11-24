/**
 * A live workspace beside its layout tree, kept in step: the figure the docs pages use to teach the tree. The map, the
 * JSON or both sit beside or under the workspace, as `panels` and the figure's width allow. (The landing's hero, with
 * one side panel and a tour, is hero/Hero.tsx.)
 */
import { useRef, useState } from "react";
import { demoLayouts, type DemoLayoutId } from "../shop/layouts";
import { JsonView } from "../tree/JsonView";
import { LayoutMap } from "../tree/LayoutMap";
import { OverlayCard } from "../tree/OverlayCard";
import { ResetButton, Segmented, SizesToggle } from "../tree/controls";
import { TreeScope } from "../tree/TreeScope";
import { useTreeHover } from "../tree/useTreeHover";
import { LiveWorkspace } from "../workspace/LiveWorkspace";
import { resetLive, useLiveStore } from "../workspace/useLiveStore";
import { hintsFor, Tries } from "./hints";
import { useWidth } from "./useWidth";

export interface TreeViewProps {
  layout: DemoLayoutId;
  /** Height of the workspace: px, or any CSS length such as "min(76vh, 760px)". Default 360. */
  height?: number | string;
  caption?: string;
  /**
   * What sits beside the workspace. "auto" (default): the map and the JSON side by side when the figure is about
   * 1200px wide or more, else one of them with a Map | JSON switch. "map" or "json": only that one. "map+json": both,
   * side by side when there is room, else one above the other.
   */
  panels?: "auto" | "map" | "json" | "map+json";
  /** With `panels="auto"` on a narrow figure: start on the JSON rather than the map. */
  showJson?: boolean;
  /** For pages that teach the model: sizes shown from the start, and the overlay card under the map. Default false. */
  detail?: boolean;
  /** The row of things to try above the figure. Default true. */
  tries?: boolean;
}

type Panel = "map" | "json";
const PANELS: readonly { value: Panel; text: string }[] = [
  { value: "map", text: "Map" },
  { value: "json", text: "JSON" },
];

/** How the tree's panels sit, for `panels` at this width: one, one at a time with a switch, or both. */
type Arrangement =
  | { kind: "one"; panel: Panel }
  | { kind: "switch" }
  | { kind: "both"; beside: boolean };

/** Wide enough (px) for the workspace, the map and the JSON side by side. */
const THREE_UP = 1200;

function arrange(panels: NonNullable<TreeViewProps["panels"]>, width: number): Arrangement {
  if (panels === "map" || panels === "json") return { kind: "one", panel: panels };
  if (panels === "map+json") return { kind: "both", beside: width >= 56 * 16 };
  return width >= THREE_UP ? { kind: "both", beside: true } : { kind: "switch" };
}

/** What `data-parts` says to the CSS: the workspace and one panel, two stacked, or three side by side. */
const partsOf = (a: Arrangement) => (a.kind !== "both" ? "2" : a.beside ? "3" : "2+");

export function TreeView({
  layout,
  height = 360,
  caption,
  panels = "auto",
  showJson = false,
  detail = false,
  tries = true,
}: TreeViewProps) {
  const name = caption ?? demoLayouts[layout];
  const store = useLiveStore(layout, name);
  const wrap = useRef<HTMLDivElement | null>(null);
  const fig = useRef<HTMLElement | null>(null);
  const width = useWidth(fig);
  const { m, hover, setHover, preview, stage } = useTreeHover(store, wrap);
  const [chosen, choose] = useState<Panel>(showJson ? "json" : "map");
  const [sizes, setSizes] = useState(detail);

  const at = arrange(panels, width);
  const shown: Panel[] =
    at.kind === "both" ? ["map", "json"] : [at.kind === "one" ? at.panel : chosen];
  const reset = (
    <ResetButton
      onReset={() => {
        setHover(null);
        resetLive(store, layout);
      }}
    />
  );
  const switcher =
    at.kind === "switch" ? (
      <Segmented<Panel>
        label="Show the layout as"
        options={PANELS}
        value={chosen}
        onChange={choose}
      />
    ) : null;
  // The first panel shown carries Reset.
  const panel = (p: Panel) => {
    const first = shown[0] === p;
    return p === "map" ? (
      <section
        key="map"
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
            <SizesToggle on={sizes} onChange={setSizes} />
            {switcher}
            {first ? reset : null}
          </span>
        </header>
        <div className="live-panel-body">
          <LayoutMap hover={hover} setHover={setHover} sizes={sizes} />
          {detail ? <OverlayCard m={m} /> : null}
        </div>
      </section>
    ) : (
      <section
        key="json"
        className="live-panel"
        data-panel="json"
        role="group"
        aria-label="Layout tree, as JSON"
      >
        <header className="live-panel-head">
          <span className="live-panel-title">
            <b>{at.kind === "both" ? "JSON" : "Layout tree"}</b>
            <span>
              {at.kind === "both" ? "the same tree, as data" : "as JSON, the same tree as data"}
            </span>
          </span>
          <span className="live-panel-tools">
            {switcher}
            {first ? reset : null}
          </span>
        </header>
        <div className="live-panel-body is-json">
          <JsonView
            value={m.layout}
            hover={hover}
            setHover={setHover}
            label="The layout as JSON"
            compact={at.kind === "both" && at.beside && width < 1560}
          />
        </div>
      </section>
    );
  };
  const h = typeof height === "number" ? `${height}px` : height;

  return (
    <figure
      className="live-figure live-tv"
      ref={fig}
      data-live="tree-view"
      data-detail={detail || undefined}
      data-parts={partsOf(at)}
      aria-label={name}
      style={{ ["--live-ws-h" as string]: h }}
    >
      {tries ? <Tries hints={hintsFor(layout, shown.includes("json") ? "json" : "map")} /> : null}
      <div className="live-tv-grid">
        <div className="live-stage" {...stage}>
          <LiveWorkspace jali={store.jali} height={h} wrapRef={wrap} />
        </div>
        <TreeScope store={store} preview={preview}>
          {at.kind === "both" && !at.beside ? (
            <div className="live-panels">{shown.map(panel)}</div>
          ) : (
            shown.map(panel)
          )}
        </TreeScope>
      </div>
      {caption ? <figcaption className="live-caption">{caption}</figcaption> : null}
    </figure>
  );
}
