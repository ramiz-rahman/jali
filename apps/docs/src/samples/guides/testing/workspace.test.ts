import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createWorkspace, memoryLocation, memoryStorage, type Workspace } from "@jali/core";
import { orderKind, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** A workspace with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
function testWorkspace(search = "") {
  const location = memoryLocation(search);
  const workspace = createWorkspace({
    panes: orderKinds,
    presets,
    preset: "triage",
    url: { location },
    storage: memoryStorage(),
    size: { width: 1440, height: 900 },
    moveFocus: false,
  });
  return { workspace, location };
}

const ids = (workspace: Workspace) => workspace.model().panes.map((p) => p.id);

describe("the orders workspace", () => {
  let workspace: Workspace;
  let location: ReturnType<typeof memoryLocation>;
  beforeEach(() => ({ workspace, location } = testWorkspace()));
  afterEach(() => vi.useRealTimers());

  it("opens an order beside the list and keeps focus in the list", () => {
    const opened = workspace.actions.openBeside("orders", orderKind({ id: 3 }));
    expect(workspace.model().pane(opened)?.ref.params.id).toBe(3);
    expect(workspace.get().view.focused).toBe("orders");
  });

  it("asks before closing a pane with unsaved work", () => {
    workspace.actions.setUnsaved("order", "an unsaved note");
    workspace.actions.close("order");
    expect(workspace.get().confirm?.panes).toEqual(["order"]);
    expect(ids(workspace)).toContain("order");

    workspace.actions.discardAndContinue();
    expect(ids(workspace)).not.toContain("order");
  });

  it("writes the layout to its own address, and a new history entry for a deliberate change", () => {
    workspace.actions.preset("customer-desk");
    const q = new URLSearchParams(location.search());
    expect(q.get("l")).toBeTruthy();
    expect(location.entries.length).toBe(2);
  });

  it("opens a link: the layout in the address wins over the preset", () => {
    workspace.actions.preset("customer-desk");
    const link = location.search();

    const { workspace: reader } = testWorkspace(link);
    expect(ids(reader)).toEqual(ids(workspace));
  });

  it("shows the selected order in the following detail once the cursor rests", () => {
    vi.useFakeTimers();
    workspace.actions.select("orders", orderKind({ id: 5 }));
    vi.advanceTimersByTime(200);
    expect(workspace.model().pane("order")?.ref.params.id).toBe(5);
  });

  it("folds what does not fit", () => {
    workspace.set({ area: { width: 700, height: 900 } }); // orders 440 + order 360 do not fit in 700
    expect(workspace.model().folded.length).toBeGreaterThan(0);
  });
});
