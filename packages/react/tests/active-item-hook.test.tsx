/** useActiveItemPort: the port is stable for a pane, and always uses the mapping of the latest render (finding 7). */
import { describe, expect, it } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ObjectRef } from "../../core/src/layout/types";
import { memoryStorage } from "../../core/src/ports";
import { StoreProvider } from "../src/state/react";
import { PaneContext, type PaneContextValue } from "../src/pane/context";
import { useActiveItemPort } from "../src/pane/useActiveItemPort";
import { createTestStore } from "../../core/tests/fixtures/workspace";

describe("useActiveItemPort", () => {
  it("reads the current mapping after a re-render", () => {
    const store = createTestStore({
      storage: memoryStorage(),
      focusPane: null,
      initial: { area: { width: 1600, height: 800 } },
    });
    store.actions.preset("order-chain");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StoreProvider store={store}>
        <PaneContext.Provider value={{ id: "orders" } as PaneContextValue}>
          {children}
        </PaneContext.Provider>
      </StoreProvider>
    );
    const mk = (table: string) => ({
      toRef: (id: string): ObjectRef => ({ kind: "record", params: { table, id: Number(id) } }),
      idOf: (r: ObjectRef) => String(r.params.id),
    });
    const { result, rerender } = renderHook(({ m }) => useActiveItemPort(m), {
      wrapper,
      initialProps: { m: mk("orders") },
    });
    const first = result.current;
    rerender({ m: mk("customers") });
    expect(result.current).toBe(first);
    result.current!.write("3", "step");
    expect(store.get().selection.orders?.ref).toEqual({
      kind: "record",
      params: { table: "customers", id: 3 },
    });
  });
});
