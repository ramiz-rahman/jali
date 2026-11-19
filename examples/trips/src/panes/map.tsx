/**
 * The map: MapLibre GL on OpenFreeMap's free vector tiles, with the day's stops numbered in order, the route drawn
 * between them (dots for walking, a line for transit, dashes for a taxi), the hotel, and candidates: what Explore
 * shows, or else what is near the selected place.
 *
 * What it shows with Jali:
 *  - It wants room: `width.min` 360, `comfortable` 640, and it resizes with its box (ResizeObserver, `map.resize()`),
 *    as dividers move and panes fold.
 *  - While Jali says it is `paused` (behind a tab, folded, tucked, behind a maximised pane) it does nothing: no
 *    resize, no camera moves. The last move asked for waits and happens when it is shown again.
 *  - It is a list: a pin selects its place (`select`), and the place pane follows it. A place selected anywhere else
 *    is handed to the map's selection (actions.ts), and the map flies to it.
 *  - It follows the overview: `follow` turns a selected day into `{ day }`.
 *  - Arrow keys pan it (MapLibre claims them with preventDefault, which Jali respects); ⌘K, F6 and Esc still reach
 *    the workspace.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
// MapLibre runs its tile work in a Web Worker, a file of its own. Bundled, it can't find it beside itself, so the
// bundler copies the file and gives its URL.
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapTrifoldIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import type { ObjectRef } from "@jali/core";
import { definePane, useCommands, useJali, useJaliModel, useTheme, type PaneProps } from "@jali/react";
import { selectPlace } from "../actions";
import { addToDay } from "../planning";
import { usePlan, useServices } from "../services";
import { useCurrent } from "../selection";
import { useStore } from "../store";
import { mustPlace, PLACES, placeById, type Place } from "../trip/places";
import { dayTotals, dayWith, type Plan } from "../trip/plan";
import { haversineKm } from "../trip/travel";
import { dayColor } from "../ui/colors";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Segmented } from "../ui/parts";

setWorkerUrl(mapWorkerUrl);

const mapParams = { day: Number };

/** OpenFreeMap: free, no key. Attribution comes with the tiles and MapLibre shows it. */
const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** Nava's zinc ground and a cool, quiet river, so the coral and the day colours carry the map. */
const TUNE = {
  light: { background: "#f4f4f5", water: "#cdd6dc", park: "#e3e8e1" },
  dark: { background: "#141418", water: "#1d2230", park: "#18201b" },
};

const LISBON = { center: [-9.152, 38.712] as [number, number], zoom: 12.4 };

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Theme = "light" | "dark";

/** A pin: what the map draws for one place. */
interface Pin {
  p: Place;
  role: "stop" | "hotel" | "candidate" | "other-day";
  day?: number;
  /** 1-based, for a stop. */
  order?: number;
}

function pinsFor(plan: Plan, dayN: number, candidates: readonly string[], selected: string | null): Pin[] {
  const pins = new Map<string, Pin>();
  for (const d of plan.days) {
    d.stops.forEach((id, i) => {
      const shown = dayN === 0 || d.n === dayN;
      pins.set(id, { p: mustPlace(id), role: shown ? "stop" : "other-day", day: d.n, order: i + 1 });
    });
  }
  pins.set(plan.hotel, { p: mustPlace(plan.hotel), role: "hotel" });
  for (const id of candidates) if (!pins.has(id)) pins.set(id, { p: mustPlace(id), role: "candidate" });
  if (selected && !pins.has(selected) && placeById(selected))
    pins.set(selected, { p: mustPlace(selected), role: "candidate" });
  return Array.from(pins.values());
}

function routesFor(plan: Plan, dayN: number, theme: Theme) {
  const features = plan.days
    .filter((d) => dayN === 0 || d.n === dayN)
    .flatMap((d) =>
      dayTotals(plan, d.stops).legs.map((l) => {
        const a = mustPlace(l.from);
        const b = mustPlace(l.to);
        return {
          type: "Feature" as const,
          properties: { mode: l.mode, color: dayColor(d.n, theme) },
          geometry: { type: "LineString" as const, coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
        };
      }),
    );
  return { type: "FeatureCollection" as const, features };
}

function addTripLayers(map: MapLibre, theme: Theme) {
  const tune = TUNE[theme];
  // The base style's own colours, softened, where its layers have these names (positron and dark do).
  const paint = (layer: string, prop: string, value: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop as "fill-color", value);
  };
  paint("background", "background-color", tune.background);
  paint("water", "fill-color", tune.water);
  paint("park", "fill-color", tune.park);

  if (!map.getSource("trip-routes"))
    map.addSource("trip-routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  const casing = theme === "dark" ? "#141418" : "#ffffff";
  const layer = (id: string, mode: string | null, paintSpec: Record<string, unknown>, layout = {}) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id,
      type: "line",
      source: "trip-routes",
      ...(mode ? { filter: ["==", ["get", "mode"], mode] } : {}),
      layout: { "line-cap": "round", "line-join": "round", ...layout },
      paint: paintSpec,
    } as Parameters<MapLibre["addLayer"]>[0]);
  };
  layer("route-casing", null, { "line-color": casing, "line-width": 8, "line-opacity": 0.85 });
  layer("route-transit", "transit", { "line-color": ["get", "color"], "line-width": 4 });
  layer("route-taxi", "taxi", { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [2, 1.4] }, { "line-cap": "butt" });
  layer("route-walk", "walk", { "line-color": ["get", "color"], "line-width": 4.5, "line-dasharray": [0.01, 1.8] });
}

function MapPane({ params, paused, node, inPeek }: PaneProps<typeof mapParams>) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const theme = useTheme();
  const selected = useCurrent();
  const model = useJaliModel();
  const results = useStore(services.results, (r) => r);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLButtonElement }>());
  const pausedRef = useRef(paused);
  const pending = useRef<(() => void) | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  pausedRef.current = paused;

  // Explore's results count only while its pane is on screen; else, what is near the selected place.
  const exploreShown =
    !!results && model.resolved.panes.some((b) => b.id === results.pane && !b.hidden);
  const candidates = useMemo(() => {
    if (exploreShown) return results!.ids;
    const at = selected ? placeById(selected) : undefined;
    if (!at) return [];
    return PLACES.filter((q) => q.id !== at.id && !dayWith(plan, q.id) && haversineKm(at, q) <= 0.9)
      .slice(0, 10)
      .map((q) => q.id);
  }, [exploreShown, results, selected, plan]);

  /** Run a camera move now, or when the map is next shown. */
  const whenShown = (move: () => void) => {
    if (pausedRef.current || !mapRef.current) pending.current = move;
    else move();
  };

  // The map, made once.
  useEffect(() => {
    const el = box.current;
    if (!el || inPeek) return;
    const map = new MapLibre({
      container: el,
      style: STYLE[themeRef.current],
      center: LISBON.center,
      zoom: LISBON.zoom,
      minZoom: 10,
      maxZoom: 18,
      attributionControl: { compact: false },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Ctrl + scroll or two fingers would be the cooperative alternative; a map-first app keeps plain scroll.
      cooperativeGestures: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", () => {
      setFailed(false);
      addTripLayers(map, themeRef.current);
      setStyleTick((t) => t + 1);
    });
    map.on("error", (e) => {
      // A style or tile that can't be fetched. The plan doesn't need the map: say so, and keep the pins.
      const status = (e.error as { status?: number } | undefined)?.status;
      if (!map.isStyleLoaded() || status === undefined || status >= 400) setFailed(!map.isStyleLoaded());
    });
    // The canvas is the keyboard's way in: name it, so a screen reader says what it is and what the keys do.
    map.getCanvas().setAttribute("aria-label", "Map. Arrow keys pan, plus and minus zoom.");
    mapRef.current = map;

    // It resizes with its box, unless it is out of sight (then it catches up when shown).
    let frame = 0;
    const ro = new ResizeObserver(() => {
      if (pausedRef.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (el.clientWidth > 0 && el.clientHeight > 0) map.resize();
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      for (const m of markers.current.values()) m.marker.remove();
      markers.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [inPeek]);

  // Paused: stop any camera move. Shown again: fit the box it now has, and make the move that waited.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (paused) {
      map.stop();
      return;
    }
    map.resize();
    const move = pending.current;
    pending.current = null;
    move?.();
  }, [paused]);

  // Light and dark: swap the base style; the trip's layers come back on "style.load".
  const lastTheme = useRef(theme);
  useEffect(() => {
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    mapRef.current?.setStyle(STYLE[theme], { diff: false });
  }, [theme]);

  // As a list does on first show: start on what the place pane beside it already shows, so nothing jumps.
  useEffect(() => {
    if (inPeek || jali.get().selection[node.id]) return;
    const follower = jali
      .model()
      .panes.find((p) => p.linkedTo === node.id && p.follows && p.ref.kind === "place");
    if (follower) jali.actions.select(node.id, follower.ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The routes.
  useEffect(() => {
    const src = mapRef.current?.getSource("trip-routes") as GeoJSONSource | undefined;
    src?.setData(routesFor(plan, params.day, theme));
  }, [plan, params.day, theme, styleTick]);

  // The pins: DOM markers, so each is a real button with a name, and big enough for a finger.
  const pins = useMemo(
    () => pinsFor(plan, params.day, candidates, selected),
    [plan, params.day, candidates, selected],
  );
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.p.id);
      let m = markers.current.get(pin.p.id);
      if (!m) {
        // MapLibre moves the marker's own element with `transform`; the pin is a button inside it, free to grow.
        const wrap = document.createElement("div");
        wrap.className = "pin-wrap";
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pin";
        wrap.append(el);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          selectPlace(jali, el.dataset.id!, { from: node.id });
        });
        const marker = new Marker({ element: wrap, anchor: "center" })
          .setLngLat([pin.p.lng, pin.p.lat])
          .addTo(map);
        m = { marker, el };
        markers.current.set(pin.p.id, m);
      }
      paintPin(m.el, pin, pin.p.id === selected);
    }
    for (const [id, m] of markers.current)
      if (!seen.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
  }, [pins, selected, jali, node.id, styleTick]);

  // A new day: frame its stops and the hotel.
  useEffect(() => {
    const days = plan.days.filter((d) => params.day === 0 || d.n === params.day);
    const pts = [plan.hotel, ...days.flatMap((d) => d.stops)].map(mustPlace);
    whenShown(() => {
      const map = mapRef.current;
      if (!map) return;
      const b = new LngLatBounds();
      for (const p of pts) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: framePadding(map), maxZoom: 15, duration: reducedMotion() ? 0 : 700 });
    });
    // Only when the day changes (or the map is first made): moving a stop doesn't re-frame the person's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.day]);

  // A place selected anywhere: bring it into view, gently, unless it is already well inside.
  useEffect(() => {
    if (!selected) return;
    const p = placeById(selected);
    if (!p) return;
    whenShown(() => {
      const map = mapRef.current;
      if (!map) return;
      const pt = map.project([p.lng, p.lat]);
      const { clientWidth: w, clientHeight: h } = map.getContainer();
      const inside = pt.x > w * 0.15 && pt.x < w * 0.85 && pt.y > h * 0.15 && pt.y < h * 0.7;
      if (inside) return;
      map.easeTo({
        center: [p.lng, p.lat],
        zoom: Math.max(map.getZoom(), 14),
        duration: reducedMotion() ? 0 : 600,
        padding: { top: 40, bottom: Math.min(180, h * 0.3), left: 20, right: 20 },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const showDay = (n: number) => jali.actions.openHere(node.id, mapRef_(n));
  useCommands(
    inPeek
      ? []
      : [
          {
            id: "frame",
            title: "Frame the day on the map",
            run: () => {
              const map = mapRef.current;
              const days = plan.days.filter((d) => params.day === 0 || d.n === params.day);
              const pts = [plan.hotel, ...days.flatMap((d) => d.stops)].map(mustPlace);
              if (!map) return;
              const b = new LngLatBounds();
              for (const p of pts) b.extend([p.lng, p.lat]);
              map.fitBounds(b, { padding: framePadding(map), maxZoom: 15 });
            },
          },
          {
            id: "all",
            title: params.day ? "Show every day on the map" : "Showing every day",
            disabled: params.day ? false : "Showing every day already",
            run: () => showDay(0),
          },
        ],
  );

  if (inPeek) return <div className="pane-body map-peek">Open the map in a pane to see it.</div>;

  const sel = selected ? placeById(selected) : undefined;
  const day = params.day ? plan.days.find((d) => d.n === params.day) : undefined;
  const totals = day ? dayTotals(plan, day.stops) : null;
  return (
    <div className="pane-body map" data-paused={paused || undefined}>
      <div ref={box} className="map-canvas" />
      <div className="map-top">
        <Segmented
          className="map-days"
          label="Days on the map"
          value={params.day}
          onChange={showDay}
          options={[
            { value: 0, label: "All", title: "Every day" },
            ...plan.days.map((d) => ({
              value: d.n,
              label: <span data-day={d.n} className="map-day-opt">{d.n}</span>,
              title: `Day ${d.n}: ${d.title}`,
            })),
          ]}
        />
        {day && totals ? (
          <p className="map-summary">
            <b>{day.title}</b>
            <span>
              {day.stops.length} stops, {f.minutes(totals.travelMin)} travelling
            </span>
          </p>
        ) : null}
      </div>
      <ul className="map-legend" aria-label="Route key">
        <li data-mode="walk">Walk</li>
        <li data-mode="transit">Transit</li>
        <li data-mode="taxi">Taxi</li>
      </ul>
      {sel ? <PlaceCard p={sel} dayN={params.day} plan={plan} from={node.id} /> : null}
      {failed ? (
        <div className="map-failed" role="status">
          <WarningCircleIcon size={22} aria-hidden />
          <p>
            <b>The map tiles didn't load.</b> Your plan, the lists and the budget all work without them. Check
            the connection and reload to try again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const mapRef_ = (day: number): ObjectRef => map({ day });

function framePadding(map: MapLibre) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const pad = Math.max(24, Math.min(80, w * 0.08));
  return { top: pad + 48, bottom: pad + Math.min(150, h * 0.25), left: pad, right: pad + 24 };
}

function paintPin(el: HTMLButtonElement, pin: Pin, selected: boolean) {
  const { p, role, day, order } = pin;
  el.dataset.id = p.id;
  el.dataset.role = role;
  el.dataset.category = p.category;
  if (day) el.dataset.day = String(day);
  else delete el.dataset.day;
  el.toggleAttribute("data-selected", selected);
  // The day's stops and the hotel are in the Tab order; other pins are reached by pointer or by the lists.
  el.tabIndex = role === "stop" || role === "hotel" ? 0 : -1;
  const text = role === "stop" ? String(order) : role === "other-day" ? "" : "";
  if (el.textContent !== text) el.textContent = text;
  el.setAttribute(
    "aria-label",
    role === "stop"
      ? `Day ${day}, stop ${order}: ${p.name}`
      : role === "hotel"
        ? `Your hotel: ${p.name}`
        : role === "other-day"
          ? `${p.name}, on Day ${day}`
          : `${p.name}, not planned`,
  );
  el.title = p.name;
  el.parentElement!.style.zIndex = selected ? "5" : role === "stop" ? "3" : role === "hotel" ? "4" : "1";
}

/** The selected place, over the bottom of the map: what it is, and the next step. */
function PlaceCard({ p, dayN, plan, from }: { p: Place; dayN: number; plan: Plan; from: string }) {
  const jali = useJali();
  const services = useServices();
  const on = dayWith(plan, p.id);
  const Icon = CATEGORY_ICON[p.category];
  const target = dayN || on?.n || 1;
  return (
    <div className="map-card" aria-label={`Selected: ${p.name}`} role="region">
      <div className="map-card-text">
        <p className="map-card-kind">
          <Icon size={14} weight="bold" aria-hidden /> {p.kind}, {p.area}
          {p.fictional ? <span className="tag">Made up</span> : null}
        </p>
        <p className="map-card-name">{p.name}</p>
        <p className="map-card-meta">
          {on ? (
            <>
              <DayMark n={on.n} size="sm" /> Day {on.n}, stop {on.stops.indexOf(p.id) + 1}
            </>
          ) : plan.hotel === p.id ? (
            "Your hotel"
          ) : (
            "Not planned"
          )}
          <span className="num">{f.price(p.price)}</span>
        </p>
      </div>
      <button
        type="button"
        className="map-card-close icon-btn"
        aria-label="Clear the selection"
        title="Clear the selection"
        onClick={() => jali.actions.select(from, null)}
      >
        <XIcon size={16} aria-hidden />
      </button>
      <div className="map-card-actions">
        {p.category !== "stay" && on?.n !== target ? (
          <button type="button" className="btn btn-primary" onClick={() => addToDay(services, p.id, target)}>
            {on ? `Move to Day ${target}` : `Add to Day ${target}`}
          </button>
        ) : null}
        <button type="button" className="btn" onClick={() => selectPlace(jali, p.id, { from, open: true })}>
          Details
        </button>
      </div>
    </div>
  );
}

export const map = definePane("map", {
  params: mapParams,
  // The overview selects a day; the map that follows it shows that day.
  follow: (selected) => (selected.kind === "day" ? { day: Number(selected.params.n) } : undefined),
  title: ({ day }) => (day ? `Map of Day ${day}` : "Trip map"),
  icon: MapTrifoldIcon,
  width: { min: 360, comfortable: 640 },
  height: { min: 300 },
  Component: MapPane,
});
