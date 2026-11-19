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

/** Open a layout, go to the winter storm and play a moment: a session in the middle, every pane following it. */
async function stage(page: Page, preset: string, { dark = false } = {}) {
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
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
  await page.locator("body").press("/");
  await page.getByRole("combobox", { name: "Go to segment…" }).fill("winter storm");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await page.waitForTimeout(2600);
}

for (const size of SIZES) {
  for (const preset of LAYOUTS) {
    test(`${preset} at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await stage(page, preset);
      await page.screenshot({ path: shot(`${preset}-${size.name}`) });
    });
  }
}

for (const preset of ["edit", "mix"] as const) {
  test(`${preset} in dark`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stage(page, preset, { dark: true });
    await page.screenshot({ path: shot(`${preset}-wide-dark`) });
  });
}

test("a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stage(page, "edit");
  await page.screenshot({ path: shot("edit-phone") });
});

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
      await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
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
      clip: { x: box.x - 16, y: box.y - 14, width: box.width + 32, height: box.height + 28 },
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
      `1.${Buffer.from(json.replace('["mixer",{"session":"night-ferry"}]', '["mixer",{"session":"gone"}]')).toString("base64url")}`,
    );
    await page.goto(url.toString());
    await page
      .locator('.jali-pane[data-kind="mixer"]')
      .screenshot({ path: shot(`state-missing${d}`) });
  });
  test(`state no audio${dark ? " dark" : ""}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route("**/*.m4a", (r) => r.abort());
    await page.goto("/");
    await expect(page.locator(".pd-alert")).toHaveText("no audio");
    await page
      .locator(".topbar")
      .screenshot({ path: shot(`state-no-audio${dark ? "-dark" : ""}`) });
  });
}
