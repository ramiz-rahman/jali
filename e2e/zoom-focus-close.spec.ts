import { test, expect } from "./fixtures/app";

test.describe("Maximise", () => {
  test("button, double-click header, ⇧⌘↵ (and ⌘K ⌘M), Esc", async ({ app, page }) => {
    await app.open();
    const area = (await app.main().boundingBox())!;

    await page.getByRole("button", { name: "Maximise orders" }).click();
    await expect(app.isZoomed("orders")).toHaveCount(1);
    expect(await app.width(app.pane("orders"))).toBeGreaterThan(area.width - 40);
    await expect(app.status()).toContainText("Zoomed · Esc to restore");
    expect(page.url()).toContain("zoom=orders");
    await app.shot("07-maximised");
    await page.keyboard.press("Escape");
    await expect(app.isZoomed("orders")).toHaveCount(0);

    await app.header("order").dblclick({ position: { x: 300, y: 20 } });
    await expect(app.isZoomed("order")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(app.isZoomed("order")).toHaveCount(0);

    await app.pane("customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(app.isZoomed("customer")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(app.isZoomed("customer")).toHaveCount(0);
    // A link inside the pane has focus: still maximise, and no new browser tab.
    const link = app
      .pane("customer")
      .getByRole("link")
      .or(app.pane("customer").locator("button[data-ref], a"))
      .first();
    if (await link.count()) {
      await link.focus();
      const pages = page.context().pages().length;
      await page.keyboard.press("ControlOrMeta+Shift+Enter");
      await expect(app.isZoomed("customer")).toHaveCount(1);
      expect(page.context().pages().length).toBe(pages);
      await page.keyboard.press("Escape");
    }
    // The ⌘K form still works.
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+m");
    await expect(app.isZoomed("customer")).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+m");
    await expect(app.isZoomed("customer")).toHaveCount(0);
    // The tree and sizes were preserved through all of it.
    await expect.poll(() => app.visibleIds()).toEqual(["orders", "order", "customer"]);
  });

  test("while zoomed, F6 switches which pane is zoomed", async ({ app, page }) => {
    await app.open();
    await page.getByRole("button", { name: "Maximise orders" }).click();
    await page.keyboard.press("F6");
    await expect(app.isZoomed("order")).toHaveCount(1);
  });
});

test.describe("Focus", () => {
  test("F6 cycles, the palette focuses by position, ⌘K ⌘arrows by direction with no wrap", async ({
    app,
    page,
  }) => {
    await app.open();
    const focused = async (want: string) => expect.poll(() => app.focusedId()).toBe(want);
    await focused("orders");
    await page.keyboard.press("F6");
    await focused("order");
    await page.keyboard.press("F6");
    await focused("customer");
    await page.keyboard.press("Shift+F6");
    await focused("order");

    // Focus by position has no default keys (⌥digit is tab switching on Linux, ⌘digit everywhere): the palette has it.
    for (const [n, want] of [
      [3, "customer"],
      [1, "orders"],
    ] as const) {
      await page.keyboard.press("ControlOrMeta+k");
      await page.keyboard.type(`Focus pane ${n}`);
      await page.keyboard.press("Enter");
      await focused(want);
    }

    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowLeft"); // already leftmost: no wrap
    await focused("orders");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowRight");
    await focused("order");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowRight");
    await focused("customer");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+ArrowRight"); // rightmost: no wrap
    await focused("customer");
    await expect(app.pane("customer")).toHaveCSS("outline-style", /.*/);
  });
});

test.describe("Close", () => {
  test("focus returns, Sonner toast, live region, ⌘K ⌘Z restores", async ({ app, page }) => {
    await app.open();
    await app.header("orders").click({ position: { x: 200, y: 20 } });
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await expect.poll(() => app.visibleIds()).toEqual(["orders", "order"]);

    const toast = app.toast("Pane closed");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(app.announcer()).toContainText(/closed/i);
    await expect(app.announcer()).toContainText(/Undo available/);
    // Focus goes back to where it came from, not to a random pane.
    await expect(app.pane("orders")).toHaveAttribute("data-focused", "true");
    await app.shot("09-close-toast");

    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(app.pane("customer")).toBeVisible();
    await expect.poll(() => app.visibleIds()).toEqual(["orders", "order", "customer"]);

    // The toast's Undo button works too. While two toasts stack, Sonner keeps the front one animating, so
    // Playwright's stability check never passes; wait for it to mount, then dispatch the click.
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await expect.poll(() => app.visibleCount()).toBe(2);
    const front = page.locator('[data-sonner-toast][data-front="true"][data-mounted="true"]');
    await expect(front).toContainText("Pane closed");
    await front.getByRole("button", { name: "Undo" }).dispatchEvent("click");
    await expect.poll(() => app.visibleCount()).toBe(3);
  });

  test("the last pane stays open", async ({ app, page }) => {
    await app.open();
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await page.getByRole("button", { name: "Close orders" }).click();
    await expect.poll(() => app.visibleCount()).toBe(1);
    await expect(app.announcer()).toContainText(/last pane stays open/i);
  });
});

test.describe("Palette", () => {
  test("⌘K runs a command", async ({ app, page }) => {
    await app.open();
    await page.keyboard.press("ControlOrMeta+k");
    const dlg = page.getByRole("dialog", { name: "Commands" });
    await expect(dlg).toBeVisible();
    await app.shot("10-command-palette");
    await page.keyboard.type("stress");
    await page.keyboard.press("Enter");
    await expect(dlg).toBeHidden();
    await expect(page.getByRole("button", { name: "Stress: 10 panes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // and a pane command: back to the chain, close other panes, then undo
    await page.getByRole("button", { name: "Order → customer chain" }).click();
    await expect.poll(() => app.visibleCount()).toBe(3);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("close other");
    await page.keyboard.press("Enter");
    await expect.poll(() => app.visibleCount()).toBe(1);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => app.visibleCount()).toBe(3);
  });
});
