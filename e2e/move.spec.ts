import { test, expect } from "./fixtures/lab";

test.describe("Move: drag by the grip", () => {
  test("edge zone places beside", async ({ lab }) => {
    await lab.open();
    await lab.drag("customer", "orders", "left");
    await expect.poll(async () => (await lab.visibleIds())[0]).toBe("customer");
    expect(await lab.visibleIds()).toHaveLength(3);
    await lab.shot("03-drop-edge");
  });

  test("centre drop swaps (swap mode) and the drag chip says so", async ({ lab, page }) => {
    await lab.open();
    await lab.setting(/Swap the two panes/);
    await lab.drag("customer", "orders", "centre", { release: false });
    await expect(page.getByText("Swap with orders")).toBeVisible();
    await lab.shot("04-drop-centre-swap");
    await page.mouse.up();
    await expect.poll(() => lab.visibleIds()).toEqual(["customer", "order", "orders"]);
  });

  test("a drag selects no text in the panes it crosses", async ({ lab, page }) => {
    await lab.open();
    await lab.drag("customer", "orders", "centre", { release: false });
    await expect(lab.dragChip()).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  });

  test("centre drop adds a tab (tab mode)", async ({ lab, page }) => {
    await lab.open();
    await lab.setting(/Add as a tab/);
    await lab.drag("customer", "orders", "centre", { release: false });
    await expect(page.getByText("Add as tab to orders")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(lab.tabs()).toHaveCount(2);
    expect(await lab.visibleIds()).toHaveLength(2);
    await lab.shot("05-drop-centre-tab");
  });

  test("Esc cancels a drag; a drag under 4px does nothing", async ({ lab, page }) => {
    await lab.open();
    const before = await lab.visibleIds();
    await lab.drag("customer", "orders", "left", { release: false });
    await expect(lab.dragChip()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(lab.dragChip()).toBeHidden();
    await page.mouse.up();
    expect(await lab.visibleIds()).toEqual(before);

    const h = (await lab.header("customer").boundingBox())!;
    await page.mouse.move(h.x + 200, h.y + 20);
    await page.mouse.down();
    await page.mouse.move(h.x + 202, h.y + 21);
    await expect(lab.dragChip()).toBeHidden();
    await page.mouse.up();
  });

  test("keyboard move: ⌘K ⇧⌘Arrow", async ({ lab, page }) => {
    await lab.open();
    await lab.pane("customer").click({ position: { x: 100, y: 200 } });
    await page.keyboard.press("ControlOrMeta+k"); await page.keyboard.press("ControlOrMeta+Shift+ArrowLeft");
    await expect.poll(() => lab.visibleIds()).toEqual(["orders", "customer", "order"]);
  });
});
