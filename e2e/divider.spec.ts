import { test, expect } from "./fixtures/app";

// One divider implementation (our own APG window splitter); the Ark adapter was removed in the ui refactor.
test.describe("Divider", () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test("pointer drag clamps at the minimum; double-click resets; hit area wider than the line", async ({
    app,
    page,
  }) => {
    const orders = app.pane("orders");
    const initial = await app.width(orders);
    const s = app.separator(0);
    const box = (await s.boundingBox())!;
    // The hit area is wider than the 6px gap line: a point 5px either side still lands on the separator.
    const hit = await page.evaluate(
      ([cx, cy]) =>
        [-5, 5].map((d) => !!document.elementFromPoint(cx! + d, cy!)?.closest("[role=separator]")),
      [box.x + box.width / 2, box.y + 300],
    );
    expect(hit).toEqual([true, true]);
    const x = box.x + box.width / 2,
      y = box.y + 300;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y, { steps: 8 });
    await page.mouse.move(x - 900, y, { steps: 8 }); // far past the minimum
    await page.mouse.up();
    await app.stable();
    const clamped = await app.width(orders);
    expect(clamped).toBeLessThan(initial);
    expect(clamped).toBeGreaterThanOrEqual(440); // table minimum
    await page.mouse.move(x - 1200, y);
    // a second, even longer drag stays at the same width
    const b2 = (await s.boundingBox())!;
    await page.mouse.move(b2.x + 3, y);
    await page.mouse.down();
    await page.mouse.move(b2.x - 700, y, { steps: 8 });
    await page.mouse.up();
    await app.stable();
    expect(Math.abs((await app.width(orders)) - clamped)).toBeLessThanOrEqual(1);
    await app.shot("06-divider-clamped-own");

    await s.dblclick();
    await expect.poll(() => app.width(orders)).toBeGreaterThan(clamped + 20);
    expect(Math.abs((await app.width(orders)) - initial)).toBeLessThanOrEqual(2);
  });

  test("keyboard: arrows 16px, Shift 64px, Home/End ; aria-valuenow follows", async ({
    app,
    page,
  }) => {
    const orders = app.pane("orders");
    const s = app.separator(0);
    const w0 = await app.width(orders);
    const v0 = await app.attr(s, "aria-valuenow");
    await s.focus();

    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => app.width(orders)).toBe(w0 - 16);
    expect(await app.attr(s, "aria-valuenow")).toBeLessThan(v0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => app.width(orders)).toBe(w0);
    expect(await app.attr(s, "aria-valuenow")).toBe(v0);

    await page.keyboard.press("Shift+ArrowLeft");
    await expect.poll(() => app.width(orders)).toBe(w0 - 64);

    await page.keyboard.press("Home");
    await expect.poll(() => app.width(orders)).toBe(440); // table minimum
    expect(await app.attr(s, "aria-valuenow")).toBe(await app.attr(s, "aria-valuemin"));
    await page.keyboard.press("End");
    // End takes orders as far as its neighbour's minimum allows. The records start at their comfortable 440, above
    // their 360 minimum, so orders grows past its start (it could not when records needed 480).
    await expect.poll(() => app.width(orders)).toBeGreaterThan(w0);
    expect(await app.attr(s, "aria-valuenow")).toBe(await app.attr(s, "aria-valuemax"));
  });

  test("separator has role, orientation, valuenow within min and max", async ({ app, page }) => {
    const seps = page.getByRole("separator");
    expect(await seps.count()).toBe(2);
    for (let i = 0; i < 2; i++) {
      const s = seps.nth(i);
      const [now, min, max] = [
        await app.attr(s, "aria-valuenow"),
        await app.attr(s, "aria-valuemin"),
        await app.attr(s, "aria-valuemax"),
      ];
      expect(min).toBeLessThanOrEqual(now);
      expect(now).toBeLessThanOrEqual(max);
      await expect(s).toHaveAttribute("aria-orientation", "vertical");
      await expect(s).toHaveAttribute("aria-controls", /pane-/);
      expect(((await s.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(3);
    }
  });

  test("resize mode: ⌘K ⌘R then arrows", async ({ app, page }) => {
    const orders = app.pane("orders");
    await app.header("orders").click({ position: { x: 200, y: 20 } });
    const w0 = await app.width(orders);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+r");
    await expect(app.status()).toContainText("Resize mode");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => app.width(orders)).toBe(w0 - 16);
    await page.keyboard.press("Escape");
    await expect(app.status()).not.toContainText("Resize mode");
  });

  test("drag smoothness: a 400px drag in small steps has no long task, follows the pointer 1:1, writes the URL once after release, and does not jump", async ({
    app,
    page,
  }) => {
    await page.setViewportSize({ width: 2560, height: 1000 });
    await expect.poll(() => app.width(app.pane("orders"))).toBeGreaterThan(1000);
    await page.evaluate(() => {
      const w = window as unknown as { __lt: number[]; __from: number };
      w.__lt = [];
      w.__from = Infinity;
      // Entries arrive a little after the task, so each is judged by when it started, not by when it was heard: one
      // that began before the drag (the viewport's resize settling, the press) and was heard after it isn't the drag's.
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          if (e.startTime >= w.__from) w.__lt.push(Math.round(e.duration));
      }).observe({ type: "longtask" });
    });
    const orders = app.pane("orders");
    // A long task is the machine's as much as the page's: a browser sharing a loaded machine stalls for 50 ms now
    // and then, anywhere in a six-second drag. Jank in the drag itself is in every drag, so a drag with one is made
    // again (the other way, from where the divider now is), up to three times, and only a drag that has one every
    // time fails. What the drag does is checked on the last one.
    let result!: { longtasks: number[]; during: object; previewed: number; url0: string };
    let way = -1;
    for (let attempt = 0; attempt < 3; attempt++, way = -way) {
      const w0 = (await orders.boundingBox())!.width;
      const box = (await app.separator(0).boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + 300;
      const url0 = page.url();
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.evaluate(() => {
        const w = window as unknown as { __lt: number[]; __from: number };
        w.__lt = [];
        w.__from = performance.now();
      });
      for (let i = 1; i <= 100; i++) await page.mouse.move(x + way * i * 4, y);
      // The preview catches up with the pointer on the next frame.
      await expect
        .poll(async () => Math.abs((await orders.boundingBox())!.width - (w0 + way * 400)), {
          message: "frame follows the pointer 1:1",
        })
        .toBeLessThanOrEqual(1);
      const during = await page.evaluate(() => ({
        cursor: getComputedStyle(document.body).cursor,
        selectable: getComputedStyle(document.body).userSelect,
      }));
      const line = await app.dividerPreview().isVisible();
      const previewed = (await orders.boundingBox())!.width;
      expect(page.url(), "no URL write during the drag").toBe(url0);
      await page.mouse.up();
      const longtasks = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
      result = { longtasks, during: { ...during, line }, previewed, url0 };
      if (!longtasks.length) break;
      await expect.poll(() => page.url()).not.toBe(url0);
    }
    expect(result.longtasks, "long tasks during the drag").toEqual([]);
    expect(result.during).toEqual({ cursor: "col-resize", selectable: "none", line: true });
    await expect
      .poll(() => page.url(), { message: "URL written after the drag settles" })
      .not.toBe(result.url0);
    expect((await orders.boundingBox())!.width, "committed size equals the previewed size").toBe(
      result.previewed,
    );
    await expect(app.dividerPreview()).toBeHidden();
  });
});
