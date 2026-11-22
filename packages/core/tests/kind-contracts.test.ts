/**
 * A kind's callbacks give what the rest of the instance can use, or fall back (architecture review 22 Nov 2026,
 * P2-8). A Standard Schema's output must still be params (text, numbers, flags); an `identity` is written as JSON
 * inside its guard, so one JSON can't write (a bigint, a cycle, a function) falls back to the params, as a throw did.
 */
import { describe, expect, it } from "vite-plus/test";
import { createPaneKinds, type PaneKindBase } from "@jali/core/adapter";

const schema = (transform: (v: Record<string, unknown>) => unknown) => ({
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (v: unknown) => ({ value: transform(v as Record<string, unknown>) }),
  },
});

describe("a schema's output", () => {
  it("is kept when it is params", () => {
    const kinds = createPaneKinds([
      {
        kind: "y",
        title: "Y",
        params: schema((v) => ({ ...v, id: Number(v.id) })),
      } as PaneKindBase,
    ]);
    expect(kinds.params({ kind: "y", params: { id: "4" } })).toEqual({ id: 4 });
    expect(kinds.problems({ kind: "y", params: { id: "4" } })).toEqual([]);
  });

  it("that isn't params is a problem of the param, and the ref keeps what it was given", () => {
    const kinds = createPaneKinds([
      {
        kind: "y",
        title: "Y",
        params: schema((v) => ({ ...v, nested: { deep: [1, 2] } })),
      } as PaneKindBase,
    ]);
    const ref = { kind: "y", params: { a: "1" } };
    expect(kinds.problems(ref)).toEqual([{ param: "nested" }]);
    expect(kinds.params(ref)).toEqual({ a: "1" });
  });

  it("that isn't an object is a problem of the params", () => {
    const kinds = createPaneKinds([
      { kind: "y", title: "Y", params: schema(() => "not params") } as PaneKindBase,
    ]);
    expect(kinds.problems({ kind: "y", params: {} })).toEqual([{ param: "params" }]);
  });
});

describe("an identity", () => {
  const kind = (identity: (p: never) => unknown) =>
    createPaneKinds([
      { kind: "x", title: "X", params: { id: Number }, identity } as unknown as PaneKindBase,
    ]);
  const a = { kind: "x", params: { id: 1 } };

  it.each([
    ["a bigint", () => 1n],
    [
      "a cycle",
      () => {
        const o: Record<string, unknown> = {};
        o.self = o;
        return o;
      },
    ],
    ["a function", () => () => 1],
    [
      "a throw",
      () => {
        throw new Error("boom");
      },
    ],
  ])("JSON can't write (%s) falls back to the params, and never throws", (_, identity) => {
    const kinds = kind(identity);
    expect(() => kinds.identityOf(a)).not.toThrow();
    // As a kind without `identity` reads it: its params.
    const plain = createPaneKinds([
      { kind: "x", title: "X", params: { id: Number } } as PaneKindBase,
    ]);
    expect(kinds.identityOf(a)).toBe(plain.identityOf(a));
    expect(kinds.sameObject(a, { kind: "x", params: { id: 1 } })).toBe(true);
    expect(kinds.sameObject(a, { kind: "x", params: { id: 2 } })).toBe(false);
  });

  it("is compared as JSON when it can be written", () => {
    const kinds = kind((p: { id: number }) => ({ object: "order", id: p.id }) as never);
    expect(kinds.sameObject(a, { kind: "x", params: { id: 1 } })).toBe(true);
    expect(kinds.identityOf(a)).toBe('{"object":"order","id":1}');
  });
});
