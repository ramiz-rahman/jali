/**
 * `createJali({ gap, inset })`: the layout measures with the workspace's own spacing, and `<JaliRoot>` writes it as
 * `--jali-gap` and `--jali-inset`, so styles that read the variables agree with where the panes are.
 */
import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import { GAP, createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import type { JaliOptions } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note {params.id}</p>,
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...options,
  });

/** The space between the two panes, from the resolved layout. */
const between = (jali: ReturnType<typeof make>) => {
  const [a, b] = storeOf(jali).model().resolved.panes.map((p) => p.rect);
  return b!.x - (a!.x + a!.width);
};

describe("spacing", () => {
  it("defaults to GAP between panes and as the inset", () => {
    const jali = make();
    expect(between(jali)).toBe(GAP);
    expect(storeOf(jali).env.spacing).toEqual({ gap: GAP, inset: GAP });
  });

  it("lays the panes out with the workspace's gap, which the inset follows unless set", () => {
    const jali = make({ gap: 3 });
    expect(between(jali)).toBe(3);
    expect(storeOf(jali).env.spacing).toEqual({ gap: 3, inset: 3 });
    expect(storeOf(make({ gap: 0, inset: 20 })).env.spacing).toEqual({ gap: 0, inset: 20 });
    expect(between(make({ gap: 0, inset: 20 }))).toBe(0);
  });

  it("refuses a negative or non-finite gap or inset", () => {
    expect(() => make({ gap: -1 })).toThrow(RangeError);
    expect(() => make({ inset: Number.NaN })).toThrow(RangeError);
  });

  it("writes --jali-gap and --jali-inset on the root and the layer, keeping the app's own style", () => {
    const jali = make({ gap: 3, inset: 12 });
    const { container } = render(<JaliRoot jali={jali} style={{ color: "red" }} />);
    const root = container.querySelector<HTMLElement>("[data-jali]")!;
    expect(root.style.getPropertyValue("--jali-gap")).toBe("3px");
    expect(root.style.getPropertyValue("--jali-inset")).toBe("12px");
    expect(root.style.color).toBe("red");
    const layer = document.querySelector<HTMLElement>("[data-jali-layer]")!;
    expect(layer.style.getPropertyValue("--jali-gap")).toBe("3px");
    expect(layer.style.display).toBe("contents");
  });
});
