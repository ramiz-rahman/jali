/**
 * A destroyed workspace does nothing more (core-opus CORE-3, core-codex CORE-5). A held host answer, a later commit,
 * a URL write or an arrival waiting for a decision never lands on whatever route shows next.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type JaliOptions } from "@jali/core";
import { createUrlSync, storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });

function deferred() {
  let answer!: (yes: boolean) => void;
  const promise = new Promise<boolean>((r) => (answer = r));
  return { promise, answer };
}

const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [item],
    layout: row({ ...ref(1), id: "a" } as never, { ...ref(2), id: "b" } as never),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });

describe("destroy() ends everything pending", () => {
  it("a host's yes after destroy() changes nothing and writes no address", async () => {
    const location = memoryLocation();
    const held = deferred();
    const jali = make({ url: { location }, beforeClose: () => held.promise });
    const panes = jali.model().resolved.panes.map((p) => p.id);
    const r = jali.actions.close(panes[1]!);
    expect(r.reason).toBe("pending");
    const entries = location.entries.length;
    jali.destroy();
    location.navigate("?route=next", "push");
    held.answer(true);
    await expect(r.settled).resolves.toEqual({ ok: false, reason: "kept" });
    await Promise.resolve();
    expect(jali.model().resolved.panes.map((p) => p.id)).toEqual(panes);
    expect(location.entries.length).toBe(entries + 1);
    expect(location.search()).toBe("?route=next");
  });

  it("settles a held host answer as kept at once, before the host answers", async () => {
    const held = deferred();
    const jali = make({ url: false, beforeClose: () => held.promise });
    const r = jali.actions.close(jali.model().resolved.panes[1]!.id);
    let end: unknown;
    void r.settled!.then((v) => (end = v));
    jali.destroy();
    await Promise.resolve();
    await Promise.resolve();
    expect(end).toEqual({ ok: false, reason: "kept" });
  });

  it("refuses every action after destroy()", () => {
    const jali = make({ url: false });
    const layout = jali.getLayout();
    jali.destroy();
    expect(jali.actions.openBeside(jali.model().resolved.panes[0]!.id, ref(3))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(jali.setLayout(row(ref(9))).reason).toBe("unavailable");
    expect(jali.getLayout()).toBe(layout);
  });

  it("a URL sync cancelled drops later writes", () => {
    const location = memoryLocation("?x=1");
    const sync = createUrlSync({ location, storage: memoryStorage() });
    const jali = make({ url: sync });
    const at = location.search();
    sync.cancel!();
    storeOf(jali).writeUrl("push");
    jali.actions.openBeside(jali.model().resolved.panes[0]!.id, ref(5));
    expect(location.search()).toBe(at);
  });

  it("an arrival waiting for the host when the listeners stop does nothing after", async () => {
    const location = memoryLocation();
    const held = deferred();
    const jali = make({ url: { location }, beforeClose: () => held.promise });
    const stop = jali.start();
    const layout = jali.getLayout();
    const other = make({ url: { location: memoryLocation() }, layout: row(ref(7)) });
    location.visit(new URL(storeOf(other).href().replace("memory:", "http://x/")).search);
    stop();
    held.answer(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(jali.getLayout()).toBe(layout);
  });
});
