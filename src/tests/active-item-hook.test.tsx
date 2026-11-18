/** useActiveItemPort: the port is stable for a pane, and always uses the mapping of the latest render (finding 7). */
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ObjectRef } from "../../packages/core/src/layout/types";
import { memoryStorage } from "../../packages/core/src/ports";
import { StoreProvider } from "../../packages/react/src/state/react";
import { PaneIdContext } from "../../packages/react/src/pane/usePaneState";
import { useActiveItemPort } from "../../packages/react/src/pane/useActiveItemPort";
import { createLabStore } from "../lab";

describe("useActiveItemPort", () => {
  it("reads the current mapping after a re-render", () => {
    const store = createLabStore({ storage: memoryStorage(), focusPane: null, initial: { area: { width: 1600, height: 800 } } });
    store.actions.preset("order-chain");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProvider store={store}><PaneIdContext.Provider value="orders">{children}</PaneIdContext.Provider></StoreProvider>
    );
    const mk = (table: string) => ({ toRef: (id: string): ObjectRef => ({ kind: "record", params: { table, id: Number(id) } }), idOf: (r: ObjectRef) => String(r.params.id) });
    const { result, rerender } = renderHook(({ m }) => useActiveItemPort(m), { wrapper, initialProps: { m: mk("orders") } });
    const first = result.current;
    rerender({ m: mk("customers") });
    expect(result.current).toBe(first);
    result.current!.write("3", "step");
    expect(store.get().selection.orders?.ref).toEqual({ kind: "record", params: { table: "customers", id: 3 } });
  });
});
