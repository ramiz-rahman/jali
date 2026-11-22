/**
 * Jali's root is a column the panes fill: a host that gives <JaliRoot> only a height (or nothing at all) gets panes
 * that fill it, and a root with no height warns in development instead of collapsing in silence.
 */
import { test, expect } from "./fixtures/app";

test.describe("the root sizes the panes", () => {
  test("without the host's grid, the panes fill the root between its own chrome", async ({
    app,
    page,
  }) => {
    await app.open();
    const before = (await app.main().boundingBox())!;
    // Take away the app's grid: what is left is Jali's own rule for [data-jali].
    await page.addStyleTag({
      content: "@layer app { .app { display: revert-layer; grid-template-rows: revert-layer; } }",
    });
    await expect(page.locator("[data-jali]")).toHaveCSS("display", "flex");
    await app.stable();
    const box = async (s: string) => (await page.locator(s).first().boundingBox())!;
    const [root, top, status, panes] = [
      await box("[data-jali]"),
      await box(".topbar"),
      await box(".status"),
      await box(".jali-layout"),
    ];
    expect(Math.round(panes.height)).toBe(Math.round(root.height - top.height - status.height));
    expect(Math.round(panes.y)).toBe(Math.round(top.y + top.height));
    expect(panes.height).toBeGreaterThan(before.height / 2);
    await expect(page.locator("section[data-pane]:visible").first()).toBeVisible();
  });

  test("a root in a box with no height warns that the panes measure 0", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
    // Before the app loads: #root (the root's box) has no height, and neither has the app's grid.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = "@layer app { #root, .app { height: auto !important; } }";
        document.head.append(s);
      });
    });
    await page.goto("/");
    await expect(page.locator(".jali-layout")).toHaveCount(1);
    await expect
      .poll(() => warnings.some((w) => w.startsWith("Jali: the panes measure 0 pixels high")))
      .toBe(true);
  });
});
