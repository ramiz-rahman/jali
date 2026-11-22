import { test, expect } from "./fixtures/app";

test.describe("Move: drag by the grip", () => {
  test("edge zone places beside", async ({ app }) => {
    await app.open();
    await app.drag("customer", "orders", "left");
    await expect.poll(async () => (await app.visibleIds())[0]).toBe("customer");
    expect(await app.visibleIds()).toHaveLength(3);
    await app.shot("03-drop-edge");
  });

  test("centre drop swaps (swap mode) and the drag chip says so", async ({ app, page }) => {
    await app.open();
    await app.setting(/Swap the two panes/);
    await app.drag("customer", "orders", "centre", { release: false });
    await expect(page.getByText("Swap with orders")).toBeVisible();
    await app.shot("04-drop-centre-swap");
    await page.mouse.up();
    await expect.poll(() => app.visibleIds()).toEqual(["customer", "order", "orders"]);
  });

  test("a drag the browser cancels drops nothing, even on the next release", async ({
    app,
    page,
  }) => {
    // Architecture review 22 Nov 2026: a cancelled pointer (a touch that became a scroll, the system taking the
    // gesture) left the drag live, and the next release dropped the pane where the pointer last was.
    await app.open();
    const before = await app.visibleIds();
    await app.drag("customer", "orders", "left", { release: false });
    await expect(app.dragChip()).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true })),
    );
    await expect(app.dragChip()).toHaveCount(0);
    await page.mouse.up();
    expect(await app.visibleIds()).toEqual(before);
  });

  test("a drag selects no text in the panes it crosses", async ({ app, page }) => {
    await app.open();
    await app.drag("customer", "orders", "centre", { release: false });
    await expect(app.dragChip()).toBeVisible();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  });

  test("the drag chip never covers the drop label, and only the drop is ringed", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.drag("customer", "orders", "centre", { release: false });
    const label = (await page.locator(".jali-drop-label").boundingBox())!;
    const chip = (await app.dragChip().boundingBox())!;
    const overlaps =
      chip.x < label.x + label.width &&
      chip.x + chip.width > label.x &&
      chip.y < label.y + label.height &&
      chip.y + chip.height > label.y;
    expect(overlaps).toBe(false);
    const dragged = app.pane("customer");
    expect(await dragged.evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");
    await page.mouse.up();
  });

  test("centre drop adds a tab (tab mode)", async ({ app, page }) => {
    await app.open();
    await app.setting(/Add as a tab/);
    await app.drag("customer", "orders", "centre", { release: false });
    await expect(page.getByText("Add as tab to orders")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(app.tabs()).toHaveCount(2);
    expect(await app.visibleIds()).toHaveLength(2);
    await app.shot("05-drop-centre-tab");
  });

  test("Esc cancels a drag; a drag under 4px does nothing", async ({ app, page }) => {
    await app.open();
    const before = await app.visibleIds();
    await app.drag("customer", "orders", "left", { release: false });
    await expect(app.dragChip()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(app.dragChip()).toBeHidden();
    await page.mouse.up();
    expect(await app.visibleIds()).toEqual(before);

    const h = (await app.header("customer").boundingBox())!;
    await page.mouse.move(h.x + 200, h.y + 20);
    await page.mouse.down();
    await page.mouse.move(h.x + 202, h.y + 21);
    await expect(app.dragChip()).toBeHidden();
    await page.mouse.up();
  });

  test("keyboard move: ⌘K ⇧⌘Arrow", async ({ app, page }) => {
    await app.open();
    await app.pane("customer").click({ position: { x: 100, y: 200 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+Shift+ArrowLeft");
    await expect.poll(() => app.visibleIds()).toEqual(["orders", "customer", "order"]);
  });
});
