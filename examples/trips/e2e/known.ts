/**
 * What the shared quality checks found in Trips that is still to fix (FIXME, for Trips' own session). The console
 * guard allows only these messages; take each out once the map style stops causing it:
 *
 * - the style's shield layers filter on a value that is null in these tiles;
 * - the style names sprite images it doesn't provide.
 */
export const MAP_STYLE_WARNINGS =
  /^(layers\[(road_shield_us|highway-shield-us-interstate|highway-shield-non-us)\]\.filter\[1\]: Expected value to be of type number, but found null instead|Image "(circle-11|wood-pattern)" could not be loaded)/;
