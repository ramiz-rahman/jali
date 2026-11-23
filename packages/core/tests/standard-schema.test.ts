/**
 * Params declared with a Standard Schema of the whole object (API-REVIEW section 4). The schema
 * decides what is valid and what the pane gets; Jali's codec still writes the link (numbers and flags come back as
 * they went); failures are `ParamProblem`s. The
 * schemas here are written by hand to the spec, as Zod, Valibot, ArkType and Effect Schema implement it: Jali depends
 * on none of them.
 */
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  row,
  type ParamsOf,
  type StandardSchemaV1,
} from "@jali/core";
import {
  createPaneKinds,
  defineKind,
  parseParams,
  toLayout,
  type PaneKindBase,
  layout,
} from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

type Schema<O> = StandardSchemaV1<unknown, O>;
const schema = <O>(check: (v: unknown) => { value: O } | { message: string }): Schema<O> => ({
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value) => {
      const r = check(value);
      return "message" in r ? { issues: [{ message: r.message }] } : { value: r.value };
    },
  },
});
const number = () =>
  schema<number>((v) =>
    typeof v === "number" && Number.isFinite(v) ? { value: v } : { message: "not a number" },
  );
const string = () =>
  schema<string>((v) => (typeof v === "string" ? { value: v } : { message: "not a string" }));
const maybe = <O>(inner: Schema<O>) =>
  schema<O | undefined>((v) => {
    if (v === undefined) return { value: undefined };
    const r = inner["~standard"].validate(v) as StandardSchemaV1.Result<O>;
    return r.issues ? { message: r.issues[0]!.message } : { value: r.value };
  });
/** An object schema, which strips keys it doesn't declare, as Zod's does. */
const object = <S extends Record<string, Schema<unknown>>>(shape: S) =>
  ({
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value: unknown) => {
        if (!value || typeof value !== "object") return { issues: [{ message: "not an object" }] };
        const out: Record<string, unknown> = {};
        const issues: StandardSchemaV1.Issue[] = [];
        for (const [k, s] of Object.entries(shape)) {
          const r = s["~standard"].validate(
            (value as Record<string, unknown>)[k],
          ) as StandardSchemaV1.Result<unknown>;
          if (r.issues) issues.push(...r.issues.map((i) => ({ ...i, path: [{ key: k }] })));
          else if (r.value !== undefined) out[k] = r.value;
        }
        return issues.length ? { issues } : { value: out };
      },
    },
  }) as Schema<{ [K in keyof S]: StandardSchemaV1.InferOutput<S[K]> }> &
    Schema<
      {
        [K in keyof S as undefined extends StandardSchemaV1.InferOutput<S[K]> ? never : K]: Exclude<
          StandardSchemaV1.InferOutput<S[K]>,
          undefined
        >;
      } & {
        [
          K in keyof S as undefined extends StandardSchemaV1.InferOutput<S[K]> ? K : never
        ]?: Exclude<StandardSchemaV1.InferOutput<S[K]>, undefined>;
      }
    >;

describe("params declared with a Standard Schema", () => {
  it("the whole object: its output is what the pane gets, each issue a problem with its param", () => {
    const types = object({ id: number(), tab: maybe(string()) });
    expectTypeOf<ParamsOf<typeof types>>().toMatchTypeOf<{ id: number; tab?: string }>();
    expect(parseParams(types, { id: 3, tab: "notes" })).toEqual({
      params: { id: 3, tab: "notes" },
      problems: [],
    });
    // A value a link carries as text reaches the schema as text: coercing it is the schema's (`z.coerce.number()`).
    expect(parseParams(types, { id: "3" }).problems).toEqual([{ param: "id", value: "3" }]);
    expect(parseParams(types, { tab: 4 }).problems).toEqual([
      { param: "id" },
      { param: "tab", value: 4 },
    ]);
  });

  it("a schema that validates asynchronously can't read a link", () => {
    const later: Schema<{ id: number }> = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (v) => ({ value: v as { id: number } }),
      },
    };
    expect(parseParams(later, { id: 1 }).problems).toEqual([{ param: "params" }]);
  });

  it("in a workspace: a kind's call, its title, the link Jali writes, and a link it can't read", () => {
    const order = defineKind<{ id: number }, PaneKindBase, "order">({
      kind: "order",
      title: (p: never) => `Order ${(p as { id: number }).id}`,
      params: object({ id: number() }),
    } as PaneKindBase & { kind: "order" });
    const kinds = createPaneKinds([order]);
    expect(kinds.title(order({ id: 4 }))).toBe("Order 4");
    expect(kinds.problems({ kind: "order", params: { id: "x" } })).toEqual([
      { param: "id", value: "x" },
    ]);
    const location = memoryLocation(`?l=${layout.encode(toLayout(row(order({ id: 5 }))))}`);
    const jali = createJali({
      panes: [order],
      layout: row(order({ id: 1 })),
      features: [urlSync({ location })],
      storage: memoryStorage(),
      moveFocus: false,
    });
    // The link's number came back a number, through the schema.
    expect(jali.model().panes.map((p) => p.ref.params)).toEqual([{ id: 5 }]);
  });
});
