import { expect, test, type Page } from "@playwright/test";

const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Days" })).toBeVisible();
});

test("the map renders, and a pin selects its place everywhere", async ({ page }) => {
  await expect(pane(page, "map").locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.locator('.pin[aria-label="Day 1, stop 5: Sé de Lisboa"]').click();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Sé de Lisboa");
  await expect(pane(page, "map").locator(".map-card-name")).toHaveText("Sé de Lisboa");
  await expect(pane(page, "day").locator('.stop-item[data-current] .stop-name')).toHaveText("Sé de Lisboa");
});

test("the overview drives the day and the map; arrow keys pan the map and F6 still moves focus", async ({ page }) => {
  const days = page.getByRole("listbox", { name: "Days" });
  await days.getByRole("option", { name: /Belém by the river/ }).click();
  await expect(pane(page, "day").locator(".day-title")).toHaveText("Belém by the river");
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

test("drag a stop from one day to another in the Days layout", async ({ page }) => {
  await layout(page, "Days").click();
  const from = pane(page, "day-1");
  const to = pane(page, "day-4");
  await expect(to).toBeVisible();
  const handle = from.locator(".stop-handle").first();
  const target = to.locator(".stop-item").nth(1);
  const h = (await handle.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 40, h.y + 30, { steps: 4 });
  await page.mouse.move(t.x + 80, t.y + 8, { steps: 8 });
  await page.mouse.up();
  await expect(to.locator(".stop-name").nth(1)).toHaveText("Praça do Comércio");
  await expect(from.locator(".stop-name")).not.toContainText(["Praça do Comércio"]);
});

test("a layout switches, and a reload keeps it and the place compared from the address", async ({ page }) => {
  await layout(page, "Stay").click();
  const results = page.getByRole("listbox", { name: "Places" });
  await results.getByRole("option", { name: /Graça Terrace Inn/ }).click();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Graça Terrace Inn");
  // The kept hotel stays for comparing.
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Ribeira Loft Rooms");
  expect(new URL(page.url()).searchParams.get("l")).toBeTruthy();

  await page.reload();
  await expect(layout(page, "Stay")).toHaveAttribute("aria-pressed", "true");
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Graça Terrace Inn");
  await expect(pane(page, "place-kept").locator(".place-name")).toHaveText("Ribeira Loft Rooms");
  // The map starts on the place its place pane shows (the selection itself is not in the address).
  await expect(pane(page, "map").locator(".map-card-name")).toHaveText("Graça Terrace Inn");
});

test("⌘K: Go to place… asks in Jali's chooser and shows the place", async ({ page }) => {
  await page.getByRole("listbox", { name: "Days" }).focus();
  await page.keyboard.press("/");
  const input = page.getByRole("combobox", { name: "Go to place…" });
  await expect(input).toBeFocused();
  await input.fill("ocean");
  await page.keyboard.press("Enter");
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Oceanário de Lisboa");
});

test("on a phone, one pane at a time: the map, a pin, and the place", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.locator(".jali-switcher").getByText("Map of Day 1").tap();
  await expect(pane(page, "map").locator("canvas.maplibregl-canvas")).toBeVisible();
  await page.locator('.pin[aria-label^="Day 1, stop 6"]').tap();
  await page.getByRole("button", { name: "Details" }).tap();
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Miradouro de Santa Luzia");
  await ctx.close();
});
