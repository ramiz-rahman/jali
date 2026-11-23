/**
 * `useJaliState` and `useJaliModel` with a selector that returns a fresh object (react-opus REACT-2, react-codex
 * REACT-2): no loop, and with an equality function (`shallow`) no re-render while the parts it picked are the same.
 */
import { act, cleanup, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { definePane, useJaliModel, useJaliState } from "@jali/react";
import { shallow } from "../src/state/react";
// Internal: hooks read outside a root, as a docs side panel does.
import { JaliProvider } from "../src/JaliRoot";
import { defaultFeatures, urlSync } from "./features";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const make = () =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("selectors that return objects", () => {
  it("useJaliState(s => ({…})) renders, without a loop or a warning", () => {
    const jali = make();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: unknown[] = [];
    function Probe() {
      const v = useJaliState((s) => ({ focused: s.view.focused }));
      seen.push(v);
      return <p>{v.focused ?? "none"}</p>;
    }
    const { container } = render(
      <StrictMode>
        <JaliProvider jali={jali}>
          <Probe />
        </JaliProvider>
      </StrictMode>,
    );
    act(() => void jali.actions.focus("b"));
    expect(container.textContent).toBe("b");
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("with shallow, re-renders only when a picked value changes", () => {
    const jali = make();
    let renders = 0;
    function Probe() {
      renders++;
      const v = useJaliState(
        (s) => ({ focused: s.view.focused, cap: s.settings.paneCap }),
        shallow,
      );
      return <p>{v.focused}</p>;
    }
    render(
      <JaliProvider jali={jali}>
        <Probe />
      </JaliProvider>,
    );
    act(() => void jali.actions.focus("a"));
    const after = renders;
    // Something it didn't pick changes: no render.
    act(() => void storeOf(jali).actions.setTitle("a", "Renamed"));
    act(() => void jali.actions.toggleZoom("a"));
    expect(renders).toBe(after);
    act(() => void jali.actions.focus("b"));
    expect(renders).toBe(after + 1);
  });

  it("a selector that reads a changing prop sees the new prop", () => {
    const jali = make();
    function Probe({ id }: { id: string }) {
      const v = useJaliState((s) => ({ on: s.view.focused === id }), shallow);
      return <p>{v.on ? "on" : "off"}</p>;
    }
    act(() => void jali.actions.focus("a"));
    const { container, rerender } = render(
      <JaliProvider jali={jali}>
        <Probe id="a" />
      </JaliProvider>,
    );
    expect(container.textContent).toBe("on");
    rerender(
      <JaliProvider jali={jali}>
        <Probe id="b" />
      </JaliProvider>,
    );
    expect(container.textContent).toBe("off");
  });

  it("useJaliModel(select, shallow): a live title elsewhere doesn't re-render", () => {
    const jali = make();
    let renders = 0;
    function Probe() {
      renders++;
      const v = useJaliModel(
        (m) => ({
          ids: m.panes
            .filter((p) => p.where !== "hidden")
            .map((p) => p.id)
            .join(),
          t: m.pane("a")?.title,
        }),
        shallow,
      );
      return <p>{v.t}</p>;
    }
    const { container } = render(
      <JaliProvider jali={jali}>
        <Probe />
      </JaliProvider>,
    );
    const before = renders;
    act(() => void storeOf(jali).actions.setTitle("b", "Other"));
    expect(renders).toBe(before);
    act(() => void storeOf(jali).actions.setTitle("a", "Mine"));
    expect(container.textContent).toBe("Mine");
  });

  it("a whole-state or whole-model read doesn't re-render for what only the engine holds", () => {
    const jali = make();
    let renders = 0;
    function Probe() {
      renders++;
      const s = useJaliState((x) => x);
      const m = useJaliModel();
      return (
        <p>
          {s.view.focused} {m.panes.map((p) => `${p.id}:${p.where}`).join(" ")}
        </p>
      );
    }
    const { container } = render(
      <JaliProvider jali={jali}>
        <Probe />
      </JaliProvider>,
    );
    const before = renders;
    const store = storeOf(jali);
    act(() => store.set({ paletteOpen: true }));
    act(() => void store.actions.setPaneState("a", "draft", "x"));
    act(() => store.announce("Said"));
    expect(renders).toBe(before);
    act(() => void jali.actions.focus("b"));
    expect(renders).toBe(before + 1);
    expect(container.textContent).toBe("b a:shown b:shown");
  });

  it("a selector over one pane doesn't re-render when another pane changes", () => {
    const jali = make();
    let renders = 0;
    function Probe() {
      renders++;
      const a = useJaliModel((m) => m.pane("a"));
      return <p>{a?.title}</p>;
    }
    render(
      <JaliProvider jali={jali}>
        <Probe />
      </JaliProvider>,
    );
    const before = renders;
    act(() => void storeOf(jali).actions.setTitle("b", "Other"));
    act(() => void jali.actions.select("b", note({ id: 7 })));
    expect(renders).toBe(before);
    act(() => void jali.actions.focus("b"));
    expect(renders).toBe(before + 1);
  });

  it("shallow compares one level of objects and arrays", () => {
    expect(shallow({ a: 1, b: "x" }, { a: 1, b: "x" })).toBe(true);
    expect(shallow({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallow([1, 2], [1, 2])).toBe(true);
    expect(shallow([1, 2], [2, 1])).toBe(false);
    expect(shallow({ a: {} }, { a: {} })).toBe(false);
    expect(shallow(1, 1)).toBe(true);
    expect(shallow(null, {})).toBe(false);
  });
});
