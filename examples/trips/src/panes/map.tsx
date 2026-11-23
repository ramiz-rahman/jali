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
import type { ObjectRef } from "jali";
import {
  definePane,
  useCommands,
  useJali,
  useJaliModel,
  useJaliState,
  useJaliTheme,
  type PaneProps,
} from "jali/react";
import { selectPlace } from "../actions";
import { addToDay } from "../planning";
import { usePlan, useServices } from "../services";
import { useCurrent } from "../selection";
import { useStore } from "../store";
import {
  AIRPORT,
  CITY_NAME,
  mustPlace,
  PLACES,
  placeById,
  type CityId,
  type Place,
} from "../trip/places";
import { daysIn, dayTotals, dayWith, isHotel, routeOf, type Day, type Plan } from "../trip/plan";
import { haversineKm } from "../trip/travel";
import { dayColor } from "../ui/colors";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Segmented } from "../ui/parts";
import { Photo, photoSrc } from "../ui/photo";
import { photoOf } from "../trip/photos";
import { repairStyle } from "./map-style";
import {
  layoutPins,
  overlaps,
  pileMark,
  type PileStop,
  type PinBox,
  type Rect,
} from "./pin-layout";

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

/** Thailand, with both cities in view, until the first day is framed. */
const TRIP = { center: [99.55, 10.9] as [number, number], zoom: 5 };

/** Below this zoom the map shows each city as one badge rather than its pins (they would pile up). */
const CITY_ZOOM = 8.5;

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

type Theme = "light" | "dark";

/** A pin: what the map draws for one place. */
interface Pin {
  p: Place;
  role: "stop" | "hotel" | "candidate" | "other-day" | "airport";
  day?: number;
  /** 1-based, for a stop. */
  order?: number;
}

function pinsFor(
  plan: Plan,
  dayN: number,
  candidates: readonly string[],
  selected: string | null,
): Pin[] {
  const pins = new Map<string, Pin>();
  for (const d of plan.days) {
    d.stops.forEach((id, i) => {
      const shown = dayN === 0 || d.n === dayN;
      pins.set(id, {
        p: mustPlace(id),
        role: shown ? "stop" : "other-day",
        day: d.n,
        order: i + 1,
      });
    });
  }
  for (const id of Object.values(plan.hotels)) pins.set(id, { p: mustPlace(id), role: "hotel" });
  for (const id of Object.values(AIRPORT)) pins.set(id, { p: mustPlace(id), role: "airport" });
  for (const id of candidates)
    if (!pins.has(id)) pins.set(id, { p: mustPlace(id), role: "candidate" });
  if (selected && !pins.has(selected) && placeById(selected))
    pins.set(selected, { p: mustPlace(selected), role: "candidate" });
  return Array.from(pins.values());
}

/** The flight as a gentle arc, not a ruler line across the gulf. */
function arc(a: Place, b: Place, steps = 48): [number, number][] {
  const [x1, y1, x2, y2] = [a.lng, a.lat, b.lng, b.lat];
  // The control point sits off the middle, to the west of the line.
  const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  const [dx, dy] = [x2 - x1, y2 - y1];
  const [cx, cy] = [mx - dy * 0.18, my + dx * 0.18];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
  });
}

function routesFor(plan: Plan, dayN: number, theme: Theme) {
  const features = plan.days
    .filter((d) => dayN === 0 || d.n === dayN)
    .flatMap((d) =>
      dayTotals(plan, d).legs.map((l) => {
        const a = mustPlace(l.from);
        const b = mustPlace(l.to);
        return {
          type: "Feature" as const,
          properties: { mode: l.mode, color: dayColor(d.n, theme) },
          geometry: {
            type: "LineString" as const,
            coordinates:
              l.mode === "flight"
                ? arc(a, b)
                : [
                    [a.lng, a.lat],
                    [b.lng, b.lat],
                  ],
          },
        };
      }),
    );
  return { type: "FeatureCollection" as const, features };
}

/** A city's part of the trip: its hotel and every stop on its days. */
const cityPoints = (plan: Plan, city: CityId): Place[] =>
  [plan.hotels[city], ...daysIn(plan, city).flatMap((d) => d.stops)].map(mustPlace);

/** "Days 1 to 3", "Day 4". */
function dayRange(days: readonly Day[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "No days";
  return first === last ? `Day ${first.n}` : `Days ${first.n} to ${last.n}`;
}

/** The places to frame for a day: its own city's part of the route (on the transfer day, from the landing). */
function framePoints(plan: Plan, dayN: number): Place[] {
  if (dayN === 0)
    return [...Object.values(plan.hotels), ...plan.days.flatMap((d) => d.stops)].map(mustPlace);
  const day = plan.days.find((d) => d.n === dayN);
  if (!day) return [];
  return routeOf(plan, day).places.filter((p) => p.city === day.city);
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
    map.addSource("trip-routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  const casing = theme === "dark" ? "#141418" : "#ffffff";
  const layer = (
    id: string,
    mode: string | null,
    paintSpec: Record<string, unknown>,
    layout = {},
  ) => {
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
  layer(
    "route-taxi",
    "taxi",
    { "line-color": ["get", "color"], "line-width": 4, "line-dasharray": [2, 1.4] },
    { "line-cap": "butt" },
  );
  layer("route-walk", "walk", {
    "line-color": ["get", "color"],
    "line-width": 4.5,
    "line-dasharray": [0.01, 1.8],
  });
  layer("route-scooter", "scooter", {
    "line-color": ["get", "color"],
    "line-width": 4,
    "line-dasharray": [3, 1, 0.01, 1],
  });
  layer(
    "route-flight",
    "flight",
    { "line-color": ["get", "color"], "line-width": 2.5, "line-dasharray": [1, 2] },
    { "line-cap": "butt" },
  );
}

function MapPane({ params, paused, node, inPeek }: PaneProps<typeof mapParams>) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const theme = useJaliTheme();
  const selected = useCurrent();
  const model = useJaliModel();
  const results = useStore(services.results, (r) => r);
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const markers = useRef(new Map<string, PinMarker>());
  /** The pins each pin that shows stands for too, from the last layout (pin-layout.ts). */
  const piles = useRef(new Map<string, string[]>());
  /** Lays the pins out on screen again (set further down, where it can see the markers). */
  const layoutRef = useRef(() => {});
  const pausedRef = useRef(paused);
  /** The map shows the day as framed (not moved by the person since). */
  const framed = useRef(true);
  const frameRef = useRef<(animate?: boolean) => void>(() => {});
  // A badge for each city, shown when the whole country is in view: its name and its days. A click frames it.
  const badges = useRef(new Map<CityId, Marker>());
  const pending = useRef<(() => void) | null>(null);
  const [styleTick, setStyleTick] = useState(0);
  const [failed, setFailed] = useState(false);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  pausedRef.current = paused;

  // Explore's results count only while its pane is on screen; else, what is near the selected place.
  const explored = results && model.pane(results.pane)?.where === "shown" ? results.ids : null;
  const candidates = useMemo(() => {
    if (explored) return explored;
    const at = selected ? placeById(selected) : undefined;
    if (!at) return [];
    const radius = at.city === "bkk" ? 0.9 : 3;
    return PLACES.filter(
      (q) =>
        q.id !== at.id &&
        q.city === at.city &&
        q.category !== "airport" &&
        !dayWith(plan, q.id) &&
        haversineKm(at, q) <= radius,
    )
      .slice(0, 10)
      .map((q) => q.id);
  }, [explored, selected, plan]);

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
      // Mends what in the base styles would log a warning; theme switches use it too.
      transformStyle: repairStyle,
      center: TRIP.center,
      zoom: TRIP.zoom,
      minZoom: 4,
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
      if (!map.isStyleLoaded() || status === undefined || status >= 400)
        setFailed(!map.isStyleLoaded());
    });
    // The keyboard's way in is the box that holds the canvas and the pins, not the canvas MapLibre picks: focus then
    // sits round everything on the map, and a pin over the canvas's middle is inside it, not over it. MapLibre
    // listens for its keys on that box, so the arrows still pan. Named, so a screen reader says what the keys do.
    const canvas = map.getCanvas();
    for (const a of ["tabindex", "role", "aria-label"]) canvas.removeAttribute(a);
    const surface = map.getCanvasContainer();
    surface.tabIndex = 0;
    surface.setAttribute("role", "region");
    surface.setAttribute("aria-label", "Map. Arrow keys pan, plus and minus zoom.");
    // Busy while tiles load, until everything in view is drawn (or failed to load: the map says so).
    surface.setAttribute("aria-busy", "true");
    map.on("dataloading", () => surface.setAttribute("aria-busy", "true"));
    map.on("idle", () => surface.removeAttribute("aria-busy"));
    map.on("error", () => surface.removeAttribute("aria-busy"));
    mapRef.current = map;

    // The pins are laid out again whenever the map moves or changes size: what overlaps changes with the zoom, and
    // what is under the floating controls with the pan.
    const relayout = () => layoutRef.current();
    map.on("move", relayout);
    map.on("resize", relayout);

    // A pan or zoom by the person ends the framing; the map stays where they put it.
    const moved = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) framed.current = false;
    };
    map.on("dragstart", moved);
    map.on("zoomstart", moved);
    map.on("rotatestart", moved);

    // Zoomed out to the whole country, each city is one badge; zoomed in, its pins (the layout says which).
    relayout();

    // It resizes with its box, unless it is out of sight (then it catches up when shown).
    let frame = 0;
    const ro = new ResizeObserver(() => {
      if (pausedRef.current || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          map.resize();
          // Until the person moves the map, it keeps the day framed as its box changes (a fold, a preset).
          if (framed.current) frameRef.current(false);
        }
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      for (const m of markers.current.values()) m.marker.remove();
      markers.current.clear();
      for (const b of badges.current.values()) b.remove();
      badges.current.clear();
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

  // What the place pane that follows this map shows. Jali starts the map's selection there (`selects`), and keeps
  // the two agreeing when a layout (a preset, a link, Back) brings that pane another place.
  const followerShows =
    model.panes
      .filter((p) => p.linkedTo === node.id && p.follows && p.ref.kind === "place")
      .map((p) => String(p.ref.params.id))[0] ?? null;

  // The routes.
  useEffect(() => {
    const src = mapRef.current?.getSource("trip-routes") as GeoJSONSource | undefined;
    src?.setData(routesFor(plan, params.day, theme));
  }, [plan, params.day, theme, styleTick]);

  // The pins: DOM markers, so each is a real button with a name, and a whole target of at least 24px.
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
          const id = el.dataset.id;
          if (!id) return;
          // A pin that stands for others too opens the pile first: the map zooms in until they part. Pressed when
          // the map is as close as it goes, it picks its own place, like any pin.
          const pile = piles.current.get(id);
          if (pile?.length && openPile(map, [id, ...pile])) {
            framed.current = false;
            return;
          }
          selectPlace(jali, id, { from: node.id });
        });
        const marker = new Marker({ element: wrap, anchor: "center" })
          .setLngLat([pin.p.lng, pin.p.lat])
          .addTo(map);
        m = { marker, el, pin };
        markers.current.set(pin.p.id, m);
      }
      m.pin = pin;
      paintPin(m.el, pin, pin.p.id === selected);
    }
    for (const [id, m] of markers.current)
      if (!seen.has(id)) {
        m.marker.remove();
        markers.current.delete(id);
      }
    layoutRef.current();
  }, [pins, selected, jali, node.id, styleTick]);

  // Lays out what the zoom shows (pin-layout.ts): zoomed out to the whole country, a badge per city; else the pins.
  // Nothing covers anything else, and nothing hides under the controls over the map.
  layoutRef.current = () => {
    const map = mapRef.current;
    const el = box.current;
    if (!map || !el) return;
    const far = map.getZoom() < CITY_ZOOM;
    el.toggleAttribute("data-far", far);
    if (!el.clientWidth || !el.clientHeight) return;
    piles.current = placePins(
      map,
      el,
      far ? [] : Array.from(markers.current.values()),
      far ? badges.current : new Map(),
    );
  };
  // After every render too: the card under the map, and the summary over it, come and go with the selection.
  useEffect(() => layoutRef.current());

  // The badges' click handlers outlive this render: they read the plan as it is when clicked, so a new hotel or a
  // moved stop is framed, not the plan the badge was made with.
  const planRef = useRef(plan);
  planRef.current = plan;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const city of ["bkk", "hkt"] as const) {
      const days = daysIn(plan, city);
      const pts = cityPoints(plan, city);
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
      let m = badges.current.get(city);
      if (!m) {
        const wrap = document.createElement("div");
        wrap.className = "city-badge-wrap";
        const el = document.createElement("button");
        el.type = "button";
        el.className = "city-badge";
        wrap.append(el);
        el.addEventListener("click", () => {
          const b = new LngLatBounds();
          for (const p of cityPoints(planRef.current, city)) b.extend([p.lng, p.lat]);
          map.fitBounds(b, {
            padding: framePadding(map),
            maxZoom: 15,
            duration: reducedMotion() ? 0 : 900,
          });
        });
        m = new Marker({ element: wrap, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
        badges.current.set(city, m);
      }
      m.setLngLat([lng, lat]);
      const el = m.getElement().firstElementChild as HTMLButtonElement;
      const range = dayRange(days);
      el.innerHTML = "";
      const name = document.createElement("b");
      name.textContent = CITY_NAME[city];
      const sub = document.createElement("span");
      const stops = `${range}, ${days.reduce((s, d) => s + d.stops.length, 0)} stops`;
      sub.textContent = stops;
      // The space keeps the two lines apart in the text a screen reader matches the name against; the name says all
      // the badge shows, then what it does (WCAG 2.5.3).
      el.append(name, " ", sub);
      el.setAttribute("aria-label", `${CITY_NAME[city]}, ${stops}. Show it on the map.`);
    }
    // Their text may have changed their size, and they move to stay clear.
    layoutRef.current();
  }, [plan, styleTick]);

  // A new day: frame its stops and its hotel, in its own city. "All" frames both cities.
  const frame = (animate = true) => {
    const map = mapRef.current;
    const pts = framePoints(plan, params.day);
    if (!map || !pts.length) return;
    const b = new LngLatBounds();
    for (const p of pts) b.extend([p.lng, p.lat]);
    map.fitBounds(b, {
      padding: framePadding(map),
      maxZoom: 15,
      duration: animate && !reducedMotion() ? 700 : 0,
    });
    framed.current = true;
  };
  frameRef.current = frame;
  useEffect(() => {
    whenShown(() => frame());
    // Only when the day changes (or the map is first made): moving a stop doesn't re-frame the person's view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.day]);

  // A place selected anywhere: bring it into view, gently, unless it is already well inside. Not on the map's first
  // show, which frames the day instead (the selection may be in the other city), and not when a layout brought it:
  // Jali agrees this pane's selection with its place pane in the same step, and the map keeps the day framed.
  const firstSelection = useRef(true);
  const presetId = useJaliState((s) => s.presetId);
  const lastPreset = useRef(presetId);
  const lastShown = useRef(followerShows);
  useEffect(() => {
    const byLayout = lastPreset.current !== presetId;
    // Brought by a layout: the place pane that was there already shows it in the same step (a place the person picks
    // reaches it a moment later, and a place pane opened for it wasn't there before).
    const fromLayout = !!selected && selected === followerShows && lastShown.current !== null;
    if (firstSelection.current || byLayout || fromLayout) {
      firstSelection.current = false;
      return;
    }
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
      framed.current = false;
      // Within a city, glide; to the other city (or out of the whole-country view), fly.
      const far =
        haversineKm(map.getCenter(), { lat: p.lat, lng: p.lng }) > 60 || map.getZoom() < CITY_ZOOM;
      const camera = {
        center: [p.lng, p.lat] as [number, number],
        zoom: Math.max(map.getZoom(), p.city === "hkt" ? 13 : 14),
        duration: reducedMotion() ? 0 : far ? 1600 : 600,
        padding: { ...framePadding(map), left: 20, right: 20 },
      };
      if (far) map.flyTo(camera);
      else map.easeTo(camera);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  // After the effect above, so that in a step where the preset and the selection change together it sees the old one.
  useEffect(() => {
    lastPreset.current = presetId;
  }, [presetId]);
  useEffect(() => {
    lastShown.current = followerShows;
  }, [followerShows]);

  const showDay = (n: number) => jali.actions.openHere(node.id, mapRef_(n));
  useCommands(
    inPeek
      ? []
      : [
          {
            id: "frame",
            title: "Frame the day on the map",
            run: () => frame(),
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
  // A place pane that follows this map and is on screen already says everything the card would: the map stays clear.
  const shownBeside = model.panes.some(
    (p) => p.ref.kind === "place" && p.linkedTo === node.id && p.follows && p.where === "shown",
  );
  const day = params.day ? plan.days.find((d) => d.n === params.day) : undefined;
  const totals = day ? dayTotals(plan, day) : null;
  const legendCity: CityId | null = day && !day.from ? day.city : null;
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
              label: (
                <span data-day={d.n} className="map-day-opt">
                  {d.n}
                </span>
              ),
              title: `Day ${d.n}: ${d.title}`,
            })),
          ]}
        />
        {day && totals ? (
          <p className="map-summary">
            <b>{day.title}</b>
            <span>
              {CITY_NAME[day.city]}, {day.stops.length} stops, {f.minutes(totals.travelMin)}{" "}
              travelling
            </span>
          </p>
        ) : null}
      </div>
      <ul className="map-legend" aria-label="Route key">
        <li data-mode="walk">Walk</li>
        {legendCity !== "hkt" ? <li data-mode="transit">Train or boat</li> : null}
        <li data-mode="taxi">Taxi</li>
        {legendCity !== "bkk" ? <li data-mode="scooter">Scooter</li> : null}
        {!day || day.from ? <li data-mode="flight">Flight</li> : null}
      </ul>
      {/* The card is for a place on this map: a Bangkok place stays selected, but out of the way, on a Phuket day. */}
      {sel && !shownBeside && (!day || day.city === sel.city) ? (
        <PlaceCard p={sel} dayN={params.day} plan={plan} from={node.id} />
      ) : null}
      {failed ? (
        <div className="map-failed" role="status">
          <WarningCircleIcon size={22} aria-hidden />
          <p>
            <b>The map tiles didn't load.</b> Your plan, the lists and the budget all work without
            them. Check the connection and reload to try again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

const mapRef_ = (day: number): ObjectRef => map({ day });

/** Room around a framed day: clear of what floats over the map (the days and the summary on top, the card below). */
function framePadding(map: MapLibre) {
  const box = map.getContainer();
  const { clientWidth: w, clientHeight: h } = box;
  const pad = Math.max(24, Math.min(64, w * 0.07));
  const top = box.parentElement?.querySelector<HTMLElement>(".map-top")?.offsetHeight ?? 40;
  const card = box.parentElement?.querySelector<HTMLElement>(".map-card")?.offsetHeight ?? 0;
  const legend = box.parentElement?.querySelector<HTMLElement>(".map-legend")?.offsetHeight ?? 0;
  const bottom = Math.max(card + 24, legend ? legend + 50 : 0, pad + 24);
  // The selected pin's photo stands 100px above it: the top keeps room for it.
  return {
    top: top + 12 + Math.min(70, pad + 30),
    bottom: Math.min(bottom, h * 0.45),
    left: pad,
    right: pad + 24,
  };
}

/** A pin on the map: MapLibre's marker, the button in it, and what it shows. */
interface PinMarker {
  marker: Marker;
  el: HTMLButtonElement;
  pin: Pin;
}

/** Which pins go first when they would overlap: the selected place, the day's stops in order, then the rest. */
const RANK: Record<Pin["role"], number> = {
  stop: 1,
  hotel: 2,
  airport: 3,
  candidate: 4,
  "other-day": 5,
};

/** Each pin's target, as map.css draws it: a selected stop, hotel or airport grows by 1.22. */
function pinSize({ role }: Pin, selected: boolean) {
  const size = { stop: 30, hotel: 32, airport: 26, candidate: 24, "other-day": 24 }[role];
  return selected && size > 24 ? size * 1.22 : size;
}

/** The selected pin's photo stands above it (photos.css): 64px round, 34px up, with a point toward the pin. */
const photoBox = (x: number, y: number) => ({
  left: x - 35,
  right: x + 35,
  top: y - 34 - 67,
  bottom: y - 34 + 10,
});

/** A pin as a pile's badge reads it: the day and number of one of the days' stops shown, nothing for the rest. */
const pileStop = (pin: Pin): PileStop =>
  pin.role === "stop" ? { day: pin.day, order: pin.order } : {};

/** A city badge's id in the layout, beside the places'. */
const badgeId = (city: CityId) => `city:${city}`;

/**
 * What floats over the map (the days and the summary on top, the route key, the card, MapLibre's buttons and its
 * attribution), as rectangles in the map's own coordinates.
 */
function floating(el: HTMLElement): Rect[] {
  const origin = el.getBoundingClientRect();
  const root = el.parentElement ?? el;
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      ".map-top > *, .map-legend, .map-card, .map-failed, .maplibregl-ctrl",
    ),
  )
    .map((f) => f.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    }));
}

/**
 * Places the pins and the city badges (pin-layout.ts) and shows the result: a pin off the open map or in a pile is
 * hidden, and a pin that stands for others says "+N" (or their stop numbers) and names them. A badge moves to the clear spot nearest its city,
 * or hides if there is none. The selected pin's photo shows only where it covers nothing. Returns the piles.
 */
function placePins(
  map: MapLibre,
  el: HTMLElement,
  all: PinMarker[],
  badges: ReadonlyMap<CityId, Marker>,
) {
  const view = { left: 0, top: 0, right: el.clientWidth, bottom: el.clientHeight };
  const blocked = floating(el);
  const at = new Map<string, { x: number; y: number }>();
  const boxes: PinBox[] = all.map(({ pin, el: button }) => {
    const { x, y } = map.project([pin.p.lng, pin.p.lat]);
    at.set(pin.p.id, { x, y });
    const selected = button.hasAttribute("data-selected");
    return {
      id: pin.p.id,
      x,
      y,
      size: pinSize(pin, selected),
      rank: selected ? 0 : RANK[pin.role] + (pin.order ?? 0) / 100,
    };
  });
  for (const [city, marker] of badges) {
    const { x, y } = map.project(marker.getLngLat());
    const button = marker.getElement().firstElementChild as HTMLElement;
    // Room for it to grow on hover (by 1.04) and still cover nothing.
    boxes.push({
      id: badgeId(city),
      x,
      y,
      size: 0,
      width: Math.ceil(button.offsetWidth * 1.04),
      height: Math.ceil(button.offsetHeight * 1.04),
      rank: 0,
      moves: true,
    });
  }
  const { shown, moved } = layoutPins(boxes, view, blocked);
  for (const [city, marker] of badges) {
    const id = badgeId(city);
    marker.getElement().toggleAttribute("data-hidden", !shown.has(id));
    const { dx, dy } = moved.get(id) ?? { dx: 0, dy: 0 };
    const at = marker.getOffset();
    if (at.x !== dx || at.y !== dy) marker.setOffset([dx, dy]);
  }
  const label = (id: string) => all.find((m) => m.pin.p.id === id)?.el.dataset.label ?? "";
  for (const { pin, el: button, marker } of all) {
    const id = pin.p.id;
    const pile = shown.get(id);
    const wrap = marker.getElement();
    wrap.toggleAttribute("data-hidden", !pile);
    if (pile?.length) {
      // A pile of the day's own stops says which ("4–5"); any other pile says how many it holds.
      button.dataset.more = pileMark(
        pileStop(pin),
        pile.map((other) => {
          const p = all.find((m) => m.pin.p.id === other)?.pin;
          return p ? pileStop(p) : {};
        }),
      );
      button.setAttribute(
        "aria-label",
        `${label(id)}. Also here: ${pile.map(label).join("; ")}. Press to zoom in to them.`,
      );
    } else {
      delete button.dataset.more;
      button.setAttribute("aria-label", label(id));
    }
    // The photo is decoration: it gives way to any pin, control or edge it would cover.
    if (pile && button.hasAttribute("data-selected")) {
      const { x, y } = at.get(id)!;
      const photo = photoBox(x, y);
      const clear =
        photo.top >= 0 &&
        photo.left >= 0 &&
        photo.right <= view.right &&
        !blocked.some((b) => overlaps(photo, b)) &&
        boxes.every(
          (b) =>
            b.id === id ||
            !shown.has(b.id) ||
            !overlaps(photo, {
              left: b.x - b.size / 2,
              right: b.x + b.size / 2,
              top: b.y - b.size / 2,
              bottom: b.y + b.size / 2,
            }),
        );
      wrap.toggleAttribute("data-photo-off", !clear);
    } else wrap.removeAttribute("data-photo-off");
  }
  return shown;
}

/** Zooms in on a pile of pins until they part, unless the map is already as close as it goes. Says if it did. */
function openPile(map: MapLibre, ids: string[]): boolean {
  const b = new LngLatBounds();
  for (const id of ids) {
    const p = placeById(id);
    if (p) b.extend([p.lng, p.lat]);
  }
  const camera = map.cameraForBounds(b, { padding: framePadding(map), maxZoom: 18 });
  if (!camera?.zoom || camera.zoom <= map.getZoom() + 0.1) return false;
  map.easeTo({ ...camera, duration: reducedMotion() ? 0 : 600 });
  return true;
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
  const text = role === "stop" ? String(order) : "";
  if (el.textContent !== text) el.textContent = text;
  // Its own name; the layout adds the pins it stands for (placePins).
  el.dataset.label =
    role === "stop"
      ? `Day ${day}, stop ${order}: ${p.name}`
      : role === "hotel"
        ? `Your hotel in ${CITY_NAME[p.city]}: ${p.name}`
        : role === "airport"
          ? p.name
          : role === "other-day"
            ? `${p.name}, on Day ${day}`
            : `${p.name}, not planned`;
  el.setAttribute("aria-label", el.dataset.label);
  el.title = p.name;
  el.parentElement!.style.zIndex = selected
    ? "5"
    : role === "stop"
      ? "3"
      : role === "hotel"
        ? "4"
        : "1";
  paintBubble(el.parentElement!, selected ? p.id : null, day);
}

/**
 * The selected pin's photo, in a round frame above it, so the place is easy to find on the map. Decorative: the
 * pin has the name, and the card below says the rest.
 */
function paintBubble(wrap: HTMLElement, id: string | null, day?: number) {
  let bubble = wrap.querySelector<HTMLElement>(".pin-photo");
  const url = id ? photoSrc(id) : undefined;
  if (!url) {
    bubble?.remove();
    return;
  }
  if (!bubble) {
    bubble = document.createElement("span");
    bubble.className = "pin-photo";
    bubble.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    bubble.append(img);
    wrap.prepend(bubble);
  }
  if (day) bubble.dataset.day = String(day);
  else delete bubble.dataset.day;
  const img = bubble.querySelector("img")!;
  if (img.getAttribute("src") !== url) img.src = url;
  bubble.style.setProperty("--tone", photoOf(id!)?.tone ?? "transparent");
}

/** The selected place, over the bottom of the map: what it is, and the next step. */
function PlaceCard({ p, dayN, plan, from }: { p: Place; dayN: number; plan: Plan; from: string }) {
  const jali = useJali();
  const services = useServices();
  const on = dayWith(plan, p.id);
  const Icon = CATEGORY_ICON[p.category];
  // The day to offer: the map's day if it is in the place's city, else the place's day, else its city's first day.
  const mapDay = plan.days.find((d) => d.n === dayN);
  const target =
    (mapDay?.city === p.city ? mapDay.n : undefined) ?? on?.n ?? daysIn(plan, p.city)[0]?.n ?? 1;
  return (
    <div className="map-card" aria-label={`Selected: ${p.name}`} role="region">
      <Photo id={p.id} className="map-card-photo" />
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
          ) : isHotel(plan, p.id) ? (
            `Your hotel in ${CITY_NAME[p.city]}`
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
        {(p.category === "sight" || p.category === "food") && on?.n !== target ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => addToDay(services, p.id, target)}
          >
            {on ? `Move to Day ${target}` : `Add to Day ${target}`}
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => selectPlace(jali, p.id, { from, open: true })}
        >
          Details
        </button>
      </div>
    </div>
  );
}

export const map = definePane("map", {
  params: mapParams,
  // A list of places: with none selected, it starts on the one its following place pane shows.
  selects: "place",
  // The overview selects a day; the map that follows it shows that day.
  follow: (selected) => (selected.kind === "day" ? { day: Number(selected.params.n) } : undefined),
  title: ({ day }) => (day ? `Map of Day ${day}` : "Trip map"),
  icon: MapTrifoldIcon,
  width: { min: 360, comfortable: 640 },
  height: { min: 300 },
  // Stacked on a phone, the map goes on top: the place, or the day, reads below it.
  phone: { place: "top" },
  Component: MapPane,
});
