import { expect, test } from "./fixtures/app";

/** The query pane uses the whole pane contract: unsaved work, a kept draft and its own ⌘K commands. */
test.describe("Pane contract", () => {
  const sql = (app: import("./fixtures/app").App) =>
    app.pane("query").getByRole("textbox", { name: "SQL" });

  test("closing a query with an edit that has not run asks first; Keep editing keeps it, Discard closes it", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.preset("Query + chart + inspector");
    await expect(app.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(app).fill("SELECT 1 AS one");
    await app
      .pane("query")
      .getByRole("button", { name: /^Close / })
      .click();
    const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("an edited query that has not run");
    await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sql(app)).toHaveValue("SELECT 1 AS one");
    await app
      .pane("query")
      .getByRole("button", { name: /^Close / })
      .click();
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(app.pane("query")).toHaveCount(0);
  });

  test("running the edit saves it: the pane then closes without asking", async ({ app, page }) => {
    await app.open();
    await app.preset("Query + chart + inspector");
    await expect(app.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(app).fill("SELECT 2 AS two");
    await sql(app).press("ControlOrMeta+Enter");
    await app
      .pane("query")
      .getByRole("button", { name: /^Close / })
      .click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(app.pane("query")).toHaveCount(0);
  });

  test("the draft is the pane's own state: it survives a reload", async ({ app, page }) => {
    await app.open();
    await app.preset("Query + chart + inspector");
    await expect(app.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(app).fill("SELECT 3 AS three");
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("data-studio:pane-state") ?? ""))
      .toContain("SELECT 3 AS three");
    await page.reload();
    await expect(sql(app)).toHaveValue("SELECT 3 AS three");
  });

  test("⌘K lists the focused query's own commands first, under its title", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.preset("Query + chart + inspector");
    await expect(app.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(app).click();
    await page.keyboard.press("ControlOrMeta+k");
    const first = page.locator(".jali-palette-item").first();
    await expect(first).toContainText("Run query");
    await expect(first).toContainText("Query");
    await page.keyboard.press("Escape");
  });
});
