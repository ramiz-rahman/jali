import { test, expect } from "./fixtures/lab";

test.describe("Launcher and tabs", () => {
  test("split opens a launcher with focus in its field; choosing a table fills the same pane", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("One table");
    await lab.heading("orders").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    const launcher = lab.launcher();
    await expect(launcher).toHaveCount(1);
    await expect(lab.launcherField()).toBeFocused();
    await expect(launcher.getByRole("group", { name: "Recent" })).toBeVisible();
    await expect(launcher.getByRole("group", { name: "Tables" }).getByRole("option", { name: /customers/ })).toContainText("240");
    await expect(launcher.getByRole("option", { name: "New query" })).toBeVisible();
    await expect(page.locator('section[data-kind="table"]')).toHaveCount(1); // not a copy of orders
    await lab.shot("15-launcher");
    const id = await launcher.getAttribute("data-pane");

    await page.keyboard.type("customers");
    await page.keyboard.press("Enter");
    const filled = lab.pane(id!);
    await expect(filled).toHaveAttribute("data-kind", "table");
    await expect(filled.getByRole("heading", { level: 2 })).toHaveText("customers");
    await expect(filled.getByRole("grid")).toBeVisible();
  });

  test("Esc on an untouched launcher closes it and focus returns", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("One table");
    await lab.heading("orders").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    await expect(lab.launcherField()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(lab.launcher()).toHaveCount(0);
    await expect(lab.pane("orders")).toHaveAttribute("data-focused", "true");
  });

  test("opening an object that is already open focuses it instead of duplicating it", async ({ lab, page }) => {
    await lab.open({ size: { width: 1920, height: 1000 } });
    await lab.heading("orders").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    await expect(lab.launcherField()).toBeFocused();
    await expect(lab.launcher().getByRole("option", { name: /customer 1/ }).first()).toContainText("Open");
    await page.keyboard.type("customer 1");
    await page.keyboard.press("Enter");
    await expect(lab.launcher()).toHaveCount(0);
    expect(await lab.visibleIds()).toEqual(["orders", "order", "customer"]);
    await expect(lab.pane("customer")).toHaveAttribute("data-focused", "true");
    await expect(lab.announcer()).toHaveText("Already open: focused customer 1");
  });

  test("merge and unmerge by ⌘K", async ({ lab, page }) => {
    await lab.open();
    await lab.heading("customer").click();
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("add to tabs");
    await page.keyboard.press("Enter");
    const chooser = page.getByRole("dialog", { name: "Add customer 1 to tabs of" });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole("option")).toHaveText([/orders/, /order 1/]);
    await lab.shot("16-merge-chooser");
    await page.keyboard.type("orders");
    await page.keyboard.press("Enter");
    await expect(chooser).toBeHidden();
    await expect(lab.tabs()).toHaveCount(2);
    await expect.poll(() => lab.visibleCount()).toBe(2);
    await expect(lab.announcer()).toHaveText("customer 1 added to tabs with orders");

    await page.keyboard.press("Meta+k");
    await page.keyboard.type("move out of tabs");
    await page.keyboard.press("Enter");
    await expect(lab.tabs()).toHaveCount(0);
    await expect.poll(() => lab.visibleIds()).toEqual(["orders", "customer", "order"]);
    await expect(lab.announcer()).toContainText("customer 1 moved out of tabs");
  });

  test("merge and unmerge by shortcut (⌥⌘T, ⌥⇧⌘T)", async ({ lab, page }) => {
    await lab.open();
    await lab.heading("customer").click();
    await page.keyboard.press("Alt+Meta+t");
    await expect(page.getByRole("dialog", { name: "Add customer 1 to tabs of" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(lab.tabs()).toHaveCount(2);
    await expect(lab.tab(/customer 1/)).toHaveAttribute("aria-selected", "true");
    await expect(lab.announcer()).toHaveText("customer 1 added to tabs with order 1");
    await page.keyboard.press("Alt+Shift+Meta+t");
    await expect(lab.tabs()).toHaveCount(0);
    await expect.poll(() => lab.visibleCount()).toBe(3);
  });

  test("the tab strip's + adds a launcher tab and focuses it", async ({ lab, page }) => {
    await lab.open();
    await lab.heading("customer").click();
    await page.keyboard.press("Alt+Meta+t");
    await page.keyboard.press("Enter");
    await expect(lab.tabs()).toHaveCount(2);
    await page.getByRole("button", { name: "New tab in this stack" }).click();
    await expect(lab.tabs()).toHaveCount(3);
    await expect(lab.tab(/New pane/)).toHaveAttribute("aria-selected", "true");
    await expect(lab.launcherField()).toBeFocused();
    await lab.shot("17-tab-plus");
    await page.keyboard.type("products");
    await page.keyboard.press("Enter");
    await expect(lab.tab(/products/)).toHaveAttribute("aria-selected", "true");
    await expect(lab.tabs()).toHaveCount(3);
  });
});
