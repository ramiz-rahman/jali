/** The queue's and the header's collapse keys are commands with their own keys: Jali binds them, ⌘K prints them. */
import { expect, test, type Page } from "@playwright/test";
import { openReview } from "./open";

const queueToggle = (page: Page) =>
  page.getByRole("button", { name: /^(Collapse|Expand) the queue$/ });

test("⌘B collapses the queue and expands it again, and its tooltip prints the key", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  await expect(queueToggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(queueToggle(page)).toHaveAttribute("title", /· (⌘B|Ctrl\+B)$/);
  await page.keyboard.press("ControlOrMeta+b");
  await expect(queueToggle(page)).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(queueToggle(page)).toHaveAttribute("aria-expanded", "true");
});

test("⌘. collapses the queue and the header together", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReview(page);
  await page.keyboard.press("ControlOrMeta+.");
  await expect(queueToggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Expand the header" })).toBeVisible();
});

test("⌘K lists the queue's command with its key, greyed out with its reason on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReview(page);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog");
  await palette.getByRole("combobox").fill("Collapse or expand the queue");
  const option = palette.getByRole("option", { name: /Collapse or expand the queue/ });
  await expect(option).toContainText(/⌘B|Ctrl\+B/);
  await expect(option).toHaveAttribute("aria-disabled", "true");
});
