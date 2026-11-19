/**
 * Shelf screenshots, light and dark, for docs/screens. Runs only in the `screens` project (pnpm screens);
 * the other screenshots are written by the area specs through app.shot().
 */
import { test, expect } from "./fixtures/app";

for (const mode of ["light", "dark"] as const) {
  for (const preset of ["Chain", "Stress: 10 panes"]) {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1024, height: 768 },
    ]) {
      test(`screenshots: shelf, ${preset}, ${size.width}, ${mode}`, async ({ app, page }) => {
        await app.open({ size });
        if (preset !== "Chain") await app.preset(preset);
        const dlg = page.getByRole("dialog", { name: "Settings" });
        await page.getByRole("button", { name: "Settings" }).click();
        await dlg.getByLabel(new RegExp(`^${mode}$`, "i")).check();
        await page.keyboard.press("Escape");
        await expect(dlg).toBeHidden();
        for (let i = 0; i < 2; i++) {
          const b = app.firstTuckable("last");
          if (await b.count()) {
            await b.click();
            await expect(app.chips()).toHaveCount(i + 1);
          }
        }
        const tabs = page.locator('[role="tab"][data-tucked]');
        if (await tabs.count()) {
          await app.setActivity((await tabs.first().getAttribute("data-tab"))!, "needs-you");
          await tabs.first().hover();
        }
        const mains = app.chipMains();
        if (await mains.count()) await mains.last().focus();
        await app.shot(`75-shelf-${preset === "Chain" ? "chain" : "stress"}-${size.width}-${mode}`);
      });
    }
  }
}
