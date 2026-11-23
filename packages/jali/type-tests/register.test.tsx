/**
 * `Register`: one declaration types every React hook by the app's workspace, as TanStack Router does. Checked by the
 * typecheck gate (`tsc -p packages/react/type-tests`).
 */
import { expectTypeOf } from "vite-plus/test";
import { createJali, optional, row, type Jali, type Ref } from "jali";
import { definePane, useJali, useJaliEvent, useJaliModel, useJaliState, usePane } from "jali/react";

const note = definePane("note", { params: { id: Number }, title: "Note", Component: () => null });
const order = definePane("order", {
  params: { id: Number, tab: optional(String) },
  title: "Order",
  Component: () => null,
});
export const jali = createJali({ panes: [note, order], layout: row(note({ id: 1 })) });

declare module "jali" {
  interface Register {
    jali: typeof jali;
  }
}

type Refs = Ref<"note", { id: number }> | Ref<"order", { id: number; tab?: string }>;

export function Status() {
  expectTypeOf(useJali()).toEqualTypeOf<Jali<Refs, undefined>>();
  expectTypeOf(useJaliModel().panes[0]!.ref).toEqualTypeOf<Refs>();
  expectTypeOf(useJaliState((s) => s.selection.list?.ref)).toEqualTypeOf<Refs | undefined>();
  expectTypeOf(useJaliModel((m) => m.paneOf(note({ id: 1 }))?.selected)).toEqualTypeOf<
    Refs | undefined
  >();
  useJaliEvent("open", ({ ref }) => {
    if (ref.kind === "order") expectTypeOf(ref.params.tab).toEqualTypeOf<string | undefined>();
  });
  expectTypeOf(usePane(order).params.id).toEqualTypeOf<number>();
  // @ts-expect-error there is no kind "ordr"
  useJali().actions.openBeside("p", { kind: "ordr", params: {} });
  // @ts-expect-error no page here
  useJali().page.open();
  return null;
}
