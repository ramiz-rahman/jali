/**
 * A layout link names the preset it came from (`?preset=`), so a reader's workspace marks the right preset and Reset
 * rebuilds it. Links without it open as before.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type PresetOptions } from "@jali/core";
import { definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const Nothing = () => null;
const list = definePane("orders", { title: "Orders", Component: Nothing });
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  Component: Nothing,
});
const presets: PresetOptions[] = [
  { id: "triage", label: "Triage", layout: row(list(), order({ id: 1 })) },
  { id: "review", label: "Review", layout: row(list(), order({ id: 2 }), order({ id: 3 })) },
];
const make = (search = "") => {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [list, order],
    presets,
    features: [...defaultFeatures(), urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });
  return { jali, location };
};
const q = (search: string) => new URLSearchParams(search);
const shows = (jali: ReturnType<typeof make>["jali"]) =>
  jali.model().panes.map((p) => p.ref.params.id ?? p.ref.kind);

describe("a layout link names its preset", () => {
  it("writes the preset beside the layout", () => {
    const { jali, location } = make();
    expect(q(location.search()).get("preset")).toBe("triage");
    jali.actions.preset("review");
    expect(q(location.search()).get("preset")).toBe("review");
    expect(q(location.search()).get("l")).toBeTruthy();
  });

  it("a reader's workspace is on that preset, and Reset rebuilds it", () => {
    const { jali, location } = make();
    jali.actions.preset("review");
    jali.actions.close();
    const { jali: reader } = make(location.search());
    expect(reader.get().presetId).toBe("review");
    expect(shows(reader)).toEqual(shows(jali));
    reader.actions.resetLayout();
    expect(shows(reader)).toEqual(["orders", 2, 3]);
  });

  it("a link without it opens as before: on the first preset", () => {
    const { jali, location } = make();
    jali.actions.preset("review");
    const old = q(location.search());
    old.delete("preset");
    const { jali: reader } = make(`?${old}`);
    expect(reader.get().presetId).toBe("triage");
    expect(shows(reader)).toEqual(["orders", 2, 3]);
  });

  it("ignores a preset the workspace doesn't have", () => {
    const { jali, location } = make();
    jali.actions.preset("review");
    const link = q(location.search());
    link.set("preset", "gone");
    expect(make(`?${link}`).jali.get().presetId).toBe("triage");
  });

  it("Back returns to the preset of that entry; an entry without one leaves it as it is", () => {
    const { jali, location } = make();
    const first = location.search();
    jali.actions.preset("review");
    const second = location.search();
    const stop = jali.start();
    location.visit(first);
    expect(jali.get().presetId).toBe("triage");
    location.visit(second);
    expect(jali.get().presetId).toBe("review");
    const old = q(first);
    old.delete("preset");
    location.visit(`?${old}`);
    expect(jali.get().presetId).toBe("review");
    stop();
  });

  it("a link whose layout can't be read opens the preset it names", () => {
    const { jali } = make(`?l=not-a-layout&preset=review`);
    expect(jali.get().presetId).toBe("review");
    expect(shows(jali)).toEqual(["orders", 2, 3]);
  });
});
