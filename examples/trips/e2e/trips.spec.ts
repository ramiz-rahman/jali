import { expect, test, type Page } from "@playwright/test";

const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

test("a plan saved by the old Lisbon version doesn't break the app", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "trips:plan",
      JSON.stringify({ version: 1, city: "Lisbon", budget: 950, hotel: "h-ribeira", days: [], modes: {} }),
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
  await expect(pane(page, "map").locator(".map-card-name")).toHaveText("Wat Pho");
  await expect(pane(page, "day").locator(".stop-item[data-current] .stop-name")).toHaveText("Wat Pho");
});

test("the overview drives the day and the map; arrow keys pan the map and F6 still moves focus", async ({ page }) => {
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
  await day.getByRole("button", { name: /Optimise order, save/ }).click();
  await expect(page.getByText(/Day 1: \d+ min less travel/)).toBeVisible();
  await expect(day.getByRole("button", { name: "In its quickest order" })).toBeDisabled();
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

test("drag a stop from one Phuket day to another; a Bangkok stop can't go to Phuket", async ({ page }) => {
  await layout(page, "Days").click();
  await expect(pane(page, "day-7")).toBeVisible();
  await dragStop(page, "day-6", "day-7");
  await expect(pane(page, "day-7").locator(".stop-name").nth(1)).toHaveText("Promthep Cape");
  await expect(pane(page, "day-6").locator(".stop-name")).not.toContainText(["Promthep Cape"]);

  await dragStop(page, "day-1", "day-7");
  await expect(page.getByText("Wat Arun is in Bangkok, and Day 7 is in Phuket")).toBeVisible();
  await expect(pane(page, "day-1").locator(".stop-name").first()).toHaveText("Wat Arun");
});

test("the transfer day starts in Bangkok, flies, and goes on in Phuket", async ({ page }) => {
  await page.getByRole("listbox", { name: "Days" }).getByRole("option", { name: /Fly to Phuket/ }).click();
  const day = pane(page, "day");
  await expect(day.locator(".day-title")).toHaveText("Fly to Phuket");
  await expect(day.locator(".endpoint-label").first()).toHaveText("Leave Riverside Teak House");
  await expect(day.locator(".leg-flight")).toContainText("1h 25m flight");
  await expect(day.locator(".endpoint-label").last()).toHaveText("Check in at Kata Hillside Bungalows");
});

test("a layout switches, and a reload keeps it and the place compared from the address", async ({ page }) => {
  await layout(page, "Stay").click();
  const results = page.getByRole("listbox", { name: "Places" });
  await results.getByRole("option", { name: /Sukhumvit Bamboo Rooms/ }).click();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Sukhumvit Bamboo Rooms");
  // The kept hotel stays for comparing.
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Riverside Teak House");
  expect(new URL(page.url()).searchParams.get("l")).toBeTruthy();

  await page.reload();
  await expect(layout(page, "Stay")).toHaveAttribute("aria-pressed", "true");
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Sukhumvit Bamboo Rooms");
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Riverside Teak House");
  // The map starts on the place its place pane shows (the selection itself is not in the address).
  await expect(pane(page, "map").locator(".map-card-name")).toHaveText("Sukhumvit Bamboo Rooms");
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.locator(".jali-switcher").getByText("Map of Day 1").tap();
  await expect(pane(page, "map").locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.locator('.pin[aria-label^="Day 1, stop 6"]').tap();
  await page.getByRole("button", { name: "Details" }).tap();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Pak Khlong Talat");
  await ctx.close();
});
