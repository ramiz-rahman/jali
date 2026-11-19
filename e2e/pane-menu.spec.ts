/** A pane's own menu: right-click its header (a pane without tabs) for what can be done with it. */
import { test, expect } from "./fixtures/app";

test("right-clicking a pane's header opens its menu; Escape closes it and focus goes back to the pane", async ({
  app,
  page,
}) => {
  await app.open();
  const pane = page.locator("section[data-pane]").first();
  await pane.locator(".jali-pane-title").click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const items = await menu.getByRole("menuitem").allInnerTexts();
  for (const want of ["Close", "Maximise", "Full screen", "Tuck"])
    expect(items.some((i) => i.startsWith(want))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(pane).toBeFocused();

  // Its items act on that pane.
  await pane.locator(".jali-pane-title").click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Maximise/ }).click();
  await expect(pane).toHaveAttribute("data-zoomed", "true");
});

test("the menu offers Pop out where the browser can, and it pops the pane out", async ({
  app,
  page,
  context,
}) => {
  await app.open();
  test.skip(!(await page.evaluate(() => "documentPictureInPicture" in window)), "no Document PiP");
  const pane = page.locator("section[data-pane]").first();
  await pane.locator(".jali-pane-title").click({ button: "right" });
  const opened = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Pop out" }).click();
  await opened;
  await expect(pane.locator(".jali-popped-out")).toBeVisible();
});

test("⋯ opens the same menu, under itself, and Shift+F10 on the pane opens it from the keyboard", async ({
  app,
  page,
}) => {
  await app.open();
  const pane = page.locator("section[data-pane]").first();
  const more = pane.locator(".jali-act-menu");
  await pane.hover();
  await more.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /^Full screen/ })).toBeVisible();
  const [m, b] = [(await menu.boundingBox())!, (await more.boundingBox())!];
  expect(Math.round(m.x + m.width)).toBe(Math.round(b.x + b.width));
  await page.keyboard.press("Escape");
  await expect(pane).toBeFocused();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
});
