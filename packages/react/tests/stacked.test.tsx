/**
 * Stacked view (a portrait phone with `phone: { stack: true }`): the focused pane and the pane it was opened from,
 * one above the other, in place of Single view's one pane.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, type PhoneOptions } from "@jali/core";
import { STACK_GAP, frames, storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const list = definePane("list", {
  title: () => "Orders",
  width: { min: 280 },
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number },
  title: ({ id }) => `Order ${id}`,
  width: { min: 300 },
  Component: () => null,
});
const chart = definePane("chart", {
  title: () => "Chart",
  phone: { stack: false },
  Component: () => null,
});

const make = (size = { width: 378, height: 760 }, phone: PhoneOptions = { stack: true }) => {
  const jali = createJali({
    panes: [list, order, chart],
    layout: list(),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size,
    moveFocus: false,
    phone,
  });
  const orders = jali.model().visible[0]!;
  jali.actions.openBeside(orders, order({ id: 7 }));
  return { jali, orders };
};

describe("stacked view", () => {
  it("puts the pane it was opened from above it", () => {
    const { jali, orders } = make();
    const m = storeOf(jali).model();
    expect(m.onePane).toBe(true);
    expect(m.stacked).toEqual({
      top: orders,
      bottom: m.panes.find((p) => p.ref.kind === "order")!.id,
    });
  });

  it("is off unless the app asks, without height for both, and for a kind that stays out", () => {
    expect(make(undefined, {}).jali.model().stacked).toBeUndefined();
    expect(make({ width: 378, height: 420 }).jali.model().stacked).toBeUndefined();
    const { jali, orders } = make();
    jali.actions.openHere(jali.model().panes.find((p) => p.ref.kind === "order")!.id, chart());
    jali.actions.focus(jali.model().panes.find((p) => p.ref.kind === "chart")!.id);
    expect(jali.model().stacked).toBeUndefined();
    expect(orders).toBeTruthy();
  });

  it("follows focus, and a pane with no link shows alone", () => {
    const { jali, orders } = make();
    jali.actions.focus(orders);
    expect(jali.model().stacked?.top).toBe(orders);
    const alone = createJali({
      panes: [list],
      layout: list(),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 378, height: 760 },
      moveFocus: false,
      phone: { stack: true },
    });
    expect(alone.model().onePane).toBe(true);
    expect(alone.model().stacked).toBeUndefined();
  });
});

const size = { clientWidth: 390, clientHeight: 772 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(cleanup);

describe("stacked view, drawn", () => {
  it("shows both panes and a divider that settles on thirds from the keyboard", () => {
    const { jali } = make();
    const { container } = render(<JaliRoot jali={jali} />);
    expect(container.querySelector(".jali-layout")!.hasAttribute("data-stacked")).toBe(true);
    const shown = [...container.querySelectorAll<HTMLElement>(".jali-pane")].filter(
      (p) => p.style.display !== "none",
    );
    expect(shown.map((p) => p.dataset.kind)).toEqual(["list", "order"]);
    const divider = container.querySelector<HTMLElement>(".jali-stack-divider")!;
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
    act(() => void fireEvent.keyDown(divider, { key: "ArrowDown" }));
    expect(divider.getAttribute("aria-valuenow")).toBe("67");
    act(() => void fireEvent.keyDown(divider, { key: "Home" }));
    expect(divider.getAttribute("aria-valuenow")).toBe("33");
    expect(container.querySelector(".jali-switch-item[data-in-view]")).not.toBeNull();
  });

  it("advertises a range that holds its value while dragged, controls the top pane, and a cancel puts it back", () => {
    // react-codex REACT-12.
    const { jali } = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const divider = container.querySelector<HTMLElement>(".jali-stack-divider")!;
    const top = container.querySelector<HTMLElement>(".jali-pane:not([style*='none'])")!;
    expect(divider.getAttribute("aria-controls")).toBe(top.id);
    act(() => void fireEvent.pointerDown(divider, { clientY: 300, pointerId: 1 }));
    act(() => void fireEvent.pointerMove(divider, { clientY: 300 - 772 * 0.28, pointerId: 1 }));
    const now = Number(divider.getAttribute("aria-valuenow"));
    expect(now).toBeLessThan(33);
    expect(Number(divider.getAttribute("aria-valuemin"))).toBeLessThanOrEqual(now);
    expect(Number(divider.getAttribute("aria-valuemax"))).toBeGreaterThanOrEqual(now);
    act(() => void fireEvent.pointerCancel(divider, { pointerId: 1 }));
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
  });

  it("arrow keys move the way they say from a share between the stops", () => {
    const { jali } = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const divider = container.querySelector<HTMLElement>(".jali-stack-divider")!;
    // Dragged to 72%, released: it settles on two thirds. Dragged on to 75% and released near 67%: from a share
    // past the last stop, ↓ stays at the last stop, never moves up.
    act(() => void fireEvent.pointerDown(divider, { clientY: 300, pointerId: 1 }));
    act(() => void fireEvent.pointerMove(divider, { clientY: 300 + 772 * 0.22, pointerId: 1 }));
    act(() => void fireEvent.pointerUp(divider, { pointerId: 1 }));
    expect(divider.getAttribute("aria-valuenow")).toBe("67");
    act(() => void fireEvent.keyDown(divider, { key: "ArrowUp" }));
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
    act(() => void fireEvent.keyDown(divider, { key: "ArrowUp" }));
    act(() => void fireEvent.keyDown(divider, { key: "ArrowUp" }));
    expect(divider.getAttribute("aria-valuenow")).toBe("33");
  });

  it("is the room between the panes, all of it, so it covers neither pane", () => {
    const { jali } = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const [above, below] = [...container.querySelectorAll<HTMLElement>(".jali-pane")].filter(
      (p) => p.style.display !== "none",
    );
    const divider = container.querySelector<HTMLElement>(".jali-stack-divider")!;
    const px = (v: string) => Number(v.replace("px", ""));
    const aboveEnd = px(above!.style.top) + px(above!.style.height);
    expect(px(divider.style.top)).toBe(aboveEnd);
    expect(px(divider.style.height)).toBe(STACK_GAP);
    expect(px(divider.style.top) + px(divider.style.height)).toBe(px(below!.style.top));
  });
});

describe("stacked view, from the kinds' heights", () => {
  // A short pane: comfortable at 200, never usefully taller than 260.
  const strip = definePane("strip", {
    title: () => "Strip",
    width: { min: 280 },
    height: { min: 120, comfortable: 200, max: 260 },
    Component: () => null,
  });
  const setup = () => {
    const jali = createJali({
      panes: [strip, order],
      layout: strip(),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 378, height: 760 },
      moveFocus: false,
      phone: { stack: true },
    });
    jali.actions.openBeside(jali.model().visible[0]!, order({ id: 7 }));
    return jali;
  };
  const tops = (jali: ReturnType<typeof setup>, stack?: number) => {
    const m = storeOf(jali).model();
    const placed = frames(
      m,
      storeOf(jali).get().view,
      "single",
      { width: 378, height: 760 },
      stack,
    );
    return placed.find((f) => f.node.id === m.stacked!.top)!.rect.height;
  };

  it("gives the top pane its max until the person moves the divider; the other pane takes the rest", () => {
    const jali = setup();
    expect(jali.model().pane(jali.model().stacked!.top)!.ref.kind).toBe("strip");
    expect(tops(jali)).toBe(260);
    // The person's choice wins, as a divider drag may pass a max.
    expect(tops(jali, 0.5)).toBe(Math.round((760 - STACK_GAP) / 2));
  });

  it("is a half when neither kind gives a comfortable or max height", () => {
    const { jali } = make();
    expect(tops(jali as unknown as ReturnType<typeof setup>)).toBe(
      Math.round((760 - STACK_GAP) / 2),
    );
  });

  it("starts the divider there, and its keys move on from it", () => {
    const jali = setup();
    const { container } = render(<JaliRoot jali={jali} />);
    const divider = container.querySelector<HTMLElement>(".jali-stack-divider")!;
    const top = container.querySelector<HTMLElement>('.jali-pane[data-kind="strip"]')!;
    expect(top.style.height).toBe("260px");
    expect(Number(divider.getAttribute("aria-valuenow"))).toBeLessThan(40);
    act(() => void fireEvent.keyDown(divider, { key: "ArrowDown" }));
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
  });
});
