import { test, expect, review, type App } from "./fixtures/app";
import type { Page } from "@playwright/test";

/**
 * The curated loan review: a queue, the application's header and its tabs. Single (default) shows one view; Split view
 * lets the tabs be dragged into split layouts. Links peek in Single and open beside in Split view.
 */
const at = (tab: string, item = 4) => review(`?page=loan-review&item=${item}&tab=${tab}`);
const pageTab = (page: Page, name: string) =>
  page.getByRole("tablist", { name: "Loan review views" }).getByRole("tab", { name, exact: true });
const mode = (page: Page, name: "Single" | "Split view") =>
  page.getByRole("radiogroup", { name: "View mode" }).getByRole("radio", { name });
const investigation = (page: Page) => page.getByRole("group", { name: "Opened panes" });
const opened = (page: Page) => page.locator('section[data-origin="opened"]');
const groupLink = (app: App, from: string) =>
  app.pane(from).locator('button[data-ref="lending_groups 5"]');
/** A link from one view to another view's object (Group is a view on this page). */
const link = (app: App, from: string, ref: string) =>
  app.pane(from).locator(`button[data-ref="${ref}"]`);
/** A link to an object that is no view on this page: following it opens a pane. */
const openLink = (app: App) => link(app, "borrower", "loan_applications member_id=149");

async function dragTab(page: Page, name: string, to: { x: number; y: number }) {
  const b = (await pageTab(page, name).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 10, b.y + b.height + 20, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}
const rightEdge = async (app: App, id: string) => {
  const r = (await app.pane(id).boundingBox())!;
  return { x: r.x + r.width - 20, y: r.y + r.height / 2 };
};

test.describe("Loan review: Single (default)", () => {
  test("one view at a time, chosen from the tabs; the tabs name it, so the pane has no visible header", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await expect(mode(page, "Single")).toHaveAttribute("aria-checked", "true");
    expect(await app.visibleIds()).toEqual(["application"]);
    await expect(pageTab(page, "Application")).toHaveAttribute("aria-selected", "true");
    await expect(app.header("application")).not.toBeInViewport();
    await pageTab(page, "Borrower").click();
    expect(await app.visibleIds()).toEqual(["borrower"]);
    await expect(page).toHaveURL(/tab=borrower/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fatema Khatun");
  });

  test("Overview is the designed page: each section leads to its tab", async ({ app, page }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await pageTab(page, "Overview").click();
    const loans = app.pane("overview").getByRole("region", { name: "Loan history" });
    await expect(loans).toContainText("3 loans");
    await loans.getByRole("button", { name: "Open Loan history" }).click();
    expect(await app.visibleIds()).toEqual(["history"]);
    await expect(pageTab(page, "Loan history")).toHaveAttribute("aria-selected", "true");
  });

  test("a link peeks instead of opening beside, and the peek offers no Open beside", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("borrower"), size: { width: 1440, height: 900 } });
    await groupLink(app, "borrower").click();
    await expect(app.peek()).toBeVisible();
    await expect(opened(page)).toHaveCount(0);
    await expect(app.peek().getByRole("button", { name: "Open beside" })).toHaveCount(0);
  });

  test("another application from the queue keeps the view; J/K move through the queue", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("borrower"), size: { width: 1440, height: 900 } });
    const queue = page.getByRole("listbox", { name: "Loan applications" });
    await queue.getByRole("option", { name: /#7/ }).click();
    await expect(page).toHaveURL(/item=7&tab=borrower/);
    await expect(app.pane("borrower")).toContainText("Member #260");
    await queue.getByRole("option", { selected: true }).press("j");
    await expect(page).toHaveURL(/item=8/);
  });
});

test.describe("Loan review: Split view", () => {
  test("starts from Overview's sections as panes; Single and back restores the exact layout", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await pageTab(page, "Overview").click();
    await mode(page, "Split view").click();
    expect(await app.visibleIds()).toEqual(["application", "borrower", "history"]);
    await expect(pageTab(page, "Application")).toHaveAttribute("data-state", "focused");
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "shown");
    await expect(pageTab(page, "Group")).toHaveAttribute("data-state", "off");
    await expect(app.heading("borrower")).toHaveText("Borrower");
    const rects = await app.snap();
    await mode(page, "Single").click();
    expect(await app.visibleIds()).toEqual(["application"]);
    await mode(page, "Split view").click();
    expect(await app.snap()).toEqual(rects);
  });

  test("a tab click never moves a pane or a tab: on screen it focuses, off screen it takes the place of the view in use", async ({
    app,
    page,
  }) => {
    const breaches: string[] = [];
    page.on("console", (m) => m.text().startsWith("Layout stability") && breaches.push(m.text()));
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    const rects = async () =>
      (
        await page.locator("section[data-pane]:visible").evaluateAll((els) =>
          els.map((e) => {
            const r = e.getBoundingClientRect();
            return `${r.x},${r.y},${r.width},${r.height}`;
          }),
        )
      ).sort();
    const tabsAt = () =>
      page
        .locator(".jali-page-tab")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().x));
    const before = await rects(),
      tabs = await tabsAt();
    const borrower = await app.pane("borrower").boundingBox();
    await pageTab(page, "Borrower").click();
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "focused");
    await pageTab(page, "Group").click();
    await expect(app.pane("group")).toBeVisible();
    expect(await app.pane("group").boundingBox()).toEqual(borrower);
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "off");
    await pageTab(page, "Overview").click();
    await pageTab(page, "Application").click();
    expect(await rects()).toEqual(before);
    expect(await tabsAt()).toEqual(tabs);
    expect(breaches).toEqual([]);
  });

  test("drag a tab to place that view; close it and it goes back to the tabs; ⌥-click opens beside", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    await dragTab(page, "Group", await rightEdge(app, "application"));
    expect(await app.visibleIds()).toEqual(["application", "group", "borrower", "history"]);
    await expect(pageTab(page, "Group")).toHaveAttribute("data-state", "focused");
    await app.pane("group").getByRole("button", { name: "Close Group" }).click();
    await expect(app.pane("group")).toBeHidden();
    await expect(pageTab(page, "Group")).toHaveAttribute("data-state", "off");
    await expect(app.announcer()).toContainText("Group closed · it's still in the tabs");
    // ⌥-click: beside the view in use.
    await app.header("application").click({ position: { x: 300, y: 20 } });
    await pageTab(page, "Field officer").click({ modifiers: ["Alt"] });
    const ids = await app.visibleIds();
    expect(ids.indexOf("officer")).toBe(ids.indexOf("application") + 1);
  });

  test("a view dropped in a pane's centre joins it as a tab: both views are listed, neither replaced", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    const to = (await app.pane("application").boundingBox())!;
    await dragTab(page, "Field officer", { x: to.x + to.width / 2, y: to.y + to.height / 2 });
    const strip = app.pane("officer").getByRole("tablist");
    await expect(strip.getByRole("tab")).toHaveText(["Application", "Field officer"]);
    await strip.getByRole("tab", { name: "Application" }).click();
    await expect(app.pane("application")).toBeVisible();
    await expect(pageTab(page, "Field officer")).toHaveAttribute("data-state", "behind");
  });

  test("dragging a tab across the panes selects no text in them", async ({ app, page }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    const selected = () => page.evaluate(() => window.getSelection()?.toString() ?? "");
    const b = (await pageTab(page, "Field officer").boundingBox())!;
    const to = (await app.pane("application").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + 40, to.y + 40, { steps: 8 });
    await page.mouse.move(to.x + to.width / 2, to.y + 60, { steps: 12 });
    expect(await selected()).toBe("");
    await page.mouse.up();
    expect(await selected()).toBe("");
  });

  test("a tab dragged onto the focused view rings only the drop, not the view's focus too", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    await app.pane("application").click();
    await expect(app.pane("application")).toHaveClass(/is-focused/);
    const b = (await pageTab(page, "Group").boundingBox())!;
    const to = (await app.pane("application").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await expect(page.locator(".jali-drop-indicator")).toBeVisible();
    const target = app.pane("application");
    expect(await target.evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");
    await page.keyboard.press("Escape");
    expect(await target.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");
    await page.mouse.up();
  });

  test("dragging a tab out of Single switches to Split view with both views", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await dragTab(page, "Loan history", await rightEdge(app, "application"));
    await expect(mode(page, "Split view")).toHaveAttribute("aria-checked", "true");
    const ids = await app.visibleIds();
    expect(ids).toContain("application");
    expect(ids).toContain("history");
  });

  test("a link opens beside the layout, marked as opened; Back to review restores every rect; ⌘K ⌘Z reopens", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1920, height: 1000 } });
    await mode(page, "Split view").click();
    const rects = await app.snap();
    await openLink(app).click();
    await expect(opened(page)).toHaveCount(1);
    await expect(opened(page).locator(".jali-badge-opened")).toHaveText("Opened");
    expect((await app.visibleIds()).at(-1)).toBe(await opened(page).getAttribute("data-pane"));
    await expect(investigation(page)).toContainText("1 opened");
    await investigation(page).getByRole("button", { name: "Back to Loan review" }).click();
    await expect(opened(page)).toHaveCount(0);
    expect(await app.snap()).toEqual(rects);
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+z");
    await expect(opened(page)).toHaveCount(1);
  });

  test("another application swaps every view in place and closes the investigation", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1920, height: 1000 } });
    await mode(page, "Split view").click();
    await openLink(app).click();
    await expect(investigation(page)).toBeVisible();
    await page
      .getByRole("listbox", { name: "Loan applications" })
      .getByRole("option", { name: /#7/ })
      .click();
    await expect(app.pane("application").locator(".jali-pane-sub")).toHaveText("Application #7");
    await expect(app.pane("borrower").locator(".jali-pane-sub")).toHaveText("Member #260");
    await expect(opened(page)).toHaveCount(0);
  });
});

test.describe("Loan review: roles and what a link carries", () => {
  test("a loan officer works in Single view only, and links peek", async ({ app, page }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    await app.setting(/Loan officer/);
    await expect(mode(page, "Single")).toHaveAttribute("aria-checked", "true");
    await expect(mode(page, "Split view")).toBeDisabled();
    await pageTab(page, "Borrower").click();
    await groupLink(app, "borrower").click();
    await expect(app.peek()).toBeVisible();
    await expect(opened(page)).toHaveCount(0);
  });

  test("the mode and layout stay with the person; a link carries the item, the view and opened panes", async ({
    app,
    page,
    browser,
  }) => {
    await app.open({ path: at("application"), size: { width: 1920, height: 1000 } });
    await mode(page, "Split view").click();
    await dragTab(page, "Group", await rightEdge(app, "application"));
    await page.reload();
    await expect(mode(page, "Split view")).toHaveAttribute("aria-checked", "true");
    await expect(app.pane("group")).toBeVisible();

    await openLink(app).click();
    const url = page.url();
    expect(url).not.toContain("l=");
    expect(url).toContain("open=");

    // Someone else: the same application and opened pane, in the designed layout (not this person's).
    const other = await browser.newContext({ viewport: { width: 1920, height: 1000 } });
    const p2 = await other.newPage();
    await p2.goto(url);
    await expect(p2.locator('section[data-origin="opened"]')).toHaveCount(1);
    await expect(p2.locator('section[data-pane="group"]')).toBeHidden();
    await expect(p2.locator('section[data-pane="application"] .jali-pane-sub')).toHaveText(
      "Application #4",
    );
    // Without opened panes, a link opens in the reader's own mode (Single by default).
    await p2.goto(at("history"));
    await expect(
      p2.getByRole("radiogroup", { name: "View mode" }).getByRole("radio", { name: "Single" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(p2.locator('section[data-pane="history"]')).toBeVisible();
    await other.close();

    // Reset drops this person's layout; the investigation stays.
    await page.getByRole("button", { name: "Reset layout to its design" }).click();
    await expect(app.pane("group")).toBeHidden();
    await expect(opened(page)).toHaveCount(1);
  });
});

test.describe("Loan review: design polish", () => {
  test("Single offers no pane controls (nothing invisible to tab to); the status bar speaks in views", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await expect(page.locator(".jali-pane-actions")).toHaveCount(0);
    await expect(page.getByTestId("fetch-stats")).toHaveCount(0);
    await expect(app.statusMain()).toHaveText("1 view on screen · Focus: Application");
    await page.getByRole("radio", { name: "Split view" }).click();
    await expect(page.locator(".jali-pane-actions").first()).toBeVisible();
    await expect(app.statusMain()).toContainText("views on screen");
    await expect(app.statusMain()).not.toContainText("hidden");
  });

  test("page tab marks differ without changing a tab's width; dividers read naturally", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    const widths = async () =>
      page
        .locator(".jali-page-tab")
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width));
    const before = await widths();
    await page.getByRole("radio", { name: "Split view" }).click();
    expect(await widths()).toEqual(before);
    const mark = (state: string) =>
      page
        .locator(`.jali-page-tab[data-state="${state}"]`)
        .first()
        .evaluate((e) => {
          const c = getComputedStyle(e);
          return `${c.borderBottomStyle} ${c.borderBottomColor}`;
        });
    const marks = [await mark("focused"), await mark("shown"), await mark("off")];
    expect(new Set(marks).size).toBe(3);
    for (const l of await page
      .getByRole("separator")
      .evaluateAll((e) => e.map((x) => x.getAttribute("aria-label"))))
      expect(l).toMatch(/^Resize between .+ and .+$/);
  });

  test("at 390px the queue opens from the header, and there is no pane switcher under the tabs", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 390, height: 844 } });
    await expect(page.locator(".jali-switcher")).toHaveCount(0);
    await page.getByRole("button", { name: /waiting/ }).click();
    await page.getByRole("dialog", { name: "Queue" }).getByRole("option").nth(2).click();
    await expect(page.getByRole("dialog", { name: "Queue" })).toHaveCount(0);
    await expect(page).toHaveURL(/item=3/);
  });
});

test.describe("Loan review: following links and placing views at 1440", () => {
  test("a link to a view already on the page goes to that view: no copy opens", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    const rects = await app.snap();
    await link(app, "application", "members 149").click();
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "focused");
    await expect(app.announcer()).toContainText("Already open: focused Borrower");
    await expect(opened(page)).toHaveCount(0);
    expect(await app.snap()).toEqual(rects);
    // The reviewer's path: Overview and Field officer ⌥-clicked in, so Borrower went back to the tabs.
    await pageTab(page, "Application").click();
    await pageTab(page, "Overview").click({ modifiers: ["Alt"] });
    await pageTab(page, "Field officer").click({ modifiers: ["Alt"] });
    expect(await app.visibleIds()).toEqual(["application", "overview", "officer"]);
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "off");
    await link(app, "application", "members 149").click();
    await expect(opened(page)).toHaveCount(0);
    await expect(app.announcer()).toContainText("Borrower is already a view on this page");
    // It opens beside the pane the link is in; that pane stays, nothing folds into a tab group.
    expect(await app.visibleIds()).toContain("application");
    expect(await app.visibleIds()).toContain("borrower");
    await expect(
      page.locator('[role="tablist"]:not([aria-label="Loan review views"])'),
    ).toHaveCount(0);
  });

  test("an opened pane never pushes the person's views aside: short of room it opens as the shown tab", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    await pageTab(page, "Group").click({ modifiers: ["Alt"] });
    expect(await app.visibleIds()).toEqual(["application", "group", "borrower", "history"]);
    const keep = async () =>
      Promise.all(["application", "group", "history"].map((id) => app.pane(id).boundingBox()));
    const before = await keep();
    await openLink(app).click();
    await expect(opened(page)).toHaveCount(1);
    await expect(opened(page)).toBeVisible();
    // Every view the person placed stays, at its rect; the opened pane is Borrower's shown tab, in Borrower's slot.
    expect(await app.visibleIds()).toEqual([
      "application",
      "group",
      (await opened(page).getAttribute("data-pane"))!,
      "history",
    ]);
    expect(await keep()).toEqual(before);
    await expect(app.announcer()).toContainText("opened as a tab: not enough room beside Borrower");
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "behind");
    // The pane's own tabs never repeat a page tab: Borrower is reached from the page tabs.
    const inPane = page.locator('[role="tablist"]:not([aria-label="Loan review views"])');
    await expect(inPane.getByRole("tab", { name: /Borrower/ })).toHaveCount(0);
    await pageTab(page, "Borrower").click();
    await expect(pageTab(page, "Borrower")).toHaveAttribute("data-state", "focused");
  });

  test("holding ⌥ over a tab previews exactly what ⌥-click does: the new view and every view that moves", async ({
    app,
    page,
  }) => {
    await app.open({ path: at("application"), size: { width: 1440, height: 900 } });
    await mode(page, "Split view").click();
    await pageTab(page, "Overview").click({ modifiers: ["Alt"] });
    for (const name of ["Field officer", "Group"]) {
      const role = (await pageTab(page, name).getAttribute("data-role"))!;
      await pageTab(page, name).hover();
      await page.keyboard.down("Alt");
      const ghost = page.locator(`.jali-ghost[data-ghost="${role}"]`);
      await expect(ghost).toBeVisible();
      const preview = (await ghost.boundingBox())!;
      const moved = await page.locator(".jali-ghost-moved").evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return [
            (e as HTMLElement).dataset.ghost!,
            [r.x, r.y, r.width, r.height].map(Math.round),
          ] as const;
        }),
      );
      await pageTab(page, name).click();
      await page.keyboard.up("Alt");
      await expect(ghost).toHaveCount(0);
      const box = (await app.pane(role).boundingBox())!;
      for (const k of ["x", "y", "width", "height"] as const)
        expect(Math.abs(box[k] - preview[k]), `${name} ${k}`).toBeLessThanOrEqual(1);
      for (const [id, r] of moved) {
        const b = (await app.pane(id).boundingBox())!;
        expect([b.x, b.y, b.width, b.height].map(Math.round), `${id} moved as previewed`).toEqual(
          r,
        );
      }
    }
  });
});
