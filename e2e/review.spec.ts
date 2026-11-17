import { test, expect } from "./fixtures/lab";

/** The curated loan review: layout controls in the top bar, one hide button on role panes, opened panes at the right. */
const REVIEW = "/?app=review&item=4";
const toggle = (page: import("@playwright/test").Page, name: string) => page.getByRole("toolbar", { name: "Panes" }).getByRole("button", { name });
const investigation = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "Investigation" });

test.describe("Loan review: the arrangement", () => {
  test("opens designed: roles named by role, group and officer hidden, no close on role panes, none at all on the primary", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    expect(await lab.visibleIds()).toEqual(["queue", "application", "borrower", "history"]);
    await expect(lab.heading("borrower")).toHaveText("Borrower");
    await expect(lab.pane("borrower").locator(".pane-sub")).toHaveText("member 149");
    await expect(toggle(page, "Group")).toHaveAttribute("aria-pressed", "false");
    await expect(toggle(page, "Borrower")).toHaveAttribute("aria-pressed", "true");
    await expect(lab.pane("borrower").getByRole("button", { name: /^Close/ })).toHaveCount(0);
    await expect(lab.pane("borrower").getByRole("button", { name: "Hide Borrower" })).toBeVisible();
    await expect(lab.pane("application").getByRole("button", { name: /^(Hide|Close|Tuck)/ })).toHaveCount(0);
    await expect(lab.statusMain()).toContainText("4 panes · 2 hidden");
  });

  test("hide from the header, show from the top bar: the pane returns to the exact same place", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    const before = await lab.pane("history").boundingBox();
    await lab.pane("history").getByRole("button", { name: "Hide Loan history" }).click();
    await expect(lab.pane("history")).toBeHidden();
    await expect(toggle(page, "Loan history")).toHaveAttribute("aria-pressed", "false");
    await expect(lab.announcer()).toContainText("Loan history hidden");
    await toggle(page, "Loan history").click();
    await expect(lab.pane("history")).toBeVisible();
    expect(await lab.pane("history").boundingBox()).toEqual(before);
    await expect(lab.focusedId()).resolves.toBe("history");
  });

  test("close and tuck on a role pane hide it; the primary pane refuses", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    await lab.header("borrower").click({ position: { x: 300, y: 20 } });
    await page.keyboard.press("Alt+Meta+w");
    await expect(lab.pane("borrower")).toBeHidden();
    await expect(toggle(page, "Borrower")).toHaveAttribute("aria-pressed", "false");
    await lab.header("application").click({ position: { x: 300, y: 20 } });
    await page.keyboard.press("Alt+Meta+w");
    await expect(lab.announcer()).toContainText("Application always stays in this layout");
    await expect(lab.pane("application")).toBeVisible();
  });

  test("Focus arrangement shows the application alone; toggles still bring roles back; Review restores the rest", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1440, height: 900 } });
    await page.getByRole("radio", { name: "Focus", exact: true }).click();
    expect(await lab.visibleIds()).toEqual(["application"]);
    await toggle(page, "Borrower").click();
    expect(await lab.visibleIds()).toEqual(["application", "borrower"]);
    await page.getByRole("radio", { name: "Review", exact: true }).click();
    expect(await lab.visibleIds()).toEqual(["queue", "application", "borrower", "history"]);
    // Each arrangement keeps its own adjustments.
    await page.getByRole("radio", { name: "Focus", exact: true }).click();
    expect(await lab.visibleIds()).toEqual(["application", "borrower"]);
  });
});

test.describe("Loan review: investigating", () => {
  test("a link opens beside the arrangement, marked as opened; Back to review clears it and restores every rect; ⌘Z reopens", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    const rects = await lab.snap();
    await lab.pane("borrower").locator('button[title="Open lending_groups 5 beside"]').click();
    const opened = page.locator('section[data-origin="opened"]');
    await expect(opened).toHaveCount(1);
    await expect(opened.locator(".badge-opened")).toHaveText("Opened");
    const ids = await lab.visibleIds();
    expect(ids.at(-1)).toBe(await opened.getAttribute("data-pane"));
    await expect(investigation(page)).toContainText("1 opened");
    // An opened pane is free: it has tuck and close.
    await expect(opened.getByRole("button", { name: /^Close/ })).toBeVisible();
    await investigation(page).getByRole("button", { name: "Back to review" }).click();
    await expect(opened).toHaveCount(0);
    await expect(investigation(page)).toHaveCount(0);
    expect(await lab.snap()).toEqual(rects);
    await page.keyboard.press("Meta+z");
    await expect(page.locator('section[data-origin="opened"]')).toHaveCount(1);
  });

  test("at 1440 the queue gives way for an opened pane; the opened pane stays on screen", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1440, height: 900 } });
    expect(await lab.visibleIds()).toEqual(["queue", "application", "borrower", "history"]);
    await lab.pane("borrower").locator('button[title="Open lending_groups 5 beside"]').click();
    const id = await page.locator('section[data-origin="opened"]').getAttribute("data-pane");
    expect(await lab.visibleIds()).toEqual(["application", "borrower", "history", id]);
    await expect(lab.tab(/^Queue/)).toBeVisible();
    await investigation(page).getByRole("button", { name: "Back to review" }).click();
    expect(await lab.visibleIds()).toEqual(["queue", "application", "borrower", "history"]);
  });

  test("choosing another application swaps every role in place and closes the investigation", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    await lab.pane("borrower").locator('button[title="Open lending_groups 5 beside"]').click();
    await expect(investigation(page)).toBeVisible();
    await lab.pane("queue").getByRole("option", { name: /#7/ }).click();
    await expect(lab.pane("application").locator(".pane-sub")).toHaveText("loan_application 7");
    await expect(lab.pane("borrower").locator(".pane-sub")).toHaveText("member 260");
    await expect(page.locator('section[data-origin="opened"]')).toHaveCount(0);
    await expect(page).toHaveURL(/item=7/);
    // J/K in the queue moves through applications.
    await lab.pane("queue").getByRole("option", { selected: true }).press("j");
    await expect(page).toHaveURL(/item=8/);
  });

  test("a loan officer's links open as a peek, never beside", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    await lab.setting(/Loan officer/);
    await lab.pane("borrower").locator('button[title="Open lending_groups 5 beside"]').click();
    await expect(lab.peek()).toBeVisible();
    await expect(page.locator('section[data-origin="opened"]')).toHaveCount(0);
    await expect(lab.peek().getByRole("button", { name: "Pin beside" })).toHaveCount(0);
  });
});

test.describe("Loan review: what a link carries", () => {
  test("the link carries the item and opened panes, not sizes or hidden panes; those stay with the person", async ({ lab, page, browser }) => {
    await lab.open({ path: REVIEW, size: { width: 1920, height: 900 } });
    await lab.pane("history").getByRole("button", { name: "Hide Loan history" }).click();
    await lab.pane("borrower").locator('button[title="Open lending_groups 5 beside"]').click();
    const url = page.url();
    expect(url).not.toContain("l=");
    expect(url).toContain("open=");

    // Reload: the person's own adjustment (History hidden) is still there.
    await page.reload();
    await expect(page.locator('section[data-origin="opened"]')).toHaveCount(1);
    await expect(lab.pane("history")).toBeHidden();

    // Someone else opens the same link: same application and opened pane, but their own (default) layout.
    const other = await browser.newContext({ viewport: { width: 1920, height: 900 } });
    const p2 = await other.newPage();
    await p2.goto(url);
    await expect(p2.locator('section[data-pane="history"]')).toBeVisible();
    await expect(p2.locator('section[data-origin="opened"]')).toHaveCount(1);
    await expect(p2.locator('section[data-pane="application"] .pane-sub')).toHaveText("loan_application 4");
    await other.close();

    // Reset drops the adjustment; the investigation stays.
    await page.getByRole("button", { name: "Reset layout to its design" }).click();
    await expect(lab.pane("history")).toBeVisible();
    await expect(page.locator('section[data-origin="opened"]')).toHaveCount(1);
  });

  test("Data Studio is untouched: switching back shows its presets and its own layout", async ({ lab, page }) => {
    await lab.open({ path: REVIEW, size: { width: 1440, height: 900 } });
    await page.getByRole("radio", { name: "Data Studio" }).click();
    await expect(page.getByRole("navigation", { name: "Layout presets" })).toBeVisible();
    await expect(page).toHaveURL(/l=/);
    await expect(page.locator("section[data-origin]")).toHaveCount(0);
  });
});
