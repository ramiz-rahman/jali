import { test, expect } from "./fixtures/app";

/** Linked selection: orders (list) → order (detail opened from a row) follows the list's selection. */
test.describe("A list's detail follows its selection", () => {
  test("J/K update the detail after the selection rests; in place; the URL is replaced, not pushed", async ({
    app,
    page,
  }) => {
    await app.open();
    await expect(app.heading("order")).toHaveText("order 1");
    await app.row("orders", /^3\b/).click();
    await expect(app.heading("order")).toHaveText("order 3");
    const before = await app.snap();
    const entries = await page.evaluate(() => history.length);

    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expect(app.heading("order")).toHaveText("order 5");
    await expect(app.pane("order")).toHaveAttribute("data-kind", "record");
    // Same slot, same size; focus stays in the list; no history entries for rows passed through.
    await app.expectSnap(before, "follow is a swap");
    await expect(app.pane("orders")).toHaveAttribute("data-focused", "true");
    expect(await page.evaluate(() => history.length)).toBe(entries);
    // The link names the order now shown (the layout in ?l= is base64url JSON), not merely any "5" in the URL.
    await expect
      .poll(() => page.evaluate(linkLayout))
      .toMatch(/"record",\{"table":"orders","id":"?5"?\}/);
    await page.keyboard.press("k");
    await expect(app.heading("order")).toHaveText("order 4");
    await expect(app.announcer()).toHaveText("Showing order 4");
  });

  test("a narrow detail keeps its title: the follow control drops its word, idle header buttons take no room (findings 29, 39)", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.row("orders", /^3\b/).click();
    await expect(app.heading("order")).toHaveText("order 3");
    await page.addStyleTag({ content: 'section[data-pane="order"] { width: 230px !important; }' });
    const pane = app.pane("order");
    await expect(pane.locator(".jali-follow-toggle span")).toBeHidden();
    await expect(pane.locator(".jali-follow-toggle")).toBeVisible();
    await expect(pane.locator(".jali-act-zoom")).toBeHidden();
    const h2 = pane.locator("h2");
    expect(await h2.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    // Focused, the buttons would cut the title short at this width, so they wait in the pane's menu instead.
    await pane.click({ position: { x: 100, y: 120 } });
    await expect(pane.locator(".jali-pane-header")).toHaveAttribute("data-narrow", "actions");
    expect(await h2.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
    await pane.locator('.jali-pane-action[data-action="menu"]').click();
    await expect(page.getByRole("menuitem", { name: /Maximi[sz]e/ })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("holding J doesn't follow every row: only where the selection rests", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.row("orders", /^1\b/).click();
    await app.recordAnnouncements();
    for (let i = 0; i < 6; i++) await page.keyboard.press("j");
    await expect(app.heading("order")).toHaveText("order 7");
    const shown = (await app.announcements()).filter((m) => m.startsWith("Showing order"));
    expect(shown.length).toBeLessThan(6);
  });

  test("⌥↵ on the row the detail shows keeps it there; the next ⌥↵ opens a new follower; a kept detail stays", async ({
    app,
    page,
  }) => {
    await app.open();
    // Room for a fourth pane: close the customer record.
    await app
      .pane("customer")
      .getByRole("button", { name: /^Close/ })
      .click();
    // One toggle naming what the pane does: Following, then Kept.
    const keep = app.pane("order").locator(".jali-follow-toggle");
    await expect(keep).toHaveAttribute("data-follow", "following");
    await expect(keep).toHaveAccessibleName("Following orders");
    await app.row("orders", /^2\b/).click();
    await expect(app.heading("order")).toHaveText("order 2");
    // The live region reads what is said within 30ms as one announcement (chrome/Announcer.tsx). The detail shows
    // order 2 as the follow is said, so a ⌥↵ pressed at once was read with it: "Showing order 2 order 2 kept", about
    // one run in 20. Wait until the follow has been said on its own.
    await expect(app.announcer()).toHaveText("Showing order 2");

    // ⌥↵ on the row it shows: that detail is kept in place, no copy opens.
    const count = await app.visibleCount();
    await page.keyboard.press("Alt+Enter");
    await expect(keep).toHaveAttribute("data-follow", "kept");
    await expect(keep).toHaveAccessibleName("Kept");
    await expect(app.announcer()).toHaveText(/^order 2 kept/);
    expect(await app.visibleCount()).toBe(count);

    // Browse on: the kept detail stays; ⌥↵ makes a new follower that follows from here.
    await page.keyboard.press("j");
    await page.waitForTimeout(400);
    await expect(app.heading("order")).toHaveText("order 2");
    await page.keyboard.press("Alt+Enter");
    await expect.poll(() => app.visibleCount()).toBe(count + 1);
    const follower = page
      .locator('section[data-pane][data-kind="record"]')
      .filter({ has: page.locator('.jali-follow-toggle[data-follow="following"]') });
    await expect(follower.getByRole("heading", { level: 2 })).toHaveText("order 3");
    await page.keyboard.press("j");
    await expect(follower.getByRole("heading", { level: 2 })).toHaveText("order 4");
    await expect(app.heading("order")).toHaveText("order 2");
  });

  test("Space shows the row in the detail when one follows; without one, the peek sheet", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.row("orders", /^6\b/).click();
    await page.keyboard.press("Space");
    await expect(app.heading("order")).toHaveText("order 6");
    await expect(app.peek()).toBeHidden();

    await app
      .pane("order")
      .getByRole("button", { name: /^Close/ })
      .click();
    await app.grid("orders").focus();
    await page.keyboard.press("Space");
    await expect(app.peek()).toBeVisible();
    await expect(app.peek()).toContainText("order 6");
  });

  test("a row filtered out of the list stays in the detail, with a note; clearing the filter selects it again", async ({
    app,
  }) => {
    await app.open();
    await app.row("orders", /^3\b/).click();
    await expect(app.heading("order")).toHaveText("order 3");
    const filter = app.pane("orders").getByRole("textbox", { name: "Filter id" });
    await filter.fill("9");
    await filter.press("Enter");
    const note = app.pane("order").getByRole("note");
    await expect(note).toHaveText("Not in the current results of orders");
    await expect(app.heading("order")).toHaveText("order 3");
    await app.pane("orders").getByRole("button", { name: "Clear" }).click();
    await expect(note).toBeHidden();
    await expect(app.pane("orders").getByRole("row", { selected: true })).toHaveAttribute(
      "aria-rowindex",
      "4",
    );
  });
});

/** The layout in the address's `?l=` link, as JSON text ("" when there is none). Runs in the page. */
function linkLayout(): string {
  const l = new URLSearchParams(location.search).get("l") ?? "";
  const b64 = l
    .slice(l.indexOf(".") + 1)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}
