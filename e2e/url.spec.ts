import { test, expect } from "./fixtures/app";
import { goneRecord, linkTo } from "./fixtures/layouts";

test.describe("URL round-trip", () => {
  test("copy the layout link of the stress preset, open it elsewhere, get the same structure", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.preset("Stress: 10 panes");
    await page.getByRole("button", { name: "Copy link to this layout" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain("?l=");
    const snapshot = (l: typeof app) =>
      l.page.locator("section[data-pane]").evaluateAll((els) =>
        (els as HTMLElement[])
          .map((e) => {
            const r = e.getBoundingClientRect();
            return [
              e.dataset.pane,
              e.dataset.kind,
              getComputedStyle(e).display === "none",
              Math.round(r.x),
              Math.round(r.y),
              Math.round(r.width),
              Math.round(r.height),
            ].join("|");
          })
          .sort(),
      );
    const a = await snapshot(app);
    const other = await app.fork(link, { width: 1600, height: 900 });
    expect(await snapshot(other)).toEqual(a);
  });

  test("Back and Forward step through structural changes only", async ({ app, page }) => {
    await app.open();
    const lengthBefore = await page.evaluate(() => history.length);
    // not structural: focus, resize, zoom
    await page.keyboard.press("F6");
    const s = (await app.separator(0).boundingBox())!;
    await page.mouse.move(s.x + 3, s.y + 300);
    await page.mouse.down();
    await page.mouse.move(s.x - 60, s.y + 300, { steps: 5 });
    await page.mouse.up();
    await app.stable();
    await page.getByRole("button", { name: "Maximise orders" }).click();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore);

    // structural: close a pane, then change preset
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await page.getByRole("button", { name: "One table" }).click();
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore + 2);
    await expect.poll(() => app.visibleIds()).toEqual(["catalog", "orders"]);

    await page.goBack();
    await expect.poll(async () => (await app.visibleIds()).join()).toBe("orders,order");
    await page.goBack();
    await expect.poll(async () => (await app.visibleIds()).join()).toBe("orders,order,customer");
    await page.goForward();
    await expect.poll(async () => (await app.visibleIds()).join()).toBe("orders,order");
  });

  test("a broken ?l= falls back to the preset with a toast", async ({ app, page }) => {
    await page.goto("/?l=not-a-layout");
    await expect(page.locator("section[data-pane]").first()).toBeVisible();
    await expect(app.toast(/couldn.t be read/)).toBeVisible();
    expect(await app.visibleCount()).toBeGreaterThan(1);
  });

  test("a pane whose object is gone stays with an error", async ({ app }) => {
    await app.open({ path: linkTo(goneRecord()) });
    await expect(app.pane("b")).toBeVisible();
    await expect(app.pane("b")).toContainText(/no longer|not found|gone|couldn.t/i);
  });
});
