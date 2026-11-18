import { expect, test } from "./fixtures/lab";

/** The query pane uses the whole pane contract: unsaved work, a kept draft and its own ⌘K commands. */
test.describe("Pane contract", () => {
  const sql = (lab: import("./fixtures/lab").Lab) => lab.pane("query").getByRole("textbox", { name: "SQL" });

  test("closing a query with an edit that has not run asks first; Keep editing keeps it, Discard closes it", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("Query + chart + inspector");
    await expect(lab.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(lab).fill("SELECT 1 AS one");
    await lab.pane("query").getByRole("button", { name: /^Close / }).click();
    const dialog = page.getByRole("alertdialog", { name: "Discard unsaved changes?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("an edited query that has not run");
    await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(sql(lab)).toHaveValue("SELECT 1 AS one");
    await lab.pane("query").getByRole("button", { name: /^Close / }).click();
    await dialog.getByRole("button", { name: "Discard" }).click();
    await expect(lab.pane("query")).toHaveCount(0);
  });

  test("running the edit saves it: the pane then closes without asking", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("Query + chart + inspector");
    await expect(lab.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(lab).fill("SELECT 2 AS two");
    await sql(lab).press("ControlOrMeta+Enter");
    await lab.pane("query").getByRole("button", { name: /^Close / }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(lab.pane("query")).toHaveCount(0);
  });

  test("the draft is the pane's own state: it survives a reload", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("Query + chart + inspector");
    await expect(lab.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(lab).fill("SELECT 3 AS three");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pane-lab:pane-state") ?? "")).toContain("SELECT 3 AS three");
    await page.reload();
    await expect(sql(lab)).toHaveValue("SELECT 3 AS three");
  });

  test("⌘K lists the focused query's own commands first, under its title", async ({ lab, page }) => {
    await lab.open();
    await lab.preset("Query + chart + inspector");
    await expect(lab.grid("query")).toBeVisible({ timeout: 20_000 });
    await sql(lab).click();
    await page.keyboard.press("ControlOrMeta+k");
    const first = page.locator(".palette-item").first();
    await expect(first).toContainText("Run query");
    await expect(first).toContainText("Query");
    await page.keyboard.press("Escape");
  });
});
