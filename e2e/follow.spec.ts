import { test, expect } from "./fixtures/lab";

/** Linked selection: orders (list) → order (detail opened from a row) follows the list's selection. */
test.describe("A list's detail follows its selection", () => {
  test("J/K update the detail after the selection rests; in place; the URL is replaced, not pushed", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await expect(lab.heading("order")).toHaveText("order 1");
    await lab.row("orders", /^3\b/).click();
    await expect(lab.heading("order")).toHaveText("order 3");
    const before = await lab.snap();
    const entries = await page.evaluate(() => history.length);

    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expect(lab.heading("order")).toHaveText("order 5");
    await expect(lab.pane("order")).toHaveAttribute("data-kind", "record");
    // Same slot, same size; focus stays in the list; no history entries for rows passed through.
    await lab.expectSnap(before, "follow is a swap");
    await expect(lab.pane("orders")).toHaveAttribute("data-focused", "true");
    expect(await page.evaluate(() => history.length)).toBe(entries);
    await expect.poll(() => page.url()).toContain("5");
    await page.keyboard.press("k");
    await expect(lab.heading("order")).toHaveText("order 4");
    await expect(lab.announcer()).toHaveText("Showing order 4");
  });

  test("a narrow detail keeps its title: the follow control drops its word, idle header buttons take no room (findings 29, 39)", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.row("orders", /^3\b/).click();
    await expect(lab.heading("order")).toHaveText("order 3");
    await page.addStyleTag({ content: 'section[data-pane="order"] { width: 230px !important; }' });
    const pane = lab.pane("order");
    await expect(pane.locator(".jali-follow-toggle span")).toBeHidden();
    await expect(pane.locator(".jali-follow-toggle")).toBeVisible();
    await expect(pane.locator(".jali-act-zoom")).toBeHidden();
    const h2 = pane.locator("h2");
    expect(await h2.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    // Focused, the buttons are back.
    await pane.click({ position: { x: 100, y: 120 } });
    await expect(pane.locator(".jali-act-zoom")).toBeVisible();
  });

  test("holding J doesn't follow every row: only where the selection rests", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.row("orders", /^1\b/).click();
    await lab.recordAnnouncements();
    for (let i = 0; i < 6; i++) await page.keyboard.press("j");
    await expect(lab.heading("order")).toHaveText("order 7");
    const shown = (await lab.announcements()).filter((m) => m.startsWith("Showing order"));
    expect(shown.length).toBeLessThan(6);
  });

  test("⌥↵ on the row the detail shows keeps it there; the next ⌥↵ opens a new follower; a kept detail stays", async ({
    lab,
    page,
  }) => {
    await lab.open();
    // Room for a fourth pane: close the customer record.
    await lab
      .pane("customer")
      .getByRole("button", { name: /^Close/ })
      .click();
    // One toggle naming what the pane does: Following, then Kept.
    const keep = lab.pane("order").locator(".jali-follow-toggle");
    await expect(keep).toHaveAttribute("data-follow", "following");
    await expect(keep).toHaveAccessibleName("Following orders");
    await lab.row("orders", /^2\b/).click();
    await expect(lab.heading("order")).toHaveText("order 2");

    // ⌥↵ on the row it shows: that detail is kept in place, no copy opens.
    const count = await lab.visibleCount();
    await page.keyboard.press("Alt+Enter");
    await expect(keep).toHaveAttribute("data-follow", "kept");
    await expect(keep).toHaveAccessibleName("Kept");
    await expect(lab.announcer()).toHaveText(/^order 2 kept/);
    expect(await lab.visibleCount()).toBe(count);

    // Browse on: the kept detail stays; ⌥↵ makes a new follower that follows from here.
    await page.keyboard.press("j");
    await page.waitForTimeout(400);
    await expect(lab.heading("order")).toHaveText("order 2");
    await page.keyboard.press("Alt+Enter");
    await expect.poll(() => lab.visibleCount()).toBe(count + 1);
    const follower = page
      .locator('section[data-pane][data-kind="record"]')
      .filter({ has: page.locator('.jali-follow-toggle[data-follow="following"]') });
    await expect(follower.getByRole("heading", { level: 2 })).toHaveText("order 3");
    await page.keyboard.press("j");
    await expect(follower.getByRole("heading", { level: 2 })).toHaveText("order 4");
    await expect(lab.heading("order")).toHaveText("order 2");
  });

  test("Space shows the row in the detail when one follows; without one, the peek sheet", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.row("orders", /^6\b/).click();
    await page.keyboard.press("Space");
    await expect(lab.heading("order")).toHaveText("order 6");
    await expect(lab.peek()).toBeHidden();

    await lab
      .pane("order")
      .getByRole("button", { name: /^Close/ })
      .click();
    await lab.grid("orders").focus();
    await page.keyboard.press("Space");
    await expect(lab.peek()).toBeVisible();
    await expect(lab.peek()).toContainText("order 6");
  });

  test("a row filtered out of the list stays in the detail, with a note; clearing the filter selects it again", async ({
    lab,
  }) => {
    await lab.open();
    await lab.row("orders", /^3\b/).click();
    await expect(lab.heading("order")).toHaveText("order 3");
    const filter = lab.pane("orders").getByRole("textbox", { name: "Filter id" });
    await filter.fill("9");
    await filter.press("Enter");
    const note = lab.pane("order").getByRole("note");
    await expect(note).toHaveText("Not in the current results of orders");
    await expect(lab.heading("order")).toHaveText("order 3");
    await lab.pane("orders").getByRole("button", { name: "Clear" }).click();
    await expect(note).toBeHidden();
    await expect(lab.pane("orders").getByRole("row", { selected: true })).toHaveAttribute(
      "aria-rowindex",
      "3",
    );
  });
});
