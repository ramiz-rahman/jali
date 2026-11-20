/**
 * Hostile input (docs/QUALITY-REVIEW.md, C1–C7 and P17): every value from outside (a link, storage, an agent, the
 * host's own calls) is checked once, where it comes in, and never crashes the workspace, reaches a CSS selector
 * unescaped or passes for a real kind or id because of a name on `Object.prototype`.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  layout,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  tabs,
  toLayout,
  type Jali,
  type JaliOptions,
  type Layout,
  type ObjectRef,
} from "@jali/core";
import {
  browserLocation,
  buildSearch,
  createPaneKinds,
  createUrlSync,
  decodePeek,
  encodePeek,
  listCommands,
  readSearch,
  storeOf,
  structureKey,
  urlKeys,
} from "@jali/core/adapter";
import { createAgent } from "@jali/core/agent";
import { JaliRoot, definePane, usePaneState } from "@jali/react";
import { follow } from "../packages/core/src/actions/follow";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const kinds = createPaneKinds([note]);
const registry = kinds.registry();

const make = (options: Partial<JaliOptions> = {}): Jali =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    url: false,
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...options,
  });

/** A `?l=` code from the JSON a link holds, as the codec writes it. */
const linkOf = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return `1.${btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
};
const paneWithId = (id: string) =>
  linkOf([1, { i: id, t: "p", s: [1, 1], r: ["note", { id: 1 }] }]);
const twoPanes = (a = "a", b = "b") =>
  layout.encode(toLayout(row(pane(note({ id: 1 }), { id: a }), pane(note({ id: 2 }), { id: b }))));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("C1: ids", () => {
  it("a link whose pane id holds a quote, a bracket or a space is broken, not opened", () => {
    for (const id of ['a"b', "a]b", "a b", "a\\b", "x".repeat(129)])
      expect(readSearch(`?l=${paneWithId(id)}`, registry)).toHaveProperty("broken");
  });

  it("ids Jali makes and builders give still validate", () => {
    const l = toLayout(
      row(
        note({ id: 1 }),
        tabs(note({ id: 2 }), note({ id: 3 })),
        pane(note({ id: 4 }), { id: "a.b:c_d-1" }),
      ),
    );
    expect(layout.validate(l, registry)).toEqual({ ok: true });
    expect(layout.tree.newId(l.root)).toMatch(/^[\w.:-]+$/);
  });

  it("a builder names a pane after a kind whose name has other characters with a safe id", () => {
    const odd = definePane("Order detail", { title: "Order", Component: () => null });
    const l = toLayout(row(odd(), odd()));
    expect(layout.validate(l, createPaneKinds([odd]).registry())).toEqual({ ok: true });
  });

  it("an id with a quote never reaches a selector unescaped", () => {
    const jali = make({
      layout: tabs(pane(note({ id: 1 }), { id: 'q"1' }), pane(note({ id: 2 }), { id: 'q"]2' })),
    });
    expect(() => render(<JaliRoot jali={jali} />)).not.toThrow();
    const store = storeOf(jali);
    expect(() => store.dom.pane('q"1')).not.toThrow();
    expect(store.dom.pane('q"1')?.id).toBe('jali-pane-q"1');
  });
});

describe("C4: refs passed to public actions", () => {
  const bad: [string, unknown][] = [
    ["an unknown kind", { kind: "typo", params: {} }],
    ["no params", { kind: "note" }],
    ["params that are not values", { kind: "note", params: { id: { nested: 1 } } }],
    ["a kind that is not text", { kind: 4, params: {} }],
    ["null", null],
  ];
  it.each(bad)(
    "%s is refused as invalid by every action that takes a ref, never thrown",
    (_, ref) => {
      const jali = make();
      const r = ref as ObjectRef;
      const results = [
        () => jali.actions.openBeside("a", r),
        () => jali.actions.openHere("a", r),
        () => jali.actions.addTab("a", r),
        () => jali.actions.peek("a", r),
        // `select(pane, null)` clears the selection, so null is no ref there.
        ...(r === null ? [] : [() => jali.actions.select("a", r)]),
      ].map((run) => {
        expect(run).not.toThrow();
        return run();
      });
      for (const out of results) {
        expect(out).toMatchObject({ ok: false, reason: "invalid" });
        expect(out.message).toBeTruthy();
      }
      expect(jali.model().panes).toHaveLength(2);
      expect(() => jali.model().resolved).not.toThrow();
    },
  );

  it("a pane named by something that is neither an id nor a ref is refused, not thrown", () => {
    const jali = make();
    expect(() => jali.actions.focus({ kind: "note" } as ObjectRef)).not.toThrow();
    expect(jali.actions.focus({ kind: "note" } as ObjectRef)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(() => jali.actions.close(null as unknown as string)).not.toThrow();
    expect(jali.actions.close(null as unknown as string)).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    // A well-formed ref of a kind the workspace doesn't have names no pane.
    expect(jali.actions.close({ kind: "typo", params: {} })).toMatchObject({
      ok: false,
      reason: "not-found",
    });
    expect(jali.model().panes).toHaveLength(2);
  });
});
