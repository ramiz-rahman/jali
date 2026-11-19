import { test, expect } from "./fixtures/app";
import {
  audit,
  customerWith,
  linkTo,
  pane,
  queryResults,
  rec,
  tabLayout,
} from "./fixtures/layouts";

test.describe("Shared data", () => {
  test("editing customer 1 updates every pane showing it with only the invalidated queries refetched", async ({
    app,
    page,
  }, info) => {
    await app.open({ size: { width: 2100, height: 900 } }); // wide enough for four panes beside each other
    const before = await app.settle();
    // Add a customers table beside the customer record so two panes show customer 1.
    await app.pane("customer").getByRole("button", { name: "customers", exact: true }).click();
    await expect.poll(() => app.visibleCount()).toBe(4);
    const customersGrid = page
      .locator('section[data-kind="table"]:not([data-pane="orders"])')
      .getByRole("grid")
      .first();
    await expect(customersGrid.getByRole("row").nth(1)).toBeVisible();
    const afterOpen = await app.settle();

    const NEW = `QA Renamed ${Date.now() % 100000}`;
    const rec1 = app.pane("customer");
    await rec1.getByRole("button", { name: "Edit name" }).click();
    await rec1.getByRole("textbox", { name: "name" }).fill(NEW);
    await page.keyboard.press("Enter");
    await expect(rec1.getByText(NEW).first()).toBeVisible();
    const afterEdit = await app.settle();

    // Every visible pane that shows customer 1 now shows the new name.
    const showing = page.locator("section[data-pane]:visible").filter({ hasText: NEW });
    expect(await showing.count()).toBeGreaterThanOrEqual(2);
    await expect(app.heading("customer")).toHaveText(/customer 1|QA Renamed/);
    await expect(rec1).toContainText(NEW);
    await expect(customersGrid.getByRole("row").nth(1)).toContainText(NEW);
    // Panes that do not show customer 1 never showed the name.
    await expect(app.pane("orders")).not.toContainText(NEW);

    const delta = afterEdit - afterOpen;
    const note = `fetches: first load ${before}, after opening customers table ${afterOpen}, after edit ${afterEdit}, delta from edit ${delta}`;
    console.log(note);
    info.annotations.push({ type: "fetch-count", description: note });
    // One UPDATE + a handful of refetches for the invalidated keys, nowhere near a reload of every pane.
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(afterOpen); // far below reloading every pane (a full load costs `afterOpen`)
    await app.shot("11-shared-data-edit");
  });

  test("an unrelated pane adds nothing to the cost of an edit (control run)", async ({
    app,
    page,
  }, info) => {
    const editCost = async (extra: ReturnType<typeof pane>[]) => {
      await app.open({ path: linkTo(customerWith(...extra)), size: { width: 1700, height: 900 } });
      const before = await app.settle();
      await app.pane("c").getByRole("button", { name: "Edit name" }).click();
      await app.pane("c").getByRole("textbox", { name: "name" }).fill(`Solo edit ${extra.length}`);
      await page.keyboard.press("Enter");
      await expect(app.pane("c")).toContainText(`Solo edit ${extra.length}`);
      return (await app.settle()) - before;
    };
    const alone = await editCost([pane("a", audit())]);
    const withSupplier = await editCost([pane("a", audit()), pane("p", rec("suppliers", 1))]);
    const note = `edit cost with customer + audit: ${alone} fetches; adding an unrelated supplier record: ${withSupplier} fetches`;
    console.log(note);
    info.annotations.push({ type: "fetch-count", description: note });
    expect(withSupplier).toBe(alone);
  });

  test("query results with a primary key refresh; results without one cannot be refreshed by entity", async ({
    app,
    page,
  }) => {
    await app.open({ path: linkTo(queryResults()), size: { width: 1700, height: 900 } });
    for (const id of ["q1", "q2"]) {
      await app.pane(id).getByRole("button", { name: /^Run/ }).click();
      await expect(app.grid(id)).toBeVisible();
    }
    // The result is real: the keyed query returns id and name, the other only name, both for customer 1.
    await expect(app.grid("q1").getByRole("columnheader")).toHaveText([/id/, /name/]);
    await expect(app.grid("q2").getByRole("columnheader")).toHaveText([/name/]);
    await expect(app.grid("q1").getByRole("row")).toHaveCount(2); // header + one row
    await expect(app.grid("q1").getByRole("gridcell").nth(0)).toHaveText("1");
    const oldName = (await app.grid("q2").getByRole("gridcell").nth(0).innerText()).trim();
    expect(oldName.length).toBeGreaterThan(0);
    await expect(app.grid("q1").getByRole("gridcell").nth(1)).toHaveText(oldName);

    const NEW = "PK Result Probe";
    await app.pane("c").getByRole("button", { name: "Edit name" }).click();
    await app.pane("c").getByRole("textbox", { name: "name" }).fill(NEW);
    await page.keyboard.press("Enter");
    await expect(app.pane("c")).toContainText(NEW);
    await expect(app.pane("q1")).toContainText(NEW);
    // The result without a key never learns which customer it came from: it keeps the old name.
    await expect(app.pane("q2")).not.toContainText(NEW);
    await expect(app.grid("q2").getByRole("gridcell").nth(0)).toHaveText(oldName);
    await app.shot("12-data-limit");
  });

  test("the query preset runs on load and charts its own result handle", async ({ app }) => {
    await app.open();
    await app.preset("Query + chart + inspector");
    await expect(app.grid("query")).toBeVisible({ timeout: 20_000 });
    await expect(app.pane("chart").getByRole("img", { name: /Bar chart/ })).toBeVisible({
      timeout: 20_000,
    });
    expect(await app.visibleCount()).toBe(3);
    await app.shot("13-query-chart-preset");
  });

  test("a pane in a background tab does not refetch", async ({ app, page }) => {
    await app.open({ path: linkTo(tabLayout(false)) });
    const alone = await app.settle();
    await app.open({ path: linkTo(tabLayout(true)) });
    const withHidden = await app.settle();
    // Same data layer cold start in each page load, so the counts are comparable.
    console.log(
      `hidden tab: fetches with the pane alone ${alone}, with a second pane in a background tab ${withHidden}`,
    );
    expect(withHidden).toBeLessThanOrEqual(alone);
    await expect(app.pane("t2")).toBeHidden();
    // Switching to the tab wakes it: now it fetches.
    await page.getByRole("tab", { name: /suppliers/ }).click();
    await expect(app.grid("t2")).toBeVisible({ timeout: 10_000 });
    const woken = await app.settle();
    console.log(`hidden tab: after switching to it ${woken}`);
    expect(woken).toBeGreaterThan(withHidden);
  });
});
