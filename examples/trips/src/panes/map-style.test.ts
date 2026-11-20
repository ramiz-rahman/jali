import type { StyleSpecification } from "maplibre-gl";
import { repairStyle } from "./map-style";

/** The shapes of the layers that warned, as OpenFreeMap serves them (21 Nov 2026). */
const style = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "highway-shield-non-us",
      type: "symbol",
      source: "openmaptiles",
      filter: [
        "all",
        ["<=", ["get", "ref_length"], 6],
        ["match", ["get", "network"], ["us-highway"], false, true],
      ],
      layout: { "icon-image": ["concat", "road_", ["get", "ref_length"]], "text-size": 10 },
    },
    {
      id: "landcover_wood",
      type: "fill",
      source: "openmaptiles",
      paint: { "fill-color": "rgb(32,32,32)", "fill-pattern": "wood-pattern" },
    },
    {
      id: "place_town",
      type: "symbol",
      source: "openmaptiles",
      layout: { "icon-image": ["step", ["zoom"], "circle-11", 9, ""], "text-size": 10 },
    },
  ],
} as unknown as StyleSpecification;

describe("repairStyle", () => {
  const [shield, wood, town] = repairStyle(undefined, style).layers as unknown as {
    filter?: unknown;
    layout?: Record<string, unknown>;
    paint?: Record<string, unknown>;
  }[];

  it("gives a road without a ref a length no shield fits", () => {
    expect(shield!.filter).toEqual([
      "all",
      ["<=", ["coalesce", ["get", "ref_length"], 99], 6],
      ["match", ["get", "network"], ["us-highway"], false, true],
    ]);
    // Only the filter: the shield's own image still reads the length.
    expect(shield!.layout!["icon-image"]).toEqual(["concat", "road_", ["get", "ref_length"]]);
  });

  it("drops what names an image the sprite sheet lacks, and keeps the rest", () => {
    expect(wood!.paint).toEqual({ "fill-color": "rgb(32,32,32)" });
    expect(town!.layout).toEqual({ "text-size": 10 });
  });

  it("leaves the style it was given alone", () => {
    expect((style.layers[1] as { paint: object }).paint).toHaveProperty("fill-pattern");
  });
});
