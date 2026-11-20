/**
 * Where a folded pane goes. A tab group needs its widest tab's room, so a wide pane folding behind a narrow list can
 * fold the next pane too. docs/DECISIONS.md, "A fold goes where it keeps the most panes on screen".
 */
import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import type {
  FitOptions,
  KindRegistry,
  Layout,
  LayoutNode,
  PaneNode,
  ResolvedLayout,
} from "../types";
import { context, folded, view } from "./fixtures";

const kinds: KindRegistry = Object.fromEntries(
  [
    ["list", 240],
    ["doc", 380],
    ["card", 300],
    ["wide", 440],
  ].map(([kind, minWidth]) => [
    kind,
    { kind, minWidth, minHeight: 200, title: () => String(kind) },
  ]),
) as KindRegistry;
const fit = (width: number): FitOptions => ({ width, height: 900, gap: 6, kinds });
const ctx = (width: number) => context(fit(width));
const pane = (id: string, kind: string, extra: Partial<PaneNode> = {}): PaneNode => ({
  id,
  type: "pane",
  size: { weight: 1 },
  ref: { kind, params: { id } },
  ...extra,
});
const split = (id: string, type: "row" | "column", children: LayoutNode[]): LayoutNode => ({
  id,
  type,
  size: { weight: 1 },
  children,
});
/** A list, a document opened from it, and under two cards opened from the document, a wide pane following the list. */
const compare = (): Layout => ({
  version: 1,
  root: split("root", "row", [
    pane("list", "list"),
    pane("doc", "doc", { linkedTo: "list" }),
    split("right", "column", [
      split("cards", "row", [
        pane("a", "card", { linkedTo: "doc", kept: true }),
        pane("b", "card", { linkedTo: "doc" }),
      ]),
      pane("wide", "wide", { linkedTo: "list" }),
    ]),
  ]),
});
const fitted = (l: Layout, width: number): ResolvedLayout =>
  core.resolve(core.refit(l, view("list"), ctx(width)), view("list"), ctx(width));
const shown = (r: ResolvedLayout) =>
  r.panes
    .filter((b) => !b.hidden)
    .map((b) => b.id)
    .sort();
const groupOf = (r: ResolvedLayout, id: string) =>
  r.stacks.find((s) => s.paneIds.includes(id))?.homeId;

describe("where a folded pane goes", () => {
  it("does not cascade: the wide pane joins the group whose fold keeps more panes on screen", () => {
    // Behind the list, the wide pane would make the list's group 440 wide; then the document no longer fits beside
    // it and folds too, leaving one pane and four folded. Behind the document (380 → 440) both stay.
    const r = fitted(compare(), 760);
    expect(shown(r)).toEqual(["doc", "list"]);
    expect(folded(r).sort()).toEqual(["a", "b", "wide"]);
    expect(groupOf(r, "wide")).toBe("doc");
  });

  it("keeps the wide pane with the pane it follows wherever that fold already fits", () => {
    // At 900 the list's group at 440 and the document fit side by side: the rule's home is already the best.
    const r = fitted(compare(), 900);
    expect(shown(r)).toEqual(["doc", "list"]);
    expect(groupOf(r, "wide")).toBe("list");
  });

  it("gives the same arrangement at the same width, and comes back the same way", () => {
    const at760 = fitted(compare(), 760);
    const l = core.refit(compare(), view("list"), ctx(1440));
    const narrow = core.refit(l, view("list"), ctx(760));
    const back = core.refit(narrow, view("list"), ctx(1440));
    expect(core.resolve(narrow, view("list"), ctx(760))).toEqual(at760);
    expect(back.overlay?.folds ?? []).toEqual([]);
  });

  it("keeps the rule's home on a tie", () => {
    // Every place leaves one pane on screen: the wide pane stays with the list it follows.
    const r = fitted(compare(), 500);
    expect(shown(r)).toHaveLength(1);
    expect(groupOf(r, "wide")).toBe(groupOf(r, "list"));
  });
});
