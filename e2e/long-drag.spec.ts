import { test, expect } from "./fixtures/app";

// A long drag writes the address once, when it ends (SAFARI-3, docs/reviews/2026-11-23/PLAN.md step 2). Safari
// refuses more than about 100 history writes in 10 seconds and throws `SecurityError`; a drag that wrote as it went
// threw mid-commit. Nothing is written while the drag holds the instance; its drop is one write after it.
test.describe("A long drag", () => {
  test("held for 12 seconds raises no error and writes the address once, at the end", async ({
    app,
    page,
  }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Every history write the page makes, as it makes it.
    await page.addInitScript(() => {
      const w = window as unknown as { historyWrites: string[] };
      w.historyWrites = [];
      for (const name of ["pushState", "replaceState"] as const) {
        const real = history[name].bind(history);
        history[name] = (...args: Parameters<History["pushState"]>) => {
          w.historyWrites.push(name);
          return real(...args);
        };
      }
    });
    await app.open();
    // Let writes from opening settle (a replace waits for its 250 ms slot), then count from zero.
    await page.waitForTimeout(500);
    await page.evaluate(() => ((window as unknown as { historyWrites: string[] }).historyWrites = []));
    const writes = () =>
      page.evaluate(() => (window as unknown as { historyWrites: string[] }).historyWrites.length);
    const before = page.url();

    const grip = app.header("customer").locator(".jali-grip");
    const from = (await ((await grip.count()) ? grip : app.header("customer")).boundingBox())!;
    const to = (await app.pane("orders").boundingBox())!;
    const x = from.x + from.width / 2,
      y = from.y + from.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y + 10, { steps: 3 });
    await expect(app.dragChip()).toBeVisible();
    // Twelve seconds over the panes, the drop hint following the pointer.
    const end = Date.now() + 12_000;
    for (let i = 0; Date.now() < end; i++) {
      await page.mouse.move(to.x + 40 + (i % 2) * 200, to.y + to.height / 2 + (i % 3) * 20, {
        steps: 2,
      });
      await page.waitForTimeout(100);
    }
    expect(await writes()).toBe(0);
    await page.mouse.move(to.x + 20, to.y + to.height / 2, { steps: 4 });
    await page.mouse.up();
    await app.stable();
    await page.waitForTimeout(500);
    expect(await writes()).toBe(1);
    expect(page.url()).not.toBe(before);
    expect(errors).toEqual([]);
  });
});
