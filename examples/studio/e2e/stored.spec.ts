/**
 * What is kept on this device is never trusted: the edits, the layouts, the two settings and each pane's own state
 * are checked as they are read (src/stored.ts), and a damaged value gives the default instead of breaking the app.
 * Each test seeds hostile storage, loads the app and uses every layout, and fails on any uncaught error.
 */
import { expect, test, type Page } from "@playwright/test";

const SESSION = "apollo11-landing";
const PANE_STATE = "studio:pane-state@2";

const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
const pane = (page: Page, id: string) => page.locator(`.jali-pane[data-pane="${id}"]`);

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

/** The app is up and in use: the library, the transcript, and every layout with its panes drawn. */
async function expectWorking(page: Page) {
  await expect(page.getByRole("listbox", { name: "Sessions" })).toBeVisible();
  await expect(page.getByRole("listbox", { name: /(Transcript|Lyrics) of/ })).toBeVisible();
  for (const [name, kind] of [
    ["Mix", "mixer"],
    ["Review", "markers"],
    ["Edit", "clip"],
  ] as const) {
    await layout(page, name).click();
    await expect(layout(page, name)).toHaveAttribute("aria-pressed", "true");
    await expect(pane(page, kind).locator(".jali-pane-content")).toBeVisible();
  }
  await expect(page.locator(".jali-pane-failed")).toHaveCount(0);
}

const damagedEdits = JSON.stringify({
  [SESSION]: {
    corrections: { s01: 42 },
    speakerNames: null,
    segmentSpeaker: [],
    notes: "none",
    markers: [{ id: "m1" }, null],
    mix: { "air-ground": { gain: "loud", pan: 0, mute: false, solo: false }, x: null },
    masterGain: "max",
  },
  "not-a-session": { mix: null },
});

test("damaged edits, layouts and settings give their defaults", async ({ page }) => {
  const seen = errors(page);
  await loadWith(page, {
    "studio:edits:v1": damagedEdits,
    "studio:layouts:v1": JSON.stringify({ mix: { root: 42 }, edit: "x", review: null }),
    "studio:feel-sounds": '"yes"',
    "studio:controls": "{",
  });
  await expectWorking(page);
  expect(seen).toEqual([]);
});

test("damaged edits under the key from before it had a version are checked too", async ({
  page,
}) => {
  const seen = errors(page);
  await loadWith(page, { "studio:edits": damagedEdits, "studio:layouts": "null" });
  await expectWorking(page);
  expect(await page.evaluate(() => localStorage.getItem("studio:edits"))).toBeNull();
  expect(seen).toEqual([]);
});

for (const [name, raw] of Object.entries({
  "text that isn't JSON": "{edits",
  null: "null",
  "a list": "[1, 2]",
})) {
  test(`edits stored as ${name} give no edits`, async ({ page }) => {
    const seen = errors(page);
    await loadWith(page, { "studio:edits:v1": raw, "studio:layouts:v1": raw });
    await expectWorking(page);
    expect(seen).toEqual([]);
  });
}

test("damaged pane state gives each pane its own defaults", async ({ page }) => {
  const seen = errors(page);
  await loadWith(page, {});
  // The panes keep some state: the library's and the transcript's cursors, a draft correction, following playback.
  await page.getByRole("listbox", { name: "Sessions" }).getByRole("option").nth(1).click();
  await page.getByRole("listbox", { name: /(Transcript|Lyrics) of/ }).focus();
  await page.keyboard.press("j");
  // Jali saves pane state a moment after it changes.
  const stored = () =>
    page.evaluate(
      // One record per pane (`pane-state@2`): each pane's values beside the object they belong to.
      (k) =>
        Object.fromEntries(
          Object.entries(
            (
              JSON.parse(localStorage.getItem(k) ?? "{}") as {
                panes?: Record<string, { values: Record<string, unknown> }>;
              }
            ).panes ?? {},
          ).map(([id, r]) => [id, r.values]),
        ),
      PANE_STATE,
    );
  await expect.poll(async () => Object.keys(await stored()).length).toBeGreaterThan(0);
  // Every value the wrong shape: a number for a cursor, a list for a draft, text for a flag.
  const values = [42, ["s01"], "yes", { s01: 7 }];
  // The records as stored, so the damaged values keep each pane's object beside them.
  const raw = await page.evaluate((k) => localStorage.getItem(k) ?? "{}", PANE_STATE);
  const withValues = (d: Record<string, unknown>) => {
    const r = JSON.parse(raw) as { panes: Record<string, { values: unknown }> };
    for (const [id, values] of Object.entries(d)) r.panes[id]!.values = values;
    return r;
  };
  const damaged = Object.fromEntries(
    Object.entries(await stored()).map(([id, s], i) => [
      id,
      {
        ...Object.fromEntries(Object.keys(s).map((k, j) => [k, values[(i + j) % values.length]])),
        // Lines of the wrong type, and one for a segment this session has never had.
        draft: { s01: 7, s02: null, s999: "A line from nowhere" },
        follow: "yes",
        get: 1,
        note: 3,
      },
    ]),
  );
  await page.evaluate(({ k, v }) => localStorage.setItem(k, v), {
    k: PANE_STATE,
    v: JSON.stringify(withValues(damaged)),
  });
  await page.reload();
  // The line from nowhere is no unsaved work.
  await expect(page.locator(".tr-unsaved")).toHaveCount(0);
  await expectWorking(page);
  expect(seen).toEqual([]);
});
