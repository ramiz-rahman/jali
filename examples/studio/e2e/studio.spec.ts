import { expect, test, type Page } from "@playwright/test";

const header = (page: Page, pane: string) =>
  page.locator(`.jali-pane[data-pane="${pane}"] .jali-pane-header`);
const layout = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
const time = (page: Page) => page.locator(".tp-now");
/** The transport's own buttons (a segment detail has a Play button too). */
const transport = (page: Page, name: string) =>
  page.getByRole("group", { name: "Transport" }).getByRole("button", { name, exact: true });
const seconds = async (page: Page) => {
  const [m, s] = (await time(page).textContent())!.split(":");
  return Number(m) * 60 + Number(s);
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("listbox", { name: "Sessions" })).toBeVisible();
  // The session's tracks have decoded: Play is enabled.
  await expect(transport(page, "Play")).toBeEnabled({ timeout: 20_000 });
});

test("the library drives the transcript and the timeline", async ({ page }) => {
  await expect(header(page, "transcript")).toContainText("The Eagle has landed");
  const list = page.getByRole("listbox", { name: "Sessions" });
  await list.getByRole("option", { name: /The Eagle has landed/ }).click();
  await page.keyboard.press("j");
  const song = "The Light caught by the Stone";
  await expect(list.getByRole("option", { selected: true })).toContainText(song);
  // A song's transcript is its lyrics.
  await expect(header(page, "transcript")).toContainText(`Lyrics · ${song}`);
  await expect(header(page, "timeline")).toContainText(song);
  await expect(page.locator(".pd-title")).toHaveText(song);
});

test("Space plays and pauses from inside a pane, and the playhead moves", async ({ page }) => {
  await page.getByRole("listbox", { name: /Transcript of/ }).focus();
  await page.keyboard.press("Space");
  await expect(transport(page, "Pause")).toBeVisible();
  await expect.poll(() => seconds(page), { timeout: 5000 }).toBeGreaterThan(1);
  // The spoken word is lit in the transcript.
  await expect(page.locator('.w[data-state="now"]').first()).toBeVisible({ timeout: 6000 });
  await page.keyboard.press("Space");
  await expect(transport(page, "Play")).toBeVisible();
});

test("the sound goes on while the mixer is folded away", async ({ page }) => {
  await layout(page, "Mix").click();
  await expect(page.locator('.jali-pane[data-pane="mixer"]')).toBeVisible();
  await transport(page, "Play").click();
  // A short window: the mixer folds into a tab rather than squeeze, and waits behind its strip's "N folded" chip.
  await page.setViewportSize({ width: 1100, height: 560 });
  await expect(page.locator(".jali-tab-folded").first()).toBeVisible();
  await expect(page.locator('.jali-pane[data-kind="mixer"]')).toBeHidden();
  const before = await seconds(page);
  await page.waitForTimeout(1500);
  expect(await seconds(page)).toBeGreaterThan(before + 1);
  await transport(page, "Pause").click();
});

test("a correction is unsaved work: a layout without the transcript asks first", async ({
  page,
}) => {
  await page.getByRole("listbox", { name: /Transcript of/ }).focus();
  await page.keyboard.press("e");
  const field = page.getByRole("textbox", { name: "Correct the segment's text" });
  await expect(field).toBeFocused();
  await field.fill("Eagle, you are looking great. You're GO.");
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 unsaved")).toBeVisible();
  await layout(page, "Mix").click();
  await expect(page.getByRole("alertdialog")).toContainText("1 unsaved correction");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(layout(page, "Edit")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^save (⌘|Ctrl)/ }).click();
  await expect(page.locator(".tr-text").first()).toContainText("you are looking great");
});

test("/ asks for a segment in Jali's chooser and goes there", async ({ page }) => {
  await page.getByRole("listbox", { name: "Sessions" }).focus();
  await page.keyboard.press("/");
  const input = page.getByRole("combobox", { name: "Go to segment…" });
  await expect(input).toBeFocused();
  await input.fill("eagle has landed");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
  await expect(time(page)).toHaveText(/^03:23/);
});

test("a layout is a link: a reload keeps it", async ({ page }) => {
  await layout(page, "Review").click();
  await expect(page.locator('.jali-pane[data-pane="markers"]')).toBeVisible();
  expect(new URL(page.url()).searchParams.get("preset")).toBe("review");
  await page.reload();
  await expect(layout(page, "Review")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.jali-pane[data-pane="markers"]')).toBeVisible();
});

test("renaming a speaker in the transcript renames them everywhere", async ({ page }) => {
  await page.locator(".tr-speaker-name").first().click();
  const field = page.getByRole("textbox", { name: "Speaker's name" });
  await expect(field).toBeFocused();
  await field.fill("Charlie Duke");
  await page.keyboard.press("Enter");
  // The transcript keeps the callsign before the new name; the segment detail's speaker says it too.
  await expect(page.locator(".tr-speaker-name").first()).toHaveText("CCCharlie Duke");
  await expect(
    page.getByRole("combobox", { name: "Who says this segment" }).locator("option:checked"),
  ).toHaveText("Charlie Duke");
});

test("the scrub dial turns round its centre: a quarter turn is 2.5 seconds, and playback goes on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  // The slab re-measures what fits on the next frame: wait for it before measuring the dial.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const dial = page.getByRole("slider", { name: "Scrub" });
  const body = (await dial.locator(".dial-body").boundingBox())!;
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  await transport(page, "Play").click();
  const before = await seconds(page);
  await page.mouse.move(cx, cy - 20);
  await page.mouse.down();
  // A quarter turn clockwise, then on round well outside the dial (pointer capture keeps it).
  for (let a = 0; a <= 90; a += 10) {
    const r = (a * Math.PI) / 180;
    await page.mouse.move(cx + Math.sin(r) * 20, cy - Math.cos(r) * 20);
  }
  await expect(transport(page, "Pause")).toBeVisible(); // still playing while turned
  for (let a = 90; a <= 180; a += 10) {
    const r = (a * Math.PI) / 180;
    await page.mouse.move(cx + Math.sin(r) * 200, cy - Math.cos(r) * 200);
  }
  await page.mouse.up();
  await expect(transport(page, "Pause")).toBeVisible(); // and plays on
  const after = await seconds(page);
  expect(after - before).toBeGreaterThan(4.5);
  expect(after - before).toBeLessThan(6.5);
  // The keys step it too.
  await transport(page, "Pause").click();
  await dial.focus();
  const at = await seconds(page);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => seconds(page)).toBeCloseTo(at + 1, 0);
});

test("the speed dial snaps to its detents and resets to 1× on a double-click", async ({ page }) => {
  await page.setViewportSize({ width: 1700, height: 900 });
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const dial = page.getByRole("slider", { name: "Speed" });
  await expect(dial).toHaveAttribute("aria-valuetext", "1×");
  await dial.focus();
  await page.keyboard.press("End");
  await expect(dial).toHaveAttribute("aria-valuetext", "2×");
  await expect(page.locator(".rotary-value")).toHaveText("2×");
  await dial.dblclick();
  await expect(dial).toHaveAttribute("aria-valuetext", "1×");
  // Press at 12 o'clock: the middle detent, 1.25×.
  const body = (await dial.locator(".dial-body").boundingBox())!;
  await page.mouse.click(body.x + body.width / 2, body.y + 4);
  await expect(dial).toHaveAttribute("aria-valuetext", "1.25×");
});

test("a mixer fader drags without jumping, settles at 0 dB, and a pan dial turns and centres", async ({
  page,
}) => {
  await layout(page, "Mix").click();
  const fader = page.getByRole("slider", { name: "Level for Public affairs" });
  await expect(fader).toHaveAttribute("aria-valuetext", "−12.0 dB");
  const cap = (await fader.locator(".fader-cap").boundingBox())!;
  const x = cap.x + cap.width / 2;
  // Grab the cap off-centre: nothing moves.
  await page.mouse.move(x, cap.y + cap.height / 2 + 6);
  await page.mouse.down();
  await expect(fader).toHaveAttribute("aria-valuetext", "−12.0 dB");
  // Up to just short of the 0 dB mark: into its detent, wherever the pointer drifts sideways (pointer capture).
  const travel = (await fader.locator(".fader-travel").boundingBox())!;
  const from = cap.y + cap.height / 2;
  const to = travel.y + (1 - 0.7079) * travel.height + 2; // 2px short of the mark, as a hand would stop
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 30, from + 6 + ((to - from) * i) / 8);
  await page.mouse.up();
  await expect(fader).toHaveAttribute("aria-valuenow", "0");
  await fader.focus();
  await page.keyboard.press("PageDown");
  await expect(fader).toHaveAttribute("aria-valuetext", "−3.0 dB");
  await fader.dblclick();
  await expect(fader).toHaveAttribute("aria-valuetext", "0.0 dB");

  const pan = page.getByRole("slider", { name: "Pan for Flight Director loop" });
  await expect(pan).toHaveAttribute("aria-valuenow", "-35");
  const body = (await pan.locator(".dial-body").boundingBox())!;
  const cx = body.x + body.width / 2;
  const cy = body.y + body.height / 2;
  await page.mouse.move(cx, cy - 18);
  await page.mouse.down();
  for (let a = 0; a <= 90; a += 10) {
    const r = (a * Math.PI) / 180;
    await page.mouse.move(cx + Math.sin(r) * 18, cy - Math.cos(r) * 18);
  }
  await page.mouse.up();
  await expect(pan).toHaveAttribute("aria-valuenow", "32");
  await pan.dblclick();
  await expect(pan).toHaveAttribute("aria-valuetext", "centre");
});

test("the timeline seeks by click, drag (with pointer capture), the wheel and the keys", async ({
  page,
}) => {
  const lanes = page.getByRole("slider", { name: /Playhead in/ });
  const box = (await lanes.boundingBox())!;
  // A click a quarter of the way along: about a quarter of the session.
  await page.mouse.click(box.x + box.width / 4, box.y + box.height / 2);
  const quarter = await seconds(page);
  expect(quarter).toBeGreaterThan(40);
  expect(quarter).toBeLessThan(65);
  // Drag right, and on past the pane: the playhead follows to the end.
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width + 400, box.y + 300);
  await page.mouse.up();
  expect(await seconds(page)).toBeGreaterThan(150);
  // The wheel: 100 of delta is a second.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press("Home");
  await lanes.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => seconds(page)).toBe(0);
  await page.mouse.wheel(0, 500);
  await expect.poll(() => seconds(page)).toBe(5);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => seconds(page)).toBe(6);
});

test("a clicked transcript row is selected without a focus ring; the keyboard adds a light one", async ({
  page,
}) => {
  const rows = page.getByRole("listbox", { name: /Transcript of/ });
  const ring = (el: import("@playwright/test").Locator) =>
    el.evaluate((e) => getComputedStyle(e).boxShadow);
  const bar = (el: import("@playwright/test").Locator) =>
    el.evaluate((e) => getComputedStyle(e, "::before").backgroundColor);
  // Click a row: selected (the side bar), no ring.
  const third = rows.getByRole("option").nth(2);
  await third.click({ position: { x: 300, y: 20 } });
  await expect(third).toHaveAttribute("aria-selected", "true");
  expect(await ring(third)).toBe("none");
  expect(await bar(third)).not.toBe("rgba(0, 0, 0, 0)");
  // Move with the keyboard: the next row is selected, with the side bar and a thin neutral outline.
  await page.keyboard.press("j");
  const fourth = rows.getByRole("option").nth(3);
  await expect(fourth).toHaveAttribute("aria-selected", "true");
  expect(await bar(fourth)).not.toBe("rgba(0, 0, 0, 0)");
  expect(await ring(fourth)).toContain("inset");
  expect(await ring(fourth)).not.toContain("255, 79, 0");
});

const SESSIONS = [
  { title: "The Eagle has landed", tracks: 3 },
  { title: "The Light caught by the Stone", tracks: 8 },
  { title: "Never had an orange", tracks: 4 },
];

test("each session loads and plays, with its own tracks on the desk and the timeline", async ({
  page,
}) => {
  await layout(page, "Mix").click();
  const list = page.getByRole("listbox", { name: "Sessions" });
  for (const s of SESSIONS) {
    // A click on the session already selected opens its transcript; select the others.
    const row = list.getByRole("option", { name: new RegExp(s.title) });
    if ((await row.getAttribute("aria-selected")) !== "true") await row.click();
    await expect(page.locator(".pd-title")).toHaveText(s.title, { timeout: 20_000 });
    await expect(transport(page, "Play")).toBeEnabled({ timeout: 20_000 });
    // One module a track, and the master; one lane a track.
    await expect(page.locator(".mx-module")).toHaveCount(s.tracks + 1);
    await expect(page.locator(".tl-labels li")).toHaveCount(s.tracks);
    // All of them on the desk at this size: nothing scrolls sideways.
    await expect
      .poll(
        () => page.locator(".mx-modules").evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        { message: s.title },
      )
      .toBe(true);
    const before = await seconds(page);
    await transport(page, "Play").click();
    await expect.poll(() => seconds(page), { timeout: 5000 }).toBeGreaterThan(before);
    await transport(page, "Pause").click();
  }
});

test("the status line's credits key opens every credit and licence", async ({ page }) => {
  await page.locator(".status-credits").click();
  const pane = page.locator('.jali-pane[data-kind="credits"]');
  await expect(pane).toBeVisible();
  await expect(pane).toContainText("Use does not imply endorsement by NASA");
  await expect(pane).toContainText("Creative Commons Attribution 4.0");
  await expect(pane).toContainText("These files are modified");
  await expect(pane.getByRole("link", { name: /cdla/i })).toHaveAttribute(
    "href",
    "https://cdla.dev/permissive-1-0/",
  );
});

test("the dinner party: neutral speaker labels, overlapping lines, sounds as quiet notes", async ({
  page,
}) => {
  const list = page.getByRole("listbox", { name: "Sessions" });
  await list.getByRole("option", { name: /Never had an orange/ }).click();
  const rows = page.getByRole("listbox", { name: /Transcript of Never had an orange/ });
  await expect(rows).toBeVisible();
  await expect(rows.locator(".tr-speaker-name").first()).toHaveText("Speaker 4 (P08)");
  expect(await rows.locator(".tr-seg[data-overlap]").count()).toBeGreaterThan(3);
  expect(await rows.locator(".w-tag").count()).toBeGreaterThan(0);
  // A sound is never a word that lights up.
  expect(await rows.locator(".w-tag[data-state]").count()).toBe(0);
});

test("the landing: callsigns, a loop with no transcript, and the mission clock", async ({
  page,
}) => {
  await expect(page.locator(".tr-code").first()).toHaveText("CC");
  await expect(page.locator(".tl-labels li", { hasText: "Flight Director loop" })).toContainText(
    "no transcript",
  );
  await expect(page.locator(".pd-show")).toHaveText(/^GET 102:42:4\d$/);
  await page.getByRole("button", { name: "GET" }).click();
  await expect(page.locator(".tr-time").first()).toHaveText("102:42:42");
});

test("a layout shows the session being worked on, not the one it was left with", async ({
  page,
}) => {
  const list = page.getByRole("listbox", { name: "Sessions" });
  await list.getByRole("option", { name: /The Light caught by the Stone/ }).click();
  for (const name of ["Mix", "Review", "Compare"]) {
    await layout(page, name).click();
    // Every pane that names a session names this one, and none waits to be loaded.
    for (const title of await page.locator(".jali-pane-title h2").allTextContents())
      expect(title).not.toContain("The Eagle has landed");
    await expect(page.locator(".not-live")).toHaveCount(0);
  }
});

test("Home and End in the correction field move the caret, not the transcript", async ({
  page,
}) => {
  const rows = page.locator(".tr-rows");
  await rows.focus();
  await page.keyboard.press("j");
  await page.keyboard.press("e");
  const field = page.getByRole("textbox", { name: "Correct the segment's text" });
  await expect(field).toBeFocused();
  for (const key of ["End", "Home", "PageDown", "End"]) await page.keyboard.press(key);
  expect(await rows.evaluate((el) => el.scrollTop)).toBe(0);
  expect(
    await field.evaluate((el: HTMLTextAreaElement) => el.selectionStart === el.value.length),
  ).toBe(true);
});

test("a deleted marker can be taken back, and the session's own restored", async ({ page }) => {
  await layout(page, "Mix").click();
  const rows = page.locator(".mk-row");
  await expect(rows).toHaveCount(5);
  await rows.first().click();
  await page.keyboard.press("Delete");
  await expect(rows).toHaveCount(4);
  await page.locator("[data-sonner-toast] button", { hasText: "Undo" }).click();
  await expect(rows).toHaveCount(5);
  await page.keyboard.press("Delete");
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("Restore the session");
  await page.keyboard.press("Enter");
  await expect(rows).toHaveCount(5);
});
