/**
 * Render counts: the memoisation DECISIONS relies on (17 Nov, WP3: a keyboard resize re-renders only the frames either
 * side of the divider), held by tests. Each pane frame, pane body and divider layer is wrapped in a `<Profiler>` with
 * the component's own memo rule, so a count is a commit of that part of the tree: the component itself, or anything
 * inside it re-rendering from its own subscription (a frame's header actions, its tab strip). The workspace (`Panes`)
 * is counted by its calls of `frames`, which it makes once per render.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState, type ComponentType } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { column, createJali, memoryLocation, memoryStorage, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, useJaliCommands } from "@jali/react";

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
// The workspace (`Panes`) places every frame on each render it does: one call of `frames` is one render of it.
vi.mock("../packages/core/src/workspace/frames", async (original) => {
  const mod = await original<typeof import("../packages/core/src/workspace/frames")>();
  return {
    ...mod,
    frames: (...args: Parameters<typeof mod.frames>) => {
      counts.panes++;
      return mod.frames(...args);
    },
  };
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
  it("a keyboard resize commits only the two frames either side of the divider, and no pane body", () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    expect(jali.model().visible).toHaveLength(10);
    // The divider inside the first column: its neighbours are that column's two panes.
    const first = jali.model().resolved.dividers.find((d) => d.neighbours?.[0]?.length === 1)!;
    const [[a], [b]] = first.neighbours!;
    const handle = container.querySelector<HTMLElement>(
      `[data-divider="${first.parentId}:${first.index}"] [role="separator"], [role="separator"][data-divider="${first.parentId}:${first.index}"]`,
    )!;
    expect(handle).not.toBeNull();
    const key = first.rect.width > first.rect.height ? "ArrowDown" : "ArrowRight";
    const before = jali.model().resolved;
    const steps: string[][] = [];
    const total = { frame: 0, panes: 0, dividers: 0 };
    for (let i = 0; i < 10; i++) {
      reset();
      act(() => void fireEvent.keyDown(handle, { key }));
      steps.push([...new Set(counts.frame)].sort());
      total.frame += counts.frame.length;
      total.panes += counts.panes;
      total.dividers += counts.dividers;
      expect(counts.body).toEqual([]);
    }
    // eslint-disable-next-line no-console
    console.info(
      `keyboard resize, 10 steps: Panes ${total.panes}, DividerLayer ${total.dividers}, PaneFrame ${total.frame}`,
    );
    expect(jali.model().resolved).not.toBe(before);
    for (const ids of steps) expect(ids).toEqual([a, b].sort());
  });

  it("a pane drag commits no pane frame or body per pointermove: only where it would land changes them", async () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const m = jali.model();
    const dragged = m.visible[0]!;
    const header = container.querySelector<HTMLElement>(
      `[data-pane="${dragged}"] .jali-pane-header`,
    )!;
    await act(async () => {
      fireEvent.pointerDown(header, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    });
    reset();
    const targets: (string | undefined)[] = [];
    let moves = 0;
    let workspaceCommits = 0;
    for (let i = 0; i < 60; i++) {
      // Across the top row, left to right.
      const x = 40 + (i * (W - 80)) / 59,
        y = 250 + (i % 3);
      await act(async () => {
        window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y }));
        await frame();
      });
      moves++;
      const d = storeOf(jali).get().dnd;
      targets.push(d?.target && `${d.target}:${d.zone}`);
    }
    workspaceCommits = counts.panes;
    const changes = targets.filter((t, i) => t !== targets[i - 1]).length;
    // eslint-disable-next-line no-console
    console.info(
      `pane drag, ${moves} moves, ${changes} changes of target: Panes ${workspaceCommits}, DividerLayer ${counts.dividers}, PaneFrame ${counts.frame.length}, PaneBody ${counts.body.length}`,
    );
    expect(counts.body).toEqual([]);
    expect(counts.dividers).toBe(0);
    // The workspace and frames hear only the drag starting and a change of target pane.
    expect(workspaceCommits).toBeLessThanOrEqual(changes + 1);
    expect(counts.frame.length).toBeLessThanOrEqual(2 * changes + 1);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(storeOf(jali).get().dnd).toBeNull();
  });

  it("a drag writes dnd at most once a frame, and a release lands where the pointer last was", async () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const store = storeOf(jali);
    const header = container.querySelector<HTMLElement>(
      `[data-pane="${jali.model().visible[0]}"] .jali-pane-header`,
    )!;
    let writes = 0;
    let last = store.get().dnd;
    const off = store.subscribe(() => {
      if (store.get().dnd !== last) writes++;
      last = store.get().dnd;
    });
    await act(async () => {
      fireEvent.pointerDown(header, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    });
    // Ten moves inside one frame: one write.
    await act(async () => {
      for (let i = 0; i < 10; i++)
        window.dispatchEvent(
          new MouseEvent("pointermove", { clientX: 100 + i * 10, clientY: 250 }),
        );
      await frame();
    });
    expect(writes).toBe(1);
    // The same point again writes nothing.
    await act(async () => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 190, clientY: 250 }));
      await frame();
    });
    expect(writes).toBe(1);
    // Moved onto another column's pane and released before the frame: the drop is there.
    const layouts: unknown[] = [];
    const offLayout = jali.on("layout", (e) => void layouts.push(e));
    const target = jali.model().resolved.panes.find((b) => b.id === jali.model().visible[6])!;
    await act(async () => {
      window.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: target.rect.x + target.rect.width / 2,
          clientY: target.rect.y + target.rect.height / 2,
        }),
      );
      window.dispatchEvent(new MouseEvent("pointerup", {}));
    });
    expect(layouts).toHaveLength(1);
    expect(store.get().dnd).toBeNull();
    off();
    offLayout();
  });

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

  it("useJaliCommands keeps its array while nothing a command shows changes", async () => {
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useJaliCommands());
      return null;
    }
    const jali = make();
    const { container } = render(
      <JaliRoot jali={jali}>
        <JaliView />
        <Probe />
      </JaliRoot>,
    );
    const store = storeOf(jali);
    const first = seen.at(-1);
    // A drag across the panes: dnd changes on every move.
    const header = container.querySelector<HTMLElement>(
      `[data-pane="${jali.model().visible[0]}"] .jali-pane-header`,
    )!;
    await act(async () => {
      fireEvent.pointerDown(header, { button: 0, clientX: 20, clientY: 20, pointerId: 1 });
    });
    for (let i = 0; i < 20; i++)
      await act(async () => {
        window.dispatchEvent(new MouseEvent("pointermove", { clientX: 40 + i * 50, clientY: 250 }));
        await frame();
      });
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(new Set(seen.slice(seen.indexOf(first))).size).toBe(1);
    // A divider moved and focus moved, in this even layout: nothing listed changes.
    act(() => void store.actions.focus(jali.model().visible[3]!));
    const d = jali.model().resolved.dividers[0]!;
    act(() => void store.actions.setDividerSize(d.parentId, d.index, 300));
    expect(seen.at(-1)).toBe(first);
    // The focused pane lists a command of its own: a new list.
    act(
      () =>
        void store.actions.setPaneCommands(jali.model().visible[3]!, [
          { id: "refresh", title: "Refresh", run: () => {} },
        ]),
    );
    expect(seen.at(-1)).not.toBe(first);
    expect((seen.at(-1) as { title: string }[])[0]!.title).toBe("Refresh");
  });

  it("an inline icons object doesn't re-render the frames", () => {
    const Close = () => <svg data-mine="" />;
    const jali = make();
    let bump = () => {};
    function Host() {
      const [n, setN] = useState(0);
      bump = () => setN(n + 1);
      return <JaliRoot jali={jali} icons={{ close: Close }} data-n={n} />;
    }
    const { container } = render(<Host />);
    expect(container.querySelector("[data-mine]")).not.toBeNull();
    reset();
    act(() => bump());
    act(() => bump());
    expect(counts.frame).toEqual([]);
  });
});
