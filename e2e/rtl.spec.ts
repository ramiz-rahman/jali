import { test, expect } from "./fixtures/app";

/** The app with the page right to left (`?dir=rtl` sets `<html dir="rtl">`), as an Arabic or Hebrew app would be. */
test.describe("Right to left", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ path: "/?dir=rtl" });
  });

  test("the row starts at the right, and the link is the same as left to right", async ({
    app,
    page,
  }) => {
    expect(await page.evaluate(() => getComputedStyle(document.body).direction)).toBe("rtl");
    // From the screen's left: the last pane first.
    expect(await app.visibleIds()).toEqual(["customer", "order", "orders"]);
    const orders = (await app.pane("orders").boundingBox())!;
    const main = (await app.main().boundingBox())!;
    expect(Math.abs(orders.x + orders.width - (main.x + main.width - 6))).toBeLessThanOrEqual(1);
    const layout = (url: string) => new URL(url).searchParams.get("l");
    const rtl = layout(page.url());
    expect(rtl).toBeTruthy();
    const ltr = await app.fork("/");
    expect(await ltr.visibleIds()).toEqual(["orders", "order", "customer"]);
    expect(layout(ltr.page.url())).toBe(rtl);
  });

  test("F6 and the focus keys: F6 reads from the right, ⌘K ⌘← goes to the pane on the left", async ({
    app,
    page,
  }) => {
    await app.header("orders").click({ position: { x: 200, y: 20 } });
    await expect(app.pane("orders")).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("F6");
    await expect(app.pane("order")).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("F6");
    await expect(app.pane("customer")).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowRight");
    await expect(app.pane("order")).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowLeft");
    await expect(app.pane("customer")).toHaveAttribute("data-focused", "true");
  });

  test("dragging a divider follows the pointer", async ({ app, page }) => {
    const orders = app.pane("orders");
    const w0 = await app.width(orders);
    // The first divider sits between orders (right) and order (left).
    const box = (await app.separator(0).boundingBox())!;
    const ordersBox = (await orders.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(ordersBox.x + 1);
    const x = box.x + box.width / 2,
      y = box.y + 300;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 8 });
    await page.mouse.up();
    await app.stable();
    // Dragged right: orders, on the right, shrinks by the pointer's travel, and the divider is where it was let go.
    await expect.poll(() => app.width(orders)).toBe(w0 - 60);
    const after = (await app.separator(0).boundingBox())!;
    expect(Math.abs(after.x - (box.x + 60))).toBeLessThanOrEqual(1);
  });

  test("arrow keys resize the way they point, on the divider and in resize mode", async ({
    app,
    page,
  }) => {
    const orders = app.pane("orders");
    const s = app.separator(0);
    const w0 = await app.width(orders);
    await s.focus();
    // ← moves the divider left: orders, on its right, grows.
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => app.width(orders)).toBe(w0 + 16);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => app.width(orders)).toBe(w0);

    await app.header("orders").click({ position: { x: 200, y: 20 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+r");
    await expect(app.status()).toContainText("Resize mode");
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => app.width(orders)).toBe(w0 - 16);
    await page.keyboard.press("Escape");
  });

  test("a drop on a pane's left edge puts the pane on its left", async ({ app, page }) => {
    await app.recordAnnouncements();
    await app.drag("customer", "orders", "left", { release: false });
    // The tinted half is the target's left half.
    const zone = page.locator("[data-drop-zone]");
    await expect(zone).toHaveAttribute("data-drop-zone", "left");
    const z = (await zone.boundingBox())!,
      target = (await app.pane("orders").boundingBox())!;
    expect(Math.abs(z.x - target.x)).toBeLessThanOrEqual(1);
    await page.mouse.up();
    await expect.poll(() => app.visibleIds()).toEqual(["order", "customer", "orders"]);
    await app.expectAnnounced(/customer.* placed left of orders/);
  });

  test("the peek sheet opens at the workspace's left", async ({ app, page }) => {
    await app.open({ path: "/?dir=rtl", preset: "One table" });
    await app.row("orders", /^3\b/).click();
    await page.keyboard.press("Space");
    const peek = (await app.peek().boundingBox())!;
    const main = (await app.main().boundingBox())!;
    expect(Math.abs(peek.x - (main.x + 6))).toBeLessThanOrEqual(1);
  });
});
