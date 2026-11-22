import { test, expect } from "./fixtures/app";

test.describe("Launcher and tabs", () => {
  test("split opens a launcher with focus in its field; choosing a table fills the same pane", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.preset("One table");
    await app.heading("orders").click();
    await page.keyboard.press("ControlOrMeta+Backslash");
    const launcher = app.launcher();
    await expect(launcher).toHaveCount(1);
    await expect(app.launcherField()).toBeFocused();
    await expect(launcher.getByRole("group", { name: "Recent" })).toBeVisible();
    await expect(
      launcher.getByRole("group", { name: "Tables" }).getByRole("option", { name: /customers/ }),
    ).toContainText("240");
    await expect(launcher.getByRole("option", { name: "New query" })).toBeVisible();
    await expect(page.locator('section[data-kind="table"]')).toHaveCount(1); // not a copy of orders
    await app.shot("15-launcher");
    const id = await launcher.getAttribute("data-pane");

    await page.keyboard.type("customers");
    await page.keyboard.press("Enter");
    const filled = app.pane(id!);
    await expect(filled).toHaveAttribute("data-kind", "table");
    await expect(filled.getByRole("heading", { level: 2 })).toHaveText("customers");
    await expect(filled.getByRole("grid")).toBeVisible();
  });

  test("Esc on an untouched launcher closes it and focus returns", async ({ app, page }) => {
    await app.open();
    await app.preset("One table");
    await app.heading("orders").click();
    await page.keyboard.press("ControlOrMeta+Backslash");
    await expect(app.launcherField()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(app.launcher()).toHaveCount(0);
    await expect(app.pane("orders")).toHaveAttribute("data-focused", "true");
  });

  test("opening an object that is already open focuses it instead of duplicating it", async ({
    app,
    page,
  }) => {
    await app.open({ size: { width: 1920, height: 1000 } });
    await app.heading("orders").click();
    await page.keyboard.press("ControlOrMeta+Backslash");
    await expect(app.launcherField()).toBeFocused();
    await expect(
      app
        .launcher()
        .getByRole("option", { name: /customer 1/ })
        .first(),
    ).toContainText("Open");
    await page.keyboard.type("customer 1");
    await page.keyboard.press("Enter");
    await expect(app.launcher()).toHaveCount(0);
    expect(await app.visibleIds()).toEqual(["orders", "order", "customer"]);
    await expect(app.pane("customer")).toHaveAttribute("data-focused", "true");
    await expect(app.announcer()).toHaveText("Already open: focused customer 1");
  });

  test("merge and unmerge by ⌘K", async ({ app, page }) => {
    await app.open();
    await app.heading("customer").click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("add to tabs");
    await page.keyboard.press("Enter");
    const chooser = page.getByRole("dialog", { name: "Add customer 1 to tabs of" });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole("option")).toHaveText([/orders/, /order 1/]);
    await app.shot("16-merge-chooser");
    await page.keyboard.type("orders");
    await page.keyboard.press("Enter");
    await expect(chooser).toBeHidden();
    await expect(app.tabs()).toHaveCount(2);
    await expect.poll(() => app.visibleCount()).toBe(2);
    await expect(app.announcer()).toHaveText("customer 1 added to tabs with orders");

    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("move out of tabs");
    await page.keyboard.press("Enter");
    await expect(app.tabs()).toHaveCount(0);
    await expect.poll(() => app.visibleIds()).toEqual(["orders", "customer", "order"]);
    await expect(app.announcer()).toContainText("customer 1 moved out of tabs");
  });

  test("a chooser row keeps a long name and hint inside it, cut short", async ({ app, page }) => {
    // react-codex REACT-17: a long hint painted over the next row.
    await app.open();
    await app.heading("customer").click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("add to tabs");
    await page.keyboard.press("Enter");
    const chooser = page.getByRole("dialog", { name: "Add customer 1 to tabs of" });
    const row = chooser.getByRole("option").first();
    await expect(row).toBeVisible();
    const box = await row.evaluate((r) => {
      const long = "A very long hint that goes on and on past the edge of the dialog ".repeat(3);
      r.querySelector(".jali-palette-hint")!.textContent = long;
      r.querySelector(".jali-palette-name")!.textContent = long;
      const inside = (el: Element) => {
        const a = el.getBoundingClientRect(),
          b = r.getBoundingClientRect();
        return a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.bottom <= b.bottom + 0.5;
      };
      return {
        hint: inside(r.querySelector(".jali-palette-hint")!),
        name: inside(r.querySelector(".jali-palette-name")!),
        height: r.getBoundingClientRect().height,
      };
    });
    expect(box).toEqual({ hint: true, name: true, height: 32 });
  });

  test("merge and unmerge by shortcut (⌘K ⌘G, ⌘K ⇧⌘G)", async ({ app, page }) => {
    await app.open();
    await app.heading("customer").click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+g");
    await expect(page.getByRole("dialog", { name: "Add customer 1 to tabs of" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(app.tabs()).toHaveCount(2);
    await expect(app.tab(/customer 1/)).toHaveAttribute("aria-selected", "true");
    await expect(app.announcer()).toHaveText("customer 1 added to tabs with order 1");
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+Shift+g");
    await expect(app.tabs()).toHaveCount(0);
    await expect.poll(() => app.visibleCount()).toBe(3);
  });

  test("the tab strip's + adds a launcher tab and focuses it", async ({ app, page }) => {
    await app.open();
    await app.heading("customer").click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+g");
    await page.keyboard.press("Enter");
    await expect(app.tabs()).toHaveCount(2);
    await page.getByRole("button", { name: "New tab in this stack" }).click();
    await expect(app.tabs()).toHaveCount(3);
    await expect(app.tab(/New pane/)).toHaveAttribute("aria-selected", "true");
    await expect(app.launcherField()).toBeFocused();
    await app.shot("17-tab-plus");
    await page.keyboard.type("products");
    await page.keyboard.press("Enter");
    await expect(app.tab(/products/)).toHaveAttribute("aria-selected", "true");
    await expect(app.tabs()).toHaveCount(3);
  });
});
