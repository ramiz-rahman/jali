import { describe, expect, it } from "vitest";
import * as core from "..";
import { context, fit, freeze, layout, pane, ref, view } from "./fixtures";

describe("pure operations", () => {
  it("preserves identity for refused and unchanged operations", () => {
    const tree = freeze(layout(pane("a"), pane("b")));
    const v = freeze(view()), ctx = context();
    expect(core.close(tree, v, "missing", ctx).layout).toBe(tree);
    expect(core.close(layout(pane("a")), v, "a", ctx).view).toBe(v);
    expect(core.drop(tree, v, "a", "a", "centre", "tab", ctx).layout).toBe(tree);
    expect(core.drop(tree, v, "a", "b", "left", "swap", ctx).layout).toBe(tree);
    expect(core.swap(tree, "a", "missing", ctx)).toBe(tree);
    expect(core.moveDirection(tree, v, "a", "left", ctx).layout).toBe(tree);
    expect(core.resizeDivider(tree, "root", 0, 0, ctx)).toBe(tree);
    expect(core.resizeDivider(tree, "root", 9, 20, ctx)).toBe(tree);
    expect(core.resetDivider(tree, "root", 0, ctx)).toBe(tree);
    expect(core.setRef(tree, v, "a", pane("a").ref, ctx)).toBe(tree);
    expect(core.setActiveTab(tree, "missing", "b", ctx)).toBe(tree);
    expect(core.reveal(tree, "a", ctx)).toBe(tree);
    expect(core.refit(tree, v, ctx)).toBe(tree);
    expect(core.focus(v, "a", ctx)).toBe(v);
    expect(core.focusDirection(v, core.resolve(tree, v, ctx), "left", ctx)).toBe(v);
    const tabs = freeze(layout({ id: "tabs", type: "stack", origin: "user", size: { weight: 1 }, active: "a", children: [pane("a"), pane("b")] }));
    expect(core.setActiveTab(tabs, "tabs", "a", ctx)).toBe(tabs);
    expect(core.resetLayout(core.resetLayout(tree, v, ctx), v, ctx).root.base).toEqual(tree.root.size);
    const linked = freeze(layout(pane("a"), pane("b", "record", { linkedTo: "a", ref: ref() })));
    expect(core.openBeside(linked, v, "a", ref(), ctx).layout).toBe(linked);
  });

  it("carries divider reset preferences through serialization and cap changes", () => {
    const initial = core.resetLayout(layout(pane("a", "small", { size: { weight: 2 } }), pane("b", "small", { size: { weight: 3 } })), view(), context(fit(1006)));
    const resized = core.resizeDivider(freeze(initial), "root", 0, 50, context(fit(1006)));
    const loaded = core.decode(core.encode(resized), fit().kinds)!;
    const recapped = core.refit(loaded, view(), context(fit(1006), 3));
    expect(core.resetDivider(recapped, "root", 0, context(fit(1006), 3))).toEqual(initial);
  });

  it("keeps pane birth order through a URL and independent calls", () => {
    const ctx = context(fit(1920), 3), v = view("c");
    const opened = core.split(layout(pane("a"), pane("b"), pane("c")), v, "c", "left", ref("small"), ctx);
    const imported = core.decode(core.encode(opened.layout), fit().kinds)!;
    expect(core.refit(imported, opened.view, ctx)).toEqual(core.refit(opened.layout, opened.view, ctx));
    expect(core.tree.find(imported.root, opened.opened)).toMatchObject({ born: 4 });
    const before = freeze(layout(pane("a"), pane("b", "small", { size: { px: 200 }, linkedTo: "a" }), pane("c", "small", { size: { px: 150 }, userSized: true })));
    const closeView = freeze(view("b"));
    const result = core.close(before, closeView, "b", context(fit(1000)));
    core.resolve(before, v, context(fit(1920), 1));
    expect(core.close(before, view("b"), "b", context(fit(1000)))).toEqual(result);
  });

  it("selects tabs inside a deliberate group wrapped by a tuck", () => {
    const ctx = context(fit(1600));
    const tree = layout({ id: "tabs", type: "stack", origin: "user", active: "b", size: { weight: 1 }, children: [pane("a"), pane("b")] }, pane("c"));
    const t = core.tuck(tree, view("c"), "c", ctx);
    if (!t.ok) throw new Error("expected tuck");
    const shown = core.reveal(t.layout, "c", ctx);
    const home = core.reveal(shown, "a", ctx);
    expect(core.resolve(home, view(), ctx).panes.filter(b => !b.hidden).map(b => b.id)).toEqual(["a"]);
    expect(core.reveal(home, "a", ctx)).toBe(home);
  });
});
