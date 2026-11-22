# Test a workspace

Test your layouts and pane rules without a browser, by running the workspace's actions and reading its state.

A workspace's behaviour lives in the workspace, not in its components. So most of it can be tested without rendering anything: make a workspace, run actions on it, and read its state. This guide uses Vitest with jsdom; any test runner works the same way.

## A workspace for tests

`src/workspace.test.ts`

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Jali } from "jali";
import { createTestJali, reportUnsaved, type TestLocation } from "jali/testing";
import { orderKind, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** A workspace with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
const testJali = (search = "", size = { width: 1440, height: 900 }) =>
  createTestJali({ panes: orderKinds, presets, preset: "triage", search, size });

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);

describe("the orders workspace", () => {
  let jali: Jali;
  let location: TestLocation;
  beforeEach(() => ({ jali, location } = testJali()));
  afterEach(() => vi.useRealTimers());

  it("opens an order beside the list and keeps focus in the list", () => {
    const opened = jali.actions.openBeside("orders", orderKind({ id: 3 }));
    expect(opened.ok).toBe(true);
    expect(jali.model().pane(opened.pane)?.ref.params.id).toBe(3);
    expect(jali.get().view.focused).toBe("orders");
  });

  it("says why a close did not happen", () => {
    expect(jali.actions.close("invoices")).toEqual({ ok: false, reason: "not-found" });
    // What useUnsaved reports from a rendered pane, reported by hand.
    reportUnsaved(jali, "order", "an unsaved note");
    expect(jali.actions.close("order")).toMatchObject({ ok: false, reason: "unsaved" });
    expect(ids(jali)).toContain("order");
  });

  it("tells the app what opened and closed", () => {
    const closed: string[] = [];
    jali.on("close", ({ pane }) => closed.push(pane));
    jali.actions.close("order");
    expect(closed).toEqual(["order"]);
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
    // orders 440 + order 360 do not fit in 700
    const { jali: narrow } = testJali("", { width: 700, height: 900 });
    expect(narrow.model().folded.length).toBeGreaterThan(0);
  });
});
```

`createTestJali` from `jali/testing` is `createJali` with what keeps a test apart from the page and from other tests:

- **An address in memory** (`location`), through `urlSync`. The workspace writes its layout there instead of the browser's address. `search` starts it on a link, to test opening one.
- **Storage in memory**: saved settings, pane state and dragged sizes never reach `localStorage`.
- **A size**, 1440 by 900 unless `size` says otherwise. Folding depends on it, and with no rendered workspace nothing measures the window. To test another size, make another workspace.
- **No DOM focus moved** into panes after changes. There are no panes in the DOM in a workspace test.
- **Keys as on a Mac**, so `pressKeys("Mod+K Mod+W")` means the same keys on every machine.

An app that makes its workspace in a function of its own passes `testJaliOptions().options` to it, and reads `location` from the same call.

Kinds belong to the workspace, so every test gets its own: nothing about one workspace affects another.

## Run actions, read state

`jali.actions` holds what an app can ask the workspace to do: `openBeside`, `close`, `preset`, `select` and the rest. Components call the same actions, so a test that runs them tests what a person does.

- Each action returns what happened: `{ ok: true, pane }` (the pane it opened or acted on), or `{ ok: false, reason }`. Check `reason` to test a rule: `"unsaved"` when the person is asked first, `"not-found"` for a pane that is not there.
- `jali.get()` is the state: `layout`, `view.focused`, `unsaved`, `selection`.
- `jali.model()` is what is derived from it: `panes` in tree order, `pane(id)`, `folded`, `visible`, `resolved` (every pane's box on screen).
- `jali.on("open" | "close" | "focus" | "layout", handler)` tells you each change once.

What a rendered pane reports (`useUnsaved`, `useCommands`) is not one of these actions. A test without rendering can report it through the engine's own steps, `storeOf(jali).actions` from `jali/adapter`, as the test above does.

## Test a link

To check that a link opens what it should, make a second workspace whose `memoryLocation` starts at the first one's address. A workspace reads its address when it is made, as a page load does:

```ts
const { jali: reader } = testJali(link);
expect(ids(reader)).toEqual(ids(jali));
```

`memoryLocation` also records history. `location.entries` lists every entry, so you can check which changes push a new one. `location.visit(search)` acts like Back, Forward or a router link: the address changes and a started workspace hears it.

## Timing

Some changes wait. A following detail shows the list's item once the cursor rests (150ms), and divider sizes reach the address 120ms after the drag. Use fake timers and move them on:

```ts
vi.useFakeTimers();
jali.actions.select("orders", orderKind({ id: 5 }));
vi.advanceTimersByTime(200);
expect(jali.model().pane("order")?.ref.params.id).toBe(5);
```

## Keys

`jali.start()` listens on the window, so a test can press keys (`pressKeys` from `jali/testing`) and check what the workspace did. Call the function `start` returns to remove the listeners after the test, or `jali.destroy()` to also drop timers still waiting (a follow, a debounced address write).

## Render it

`<JaliRoot>` mounts in jsdom as it is: you don't need to stub `ResizeObserver`. Where there is none, Jali measures again when the window resizes. jsdom lays nothing out, so the workspace measures 0 by 0 and folds every pane but one into tabs. Give the workspace element a `clientWidth` and `clientHeight` in the test when the layout matters.

## What to test in the browser

Store tests cover rules: what opens where, what folds, what asks first. Test the rest in a real browser, with Playwright or similar: that your components render, that dragging works, and how things look.

## Next

- [Unsaved work and pane state](unsaved-work-and-pane-state.md)
- [Two workspaces on one page](two-workspaces.md)
