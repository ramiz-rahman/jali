/** A pane's own menu: right-click its header (a pane without tabs) for what can be done with it. */
import { test, expect } from "./fixtures/lab";

test("right-clicking a pane's header opens its menu; Escape closes it and focus goes back to the pane", async ({
  lab,
  page,
}) => {
  await lab.open();
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
  lab,
  page,
  context,
}) => {
  await lab.open();
  test.skip(!(await page.evaluate(() => "documentPictureInPicture" in window)), "no Document PiP");
  const pane = page.locator("section[data-pane]").first();
  await pane.locator(".jali-pane-title").click({ button: "right" });
  const opened = context.waitForEvent("page");
  await page.getByRole("menuitem", { name: "Pop out" }).click();
  await opened;
  await expect(pane.locator(".jali-popped-out")).toBeVisible();
});
