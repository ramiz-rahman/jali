/**
 * What a link can and can't do to the query and chart panes: a link's SQL never runs by itself (`autorun` is app-only,
 * so no link carries it), the app's own preset query does, and a chart whose result is from an earlier visit says so.
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
  await expect(query(page)).toContainText("No results yet");
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

test("an edited draft of the preset's query waits for Run after a reload, and the preset's SQL doesn't run in its place", async ({
  page,
}) => {
  await openPreset(page, "Query + chart + inspector");
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
  const editor = query(page).getByRole("textbox", { name: "SQL" });
  await editor.fill("SELECT 'from the draft' AS said");
  // Pane state is saved once typing settles.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) => localStorage.getItem(k)?.includes("from the draft")),
      ),
    )
    .toBe(true);
  await page.reload();
  await loaded(page);

  // The draft is kept, and nothing ran: not the draft, and not the preset's SQL behind it.
  await expect(editor).toHaveValue("SELECT 'from the draft' AS said");
  await expect(query(page)).toContainText("This query hasn't run");
  await expect(query(page).getByRole("grid")).toHaveCount(0);

  await query(page).getByRole("button", { name: /^Run/ }).click();
  await expect(query(page).getByRole("grid", { name: "Query results" })).toContainText(
    "from the draft",
  );
});

test("a chart whose result is from an earlier visit says so, and how to get it back", async ({
  page,
}) => {
  await openPreset(page, "Query + chart + inspector");
  await expect(chart(page).getByRole("img", { name: /Bar chart/ })).toBeVisible();
  // A link that carries a run id (the address no longer does, but an old link may), and a query that isn't the
  // preset's own, so it waits: nothing makes a new result for the chart.
  const link = relink(page, (n) => {
    if (n.r?.[0] === "query") n.r[1] = { sql: "SELECT 1 AS one" };
    if (n.r?.[0] === "chart") n.r[1] = { runId: "an-earlier-visit-1" };
  });
  await page.goto(link);
  await loaded(page);
  await expect(chart(page)).toContainText("This chart's result is from an earlier visit");
});
