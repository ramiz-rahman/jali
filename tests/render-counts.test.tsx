/**
 * Render counts: the memoisation DECISIONS relies on (17 Nov, WP3: a keyboard resize re-renders only the frames either
 * side of the divider), held by tests. Each pane frame, pane body, the workspace (`Panes`) and the divider layer are
 * wrapped in a `<Profiler>` with the component's own memo rule, so a count is a commit of that part of the tree: the
 * component itself, or anything inside it re-rendering from its own subscription (a frame's header actions, its tab
 * strip).
 */
import { act, cleanup, render } from "@testing-library/react";
import { type ComponentType } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { column, createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

const counts = vi.hoisted(() => ({
  frame: [] as string[],
  body: [] as string[],
  panes: 0,
  dividers: 0,
}));

/** The same component, memoised by the same rule, with a Profiler inside that counts its commits. */
const profiled = vi.hoisted(
  () =>
    (
      React: typeof import("react"),
      Original: unknown,
      count: (props: Record<string, unknown>) => void,
    ) => {
      const o = Original as {
        type?: ComponentType<object>;
        compare?: (a: object, b: object) => boolean;
      };
      const Inner = (o.type ?? Original) as ComponentType<object>;
      const Wrapped = (p: Record<string, unknown>) =>
        React.createElement(
          React.Profiler,
          { id: "count", onRender: () => count(p) },
          React.createElement(Inner, p),
        );
      return o.type ? React.memo(Wrapped, o.compare ?? undefined) : Wrapped;
    },
);

vi.mock("../packages/react/src/pane/PaneFrame", async (original) => {
  const mod = await original<typeof import("../packages/react/src/pane/PaneFrame")>();
  const React = await import("react");
  return {
    ...mod,
    PaneFrame: profiled(React, mod.PaneFrame, (p) =>
      counts.frame.push((p.frame as { node: { id: string } }).node.id),
    ),
  };
});
vi.mock("../packages/react/src/pane/PaneBody", async (original) => {
  const mod = await original<typeof import("../packages/react/src/pane/PaneBody")>();
  const React = await import("react");
  return {
    ...mod,
    PaneBody: profiled(React, mod.PaneBody, (p) => counts.body.push((p.node as { id: string }).id)),
  };
});
vi.mock("../packages/react/src/dividers/DividerLayer", async (original) => {
  const mod = await original<typeof import("../packages/react/src/dividers/DividerLayer")>();
  const React = await import("react");
  return { ...mod, DividerLayer: profiled(React, mod.DividerLayer, () => counts.dividers++) };
});
vi.mock("../packages/react/src/workspace/Workspace", async (original) => {
  const mod = await original<typeof import("../packages/react/src/workspace/Workspace")>();
  const React = await import("react");
  return { ...mod, Panes: profiled(React, mod.Panes, () => counts.panes++) };
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const W = 2400,
  H = 1000;
const size = { clientWidth: W, clientHeight: H };
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

/** Ten panes: five columns of two. */
const make = () =>
  createJali({
    panes: [note],
    layout: row(
      ...[0, 1, 2, 3, 4].map((c) => column(note({ id: c * 2 + 1 }), note({ id: c * 2 + 2 }))),
    ),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: W, height: H },
    settings: { paneCap: 10 },
    moveFocus: false,
  });

const reset = () => {
  counts.frame.length = 0;
  counts.body.length = 0;
  counts.panes = 0;
  counts.dividers = 0;
};
const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

describe("render counts", () => {
  it("a pane's live title doesn't resolve the layout again", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    const store = storeOf(jali);
    const before = store.model();
    const id = before.visible[0]!;
    act(() => void store.actions.setTitle(id, "Live 1"));
    const after = store.model();
    expect(after.title(id)).toBe("Live 1");
    expect(after.resolved).toBe(before.resolved);
    expect(after.content).toBe(before.content);
    expect(after.flat).toBe(before.flat);
    expect(after.groups).toBe(before.groups);
    // And a model asked for again is the same object.
    expect(store.model()).toBe(after);
  });
});
