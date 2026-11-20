/**
 * What a link can and can't do to the query and chart panes: a link's SQL never runs by itself, the app's own preset
 * query does, and a chart whose result is from an earlier visit says so.
 */
import type { Page } from "@playwright/test";
import { expect, test } from "../../shared/e2e/quality";
import { loaded, openPreset } from "./open";

type Packed = { r?: [string, Record<string, unknown>]; n?: Packed[] };

/** The address with its `?l=` layout changed by `edit`, as a link someone could send. */
function relink(page: Page, edit: (pane: Packed) => void) {
  const url = new URL(page.url());
  const l = url.searchParams.get("l") ?? "";
  const data = JSON.parse(Buffer.from(l.slice(2), "base64url").toString("utf8")) as [
    number,
    Packed,
  ];
  const walk = (n: Packed) => {
    edit(n);
    n.n?.forEach(walk);
  };
  walk(data[1]);
  url.searchParams.set("l", `1.${Buffer.from(JSON.stringify(data)).toString("base64url")}`);
  return `${url.pathname}${url.search}`;
}

const query = (page: Page) => page.locator('section[data-pane="query"]');
const chart = (page: Page) => page.locator('section[data-pane="chart"]');

test("a link's own SQL is shown, not run, even when the link asks for it to run", async ({
  page,
}) => {
  await openPreset(page, "Query + chart + inspector");
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
  const link = relink(page, (n) => {
    if (n.r?.[0] === "query") n.r[1] = { sql: "SELECT 'from a link' AS said", autorun: true };
  });

  await page.goto(link);
  await loaded(page);
  await expect(query(page).getByRole("textbox", { name: "SQL" })).toHaveValue(
    "SELECT 'from a link' AS said",
  );
  await expect(query(page)).toContainText("This query came with the link, and hasn't run");
  await expect(query(page).getByRole("grid")).toHaveCount(0);

  // The person reads it and runs it.
  await query(page).getByRole("button", { name: /^Run/ }).click();
  await expect(query(page).getByRole("grid", { name: "Query results" })).toContainText(
    "from a link",
  );
});

test("the preset's own query runs on load, so its chart comes back after a reload", async ({
  page,
}) => {
  await openPreset(page, "Query + chart + inspector");
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
  await page.reload();
  await loaded(page);
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
});

test("a chart whose result is from an earlier visit says so, and how to get it back", async ({
  page,
}) => {
  await openPreset(page, "Query + chart + inspector");
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
  // The same layout, but the query waits: nothing makes a new result for the chart.
  const link = relink(page, (n) => {
    if (n.r?.[0] === "query") delete n.r[1].autorun;
  });
  await page.goto(link);
  await loaded(page);
  await expect(chart(page)).toContainText("This chart's result is from an earlier visit");
});
