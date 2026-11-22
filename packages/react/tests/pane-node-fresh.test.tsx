/**
 * A pane's component sees its whole node as it is now (react-codex REACT-7): `setLayout` with the same geometry, ids
 * and refs but another `role` or `follows` reaches `PaneProps.node`. The frame and the body compared a hand-picked
 * list of fields (core `sameNode`), so those changes never re-rendered the pane.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryStorage, pane, row, type PaneNode } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { noUrl } from "./features";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const nodes = new Map<string, PaneNode>();
const list = definePane("list", {
  title: "List",
  selects: "doc",
  Component: ({ node }) => (nodes.set(node.id, node), null),
});
const doc = definePane("doc", {
  params: { id: Number },
  title: ({ id }) => `Doc ${id}`,
  Component: ({ node }) => (nodes.set(node.id, node), null),
});

describe("PaneProps.node", () => {
  it("follows a change of role or follows that leaves the geometry as it was", () => {
    const layout = (follows: boolean, role?: string) =>
      row(
        pane(list(), { id: "l" }),
        pane(doc({ id: 1 }), { id: "d", linkedTo: "l", follows, ...(role ? { role } : {}) }),
      );
    const jali = createJali({
      panes: [list, doc],
      layout: layout(true),
      features: noUrl(),
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    expect(nodes.get("d")?.follows).toBe(true);
    act(() => void jali.setLayout(layout(false, "detail")));
    expect(nodes.get("d")?.follows).toBeFalsy();
    expect(nodes.get("d")?.role).toBe("detail");
  });
});
