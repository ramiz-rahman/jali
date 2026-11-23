/**
 * The base map and the trip's layers on it: OpenFreeMap's styles (mended as they load, map-style.ts), recoloured a
 * little to Nava's zinc, and one line layer per mode for the routes (dots for walking, a line for transit, dashes for
 * a taxi).
 */
import type { Map as MapLibre } from "maplibre-gl";
import type { Mode } from "../../trip/modes";
import type { Theme } from "./features";

/** OpenFreeMap: free, no key. Attribution comes with the tiles and MapLibre shows it. */
export const STYLE: Record<Theme, string> = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** Nava's zinc ground and a cool, quiet river, so the coral and the day colours carry the map. */
const TUNE: Record<Theme, { background: string; water: string; park: string; casing: string }> = {
  light: { background: "#f4f4f5", water: "#cdd6dc", park: "#e3e8e1", casing: "#ffffff" },
  dark: { background: "#141418", water: "#1d2230", park: "#18201b", casing: "#141418" },
};

/** The source the routes are drawn from (features.ts, `routesFor`). */
export const ROUTES = "trip-routes";

/** Each mode's line: its width and dash pattern, and a butt cap where the dashes should read square. */
const LINES: Record<Mode, { width: number; dash?: number[]; butt?: boolean }> = {
  transit: { width: 4 },
  taxi: { width: 4, dash: [2, 1.4], butt: true },
  walk: { width: 4.5, dash: [0.01, 1.8] },
  scooter: { width: 4, dash: [3, 1, 0.01, 1] },
  flight: { width: 2.5, dash: [1, 2], butt: true },
};

type LayerSpec = Parameters<MapLibre["addLayer"]>[0];

/** Recolour the base style and add the route layers (again, after a theme swaps the style). */
export function addTripLayers(map: MapLibre, theme: Theme) {
  const tune = TUNE[theme];
  // The base style's own colours, softened, where its layers have these names (positron and dark do).
  const paint = (layer: string, prop: string, value: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop as "fill-color", value);
  };
  paint("background", "background-color", tune.background);
  paint("water", "fill-color", tune.water);
  paint("park", "fill-color", tune.park);

  if (!map.getSource(ROUTES))
    map.addSource(ROUTES, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  const line = (id: string, spec: Omit<LayerSpec, "id" | "type" | "source">) => {
    if (!map.getLayer(id)) map.addLayer({ id, type: "line", source: ROUTES, ...spec } as LayerSpec);
  };
  const round = { "line-cap": "round", "line-join": "round" } as const;
  line("route-casing", {
    layout: round,
    paint: { "line-color": tune.casing, "line-width": 8, "line-opacity": 0.85 },
  });
  // In the order they were always drawn: transit, taxi, walk, scooter, flight.
  for (const [mode, { width, dash, butt }] of Object.entries(LINES))
    line(`route-${mode}`, {
      filter: ["==", ["get", "mode"], mode],
      layout: { ...round, ...(butt ? { "line-cap": "butt" } : {}) },
      paint: {
        "line-color": ["get", "color"],
        "line-width": width,
        ...(dash ? { "line-dasharray": dash } : {}),
      },
    });
}
