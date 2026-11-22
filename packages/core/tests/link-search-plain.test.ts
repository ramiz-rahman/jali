/**
 * `linkSearch` reads what a link may carry from the instance's kinds, never from how a ref was made (architecture
 * review 22 Nov 2026, P1-1). It used to remember which refs a kind's call built (core-opus CORE-20): a copy, a built
 * layout (`toLayout`) or a ref read from JSON then carried its app-only params into the link.
 */
import { describe, expect, it } from "vite-plus/test";
import { layout as L, row, toLayout } from "@jali/core";
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
const panes = [doc];
const firstParams = (search: string) => {
  const read = L.decode(new URLSearchParams(search).get("l")!, createPaneKinds(panes).registry())!;
  return L.tree.panes(read.root)[0]!.ref.params;
};

describe("linkSearch", () => {
  it("leaves out an app-only param however the layout was made", () => {
    const built = doc({ id: 1, draft: "PRIVATE" });
    for (const layout of [
      built,
      structuredClone(built),
      row(built),
      toLayout(row(built)),
      JSON.parse(JSON.stringify(toLayout(row(built)))),
    ])
      expect(firstParams(linkSearch({ layout }, { panes }))).toEqual({ id: 1 });
  });
});
