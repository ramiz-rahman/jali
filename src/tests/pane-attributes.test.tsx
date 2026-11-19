/**
 * usePaneAttributes: a pane marks itself from its data with data-* attributes, and Jali puts them on everything that
 * stands for the pane, and nowhere once the pane is closed or shows another object.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import type { LayoutInput } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePane, usePaneAttributes } from "@jali/react";

let room = { width: 1200, height: 600 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out: the workspace measures the room the test asks for.
  for (const prop of ["clientWidth", "clientHeight"] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? room.width : room.height;
      },
    });
});
afterEach(() => {
  cleanup();
  room = { width: 1200, height: 600 };
});

/** A query pane on a connection: production ones say so, from their data. */
const query = definePane("query", {
  params: { conn: String },
  title: ({ conn }) => `Query on ${conn}`,
  Component: ({ params }) => {
    usePaneAttributes(
      params.conn === "prod"
        ? { "data-connection": "production", "data-pane": "not-yours" }
        : params.conn === "none"
          ? null
          : { "data-connection": "staging" },
    );
    return <p>query on {params.conn}</p>;
  },
});

const make = (layout: LayoutInput) =>
  createJali({
    panes: [query],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });

const show = (jali: ReturnType<typeof make>) =>
  render(
    <JaliRoot jali={jali}>
      <JaliView />
      <Shelf />
    </JaliRoot>,
  );

const marked = (value: string) => [
  ...document.querySelectorAll<HTMLElement>(`[data-connection="${value}"]`),
];

describe("usePaneAttributes", () => {
  it("marks the pane's section, keeps Jali's own data-* attributes, and leaves other panes alone", () => {
    const jali = make(
      row(pane(query({ conn: "prod" }), { id: "a" }), pane(query({ conn: "stage" }), { id: "b" })),
    );
    show(jali);
    const a = document.querySelector<HTMLElement>('section[data-pane="a"]')!;
    expect(a.dataset.connection).toBe("production");
    expect(document.querySelector('section[data-pane="b"]')!.getAttribute("data-connection")).toBe(
      "staging",
    );
    // A name of Jali's own stays Jali's, and is not put on the pane's other parts.
    expect(a.dataset.pane).toBe("a");
    expect(document.querySelectorAll("[data-pane]")).toHaveLength(2);
  });

  it("marks its tab, tucked and folded too, and its shelf chip", () => {
    const jali = make(
      row(pane(query({ conn: "stage" }), { id: "a" }), pane(query({ conn: "prod" }), { id: "b" })),
    );
    show(jali);
    act(() => void jali.actions.tuck("b"));
    const tab = document.querySelector<HTMLElement>('[role="tab"][data-tab="b"]')!;
    expect(tab.dataset.tucked).toBe("true");
    expect(tab.dataset.connection).toBe("production");
    expect(document.querySelector<HTMLElement>('[data-chip="b"]')!.dataset.connection).toBe(
      "production",
    );

    // Folded: too little room for both.
    act(() => void jali.actions.putBack("b"));
    room = { width: 360, height: 600 };
    act(() => void window.dispatchEvent(new Event("resize")));
    act(() => storeOf(jali).set({ area: { width: 360, height: 600 } }));
    const folded = document.querySelector<HTMLElement>('[role="tab"][data-folded]')!;
    expect(folded).toBeTruthy();
    expect(folded.dataset.connection).toBe(folded.dataset.tab === "b" ? "production" : "staging");
    const chip = document.querySelector<HTMLElement>(`[data-chip="${folded.dataset.tab}"]`)!;
    expect(chip.dataset.connection).toBe(folded.dataset.connection);
  });

  it("marks its entry in the pane switcher (single view)", () => {
    room = { width: 200, height: 700 };
    const jali = make(
      row(pane(query({ conn: "stage" }), { id: "a" }), pane(query({ conn: "prod" }), { id: "b" })),
    );
    show(jali);
    act(() => storeOf(jali).set({ area: { width: 200, height: 700 } }));
    const entry = [...document.querySelectorAll<HTMLElement>(".jali-switch-item")].find(
      (e) => e.getAttribute("aria-controls")?.endsWith("-b") ?? false,
    );
    expect(entry).toBeTruthy();
    expect(entry!.dataset.connection).toBe("production");
  });

  it("marks the peek sheet while it shows the pane's object, not another", () => {
    const jali = make(
      row(pane(query({ conn: "stage" }), { id: "a" }), pane(query({ conn: "prod" }), { id: "b" })),
    );
    show(jali);
    act(() => void jali.actions.peek("a", query({ conn: "prod" })));
    const peek = document.querySelector<HTMLElement>('[data-testid="peek"]')!;
    expect(peek.dataset.connection).toBe("production");
    act(() => void jali.actions.peek("a", query({ conn: "other" })));
    expect(
      document.querySelector('[data-testid="peek"]')!.getAttribute("data-connection"),
    ).toBeNull();
  });

  it("clears them when the pane shows another object or closes, and keeps them out of jali.actions", () => {
    const jali = make(
      row(pane(query({ conn: "prod" }), { id: "a" }), pane(query({ conn: "stage" }), { id: "b" })),
    );
    show(jali);
    // Only its own names: Jali's (here data-pane) are dropped.
    expect(storeOf(jali).get().paneAttributes.a).toEqual({ "data-connection": "production" });
    act(() => void jali.actions.openHere("a", query({ conn: "none" })));
    expect(storeOf(jali).get().paneAttributes.a).toBeUndefined();
    expect(document.querySelector('section[data-pane="a"]')!.hasAttribute("data-connection")).toBe(
      false,
    );
    act(() => void jali.actions.close("b"));
    expect(storeOf(jali).get().paneAttributes.b).toBeUndefined();
    expect(marked("staging")).toEqual([]);
    expect("setPaneAttributes" in jali.actions).toBe(false);
  });
});
