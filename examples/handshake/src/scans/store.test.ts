/** The store: samples, adding and forgetting, persistence, and storage that fails. */
import { describe, expect, it, vi } from "vitest";
import * as fx from "./fixtures";
import { SAMPLE_IDS, createScanStore, hashOf } from "./store";

const memory = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe("scan store", () => {
  it("has the three samples, marked as such, parsed from their own text", () => {
    const s = createScanStore(memory());
    const list = s.list();
    expect(list.map((x) => x.id)).toEqual([SAMPLE_IDS.wifi, SAMPLE_IDS.devices, SAMPLE_IDS.path]);
    expect(list.every((x) => x.sample)).toBe(true);
    expect(s.get("sample-wifi")?.scan.kind).toBe("wifi");
    expect(s.get("sample-devices")?.scan.kind).toBe("devices");
    expect(s.get("sample-path")?.scan.kind).toBe("path");
  });

  it("adds a scan under a hash id, once however often it is pasted, and lists it before the samples", () => {
    const s = createScanStore(memory());
    const a = s.add(fx.TRACERT);
    const b = s.add(fx.TRACERT);
    expect(a.ok && a.id).toMatch(/^scan-[0-9a-z]{7}$/);
    expect(b.id).toBe(a.id);
    expect(s.list()).toHaveLength(4);
    expect(s.list()[0]).toMatchObject({
      sample: false,
      kind: "path",
      format: "path-tracert",
      title: "Path to example.com · 5 hops",
    });
  });

  it("refuses what it cannot read, with the reason", () => {
    const s = createScanStore(memory());
    const r = s.add("not a scan");
    expect(r.ok).toBe(false);
    expect(s.list()).toHaveLength(3);
  });

  it("keeps the text in storage and reads it back in a new store", () => {
    const store = memory();
    const first = createScanStore(store);
    const id = first.add(fx.ARP_MACOS).id!;
    expect(first.persisted()).toBe(true);
    const second = createScanStore(store);
    expect(second.get(id)).toMatchObject({ kind: "devices", sample: false });
  });

  it("forgets one scan, then all, and tidies storage", () => {
    const store = memory();
    const s = createScanStore(store);
    const a = s.add(fx.ARP_MACOS).id!;
    s.add(fx.MTR);
    s.forget(a);
    expect(s.get(a)).toBeUndefined();
    expect(s.list()).toHaveLength(4);
    s.forgetAll();
    expect(s.list()).toHaveLength(3);
    expect(store.m.size).toBe(0);
  });

  it("tells subscribers", () => {
    const s = createScanStore(memory());
    const fn = vi.fn();
    const off = s.state.subscribe(fn);
    s.add(fx.MTR);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.forgetAll();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("works with no storage, and says scans are not kept", () => {
    const s = createScanStore(undefined);
    expect(s.persisted()).toBe(false);
    expect(s.add(fx.MTR).ok).toBe(true);
    expect(s.list()).toHaveLength(4);
  });

  it("survives storage that throws on read and on write", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const s = createScanStore(broken);
    expect(s.persisted()).toBe(false);
    expect(s.add(fx.MTR).ok).toBe(true);
    expect(s.list()).toHaveLength(4);
    s.forgetAll();
    expect(s.list()).toHaveLength(3);
  });

  it("ignores corrupt stored data", () => {
    const store = memory();
    store.setItem("handshake.scans", "{{{");
    expect(createScanStore(store).list()).toHaveLength(3);
    store.setItem(
      "handshake.scans",
      JSON.stringify([{ id: 1 }, { id: "x", text: "junk", addedAt: 1 }]),
    );
    expect(createScanStore(store).list()).toHaveLength(3);
  });

  it("hashes the same text to the same id and different text to a different one", () => {
    expect(hashOf("a")).toBe(hashOf("a"));
    expect(hashOf("a")).not.toBe(hashOf("b"));
  });
});
