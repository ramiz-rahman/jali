/**
 * What is kept on this device is never trusted: the plan and each pane's own state are checked as they are read,
 * and a damaged value gives the default instead of breaking the app (src/stored.ts, `readPlan`). Each test seeds
 * hostile storage, loads the app and uses it, and fails on any uncaught error.
 */
import { expect, test, type Page } from "@playwright/test";

const PLAN = "trips:plan:v2";
const PANE_STATE = "trips-thailand:pane-state";

const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

/** Errors thrown on the page or written to its console, from now on. */
function errors(page: Page): string[] {
  const seen: string[] = [];
  page.on("pageerror", (e) => seen.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(m.text());
  });
  return seen;
}

/** Load the app with `items` in storage (raw strings, as a hand edit or an older version would leave them). */
async function loadWith(page: Page, items: Record<string, string>) {
  await page.goto("/");
  await page.evaluate((items) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, items);
  await page.reload();
}

/** The app is up and in use: the overview, a day's stops, and every layout. */
async function expectWorking(page: Page) {
  await expect(page.getByRole("listbox", { name: "Days" })).toBeVisible();
  await expect(pane(page, "day").locator(".day-title")).toHaveText("Temples of the old city");
  await expect(pane(page, "day").locator(".stop-item")).toHaveCount(7);
  for (const name of ["Days", "Stay", "Budget", "Plan"]) {
    await layout(page, name).click();
    await expect(layout(page, name)).toHaveAttribute("aria-pressed", "true");
  }
}

const bundled = async (page: Page) =>
  JSON.parse((await page.evaluate((k) => localStorage.getItem(k), PLAN)) ?? "null");

const hostilePlans: Record<string, string> = {
  "no hotels or days and modes: null": JSON.stringify({
    version: 2,
    budget: 1150,
    hotels: {},
    days: [],
    modes: null,
  }),
  "not JSON": "{plan",
  "a number": "42",
  "days of nulls": JSON.stringify({
    version: 2,
    name: "Thailand",
    budget: 1150,
    hotels: { bkk: "h-riverside", hkt: "h-kata" },
    days: [null, null, null, null, null, null, null],
    modes: {},
  }),
  "a stop that isn't a place": JSON.stringify({
    version: 2,
    name: "Thailand",
    budget: "lots",
    hotels: { bkk: "h-riverside", hkt: "h-kata" },
    days: Array.from({ length: 7 }, () => ({ stops: [{ id: "wat-pho" }] })),
    modes: { "wat-arun|wat-pho": { mode: "taxi" } },
  }),
};

for (const [name, raw] of Object.entries(hostilePlans)) {
  test(`a stored plan with ${name} gives the bundled trip`, async ({ page }) => {
    const seen = errors(page);
    await loadWith(page, { [PLAN]: raw });
    await expectWorking(page);
    expect(seen).toEqual([]);
  });
}

test("a stored plan with modes: null but otherwise whole gives the bundled trip", async ({
  page,
}) => {
  const seen = errors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // Make the plan the app itself saves, then damage only its modes.
  await pane(page, "day")
    .getByRole("button", { name: /Optimise/ })
    .click();
  const saved = await bundled(page);
  await loadWith(page, { [PLAN]: JSON.stringify({ ...saved, modes: null }) });
  await expectWorking(page);
  expect(seen).toEqual([]);
});

/** Every value in each pane's kept state replaced by one of the wrong shape, then a reload. */
async function damagePaneState(page: Page) {
  // Jali saves pane state a moment after it changes.
  const stored = () =>
    page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k) ?? "{}") as Record<string, Record<string, unknown>>,
      PANE_STATE,
    );
  // Jali saves 400 ms after the last change: two reads 500 ms apart that agree mean nothing is waiting.
  let last = "";
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await stored());
        const settled = now === last && now !== "{}";
        last = now;
        return settled;
      },
      { intervals: [500] },
    )
    .toBe(true);
  // A number for a cursor or a view, a half-filter, a filter from another city, a list, a flag.
  const values = [42, { city: "lisbon" }, ["day"], { within: "far" }, true];
  const damaged = Object.fromEntries(
    Object.entries(await stored()).map(([id, s], i) => [
      id,
      Object.fromEntries(Object.keys(s).map((k, j) => [k, values[(i + j) % values.length]])),
    ]),
  );
  // Written as the reloaded page starts, not before it: the page being left saves its pane state as it goes
  // (pagehide), which would write over it.
  await page.addInitScript(({ k, v }) => localStorage.setItem(k, v), {
    k: PANE_STATE,
    v: JSON.stringify(damaged),
  });
  await page.reload();
}

test("damaged pane state gives each pane its own defaults", async ({ page }) => {
  const seen = errors(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // A cursor in a day and in the overview.
  await pane(page, "day").locator(".stop-main").nth(2).click();
  await page.getByRole("listbox", { name: "Days" }).getByRole("option").nth(2).click();
  await damagePaneState(page);
  await expect(page.getByRole("listbox", { name: "Days" })).toBeVisible();
  await expect(pane(page, "day").locator(".stop-item").first()).toBeVisible();
  // Explore's filters.
  await layout(page, "Stay").click();
  await pane(page, "explore").getByRole("button", { name: "Phuket", exact: true }).click();
  await damagePaneState(page);
  await expect(pane(page, "explore").locator(".explore-count")).toContainText("in Bangkok");
  // The budget's view.
  await layout(page, "Budget").click();
  await pane(page, "budget").getByRole("button", { name: "By category" }).click();
  await damagePaneState(page);
  await expect(pane(page, "budget").getByRole("button", { name: "By day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await layout(page, "Plan").click();
  await expectWorking(page);
  expect(seen).toEqual([]);
});
