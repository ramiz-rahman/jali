/** usePaneState: its first `initial` stands, as with useState (QUALITY-REVIEW P10), and `parse` checks stored values. */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { useReducer } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, usePaneState } from "@jali/react";
import { noUrl } from "./features";

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
        if (!this.classList.contains("jali-layout")) return 0;
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

describe("a setter kept after its pane shows another object (react-codex REACT-1)", () => {
  let setDraft: (v: string) => void = () => {};
  const doc = definePane("doc", {
    params: { id: Number },
    title: ({ id }) => `Doc ${id}`,
    Component: () => {
      const [, set] = usePaneState("draft", "");
      setDraft = set;
      return null;
    },
  });

  it("writes nothing into the next object's state", () => {
    const jali = createJali({
      panes: [doc],
      layout: row(pane(doc({ id: 1 }), { id: "d" })),
      features: noUrl(),
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    const stale = setDraft;
    act(() => void jali.actions.openHere("d", doc({ id: 2 })));
    act(() => stale("written for doc 1"));
    expect(storeOf(jali).get().paneState.d).toBeUndefined();
    act(() => setDraft("doc 2's own"));
    expect(storeOf(jali).get().paneState.d).toEqual({ draft: "doc 2's own" });
  });
});

describe("null as a value of its own", () => {
  let got: (string | null)[] = [];
  let parse: ((v: unknown) => string | null | undefined) | undefined;
  const note = definePane("note", {
    params: {},
    title: () => "Note",
    Component: () => {
      const [value] = usePaneState<string | null>("pick", "none", parse ? { parse } : undefined);
      got.push(value);
      return null;
    },
  });

  function mountNote(stored: unknown) {
    got = [];
    const jali = createJali({
      panes: [note],
      layout: row(pane(note({}), { id: "n" })),
      features: noUrl(),
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    storeOf(jali).actions.setPaneState("n", "pick", stored);
    render(<JaliRoot jali={jali} />);
  }

  it("keeps the null a parser returns", () => {
    parse = (v) => (v === "clear" ? null : typeof v === "string" ? v : undefined);
    mountNote("clear");
    expect(got.at(-1)).toBeNull();
  });

  it("starts from initial when the parser returns undefined", () => {
    parse = () => undefined;
    mountNote("anything");
    expect(got.at(-1)).toBe("none");
  });

  it("keeps a stored null when there is no parser", () => {
    parse = undefined;
    mountNote(null);
    expect(got.at(-1)).toBeNull();
  });
});
