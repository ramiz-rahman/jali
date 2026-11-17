import { test, expect } from "./fixtures/lab";

// One divider implementation (our own APG window splitter); the Ark adapter was removed in the ui refactor.
test.describe("Divider", () => {
  test.beforeEach(async ({ lab }) => {
    await lab.open();
  });

  test("pointer drag clamps at the minimum; double-click resets; hit area wider than the line", async ({ lab, page }) => {
    const orders = lab.pane("orders");
    const initial = await lab.width(orders);
    const s = lab.separator(0);
    const box = (await s.boundingBox())!;
    // The hit area is wider than the 6px gap line: a point 5px either side still lands on the separator.
    const hit = await page.evaluate(([cx, cy]) => [-5, 5].map((d) => !!document.elementFromPoint(cx! + d, cy!)?.closest("[role=separator]")), [box.x + box.width / 2, box.y + 300]);
    expect(hit).toEqual([true, true]);
    const x = box.x + box.width / 2, y = box.y + 300;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y, { steps: 8 });
    await page.mouse.move(x - 900, y, { steps: 8 }); // far past the minimum
    await page.mouse.up();
    await lab.stable();
    const clamped = await lab.width(orders);
    expect(clamped).toBeLessThan(initial);
    expect(clamped).toBeGreaterThanOrEqual(440); // table minimum
    await page.mouse.move(x - 1200, y);
    // a second, even longer drag stays at the same width
    const b2 = (await s.boundingBox())!;
    await page.mouse.move(b2.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(b2.x - 700, y, { steps: 8 });
    await page.mouse.up();
    await lab.stable();
    expect(Math.abs((await lab.width(orders)) - clamped)).toBeLessThanOrEqual(1);
    await lab.shot("06-divider-clamped-own");

    await s.dblclick();
    await expect.poll(() => lab.width(orders)).toBeGreaterThan(clamped + 20);
    expect(Math.abs((await lab.width(orders)) - initial)).toBeLessThanOrEqual(2);
  });

  test("keyboard: arrows 16px, Shift 64px, Home/End ; aria-valuenow follows", async ({ lab, page }) => {
    const orders = lab.pane("orders");
    const s = lab.separator(0);
    const w0 = await lab.width(orders);
    const v0 = await lab.attr(s, "aria-valuenow");
    await s.focus();

    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => lab.width(orders)).toBe(w0 - 16);
    expect(await lab.attr(s, "aria-valuenow")).toBeLessThan(v0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => lab.width(orders)).toBe(w0);
    expect(await lab.attr(s, "aria-valuenow")).toBe(v0);

    await page.keyboard.press("Shift+ArrowLeft");
    await expect.poll(() => lab.width(orders)).toBe(w0 - 64);

    await page.keyboard.press("Home");
    await expect.poll(() => lab.width(orders)).toBe(440); // table minimum
    expect(await lab.attr(s, "aria-valuenow")).toBe(await lab.attr(s, "aria-valuemin"));
    await page.keyboard.press("End");
    // End takes orders as far as its neighbour's minimum allows. The records start at their comfortable 440, above
    // their 360 minimum, so orders grows past its start (it could not when records needed 480).
    await expect.poll(() => lab.width(orders)).toBeGreaterThan(w0);
    expect(await lab.attr(s, "aria-valuenow")).toBe(await lab.attr(s, "aria-valuemax"));
  });

  test("separator has role, orientation, valuenow within min and max", async ({ lab, page }) => {
    const seps = page.getByRole("separator");
    expect(await seps.count()).toBe(2);
    for (let i = 0; i < 2; i++) {
      const s = seps.nth(i);
      const [now, min, max] = [await lab.attr(s, "aria-valuenow"), await lab.attr(s, "aria-valuemin"), await lab.attr(s, "aria-valuemax")];
      expect(min).toBeLessThanOrEqual(now);
      expect(now).toBeLessThanOrEqual(max);
      await expect(s).toHaveAttribute("aria-orientation", "vertical");
      await expect(s).toHaveAttribute("aria-controls", /pane-/);
      expect(((await s.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(3);
    }
  });

  test("resize mode: ⌘K ⌘R then arrows", async ({ lab, page }) => {
    const orders = lab.pane("orders");
    await lab.header("orders").click({ position: { x: 200, y: 20 } });
    const w0 = await lab.width(orders);
    await page.keyboard.press("ControlOrMeta+k"); await page.keyboard.press("ControlOrMeta+r");
    await expect(lab.status()).toContainText("Resize mode");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => lab.width(orders)).toBe(w0 - 16);
    await page.keyboard.press("Escape");
    await expect(lab.status()).not.toContainText("Resize mode");
  });

  test("drag smoothness: a 400px drag in small steps has no long task, follows the pointer 1:1, writes the URL once after release, and does not jump", async ({ lab, page }) => {
    await page.setViewportSize({ width: 2560, height: 1000 });
    await expect.poll(() => lab.width(lab.pane("orders"))).toBeGreaterThan(1000);
    await page.evaluate(() => {
      const w = window as unknown as { __lt: number[]; __on: boolean };
      w.__lt = [];
      w.__on = false;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (w.__on) w.__lt.push(Math.round(e.duration)); }).observe({ type: "longtask" });
    });
    const orders = lab.pane("orders");
    const w0 = (await orders.boundingBox())!.width;
    const box = (await lab.separator(0).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + 300;
    const url0 = page.url();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.evaluate(() => { (window as unknown as { __on: boolean }).__on = true; });
    for (let i = 1; i <= 100; i++) await page.mouse.move(x - i * 4, y);
    // The preview catches up with the pointer on the next frame.
    await expect.poll(async () => Math.abs((await orders.boundingBox())!.width - (w0 - 400)), { message: "frame follows the pointer 1:1" }).toBeLessThanOrEqual(1);
    const during = await page.evaluate(() => ({
      cursor: getComputedStyle(document.body).cursor,
      selectable: getComputedStyle(document.body).userSelect,
    }));
    const line = await lab.dividerPreview().isVisible();
    const previewed = (await orders.boundingBox())!.width;
    expect(page.url(), "no URL write during the drag").toBe(url0);
    await page.mouse.up();
    const longtasks = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
    expect(longtasks, "long tasks during the drag").toEqual([]);
    expect({ ...during, line }).toEqual({ cursor: "col-resize", selectable: "none", line: true });
    await expect.poll(() => page.url(), { message: "URL written after the drag settles" }).not.toBe(url0);
    expect((await orders.boundingBox())!.width, "committed size equals the previewed size").toBe(previewed);
    await expect(lab.dividerPreview()).toBeHidden();
  });
});
