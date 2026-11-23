import { test, expect } from "./fixtures/app";

test.describe("Open and peek", () => {
  test("open beside from a list with no detail opens one that follows; focus stays in the list; J/K still move", async ({
    app,
    page,
  }) => {
    await app.open();
    expect(await app.visibleIds()).toEqual(["orders", "order", "customer"]);
    await expect(app.heading("order")).toHaveText("order 1");
    // Selecting a row shows it in the detail that follows the list (e2e/follow.spec.ts).
    await app.row("orders", /^5\b/).click();
    await expect(app.heading("order")).toHaveText("order 5");
    expect(await app.visibleIds()).toEqual(["orders", "order", "customer"]);

    // With no detail, ⌥↵ opens one beside, and it follows.
    await app
      .pane("order")
      .getByRole("button", { name: /^Close/ })
      .click();
    await app.row("orders", /^5\b/).click();
    await page.keyboard.press("Alt+Enter");
    await expect.poll(() => app.visibleCount()).toBe(3);
    await expect(
      app.page
        .locator("section[data-pane]")
        .filter({ hasText: "order 5" })
        .locator(".jali-follow-toggle"),
    ).toHaveAttribute("data-follow", "following");
    // Focus is still in the list.
    await expect(app.pane("orders")).toHaveAttribute("data-focused", "true");
    await expect.poll(() => app.focusIn("orders")).toBe(true);
    const selected = app.pane("orders").getByRole("row", { selected: true });
    await page.keyboard.press("j");
    await expect(selected).toHaveAttribute("aria-rowindex", "7");
    await page.keyboard.press("k");
    await expect(selected).toHaveAttribute("aria-rowindex", "6");
    await app.shot("01-open-beside-replaces");
  });

  test("peek with Space, follow with J, Open beside, Esc", async ({ app, page }) => {
    // No detail follows the list in this layout, so Space opens the peek sheet.
    await app.open({ preset: "One table" });
    await app.row("orders", /^3\b/).click();
    await page.keyboard.press("Space");
    const peek = app.peek();
    await expect(peek).toBeVisible();
    await expect(peek).toContainText("order 3");
    // A peek is never in the address.
    expect(page.url()).not.toContain("peek=");
    await app.shot("02-peek");

    // The list stays usable and the peek follows the selection.
    await page.keyboard.press("j");
    await expect(peek).toContainText("order 4");

    // Esc closes it.
    await page.keyboard.press("Escape");
    await expect(peek).toBeHidden();
    expect(page.url()).not.toContain("peek=");

    // Open beside: becomes a real pane in the linked slot.
    await page.keyboard.press("Space");
    await expect(peek).toBeVisible();
    await peek.getByRole("button", { name: /Open beside/ }).click();
    await expect(peek).toBeHidden();
    await expect(
      page.locator('section[data-kind="record"]').getByRole("heading", { level: 2 }),
    ).toHaveText("order 4");
  });

  test("a reload or a shared link closes the peek; an older link's ?peek= is ignored", async ({
    app,
    page,
  }) => {
    await app.open({ preset: "One table" });
    await app.row("orders", /^2\b/).click();
    await page.keyboard.press("Space");
    await expect(app.peek()).toBeVisible();
    const other = await app.fork(page.url());
    await expect(other.pane("orders")).toBeVisible();
    await expect(other.peek()).toBeHidden();
    // An older link that still carries a peek opens without it.
    const old = new URL(page.url());
    old.searchParams.set("peek", "record~table=orders~id=#2");
    const third = await app.fork(old.href);
    await expect(third.pane("orders")).toBeVisible();
    await expect(third.peek()).toBeHidden();
  });
});
