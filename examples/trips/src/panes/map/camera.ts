/**
 * Where the map looks: framing a set of places clear of what floats over the map, zooming in on a pile of pins, and
 * bringing a place into view. Every move is instant when the person prefers reduced motion.
 */
import { LngLatBounds, type Map as MapLibre } from "maplibre-gl";
import { CITY } from "../../trip/cities";
import type { Point } from "../../trip/nearby";
import type { Place } from "../../trip/places";
import { haversineKm } from "../../trip/travel";

/** Below this zoom the map shows each city as one badge rather than its pins (they would pile up). */
export const CITY_ZOOM = 8.5;

const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A move's length in ms, or none at all with reduced motion. */
const duration = (ms: number) => (reducedMotion() ? 0 : ms);

const boundsOf = (points: readonly Point[]) => {
  const b = new LngLatBounds();
  for (const p of points) b.extend([p.lng, p.lat]);
  return b;
};

/** Room around a framed day: clear of what floats over the map (the days and the summary on top, the card below). */
function framePadding(map: MapLibre) {
  const box = map.getContainer();
  const { clientWidth: w, clientHeight: h } = box;
  const pad = Math.max(24, Math.min(64, w * 0.07));
  const height = (selector: string) =>
    box.parentElement?.querySelector<HTMLElement>(selector)?.offsetHeight;
  const top = height(".map-top") ?? 40;
  const card = height(".map-card") ?? 0;
  const legend = height(".map-legend") ?? 0;
  const bottom = Math.max(card + 24, legend ? legend + 50 : 0, pad + 24);
  // The selected pin's photo stands 100px above it: the top keeps room for it.
  const padding = {
    top: top + 12 + Math.min(70, pad + 30),
    bottom: Math.min(bottom, h * 0.45),
    left: pad,
    right: pad + 24,
  };
  // A short map (a pane under another, a landscape phone) still frames its day: the room kept clear gives way until
  // the day has at least a third of the box, rather than leaving MapLibre too little to fit and the map zoomed out.
  const room = h - padding.top - padding.bottom;
  const least = h / 3;
  if (room < least) {
    const give = (h - least) / (padding.top + padding.bottom);
    padding.top = Math.floor(padding.top * give);
    padding.bottom = Math.floor(padding.bottom * give);
  }
  return padding;
}

/** Frame `points`, clear of the floating parts; `ms` is how long the move takes. */
export function frame(map: MapLibre, points: readonly Point[], ms: number) {
  map.fitBounds(boundsOf(points), {
    padding: framePadding(map),
    maxZoom: 15,
    duration: duration(ms),
  });
}

/** Zooms in on a pile of pins until they part, unless the map is already as close as it goes. Says if it did. */
export function openPile(map: MapLibre, points: readonly Point[]): boolean {
  const camera = map.cameraForBounds(boundsOf(points), { padding: framePadding(map), maxZoom: 18 });
  if (!camera?.zoom || camera.zoom <= map.getZoom() + 0.1) return false;
  map.easeTo({ ...camera, duration: duration(600) });
  return true;
}

/**
 * Bring a place into view, gently, unless it is already well inside. Within a city the map glides; to the other city
 * (or out of the whole-country view) it flies. Says if it moved.
 */
export function reveal(map: MapLibre, p: Place): boolean {
  const pt = map.project([p.lng, p.lat]);
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const inside = pt.x > w * 0.15 && pt.x < w * 0.85 && pt.y > h * 0.15 && pt.y < h * 0.7;
  if (inside) return false;
  const far =
    haversineKm(map.getCenter(), { lat: p.lat, lng: p.lng }) > 60 || map.getZoom() < CITY_ZOOM;
  const camera = {
    center: [p.lng, p.lat] as [number, number],
    zoom: Math.max(map.getZoom(), CITY[p.city].focusZoom),
    duration: duration(far ? 1600 : 600),
    padding: { ...framePadding(map), left: 20, right: 20 },
  };
  if (far) map.flyTo(camera);
  else map.easeTo(camera);
  return true;
}
