import { test, expect } from "./fixtures/lab";

test.describe("Open and peek", () => {
  test("open beside replaces the linked same-kind pane; focus stays in the list; J/K still move", async ({ lab, page }) => {
    await lab.open();
    expect(await lab.visibleIds()).toEqual(["orders", "order", "customer"]);
    await expect(lab.heading("order")).toHaveText("order 1");

    await lab.row("orders", /^5\b/).click();
    await page.keyboard.press("Alt+Enter");

    // Still three panes: the order record was replaced, not added to.
    await expect(lab.heading("order")).toHaveText("order 5");
    expect(await lab.visibleIds()).toEqual(["orders", "order", "customer"]);
    // Focus is still in the list.
    await expect(lab.pane("orders")).toHaveAttribute("data-focused", "true");
    await expect.poll(() => lab.focusIn("orders")).toBe(true);
    const selected = lab.pane("orders").getByRole("row", { selected: true });
    await page.keyboard.press("j");
    await expect(selected).toHaveAttribute("aria-rowindex", "6");
    await page.keyboard.press("k");
    await expect(selected).toHaveAttribute("aria-rowindex", "5");
    await lab.shot("01-open-beside-replaces");
  });

  test("peek with Space, follow with J, Pin beside, Open full, Esc", async ({ lab, page }) => {
    await lab.open();
    await lab.row("orders", /^3\b/).click();
    await page.keyboard.press("Space");
    const peek = lab.peek();
    await expect(peek).toBeVisible();
    await expect(peek).toContainText("order 3");
    expect(page.url()).toContain("peek=");
    await lab.shot("02-peek");

    // The list stays usable and the peek follows the selection.
    await page.keyboard.press("j");
    await expect(peek).toContainText("order 4");

    // Esc closes it.
    await page.keyboard.press("Escape");
    await expect(peek).toBeHidden();
    expect(page.url()).not.toContain("peek=");

    // Pin beside: becomes a real pane in the linked slot.
    await page.keyboard.press("Space");
    await expect(peek).toBeVisible();
    await peek.getByRole("button", { name: /Pin beside/ }).click();
    await expect(peek).toBeHidden();
    await expect(lab.heading("order")).toHaveText("order 4");

    // Open full: the peek becomes the whole page (one pane).
    await page.keyboard.press("Space");
    await expect(peek).toBeVisible();
    await peek.getByRole("button", { name: /Open full/ }).click();
    await expect(peek).toBeHidden();
    expect(await lab.visibleIds()).toEqual(["full"]);
  });

  test("a shared ?peek= link opens the peek", async ({ lab, page }) => {
    await lab.open();
    await lab.row("orders", /^2\b/).click();
    await page.keyboard.press("Space");
    await expect(lab.peek()).toBeVisible();
    const other = await lab.fork(page.url());
    await expect(other.peek()).toBeVisible();
    await expect(other.peek()).toContainText("order 2");
  });
});
