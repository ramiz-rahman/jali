# Test your layouts

Test your layouts and pane rules without a browser, by running Jali's actions and reading its state with jali/testing.

Most of what Jali does lives in the instance, not in your components. So most of it can be tested without rendering anything: make an instance, run actions on it, and read its state. This guide uses Vitest; any test runner works the same way. The test below runs in Jali's own docs suite, so it passes as written.

## An instance for tests

`src/orders.test.ts`

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Jali } from "jali";
import { createTestJali, reportUnsaved, type TestLocation } from "jali/testing";
import { orderKind, orderKinds } from "../pane-kinds/orders";
import { presets } from "../presets/layouts";

/** An instance with nothing shared: its own address, its own storage, a fixed size, no DOM focus. */
const testJali = (search = "", size = { width: 1440, height: 900 }) =>
  createTestJali({ panes: orderKinds, presets, preset: "triage", search, size });

const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);

describe("the orders app", () => {
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

- **An address in memory** (`location`), through `urlSync`. Jali writes its layout there instead of the browser's address. `search` starts it on a link, to test opening one.
- **Storage in memory**: saved settings, pane state and dragged sizes never reach `localStorage`.
- **A size**, 1440 by 900 unless `size` says otherwise. Folding depends on it, and with nothing rendered nothing measures the window. To test another size, make another instance.
- **No DOM focus moved** into panes after changes. There are no panes in the DOM in these tests.
- **Keys as on a Mac**, so `Mod` means ⌘ on every machine.

If your app makes its instance in a function of its own, pass it `testJaliOptions().options`, and read `location` from the same call. If that function adds features, merge them before the test's: `features: [...defaultFeatures(), ...(options.features ?? [])]`.

Kinds belong to the instance, so every test gets its own: nothing about one test affects another.

## Run actions, read state

`jali.actions` holds what an app can ask Jali to do: `openBeside`, `close`, `preset`, `select` and the rest. Components call the same actions, so a test that runs them tests what a person does.

- Each action returns what happened: `{ ok: true, pane }` (the pane it opened or acted on), or `{ ok: false, reason }`. Check `reason` to test a rule: `"unsaved"` when the person is asked first, `"not-found"` for a pane that is not there.
- `jali.get()` is the state: `layout`, `view.focused`, `unsaved`, `selection`.
- `jali.model()` is what is derived from it: `panes` in tree order, `pane(id)`, `folded`, `visible`, `resolved` (every pane's box on screen).
- `jali.on("open" | "close" | "focus" | "layout", handler)` tells you each change once.

## What a rendered pane would report

Some things come from a rendered pane, not from an action: unsaved work (`useUnsaved`), pane state (`usePaneState`), the dialogs a person answers. `jali/testing` reports and reads them without rendering:

| Helper | What it stands for |
|---|---|
| `reportUnsaved(jali, pane, what)` | A pane calling `useUnsaved(what)`; `null` clears it |
| `reportPaneState(jali, pane, key, value)` | A pane calling a `usePaneState` setter |
| `paneStateOf(jali, pane)` | What that pane's `usePaneState` would read |
| `discardQuestion(jali)` | "Discard unsaved changes?" while it is open: which panes, and why |
| `answerDiscard(jali, "discard" \| "keep")` | The person's answer |
| `chooserRequest(jali)` | The chooser's open request (`jali.dialogs.choose`), with the `chooser()` feature |
| `lastAnnouncement(jali)` | What screen readers last heard |

See [`jali/testing`](../reference/testing.md) for each one's details.

## Test a link

To check that a link opens what it should, make a second instance whose address starts at the first one's. An instance reads its address when it is made, as a page load does:

```ts
import { expect, it } from "vitest";
import { createTestJali } from "jali/testing";
import { orderKinds, presets } from "./panes";

it("a link reopens the same panes", () => {
  const { jali, location } = createTestJali({ panes: orderKinds, presets });
  jali.actions.preset("customer-desk");

  const { jali: reader } = createTestJali({ panes: orderKinds, presets, search: location.search() });
  expect(reader.model().panes.map((p) => p.id)).toEqual(jali.model().panes.map((p) => p.id));
});
```

The address also records history. `location.entries` lists every entry, so you can check which changes push a new one. `location.visit(search)` acts like Back, Forward or a router link: the address changes and a started instance hears it.

## Timing

Some changes wait. A following detail shows the list's item once the cursor rests (150ms), and divider sizes reach the address 120ms after the drag. Use fake timers and move them on:

```ts
import { expect, vi } from "vitest";
import { orderKind } from "./panes";

vi.useFakeTimers();
jali.actions.select("orders", orderKind({ id: 5 }));
vi.advanceTimersByTime(200);
expect(jali.model().pane("order")?.ref.params.id).toBe(5);
```

## Keys

`jali.start()` listens on the window, so a test can dispatch `keydown` events (`fireEvent.keyDown(document.body, { key: "k", metaKey: true })`, with `userEvent.keyboard` or by hand) and check what happened. Call the function `start` returns to remove the listeners after the test, or `jali.destroy()` to also drop timers still waiting (a follow, a debounced address write).

## Render it

`<JaliRoot>` mounts in jsdom as it is: you don't need to stub `ResizeObserver`. Where there is none, Jali measures again when the window resizes. jsdom lays nothing out, so Jali measures 0 by 0 and folds every pane but one into tabs. Give Jali's root element a `clientWidth` and `clientHeight` in the test when the layout matters.

To test one pane's component, render it inside `<JaliRoot>` with an instance that shows only that pane: `createTestJali({ panes: [orderKind], layout: orderKind({ id: 7 }) })`.

## What to test in the browser

Tests without a browser cover rules: what opens where, what folds, what asks first. Test the rest in a real browser, with Playwright or similar: that your components render, that dragging works, and how things look.

## Next

- [Unsaved work and pane state](unsaved-work-and-pane-state.md)
- [`jali/testing` reference](../reference/testing.md)
