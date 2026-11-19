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
  // The clips have loaded and the music has rendered: Play is enabled.
  await expect(transport(page, "Play")).toBeEnabled({ timeout: 20_000 });
});

test("the library drives the transcript and the timeline", async ({ page }) => {
  await expect(header(page, "transcript")).toContainText("The night ferry");
  const list = page.getByRole("listbox", { name: "Sessions" });
  await list.getByRole("option", { name: /The night ferry/ }).click();
  await page.keyboard.press("j");
  await expect(list.getByRole("option", { selected: true })).toContainText("A library of seeds");
  await expect(header(page, "transcript")).toContainText("A library of seeds");
  await expect(header(page, "timeline")).toContainText("A library of seeds");
  await expect(page.locator(".pd-title")).toHaveText("A library of seeds");
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
  // A short window: the mixer folds into a tab rather than squeeze, and waits behind its place's "N folded" chip.
  await page.setViewportSize({ width: 1100, height: 560 });
  await page.getByRole("button", { name: /\d+ folded panes?/ }).click();
  await expect(page.getByRole("menuitem", { name: /Mixer/ })).toBeVisible();
  await page.keyboard.press("Escape");
  const before = await seconds(page);
  await page.waitForTimeout(1500);
  expect(await seconds(page)).toBeGreaterThan(before + 1);
  await transport(page, "Pause").click();
});

// The mixer reports "working" while it plays (its hidden header carries the mark), but the folded menu doesn't draw
// it: since 3f57a4c the shelf holds only tucked panes and the "N folded" menu lists panes without their marks. Turn
// this on when the menu shows a folded pane's activity.
test.fixme("a folded mixer shows that it is working", async ({ page }) => {
  await layout(page, "Mix").click();
  await transport(page, "Play").click();
  await page.setViewportSize({ width: 1100, height: 560 });
  await page.getByRole("button", { name: /\d+ folded panes?/ }).click();
  const entry = page.getByRole("menuitem", { name: /Mixer/ });
  await expect(entry.locator("[class*=jali-ra], [class*=jali-activity]")).toBeVisible();
  await page.keyboard.press("Escape");
  await transport(page, "Pause").click();
});

test("a correction is unsaved work: a layout without the transcript asks first", async ({
  page,
}) => {
  await page.getByRole("listbox", { name: /Transcript of/ }).focus();
  await page.keyboard.press("e");
  const field = page.getByRole("textbox", { name: "Correct the segment's text" });
  await expect(field).toBeFocused();
  await field.fill("Welcome back to Harbour Hours, from the engine room.");
  await page.keyboard.press("Escape");
  await expect(page.getByText("1 unsaved")).toBeVisible();
  await layout(page, "Mix").click();
  await expect(page.getByRole("alertdialog")).toContainText("1 unsaved correction");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(layout(page, "Edit")).toHaveAttribute("aria-pressed", "true");
  // Save is the transcript's own ⌘S (also "Save corrections" in ⌘K), not a button.
  await page.getByRole("listbox", { name: /Transcript of/ }).focus();
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText("1 unsaved")).toBeHidden();
  await expect(page.locator(".tr-text").first()).toContainText("from the engine room");
});

test("/ asks for a segment in Jali's chooser and goes there", async ({ page }) => {
  await page.getByRole("listbox", { name: "Sessions" }).focus();
  await page.keyboard.press("/");
  const input = page.getByRole("combobox", { name: "Go to segment…" });
  await expect(input).toBeFocused();
  await input.fill("storm");
  await page.keyboard.press("Enter");
  await expect(input).toBeHidden();
  await expect(time(page)).toHaveText(/^00:39/);
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
  await field.fill("Maren H. Holt");
  await page.keyboard.press("Enter");
  await expect(page.locator(".tl-who").first()).toHaveText("Maren H. Holt");
  await expect(page.locator(".tr-speaker-name").first()).toHaveText("Maren H. Holt");
});

test("the scrub dial turns round its centre: a quarter turn is 2.5 seconds, and it holds playback while turned", async ({
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
  await expect(transport(page, "Play")).toBeVisible(); // held while turning
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
  const fader = page.getByRole("slider", { name: "Level for Music bed" });
  await expect(fader).toHaveAttribute("aria-valuetext", "−4.0 dB");
  const cap = (await fader.locator(".fader-cap").boundingBox())!;
  const x = cap.x + cap.width / 2;
  // Grab the cap off-centre: nothing moves.
  await page.mouse.move(x, cap.y + cap.height / 2 + 6);
  await page.mouse.down();
  await expect(fader).toHaveAttribute("aria-valuetext", "−4.0 dB");
  // Up to the 0 dB mark, wherever the pointer drifts sideways (pointer capture): into the detent. The slot's
  // height follows the layout, so the distance is read from the marks, not counted in pixels.
  const zero = (await fader.locator(".fader-zero").boundingBox())!;
  const dy = zero.y + zero.height / 2 - (cap.y + cap.height / 2);
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(x + i * 30, cap.y + cap.height / 2 + 6 + (dy * i) / 8);
  await page.mouse.up();
  await expect(fader).toHaveAttribute("aria-valuenow", "0");
  await fader.focus();
  await page.keyboard.press("PageDown");
  await expect(fader).toHaveAttribute("aria-valuetext", "−3.0 dB");
  await fader.dblclick();
  await expect(fader).toHaveAttribute("aria-valuetext", "0.0 dB");

  const pan = page.getByRole("slider", { name: "Pan for Mic A" });
  await expect(pan).toHaveAttribute("aria-valuenow", "-15");
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
  await expect(pan).toHaveAttribute("aria-valuenow", "52");
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
  expect(quarter).toBeGreaterThan(12);
  expect(quarter).toBeLessThan(25);
  // Drag right, and on past the pane: the playhead follows to the end.
  await page.mouse.move(box.x + box.width / 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width + 400, box.y + 300);
  await page.mouse.up();
  expect(await seconds(page)).toBeGreaterThan(70);
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
