import { layoutPins, overlaps, PIN_GAP, type PinBox } from "./pin-layout";

const view = { left: 0, top: 0, right: 400, bottom: 300 };
const pin = (id: string, x: number, y: number, rank = 1, size = 30): PinBox => ({
  id,
  x,
  y,
  size,
  rank,
});

describe("layoutPins", () => {
  it("shows pins that are apart, each standing for itself", () => {
    const { shown, off } = layoutPins([pin("a", 50, 50), pin("b", 150, 50)], view, []);
    expect([...shown]).toEqual([
      ["a", []],
      ["b", []],
    ]);
    expect(off.size).toBe(0);
  });

  it("puts a pin that would overlap another into it, the more important one showing", () => {
    const { shown } = layoutPins(
      [pin("other-day", 60, 50, 5, 24), pin("stop", 50, 50, 1), pin("hotel", 75, 55, 3)],
      view,
      [],
    );
    expect([...shown]).toEqual([["stop", ["hotel", "other-day"]]]);
  });

  it("keeps the gap: pins whose targets would touch are one pile", () => {
    const apart = 30 + PIN_GAP;
    expect(layoutPins([pin("a", 50, 50), pin("b", 50 + apart, 50)], view, []).shown.size).toBe(2);
    expect(layoutPins([pin("a", 50, 50), pin("b", 50 + apart - 1, 50)], view, []).shown.size).toBe(
      1,
    );
  });

  it("leaves off a pin that wouldn't show whole, or would sit under a control", () => {
    const { shown, off } = layoutPins(
      [pin("edge", 5, 100), pin("under", 200, 20), pin("clear", 200, 200)],
      view,
      [{ left: 100, top: 0, right: 300, bottom: 40 }],
    );
    expect([...shown.keys()]).toEqual(["clear"]);
    expect([...off]).toEqual(["edge", "under"]);
  });

  it("never leaves two pins that show overlapping, however crowded", () => {
    const crowd = Array.from({ length: 200 }, (_, i) =>
      pin(`p${i}`, 20 + ((i * 37) % 360), 20 + ((i * 53) % 260), i % 6, i % 2 ? 24 : 32),
    );
    const { shown } = layoutPins(crowd, view, []);
    const boxes = [...shown.keys()].map((id) => {
      const p = crowd.find((c) => c.id === id)!;
      const h = p.size / 2;
      return { left: p.x - h, top: p.y - h, right: p.x + h, bottom: p.y + h };
    });
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    // And every pin is accounted for: shown, in a pile, or off the open map.
    const counted = [...shown].reduce((n, [, more]) => n + 1 + more.length, 0);
    expect(counted).toBe(crowd.length);
  });
});
