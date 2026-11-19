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
  await expect(page.locator(".tp-title")).toHaveText("A library of seeds");
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
  await page.setViewportSize({ width: 820, height: 900 });
  // Narrow: panes fold into tabs rather than squeeze, and the shelf lists them.
  await expect(page.locator(".jali-shelf-chip").first()).toBeVisible();
  const before = await seconds(page);
  await page.waitForTimeout(1500);
  expect(await seconds(page)).toBeGreaterThan(before + 1);
  await transport(page, "Pause").click();
});

test("a correction is unsaved work: a layout without the transcript asks first", async ({ page }) => {
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
  await page.getByRole("button", { name: /^Save (⌘|Ctrl)/ }).click();
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
