import type { Page } from "@playwright/test";
import { expect, test } from "../../shared/e2e/quality";

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

test("pins that would cover each other make one pile, which names them and opens when pressed", async ({
  page,
}) => {
  // Budget's small map frames Day 7, which spans the north of Phuket: its stops crowd at that zoom.
  await layout(page, "Budget").click();
  const map = pane(page, "map");
  const pile = map.locator('.pin[data-role="stop"][data-more]').first();
  await expect(pile).toBeVisible();
  const name = (await pile.getAttribute("aria-label")) ?? "";
  const more = Number((await pile.getAttribute("data-more"))?.slice(1));
  // It says how many it stands for, and names each, so a screen reader hears what the eye can't see.
  const hidden = /Also here: (.+)\. Press to zoom in to them\.$/.exec(name)?.[1]?.split("; ") ?? [];
  expect(hidden).toHaveLength(more);
  const first = map.locator(`.pin[data-label="${hidden[0]}"]`);
  await expect(first).toBeHidden();
  await pile.click();
  await expect(first).toBeVisible();
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
  const more = day.locator("section.day-more");
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

  const canvas = pane(page, "map").getByRole("region", { name: /^Map\. Arrow keys pan/ });
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

test("the week keeps its place in the link: a reload reopens where it was scrolled", async ({
  page,
}) => {
  await layout(page, "Days").click();
  const s = (await page.locator('[data-strip="week"]').boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + 300);
  await page.mouse.wheel(500, 0);
  await expect.poll(() => new URL(page.url()).searchParams.get("scroll")).toMatch(/^week:\d+$/);
  const at = (await pane(page, "day-3").boundingBox())!.x;
  await page.reload();
  await expect(layout(page, "Days")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await pane(page, "day-3").boundingBox())!.x).toBeCloseTo(at, 0);
});

test("a day dragged by its header and held at the week's edge scrolls on, and drops on a day out of view", async ({
  page,
}) => {
  await layout(page, "Days").click();
  const h = (await pane(page, "day-1").locator(".jali-pane-header").boundingBox())!;
  const s = (await page.locator('[data-strip="week"]').boundingBox())!;
  await page.mouse.move(h.x + 60, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + 90, h.y + 30, { steps: 5 });
  await page.mouse.move(s.x + s.width - 12, s.y + 200, { steps: 8 });
  await expect.poll(() => wholeInWeek(page, "day-7"), { timeout: 8000 }).toBe(true);
  // Onto Day 7's left half: Day 1 goes just before it.
  const t = (await pane(page, "day-7").boundingBox())!;
  await page.mouse.move(t.x + 30, t.y + t.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => {
      const x = async (id: string) => (await pane(page, id).boundingBox())!.x;
      return (await x("day-6")) < (await x("day-1")) && (await x("day-1")) < (await x("day-7"));
    })
    .toBe(true);
});

test("a pane split off a day at the week's edge scrolls into view", async ({ page }) => {
  await layout(page, "Days").click();
  // Day 2 ends at the week's right edge; a pane opened beside it lands past the edge, so the week scrolls to it.
  await pane(page, "day-2")
    .locator(".jali-pane-header")
    .click({ position: { x: 120, y: 20 } });
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("Split right");
  await page.keyboard.press("Enter");
  const opened = page.locator('.jali-strip .jali-pane[data-kind="launcher"]');
  await expect(opened).toHaveCount(1);
  const id = (await opened.getAttribute("data-pane"))!;
  await expect.poll(() => wholeInWeek(page, id)).toBe(true);
});

/** The day's stop pins inside the map's box. */
const stopPinsInView = (page: Page) =>
  page.evaluate(() => {
    const m = document
      .querySelector('.jali-pane[data-kind="map"] .map-canvas')!
      .getBoundingClientRect();
    return [...document.querySelectorAll(".pin[data-role=stop]")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left > m.left && r.right < m.right && r.top > m.top && r.bottom < m.bottom;
    }).length;
  });

test("a layout's own selection keeps the map framed on the day; a place the person picks flies there", async ({
  page,
}) => {
  await expect.poll(() => stopPinsInView(page)).toBe(7);
  // Stay brings its own hotel into the place pane, and Jali selects it on the map: the layout's word, not a pick.
  await layout(page, "Stay").click();
  await expect(pane(page, "map").locator(".pin[data-selected]")).toHaveAttribute(
    "aria-label",
    /Silom/,
  );
  await expect(pane(page, "place").locator(".place-name")).toHaveText("Silom Lantern Hotel");
  // The map would move in the frames after the selection (the tests run with reduced motion, so a move is a jump):
  // let them pass, then check it stayed on the day.
  await page.evaluate(
    () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))),
  );
  expect(await stopPinsInView(page)).toBe(7);
  // Picking a hotel across town brings it into view.
  await pane(page, "explore")
    .getByRole("button", { name: /^Ari Garden Loft/ })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const m = document
          .querySelector('.jali-pane[data-kind="map"] .map-canvas')!
          .getBoundingClientRect();
        const r = document.querySelector(".pin[data-selected]")!.getBoundingClientRect();
        return r.left > m.left && r.right < m.right && r.top > m.top && r.bottom < m.bottom;
      }),
    )
    .toBe(true);
});

test("a day comes out of the week by its header, onto the side of a pane beside it", async ({
  page,
}) => {
  await layout(page, "Days").click();
  const header = (await pane(page, "day-2").locator(".jali-pane-header").boundingBox())!;
  const map = (await pane(page, "map").boundingBox())!;
  await page.mouse.move(header.x + 60, header.y + header.height / 2);
  await page.mouse.down();
  await page.mouse.move(header.x + 90, header.y + 30, { steps: 5 });
  // Over the map's left edge, where days scrolled out of the week lie hidden under it.
  await page.mouse.move(map.x + 30, map.y + map.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.jali-strip .jali-pane[data-pane="day-2"]')).toHaveCount(0);
  await expect(pane(page, "day-2")).toBeVisible();
  await expect(page.locator('.jali-strip .jali-pane[data-kind="day"]')).toHaveCount(6);
});

test("the divider beside the week widens the overview, and the days keep their width", async ({
  page,
}) => {
  await layout(page, "Days").click();
  const overview = (await pane(page, "overview").boundingBox())!.width;
  const week = (await page.locator('[data-strip="week"]').boundingBox())!.width;
  const day1 = (await pane(page, "day-1").boundingBox())!.width;
  const divider = page.getByRole("separator").first();
  await divider.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await expect
    .poll(async () => (await pane(page, "overview").boundingBox())!.width)
    .toBeGreaterThan(overview + 30);
  const grown = (await pane(page, "overview").boundingBox())!.width - overview;
  expect((await page.locator('[data-strip="week"]').boundingBox())!.width).toBeCloseTo(
    week - grown,
    0,
  );
  expect((await pane(page, "day-1").boundingBox())!.width).toBeCloseTo(day1, 0);
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
  const results = page.getByRole("list", { name: "Places" });
  await results.getByRole("button", { name: /^Sukhumvit Bamboo Rooms/ }).click();
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

test("a city's badge frames the hotel the person stays at now, not the one the badge was made with", async ({
  page,
}) => {
  // Bangkok's days without stops, so its badge frames the hotel alone: the plan as the app saves it (after a
  // change), with those days emptied.
  await pane(page, "day")
    .getByRole("button", { name: /Optimise the order to save/ })
    .click();
  await page.evaluate(() => {
    const plan = JSON.parse(localStorage.getItem("trips:plan:v2") ?? "{}");
    for (const d of plan.days) if (d.city === "bkk") d.stops = [];
    localStorage.setItem("trips:plan:v2", JSON.stringify(plan));
  });
  await page.reload();
  // The whole trip: a badge for each city.
  const map = pane(page, "map");
  await map.getByRole("button", { name: "All", exact: true }).click();
  const badge = map.getByRole("button", { name: /^Bangkok, Days 1 to 3/ });
  await expect(badge).toBeVisible();
  // Move to a hotel in the north of Bangkok, far from the old one, with the map on screen throughout.
  await page.getByRole("listbox", { name: "Days" }).focus();
  await page.keyboard.press("/");
  await page.getByRole("combobox", { name: "Go to place…" }).fill("Ari Garden");
  await page.keyboard.press("Enter");
  await pane(page, "place")
    .getByRole("button", { name: /Stay here instead/ })
    .click();
  // The map flew to the hotel; back to the whole trip.
  await map.getByRole("button", { name: "1", exact: true }).click();
  await map.getByRole("button", { name: "All", exact: true }).click();
  await badge.click();
  const hotel = map.locator('.pin[data-role="hotel"][data-id="h-ari"]');
  await expect
    .poll(() =>
      hotel.evaluate((pin) => {
        const m = pin.closest(".map-canvas")?.getBoundingClientRect();
        const r = pin.getBoundingClientRect();
        return !!m && r.left > m.left && r.right < m.right && r.top > m.top && r.bottom < m.bottom;
      }),
    )
    .toBe(true);
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
