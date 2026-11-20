import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/** screens/<name>.png, beside e2e/. */
const shot = (name: string) => join(test.info().project.testDir, "..", "screens", `${name}.png`);

// The screenshots in screens/: every layout at a wide, a medium and a narrow width, a phone, and dark mode.
// Only with SCREENS=1: `SCREENS=1 pnpm exec playwright test -c examples/studio screens`.
test.skip(!process.env.SCREENS, "SCREENS=1 writes the screenshots");

const SIZES = [
  { name: "wide", width: 1440, height: 900 },
  { name: "medium", width: 1100, height: 800 },
  { name: "narrow", width: 760, height: 900 },
] as const;
const LAYOUTS = ["edit", "mix", "review", "compare"] as const;

/** Open a layout and a session, go somewhere in the middle and play a moment: every pane following it. */
/** Which session, and where in it: the landing at contact light, the song a minute in (its Mix desk), dinner at the
 *  orange. The song is reached by the timeline's keys, not by searching its words. */
type Session = "apollo" | "song" | "dinner";
const TITLES: Record<Session, string> = {
  apollo: "The Eagle has landed",
  song: "The Light caught by the Stone",
  dinner: "Never had an orange",
};

async function stage(
  page: Page,
  preset: string,
  { dark = false, session = "apollo" as Session } = {},
) {
  await page.emulateMedia({
    colorScheme: dark ? "dark" : "light",
    reducedMotion: "reduce",
  });
  await page.goto("/");
  await expect(
    page
      .getByRole("group", { name: "Transport" })
      .getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  const select = page.locator(".layout-menu select");
  if (await select.isVisible()) await select.selectOption(preset);
  else
    await page
      .getByRole("navigation", { name: "Layouts" })
      .locator("button")
      .nth(LAYOUTS.indexOf(preset as (typeof LAYOUTS)[number]))
      .click();
  await page.waitForTimeout(300);
  if (session !== "apollo") {
    await page.keyboard.press("ControlOrMeta+k");
    await page.locator(".jali-scrim").getByRole("combobox").fill("Open session");
    await page.keyboard.press("Enter");
    await page.getByRole("combobox", { name: "Open session…" }).fill(TITLES[session]);
    await page.keyboard.press("Enter");
    await expect(page.locator(".pd-title")).toHaveText(TITLES[session], { timeout: 20_000 });
  }
  if (session === "song") {
    const lanes = page.getByRole("slider", { name: /Playhead in/ });
    await lanes.focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("PageDown");
  } else {
    await page.locator("body").press("/");
    await page
      .getByRole("combobox", { name: "Go to segment…" })
      .fill(session === "apollo" ? "CONTACT LIGHT" : "met somebody recently");
    await page.keyboard.press("Enter");
  }
  await page.locator("body").press("Space");
  await page.waitForTimeout(2600);
}

for (const dark of [false, true])
  for (const size of SIZES) {
    for (const preset of LAYOUTS) {
      const d = dark ? "-dark" : "";
      test(`${preset} at ${size.name}${d}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await stage(page, preset, { dark });
        await page.screenshot({ path: shot(`${preset}-${size.name}${d}`) });
      });
    }
  }

// The song's eight groups on the Mix desk, and the dinner party's four voices talking over each other.
for (const dark of [false, true])
  for (const size of SIZES) {
    const d = dark ? "-dark" : "";
    test(`the song in Mix at ${size.name}${d}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await stage(page, "mix", { dark, session: "song" });
      await page.screenshot({ path: shot(`song-mix-${size.name}${d}`) });
    });
    for (const preset of ["edit", "review"])
      test(`dinner in ${preset} at ${size.name}${d}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await stage(page, preset, { dark, session: "dinner" });
        await page.screenshot({ path: shot(`dinner-${preset}-${size.name}${d}`) });
      });
  }

// Credits: every session's attribution, licence and notice.
for (const dark of [false, true])
  test(`credits${dark ? " dark" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stage(page, "edit", { dark, session: "dinner" });
    await page.locator("body").press("Space");
    await page.locator(".status-credits").click();
    const pane = page.locator('.jali-pane[data-kind="credits"]');
    await expect(pane).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`credits${dark ? "-dark" : ""}`) });
    await pane.screenshot({ path: shot(`credits-pane${dark ? "-dark" : ""}`) });
  });

for (const dark of [false, true])
  test(`a phone${dark ? " dark" : ""}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stage(page, "edit", { dark });
    await page.screenshot({ path: shot(`edit-phone${dark ? "-dark" : ""}`) });
  });

// The latest Jali's header: two shortcuts, the ⋯ menu, the Following/Kept latch, and the "N folded" chip.
for (const dark of [false, true]) {
  const d = dark ? "-dark" : "";
  test(`header, menu and folded chip${d}`, async ({ browser, baseURL }) => {
    const page = await browser.newPage({
      baseURL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    await stage(page, "compare", { dark });
    await page
      .locator('.jali-pane[data-kind="clip"]')
      .first()
      .locator(".jali-pane-header")
      .screenshot({ path: shot(`header-kept${d}`) });
    await page
      .locator('.jali-pane[data-kind="clip"]')
      .last()
      .locator(".jali-pane-header")
      .screenshot({ path: shot(`header-following${d}`) });
    const tl = page.locator('.jali-pane[data-kind="timeline"]');
    await tl.locator(".jali-act-menu").click();
    const menu = page.locator(".jali-tab-menu");
    await menu.locator("[data-menu-item]").nth(1).hover();
    const box = (await menu.boundingBox())!;
    await page.screenshot({
      path: shot(`pane-menu${d}`),
      clip: {
        x: box.x - 12,
        y: box.y - 12,
        width: box.width + 24,
        height: box.height + 24,
      },
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1100, height: 560 });
    await stage(page, "mix", { dark });
    const chip = page.locator(".jali-tab-folded").first();
    await chip
      .locator("xpath=ancestor::*[contains(@class,'jali-pane-header')]")
      .screenshot({ path: shot(`folded-chip${d}`) });
    await page.close();
  });
}

// Close-ups of the top row: one row of full-height blocks at every width.
for (const [name, width, height, dark] of [
  ["toprow-wide", 1440, 900, false],
  ["toprow-wide-dark", 1440, 900, true],
  ["toprow-medium", 1100, 800, false],
  ["toprow-phone", 390, 844, false],
] as const) {
  test(name, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await stage(page, "edit", { dark });
    const box = (await page.locator(".topbar").boundingBox())!;
    await page.screenshot({
      path: shot(name),
      clip: { x: 0, y: 0, width: box.width, height: box.height + 16 },
    });
  });
}

// The header-button treatments (a temporary comparison switch, ui/headerButtons.ts), each light and dark: the
// headers of the first three panes, with the pointer over the transcript's close button.
for (const [letter, variant] of [
  ["a", "printed"],
  ["b", "wells"],
  ["c", "strip"],
  ["d", "round"],
] as const) {
  for (const dark of [false, true]) {
    test(`header buttons ${variant}${dark ? " dark" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width: 1100, height: 700 });
      await page.emulateMedia({
        colorScheme: dark ? "dark" : "light",
        reducedMotion: "reduce",
      });
      await page.addInitScript(
        (v) => localStorage.setItem("studio:header-buttons", JSON.stringify(v)),
        variant,
      );
      await page.goto("/");
      await expect(page.locator(".jali-pane").first()).toBeVisible();
      await page.waitForTimeout(800);
      const box = (await page.locator(".jali-pane").first().boundingBox())!;
      await page
        .locator('.jali-pane[data-pane="transcript"] .jali-pane-actions button')
        .last()
        .hover();
      await page.screenshot({
        path: shot(`header-buttons-${letter}${dark ? "-dark" : ""}`),
        clip: { x: 0, y: box.y - 4, width: 1100, height: 60 },
      });
    });
  }
}

// The top bar at 2x device scale, light and dark: the slab's edges, grain and pockets at full resolution.
for (const dark of [false, true]) {
  test(`toprow-wide@2x${dark ? " dark" : ""}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    await stage(page, "edit", { dark });
    const box = (await page.locator(".topbar").boundingBox())!;
    await page.screenshot({
      path: shot(`toprow-wide${dark ? "-dark" : ""}@2x`),
      clip: { x: 0, y: 0, width: box.width, height: box.height + 16 },
    });
    await context.close();
  });
}

// The scrub and speed dials, close up, at 2x, light and dark.
for (const dark of [false, true]) {
  test(`rotary ${dark ? "dark" : "light"}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1700, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    await stage(page, "edit", { dark });
    const box = (await page.locator(".group-rotary").boundingBox())!;
    await page.screenshot({
      path: shot(`rotary-${dark ? "dark" : "light"}`),
      clip: {
        x: box.x - 16,
        y: box.y - 14,
        width: box.width + 32,
        height: box.height + 28,
      },
    });
    await context.close();
  });
}

// Each pane, close up, light and dark, and one mixer module at 2x.
const PANES = [
  ["mixer", "mix"],
  ["markers", "mix"],
  ["library", "edit"],
  ["transcript", "edit"],
  ["timeline", "review"],
  ["clip", "review"],
] as const;
for (const [kind, preset] of PANES) {
  for (const dark of [false, true]) {
    test(`pane ${kind}${dark ? " dark" : ""}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await stage(page, preset, { dark });
      await page
        .locator(`.jali-pane[data-kind="${kind}"]`)
        .first()
        .screenshot({
          path: shot(`pane-${kind}${dark ? "-dark" : ""}`),
        });
    });
  }
}

test("a mixer module at 2x", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  await stage(page, "mix", { dark: true });
  await page
    .locator(".mx-module")
    .nth(1)
    .screenshot({ path: shot("mixer-module@2x") });
  await context.close();
});

// The launcher and the empty, missing and failed states, light and dark.
for (const dark of [false, true]) {
  test(`states${dark ? " dark" : ""}`, async ({ page }) => {
    const d = dark ? "-dark" : "";
    await page.setViewportSize({ width: 1440, height: 900 });
    await stage(page, "mix", { dark });
    await page.keyboard.press("Space");
    const mk = page.locator('.jali-pane[data-kind="markers"]');
    await mk.getByRole("listbox", { name: "Markers" }).focus();
    for (let i = 0; i < 6; i++) await page.keyboard.press("Delete");
    await mk.screenshot({ path: shot(`state-empty-markers${d}`) });
    await page.locator('.jali-pane[data-kind="timeline"] .tl-lanes').click();
    await page.keyboard.press("ControlOrMeta+Backslash");
    await page
      .locator('.jali-pane[data-kind="launcher"]')
      .screenshot({ path: shot(`launcher${d}`) });
    // A link to a session that isn't there.
    const url = new URL(page.url());
    const l = url.searchParams.get("l")!;
    const json = Buffer.from(l.slice(2), "base64url").toString();
    url.searchParams.set(
      "l",
      `1.${Buffer.from(json.replace('["mixer",{"session":"apollo11-landing"}]', '["mixer",{"session":"gone"}]')).toString("base64url")}`,
    );
    await page.goto(url.toString());
    await page
      .locator('.jali-pane[data-kind="mixer"]')
      .screenshot({ path: shot(`state-missing${d}`) });
  });
  test(`state no audio${dark ? " dark" : ""}`, async ({ page }) => {
    await page.emulateMedia({
      colorScheme: dark ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/*.mp3", (r) => r.abort());
    await page.goto("/");
    await expect(page.locator(".pd-alert")).toHaveText("audio didn't load");
    await page
      .locator(".topbar")
      .screenshot({ path: shot(`state-no-audio${dark ? "-dark" : ""}`) });
  });
}

// A selected transcript row after a click, and after moving to it with the keyboard.
for (const dark of [false, true]) {
  test(`transcript rows${dark ? " dark" : ""}`, async ({ page }) => {
    const d = dark ? "-dark" : "";
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({
      colorScheme: dark ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.goto("/");
    const rows = page.getByRole("listbox", { name: /Transcript of/ });
    await expect(rows).toBeVisible();
    await rows
      .getByRole("option")
      .nth(1)
      .click({ position: { x: 300, y: 20 } });
    await page.mouse.move(0, 0);
    await rows
      .getByRole("option")
      .nth(1)
      .screenshot({ path: shot(`row-selected${d}`) });
    await page.keyboard.press("j");
    await rows
      .getByRole("option")
      .nth(2)
      .screenshot({ path: shot(`row-keyboard${d}`) });
  });
}

// The fixes in this round, close up.
test("light finish after", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 820 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("listbox", { name: "Sessions" })
    .getByRole("option", { name: /Never had an orange/ })
    .click();
  await page
    .getByRole("navigation", { name: "Layouts" })
    .getByRole("button", { name: "Compare" })
    .click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: shot("light-shadows-after") });
});
for (const dark of [false, true]) {
  const d = dark ? "-dark" : "";
  test(`transcript controls and displays${d}`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator(".tr-controls")).toBeVisible();
    await page.waitForTimeout(800);
    await page.locator(".tr-controls").screenshot({ path: shot(`transcript-controls${d}`) });
    await page
      .getByRole("navigation", { name: "Layouts" })
      .getByRole("button", { name: "Review" })
      .click();
    await page.waitForTimeout(600);
    await page.locator(".clip-wave").screenshot({ path: shot(`display-segment${d}`) });
    await page.getByRole("button", { name: /Play segment/ }).click();
    await page.waitForTimeout(1800);
    await page.locator(".clip-wave").screenshot({ path: shot(`display-segment-playing${d}`) });
    await page.locator(".tl-body").screenshot({ path: shot(`timeline-selected${d}`) });
    await context.close();
  });
}
test("timeline labels when short", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Layouts" })
    .getByRole("button", { name: "Edit" })
    .click();
  await page.waitForTimeout(600);
  await page.locator(".tl-body").screenshot({ path: shot("timeline-labels") });
});
