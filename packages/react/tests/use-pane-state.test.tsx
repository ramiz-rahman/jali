/** usePaneState: its first `initial` stands, as with useState (QUALITY-REVIEW P10), and `parse` checks stored values. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { useReducer } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, usePaneState } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const prop of ["clientWidth", "clientHeight"] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? 1200 : 600;
      },
    });
});
afterEach(cleanup);

interface Filters {
  q: string;
  seed: number;
}
const isFilters = (v: unknown): v is Filters =>
  !!v &&
  typeof v === "object" &&
  typeof (v as Filters).q === "string" &&
  typeof (v as Filters).seed === "number";

let seen: Filters[] = [];
let rerender = () => {};
let update: (fn: (prev: Filters) => Filters) => void = () => {};
let seed = 0;

const explore = definePane("explore", {
  params: {},
  title: () => "Explore",
  Component: () => {
    // A new object, with a new value, on every render: only the first counts.
    const [filters, set] = usePaneState<Filters>(
      "filters",
      { q: "", seed: ++seed },
      {
        parse: (v) => {
          if (isFilters(v) && v.q === "throw") throw new Error("a parse that throws");
          return isFilters(v) ? { ...v } : undefined;
        },
      },
    );
    rerender = useReducer((n: number) => n + 1, 0)[1];
    update = set;
    seen.push(filters);
    return <p>{filters.q}</p>;
  },
});

function mount(stored?: unknown) {
  seen = [];
  seed = 0;
  const jali = createJali({
    panes: [explore],
    layout: row(pane(explore({}), { id: "x" })),
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });
  if (stored !== undefined) storeOf(jali).actions.setPaneState("x", "filters", stored);
  render(
    <JaliRoot jali={jali}>
      <JaliView />
    </JaliRoot>,
  );
  return storeOf(jali);
}

describe("usePaneState", () => {
  it("keeps its first initial while nothing is stored, for the value and for an update's prev", () => {
    const store = mount();
    act(() => rerender());
    act(() => rerender());
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]!.seed).toBe(1);
    act(() => update((prev) => ({ ...prev, q: "lisbon" })));
    expect(store.get().paneState.x?.filters).toEqual({ q: "lisbon", seed: 1 });
  });

  it("uses what parse accepts, and starts from initial when it rejects what was stored", () => {
    mount({ q: "porto", seed: 7 });
    expect(seen.at(-1)).toEqual({ q: "porto", seed: 7 });
    cleanup();
    mount({ q: 42 });
    expect(seen.at(-1)).toEqual({ q: "", seed: 1 });
    act(() => update((prev) => ({ ...prev, q: "faro" })));
    expect(seen.at(-1)).toEqual({ q: "faro", seed: 1 });
  });

  it("starts from initial when parse throws, and keeps what was stored until the pane sets its own", () => {
    const store = mount({ q: "throw", seed: 9 });
    expect(seen.at(-1)).toEqual({ q: "", seed: 1 });
    expect(store.get().paneState.x?.filters).toEqual({ q: "throw", seed: 9 });
  });

  it("gives the same value across renders when parse builds a new object", () => {
    seen = [];
    const store = mount({ q: "braga", seed: 3 });
    act(() => rerender());
    expect(seen.at(-1)).toBe(seen.at(-2));
    expect(store.get().paneState.x?.filters).toEqual({ q: "braga", seed: 3 });
  });
});
