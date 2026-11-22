/**
 * `linkSearch` without the workspace's kinds can only leave out the app-only params of refs a kind's call built: a copy
 * loses that mark (core-opus CORE-20), and so did the layout builders, which copy every ref. Each ref is now read as
 * a link carries it before it is copied, and development says when a plain object may carry app-only params.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { layout as L } from "@jali/core";
import {
  appOnly,
  createPaneKinds,
  defineKind,
  linkSearch,
  type PaneKindBase,
} from "@jali/core/adapter";

const doc = defineKind<{ id: number; draft?: string }, PaneKindBase>({
  kind: "doc",
  title: "Doc",
  params: { id: Number, draft: appOnly(String) },
});

afterEach(() => vi.restoreAllMocks());

describe("linkSearch without panes", () => {
  it("says when a ref no kind's call built may carry app-only params", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const built = doc({ id: 1, draft: "x" });
    const code = new URLSearchParams(linkSearch({ layout: built })).get("l")!;
    const read = L.decode(code, createPaneKinds([doc]).registry())!;
    expect(L.tree.panes(read.root)[0]!.ref.params).toEqual({ id: 1 });
    expect(warn).not.toHaveBeenCalled();
    linkSearch({ layout: structuredClone(built) });
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/give it `panes`/);
  });
});
