/**
 * Stacked view (a portrait phone with `phone: { stack: true }`): the focused pane and the pane it was opened from,
 * one above the other, in place of Single view's one pane.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, type PhoneOptions } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

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
    url: { location: memoryLocation() },
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
    const m = jali.model();
    expect(m.single).toBe(true);
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
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 378, height: 760 },
      moveFocus: false,
      phone: { stack: true },
    });
    expect(alone.model().single).toBe(true);
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
    expect(container.querySelector(".jali-workspace")!.hasAttribute("data-stacked")).toBe(true);
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
});
