/**
 * DOM ids and names when several workspaces share a page (react-opus REACT-4 and REACT-18, react-codex REACT-10):
 * each mounted workspace scopes its ids when the host gave it no `id`, so ids never repeat and every ARIA reference
 * stays inside its own workspace; ids are injective (pane ids `x` and `x-title` don't collide); two workspaces given
 * the same `id` are a development error; and `<JaliRoot aria-label | aria-labelledby>` names a workspace at render.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  type JaliOptions,
} from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  width: { min: 200 },
  Component: () => null,
});
const make = (opts: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(
      tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
      pane(note({ id: 3 }), { id: "c" }),
    ),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...opts,
  });

/** Every id that appears more than once in the document. */
const duplicates = () => {
  const seen = new Map<string, number>();
  for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
};
/** Each ARIA id reference, and whether it resolves to an element inside the same workspace root. */
const references = () => {
  const out: { attr: string; ref: string; ok: boolean }[] = [];
  for (const attr of ["aria-labelledby", "aria-controls", "aria-describedby"])
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      const home = el.closest("[data-jali]");
      for (const ref of el.getAttribute(attr)!.split(/\s+/).filter(Boolean)) {
        const target = document.getElementById(ref);
        out.push({ attr, ref, ok: !!target && (!home || home.contains(target)) });
      }
    }
  return out;
};

describe("two workspaces on one page", () => {
  it("without ids: no id repeats, and every reference stays in its own workspace", () => {
    render(
      <>
        <JaliRoot jali={make()} />
        <JaliRoot jali={make()} />
      </>,
    );
    expect(document.querySelectorAll("section[data-pane]").length).toBe(6);
    expect(duplicates()).toEqual([]);
    const refs = references();
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((r) => !r.ok)).toEqual([]);
  });

  it("given the same id: a development error that names id and label", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <JaliRoot jali={make({ id: "notes" })} />
        <JaliRoot jali={make({ id: "notes" })} />
      </>,
    );
    expect(error.mock.calls.flat().join(" ")).toMatch(/share the id "notes".*id.*label/s);
  });

  it("given their own ids: the ids are the host's", () => {
    render(
      <>
        <JaliRoot jali={make({ id: "left" })} />
        <JaliRoot jali={make({ id: "right" })} />
      </>,
    );
    expect(document.querySelector('[data-pane="c"]')!.id).toBe("left-pane-c");
    expect(duplicates()).toEqual([]);
  });

  it("the same name twice: a development warning to name them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <>
        <JaliRoot jali={make()} />
        <JaliRoot jali={make()} />
      </>,
    );
    expect(warn.mock.calls.flat().join(" ")).toMatch(/aria-label/);
  });
});

describe("ids inside one workspace", () => {
  it("pane ids x and x-title never share a DOM id", () => {
    render(
      <JaliRoot
        jali={make({
          layout: row(pane(note({ id: 1 }), { id: "x" }), pane(note({ id: 2 }), { id: "x-title" })),
        })}
      />,
    );
    expect(duplicates()).toEqual([]);
    expect(references().filter((r) => !r.ok)).toEqual([]);
  });
});

describe("<JaliRoot aria-label | aria-labelledby>", () => {
  it("aria-label names the workspace and its panes, over createJali's label, and can change", () => {
    const jali = make({ label: "Notes" });
    const { getByRole, rerender } = render(<JaliRoot jali={jali} aria-label="Left notes" />);
    expect(getByRole("region", { name: "Left notes" })).toBeTruthy();
    expect(document.querySelector("[data-jali]")!.hasAttribute("aria-label")).toBe(false);
    expect(document.querySelector('[data-pane="c"]')!.getAttribute("aria-label")).toMatch(
      /Note 3.*Left notes/,
    );
    rerender(<JaliRoot jali={jali} aria-label="Notes de gauche" />);
    expect(getByRole("region", { name: "Notes de gauche" })).toBeTruthy();
  });

  it("aria-labelledby points the workspace at a visible heading, and its panes carry its words", () => {
    const { getByRole } = render(
      <>
        <h2 id="heading">Field notes</h2>
        <JaliRoot jali={make()} aria-labelledby="heading" />
      </>,
    );
    const ws = document.querySelector(".jali-layout")!;
    expect(ws.getAttribute("aria-labelledby")).toBe("heading");
    expect(ws.hasAttribute("aria-label")).toBe(false);
    act(() => {});
    expect(getByRole("region", { name: /Note 1.*Field notes/ })).toBeTruthy();
  });
});
