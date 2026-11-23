/**
 * One set of limits for what a link holds (layout/codec/limits.ts), used by the writer and the reader alike
 * (stabilisation step 4, URL-3). Before, a curated page wrote every opened pane but read only 32, and start-up
 * published a layout of any size. Now an action past a limit is refused as "blocked", with nothing written; what is
 * already past one opens and may shrink; and every address written reads back whole in a fresh instance.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  layout as L,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
} from "@jali/core";
import { definePageEngine as definePage, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const loan = { kind: "loan", title: "Loan", params: { id: Number }, width: { min: 260 } };
const note = { kind: "note", title: "Note", params: { id: Number }, width: { min: 200 } };
const n = (id: number) => ({ kind: "note", params: { id } });
const book = definePage({
  id: "book",
  name: "Book",
  itemNoun: "loan",
  home: "main",
  roles: [{ id: "main", label: "Loan", priority: "primary" as const }],
  firstItem: 1,
  bind: (item: number) => ({ main: { kind: "loan", params: { id: item } } }),
  build: (item: number) =>
    pane({ kind: "loan", params: { id: item } }, { id: "main", role: "main" }),
});

const onPage = (o: { url?: boolean; search?: string } = {}) => {
  const location = memoryLocation(o.search ?? "");
  const jali = createJali({
    panes: [loan, note],
    page: book,
    ...(o.url === false ? {} : { features: [urlSync({ location })] }),
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });
  jali.start();
  return { jali, location };
};
const opened = (jali: ReturnType<typeof onPage>["jali"]) =>
  jali.model().panes.filter((p) => !p.role).length;

describe("a curated page's opened panes", () => {
  for (const url of [true, false])
    it(`32 open, the 33rd is refused, and opens once one closes (${url ? "with" : "without"} an address)`, () => {
      const { jali, location } = onPage({ url });
      jali.page!.open();
      jali.page!.setMode("split");
      for (let i = 1; i <= 32; i++) expect(jali.actions.addTab("main", n(i)).ok).toBe(true);
      expect(opened(jali)).toBe(32);
      const layout = jali.getLayout(),
        entries = [...location.entries],
        undo = storeOf(jali).get().undoStack;
      const last = jali
        .model()
        .panes.filter((p) => !p.role)
        .at(-1)!.id;
      // By every route: a link followed from an opened pane, a tab added.
      expect(jali.actions.openBeside(last, n(33))).toMatchObject({ ok: false, reason: "blocked" });
      expect(jali.actions.addTab("main", n(33))).toMatchObject({ ok: false, reason: "blocked" });
      expect(jali.getLayout()).toBe(layout);
      expect(location.entries).toEqual(entries);
      expect(storeOf(jali).get().undoStack).toBe(undo);
      // Showing an object already open, or another object in a pane, still works.
      expect(jali.actions.addTab("main", n(5)).ok).toBe(true);
      expect(jali.actions.openHere(last, n(40)).ok).toBe(true);
      expect(opened(jali)).toBe(32);
      const first = jali.model().panes.find((p) => !p.role)!.id;
      expect(jali.actions.close(first).ok).toBe(true);
      expect(jali.actions.addTab("main", n(33)).ok).toBe(true);
      expect(opened(jali)).toBe(32);
    });

  it("the address with 32 reopens all 32, in a fresh instance", () => {
    const { jali, location } = onPage();
    jali.page!.open();
    jali.page!.setMode("split");
    for (let i = 1; i <= 32; i++) jali.actions.addTab("main", n(i));
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
    const again = onPage({ search: location.search() }).jali;
    expect(
      again
        .model()
        .panes.filter((p) => !p.role)
        .map((p) => p.ref),
    ).toEqual(
      jali
        .model()
        .panes.filter((p) => !p.role)
        .map((p) => p.ref),
    );
  });
});

describe("a layout larger than a link", () => {
  const many = (count: number) =>
    tabs(...Array.from({ length: count }, (_, i) => pane(n(i), { id: `p${i}` })));
  const make = (layout: ReturnType<typeof many>) => {
    const location = memoryLocation();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const jali = createJali({
      panes: [note],
      layout,
      features: [urlSync({ location, sizes: "link" })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    return { jali, location, warn };
  };

  it("one node short of the limit takes one more, and no more", () => {
    // A group of 254 tabs is 255 nodes.
    const { jali, warn } = make(many(254));
    expect(jali.actions.addTab("p0", n(1000)).ok).toBe(true);
    expect(jali.actions.addTab("p0", n(1001))).toMatchObject({ ok: false, reason: "blocked" });
    warn.mockRestore();
  });

  it("at start-up opens, writes no address it couldn't read, says so once, and grows no further", () => {
    const { jali, location, warn } = make(many(300));
    expect(jali.model().panes).toHaveLength(300);
    expect(location.search()).toBe("");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(jali.actions.addTab("p0", n(1000))).toMatchObject({ ok: false, reason: "blocked" });
    // Shrinking is fine; once it fits, the address is written, and reads back.
    jali.actions.focus("p0");
    for (let i = 299; i >= 255; i--) expect(jali.actions.remove(`p${i}`).ok).toBe(true);
    expect(location.search()).not.toBe("");
    const code = new URLSearchParams(location.search()).get("l")!;
    expect(L.tree.panes(L.decode(code, jali.env.kinds.registry())!.root)).toHaveLength(255);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("from setLayout: well formed but too large is blocked; malformed is invalid", () => {
    const { jali, warn } = make(many(2));
    const before = jali.getLayout();
    expect(jali.setLayout(many(300))).toMatchObject({ ok: false, reason: "blocked" });
    expect(jali.setLayout(row(pane(n(1), { id: "x" }), pane(n(2), { id: "x" })))).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(jali.getLayout()).toBe(before);
    warn.mockRestore();
  });
});
