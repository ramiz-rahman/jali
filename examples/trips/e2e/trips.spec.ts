import { expect, test, type Page } from "@playwright/test";

const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

test("a plan saved by the old Lisbon version doesn't break the app", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "trips:plan",
      JSON.stringify({
        version: 1,
        city: "Lisbon",
        budget: 950,
        hotel: "h-ribeira",
        days: [],
        modes: {},
      }),
    ),
  );
  // A Lisbon link, too: its place is not in this trip.
  await page.goto("/?preset=plan");
  await expect(page.getByRole("heading", { name: "Thailand" })).toBeVisible();
  await expect(pane(page, "day").locator(".day-title")).toHaveText("Temples of the old city");
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Days" })).toBeVisible();
});

test("the map renders, and a pin selects its place everywhere", async ({ page }) => {
  await expect(pane(page, "map").locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.locator('.pin[aria-label="Day 1, stop 4: Wat Pho"]').click();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Wat Pho");
  await expect(pane(page, "day").locator(".stop-item[data-current] .stop-name")).toHaveText(
    "Wat Pho",
  );
  // The place pane beside the map shows it, so the map keeps clear of its own card; the pin wears the photo.
  await expect(pane(page, "map").locator(".pin[data-selected]")).toHaveAttribute(
    "aria-label",
    /Wat Pho/,
  );
  await expect(pane(page, "map").locator(".map-card")).toHaveCount(0);
});

/** Panes whose Jali wrapper scrolls by itself: then the pane can slide off its content, leaving it blank. */
const wrappersThatScroll = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".jali-pane-content-inner")]
      .filter((el) => el.clientHeight && el.scrollHeight > el.clientHeight + 1)
      .map((el) => el.closest(".jali-pane")?.getAttribute("data-kind") ?? "?"),
  );

test("no pane can scroll off its content, in any layout", async ({ page }) => {
  for (const name of ["Plan", "Days", "Stay", "Budget"]) {
    await layout(page, name).click();
    await expect(layout(page, name)).toHaveAttribute("aria-pressed", "true");
    expect(await wrappersThatScroll(page), name).toEqual([]);
  }
  await layout(page, "Days").click();
  await pane(page, "day-1").locator(".day-more-add").first().click();
  expect(await wrappersThatScroll(page), "after adding a stop").toEqual([]);
});

test("the foot of a day offers what is close to it, one press from being on it", async ({
  page,
}) => {
  const day = pane(page, "day");
  const more = day.getByRole("region", { name: "Close to this day" });
  const first = more.locator(".day-more-name").first();
  const name = (await first.textContent())!;
  await more.getByRole("button", { name: `Add ${name} to Day 1` }).click();
  await expect(day.locator(".stop-name").last()).toHaveText(name);
  await expect(more.locator(".day-more-name").first()).not.toHaveText(name);
});

test("a place shows its photo, credited; a made-up hotel's says it is a stand-in", async ({
  page,
}) => {
  await page.locator('.pin[aria-label="Day 1, stop 4: Wat Pho"]').click();
  const hero = pane(page, "place").locator(".place-hero img");
  await expect(hero).toHaveAttribute("alt", /Reclining Buddha/);
  await expect
    .poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(pane(page, "place").locator(".place-standin")).toHaveCount(0);
  await pane(page, "place").getByRole("button", { name: "Photo credit" }).click();
  await expect(pane(page, "place").locator(".photo-credit")).toContainText("Wikimedia Commons");
  // The selected pin wears the place's photo.
  await expect(pane(page, "map").locator(".pin-photo img")).toHaveAttribute(
    "src",
    /wat-pho-s\.webp$/,
  );

  await pane(page, "overview")
    .getByRole("button", { name: /Riverside Teak House/ })
    .click();
  await expect(page.locator(".place-standin").first()).toHaveText("Stand-in photo");
});

test("the overview drives the day and the map; arrow keys pan the map and F6 still moves focus", async ({
  page,
}) => {
  const days = page.getByRole("listbox", { name: "Days" });
  await days.getByRole("option", { name: /Chinatown, silk and the park/ }).click();
  await expect(pane(page, "day").locator(".day-title")).toHaveText("Chinatown, silk and the park");
  await expect(pane(page, "map").locator(".jali-pane-header")).toContainText("Map of Day 2");

  const canvas = pane(page, "map").locator("canvas.maplibregl-canvas");
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(canvas).toBeFocused();
  await page.keyboard.press("F6");
  await expect(canvas).not.toBeFocused();
});

test("optimise a day, then undo it", async ({ page }) => {
  const day = pane(page, "day");
  const first = await day.locator(".stop-name").allTextContents();
  await day.getByRole("button", { name: /Optimise the order to save/ }).click();
  await expect(page.getByText(/Day 1: \d+ min less travel/)).toBeVisible();
  await expect(day.getByText("In its quickest order")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect(day.locator(".stop-name")).toHaveText(first);
});

/** Drag the first stop of `from` onto the second stop of `to`, by its handle, as a person would. */
async function dragStop(page: Page, from: string, to: string) {
  const handle = pane(page, from).locator(".stop-handle").first();
  const target = pane(page, to).locator(".stop-item").nth(1);
  const h = (await handle.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 40, h.y + 30, { steps: 4 });
  await page.mouse.move(t.x + 80, t.y + 8, { steps: 8 });
  await page.mouse.up();
}

/** Whether a pane shows whole in the week's strip (Days), not cut by its edges. */
const wholeInWeek = (page: Page, id: string) =>
  page.evaluate((id) => {
    const p = document.querySelector(`.jali-pane[data-pane="${id}"]`)!.getBoundingClientRect();
    const s = document.querySelector('[data-strip="week"]')!.getBoundingClientRect();
    // A frame's border sits a px outside its rect.
    return p.left >= s.left - 3 && p.right <= s.right + 3;
  }, id);

/** Open a day from the overview: its pane in the week glides into view. */
async function openDay(page: Page, title: RegExp) {
  const row = page.getByRole("listbox", { name: "Days" }).getByRole("option", { name: title });
  await row.click();
  await row.click();
}

/** Drag a stop from `from` and hold it at the week's right edge until `to` scrolls into view, then drop it there. */
async function dragStopAcross(page: Page, from: string, to: string) {
  const h = (await pane(page, from).locator(".stop-handle").first().boundingBox())!;
  const s = (await page.locator('[data-strip="week"]').boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 40, h.y + 30, { steps: 4 });
  await page.mouse.move(s.x + s.width - 12, h.y + 30, { steps: 8 });
  await expect.poll(() => wholeInWeek(page, to), { timeout: 8000 }).toBe(true);
  const t = (await pane(page, to).locator(".stop-item").nth(1).boundingBox())!;
  await page.mouse.move(t.x + 80, t.y + 8, { steps: 8 });
  await page.mouse.up();
}

test("Days keeps the whole week at a comfortable width, in a row that scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await layout(page, "Days").click();
  // Seven days, none folded into tabs, each at its comfortable width.
  await expect(page.locator('.jali-pane[data-kind="day"]')).toHaveCount(7);
  for (let n = 1; n <= 7; n++)
    expect((await pane(page, `day-${n}`).boundingBox())!.width).toBeGreaterThanOrEqual(355);
  await expect(page.getByText(/\d+ folded/)).toHaveCount(0);
  expect(await wholeInWeek(page, "day-1")).toBe(true);
  expect(await wholeInWeek(page, "day-7")).toBe(false);
  // A sideways swipe over the week scrolls it.
  const s = (await page.locator('[data-strip="week"]').boundingBox())!;
  const before = (await pane(page, "day-2").boundingBox())!.x;
  await page.mouse.move(s.x + s.width / 2, s.y + 300);
  await page.mouse.wheel(300, 0);
  await expect
    .poll(async () => (await pane(page, "day-2").boundingBox())!.x)
    .toBeLessThan(before - 200);
  // Opening a day from the overview brings it wholly into view.
  await openDay(page, /The north/);
  await expect.poll(() => wholeInWeek(page, "day-7")).toBe(true);
  await openDay(page, /Temples of the old city/);
  await expect.poll(() => wholeInWeek(page, "day-1")).toBe(true);
});

test("drag a stop from one Phuket day to another; a Bangkok stop can't go to Phuket", async ({
  page,
}) => {
  await layout(page, "Days").click();
  // Day 6 from the overview, then its first stop held at the week's edge until Day 7 slides in.
  await openDay(page, /Beaches of the south/);
  await expect.poll(() => wholeInWeek(page, "day-6")).toBe(true);
  await dragStopAcross(page, "day-6", "day-7");
  await expect(pane(page, "day-7").locator(".stop-name").nth(1)).toHaveText("Promthep Cape");
  await expect(pane(page, "day-6").locator(".stop-name")).not.toContainText(["Promthep Cape"]);

  await openDay(page, /Temples of the old city/);
  await expect.poll(() => wholeInWeek(page, "day-1")).toBe(true);
  await dragStopAcross(page, "day-1", "day-7");
  await expect(page.getByText("Wat Arun is in Bangkok, and Day 7 is in Phuket")).toBeVisible();
  await expect(pane(page, "day-1").locator(".stop-name").first()).toHaveText("Wat Arun");
});

test("the transfer day starts in Bangkok, flies, and goes on in Phuket", async ({ page }) => {
  await page
    .getByRole("listbox", { name: "Days" })
    .getByRole("option", { name: /Fly to Phuket/ })
    .click();
  const day = pane(page, "day");
  await expect(day.locator(".day-title")).toHaveText("Fly to Phuket");
  await expect(day.locator(".endpoint-label").first()).toHaveText("Leave Riverside Teak House");
  await expect(day.locator(".leg-flight")).toContainText("1h 25m flight");
  await expect(day.locator(".endpoint-label").last()).toHaveText(
    "Check in at Kata Hillside Bungalows",
  );
});

test("a layout switches, and a reload keeps it and the place compared from the address", async ({
  page,
}) => {
  await layout(page, "Stay").click();
  const results = page.getByRole("listbox", { name: "Places" });
  await results.getByRole("option", { name: /Sukhumvit Bamboo Rooms/ }).click();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Sukhumvit Bamboo Rooms");
  // The kept hotel stays for comparing.
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Riverside Teak House");
  // …and the one beside it is read against it.
  await expect(pane(page, "place").locator(".place-compare")).toHaveText(
    "Compared with Riverside Teak House, kept beside",
  );
  await expect(pane(page, "place").locator(".delta").first()).toHaveText("\u2212$15");
  expect(new URL(page.url()).searchParams.get("l")).toBeTruthy();

  await page.reload();
  await expect(layout(page, "Stay")).toHaveAttribute("aria-pressed", "true");
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Sukhumvit Bamboo Rooms");
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Riverside Teak House");
  // The map starts on the place its place pane shows (the selection itself is not in the address).
  await expect(pane(page, "map").locator(".pin[data-selected]")).toHaveAttribute(
    "aria-label",
    /Sukhumvit Bamboo Rooms/,
  );
});

test("⌘K: Go to place… asks in Jali's chooser and shows the place", async ({ page }) => {
  await page.getByRole("listbox", { name: "Days" }).focus();
  await page.keyboard.press("/");
  const input = page.getByRole("combobox", { name: "Go to place…" });
  await expect(input).toBeFocused();
  await input.fill("buddha");
  await page.keyboard.press("Enter");
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Big Buddha");
});

test("on a phone: the map, a pin, and the place under the map", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.locator(".jali-switcher").getByText("Map of Day 1").tap();
  await expect(pane(page, "map").locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.locator('.pin[aria-label^="Day 1, stop 6"]').tap();
  await page.getByRole("button", { name: "Details" }).tap();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Pak Khlong Talat");
  await ctx.close();
});
