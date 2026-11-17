import { test, expect } from "./fixtures/lab";

test.describe("Maximise", () => {
  test("button, double-click header, Shift+Meta+Enter, Esc", async ({ lab, page }) => {
    await lab.open();
    const area = (await lab.main().boundingBox())!;

    await page.getByRole("button", { name: "Maximise orders" }).click();
    await expect(lab.isZoomed("orders")).toHaveCount(1);
    expect(await lab.width(lab.pane("orders"))).toBeGreaterThan(area.width - 40);
    await expect(lab.status()).toContainText("Zoomed · Esc to restore");
    expect(page.url()).toContain("zoom=orders");
    await lab.shot("07-maximised");
    await page.keyboard.press("Escape");
    await expect(lab.isZoomed("orders")).toHaveCount(0);

    await lab.header("order").dblclick({ position: { x: 300, y: 20 } });
    await expect(lab.isZoomed("order")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(lab.isZoomed("order")).toHaveCount(0);

    await lab.pane("customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Shift+Meta+Enter");
    await expect(lab.isZoomed("customer")).toHaveCount(1);
    await page.keyboard.press("Shift+Meta+Enter");
    await expect(lab.isZoomed("customer")).toHaveCount(0);
    // The tree and sizes were preserved through all of it.
    await expect.poll(() => lab.visibleIds()).toEqual(["orders", "order", "customer"]);
  });

  test("while zoomed, F6 switches which pane is zoomed", async ({ lab, page }) => {
    await lab.open();
    await page.getByRole("button", { name: "Maximise orders" }).click();
    await page.keyboard.press("F6");
    await expect(lab.isZoomed("order")).toHaveCount(1);
  });
});

test.describe("Focus", () => {
  test("F6 cycles, Alt+digit by position, Alt+Meta+arrows by direction with no wrap", async ({ lab, page }) => {
    await lab.open();
    const focused = async (want: string) => expect.poll(() => lab.focusedId()).toBe(want);
    await focused("orders");
    await page.keyboard.press("F6");
    await focused("order");
    await page.keyboard.press("F6");
    await focused("customer");
    await page.keyboard.press("Shift+F6");
    await focused("order");

    await page.keyboard.press("Alt+3");
    await focused("customer");
    await page.keyboard.press("Alt+1");
    await focused("orders");

    await page.keyboard.press("Alt+Meta+ArrowLeft"); // already leftmost: no wrap
    await focused("orders");
    await page.keyboard.press("Alt+Meta+ArrowRight");
    await focused("order");
    await page.keyboard.press("Alt+Meta+ArrowRight");
    await focused("customer");
    await page.keyboard.press("Alt+Meta+ArrowRight"); // rightmost: no wrap
    await focused("customer");
    await expect(lab.pane("customer")).toHaveCSS("outline-style", /.*/);
  });
});

test.describe("Close", () => {
  test("focus returns, Sonner toast, live region, Meta+Z restores", async ({ lab, page }) => {
    await lab.open();
    await lab.header("orders").click({ position: { x: 200, y: 20 } });
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await expect.poll(() => lab.visibleIds()).toEqual(["orders", "order"]);

    const toast = lab.toast("Pane closed");
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(lab.announcer()).toContainText(/closed/i);
    await expect(lab.announcer()).toContainText(/Undo available/);
    // Focus goes back to where it came from, not to a random pane.
    await expect(lab.pane("orders")).toHaveAttribute("data-focused", "true");
    await lab.shot("09-close-toast");

    await page.keyboard.press("Meta+z");
    await expect(lab.pane("customer")).toBeVisible();
    await expect.poll(() => lab.visibleIds()).toEqual(["orders", "order", "customer"]);

    // The toast's Undo button works too. While two toasts stack, Sonner keeps the front one animating, so
    // Playwright's stability check never passes; wait for it to mount, then dispatch the click.
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await expect.poll(() => lab.visibleCount()).toBe(2);
    const front = page.locator('[data-sonner-toast][data-front="true"][data-mounted="true"]');
    await expect(front).toContainText("Pane closed");
    await front.getByRole("button", { name: "Undo" }).dispatchEvent("click");
    await expect.poll(() => lab.visibleCount()).toBe(3);
  });

  test("the last pane stays open", async ({ lab, page }) => {
    await lab.open();
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await page.getByRole("button", { name: "Close orders" }).click();
    await expect.poll(() => lab.visibleCount()).toBe(1);
    await expect(lab.announcer()).toContainText(/last pane stays open/i);
  });
});

test.describe("Palette", () => {
  test("Meta+K runs a command", async ({ lab, page }) => {
    await lab.open();
    await page.keyboard.press("Meta+k");
    const dlg = page.getByRole("dialog", { name: "Commands" });
    await expect(dlg).toBeVisible();
    await lab.shot("10-command-palette");
    await page.keyboard.type("stress");
    await page.keyboard.press("Enter");
    await expect(dlg).toBeHidden();
    await expect(page.getByRole("button", { name: "Stress: 10 panes" })).toHaveAttribute("aria-pressed", "true");
    // and a pane command: back to the chain, close other panes, then undo
    await page.getByRole("button", { name: "Order → customer chain" }).click();
    await expect.poll(() => lab.visibleCount()).toBe(3);
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("close other");
    await page.keyboard.press("Enter");
    await expect.poll(() => lab.visibleCount()).toBe(1);
    await page.keyboard.press("Meta+z");
    await expect.poll(() => lab.visibleCount()).toBe(3);
  });
});
