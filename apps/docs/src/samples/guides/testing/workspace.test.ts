import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, type Jali } from "@jali/core";
import { orderKind, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** A workspace with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
function testJali(search = "") {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: orderKinds,
    presets,
    preset: "triage",
    url: { location },
    storage: memoryStorage(),
    size: { width: 1440, height: 900 },
    moveFocus: false,
  });
  return { jali, location };
}

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);

describe("the orders workspace", () => {
  let jali: Jali;
  let location: ReturnType<typeof memoryLocation>;
  beforeEach(() => ({ jali, location } = testJali()));
  afterEach(() => vi.useRealTimers());

  it("opens an order beside the list and keeps focus in the list", () => {
    const opened = jali.actions.openBeside("orders", orderKind({ id: 3 }));
    expect(jali.model().pane(opened)?.ref.params.id).toBe(3);
    expect(jali.get().view.focused).toBe("orders");
  });

  it("asks before closing a pane with unsaved work", () => {
    jali.actions.setUnsaved("order", "an unsaved note");
    jali.actions.close("order");
    expect(jali.get().confirm?.panes).toEqual(["order"]);
    expect(ids(jali)).toContain("order");

    jali.actions.discardAndContinue();
    expect(ids(jali)).not.toContain("order");
  });

  it("writes the layout to its own address, and a new history entry for a deliberate change", () => {
    jali.actions.preset("customer-desk");
    const q = new URLSearchParams(location.search());
    expect(q.get("l")).toBeTruthy();
    expect(location.entries.length).toBe(2);
  });

  it("opens a link: the layout in the address wins over the preset", () => {
    jali.actions.preset("customer-desk");
    const link = location.search();

    const { jali: reader } = testJali(link);
    expect(ids(reader)).toEqual(ids(jali));
  });

  it("shows the selected order in the following detail once the cursor rests", () => {
    vi.useFakeTimers();
    jali.actions.select("orders", orderKind({ id: 5 }));
    vi.advanceTimersByTime(200);
    expect(jali.model().pane("order")?.ref.params.id).toBe(5);
  });

  it("folds what does not fit", () => {
    jali.set({ area: { width: 700, height: 900 } }); // orders 440 + order 360 do not fit in 700
    expect(jali.model().folded.length).toBeGreaterThan(0);
  });
});
