import { test, expect } from "./fixtures/lab";

/** Dragging a tab between its group's tabs reorders them, with a line where it would go (Data Studio's request). */
test("a tab dragged between its group's tabs moves there", async ({ lab, page }) => {
  await lab.open({ size: { width: 1920, height: 1000 } });
  await lab.setting(/Add as a tab/);
  // Order → customer chain: put all three in one tab group.
  await lab.drag("order", "orders", "centre");
  await lab.drag("customer", "order", "centre"); // order is the shown tab now
  const strip = page
    .locator('[role="tablist"]')
    .filter({ has: page.locator("[data-tab]") })
    .first();
  const tabs = strip.locator("[data-tab]");
  await expect(tabs).toHaveCount(3);
  const ids = () => tabs.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tab));
  const before = await ids();

  // The first tab, over the second half of the last: a line after the last, then it moves to the end.
  const first = (await tabs.nth(0).boundingBox())!;
  const last = (await tabs.nth(2).boundingBox())!;
  await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x + first.width / 2 + 10, first.y + first.height / 2, { steps: 3 });
  await page.mouse.move(last.x + last.width * 0.8, last.y + last.height / 2, { steps: 12 });
  await expect(page.locator('.jali-tab-item[data-drop="after"]')).toHaveCount(1);
  await expect(page.locator(".jali-drop-zone, [data-testid='drop-zone']")).toHaveCount(0);
  await page.mouse.up();
  await expect.poll(ids).toEqual([before[1], before[2], before[0]]);
  await expect(page.locator(".jali-tab-item[data-drop]")).toHaveCount(0);
});

/** A pinned tab never scrolls out of view: only the other tabs scroll, as in a browser (the docs' Tabs guide). */
test("a pinned tab stays in view while the others scroll", async ({ lab, page }) => {
  await lab.open({ size: { width: 1920, height: 1000 } });
  await lab.setting(/Add as a tab/);
  await lab.drag("order", "orders", "centre");
  await lab.drag("customer", "order", "centre");
  const tabs = page.locator("[data-tab]");
  await expect(tabs).toHaveCount(3);
  // Pin the first tab from its menu.
  await tabs.first().click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Pin tab" }).click();
  const pinned = page.locator('[role="tab"][data-pinned]');
  await expect(pinned).toHaveCount(1);
  // A narrow strip, scrolled to its end.
  await page.addStyleTag({ content: ".jali-tabs { max-width: 4rem; }" });
  await page
    .locator(".jali-tabs")
    .first()
    .evaluate((el) => (el.scrollLeft = el.scrollWidth));
  const box = (await pinned.boundingBox())!;
  const bar = (await page.locator(".jali-tabbar").first().boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(bar.x - 1);
  expect(box.width).toBeGreaterThan(20);
  await expect(page.locator(".jali-tabs [data-pinned]")).toHaveCount(0);
});

/** In a narrow header the shown tab stays on screen: pinned tabs give way first, down to a pin and an icon. */
test("a narrow strip keeps the shown tab in view, pinned tabs shrinking to their icon", async ({
  lab,
  page,
}) => {
  await lab.open({ size: { width: 1920, height: 1000 } });
  await lab.setting(/Add as a tab/);
  await lab.drag("order", "orders", "centre");
  await lab.drag("customer", "order", "centre");
  const tabs = page.locator("[data-tab]");
  await expect(tabs).toHaveCount(3);
  for (let n = 0; n < 2; n++) {
    await page.locator("[data-tab]:not([data-pinned])").first().click({ button: "right" });
    await page.getByRole("menuitemcheckbox", { name: "Pin tab" }).click();
  }
  await expect(page.locator('[role="tab"][data-pinned]')).toHaveCount(2);
  // The shown tab is the one left unpinned.
  const shown = page.locator('[role="tab"]:not([data-pinned])');
  await shown.click();
  await page.addStyleTag({ content: ".jali-pane-header { max-width: 390px; }" });
  const bar = (await page.locator(".jali-tabbar").first().boundingBox())!;
  const box = (await shown.boundingBox())!;
  expect(box.width).toBeGreaterThan(40);
  expect(box.x).toBeGreaterThanOrEqual(bar.x - 1);
  expect(box.x + 40).toBeLessThanOrEqual(bar.x + bar.width);
  // Pinned tabs show their icon only, and keep their name.
  await expect(page.locator("[data-pinned] .jali-tab-title").first()).toBeHidden();
  await expect(page.locator('[role="tab"][data-pinned]').first()).toHaveAttribute(
    "aria-label",
    /.+/,
  );
});
