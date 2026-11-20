/**
 * OpenFreeMap's Positron and Dark, mended as they load (MapLibre's `transformStyle`), so the map logs nothing:
 *
 * - The road shields compare `ref_length` with a number, and a road with no `ref` has none: MapLibre warns, once per
 *   layer, that it found null. A missing length now reads as too long for a shield, which is what the filter meant.
 * - Dark names sprite images its sprite sheet doesn't have (`circle-11` beside town names, `wood-pattern` over
 *   woods): MapLibre warns, and draws nothing there anyway. Those properties are dropped; the labels and the woods'
 *   fill stay.
 */
import type { TransformStyleFunction } from "maplibre-gl";

/** Images the styles name that OpenFreeMap's sprite sheet (`ofm`) doesn't have. */
export const MISSING_IMAGES = ["circle-11", "wood-pattern"] as const;

type Json = unknown;

/** `["get", "ref_length"]`, the value a road without a `ref` doesn't have. */
const isRefLength = (v: Json) =>
  Array.isArray(v) && v.length === 2 && v[0] === "get" && v[1] === "ref_length";

/** The expression, with every bare `["get", "ref_length"]` given a default too long for any shield. */
function mendFilter(v: Json): Json {
  if (isRefLength(v)) return ["coalesce", v, 99];
  return Array.isArray(v) ? v.map(mendFilter) : v;
}

const namesMissing = (v: Json) =>
  MISSING_IMAGES.some((id) => JSON.stringify(v ?? null).includes(`"${id}"`));

/** The properties of `props` that don't name a missing image. */
function withoutMissing<T extends object>(props: T | undefined): T | undefined {
  if (!props) return props;
  return Object.fromEntries(Object.entries(props).filter(([, v]) => !namesMissing(v))) as T;
}

export const repairStyle: TransformStyleFunction = (_previous, next) => ({
  ...next,
  layers: next.layers.map((layer) => {
    const mended = { ...layer } as typeof layer & {
      filter?: Json;
      layout?: object;
      paint?: object;
    };
    if (mended.filter !== undefined) mended.filter = mendFilter(mended.filter);
    if (mended.layout) mended.layout = withoutMissing(mended.layout);
    if (mended.paint) mended.paint = withoutMissing(mended.paint);
    return mended as typeof layer;
  }),
});
