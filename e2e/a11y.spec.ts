import { test, expect } from "./fixtures/app";

test.describe("Accessibility", () => {
  test("every pane is a named region; separators carry the splitter attributes; live region announces", async ({
    app,
    page,
  }) => {
    await app.open({ size: { width: 1920, height: 1000 } });
    await app.preset("Stress: 10 panes");
    const regions = page.locator("section[data-pane]");
    const n = await regions.count();
    expect(n).toBe(10);
    for (let i = 0; i < n; i++) {
      const r = regions.nth(i);
      await expect(r).toHaveAttribute("role", "region");
      if ((await r.evaluate((e) => getComputedStyle(e).display)) === "none") continue;
      const name = await r.evaluate((e) => {
        const ids = (e.getAttribute("aria-labelledby") ?? "").split(" ");
        return ids
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
      });
      expect(name.length, `pane ${i} has an accessible name`).toBeGreaterThan(0);
    }
    // One main landmark (the app is the whole page: `landmark: "main"`), and no pane header is a banner.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(app.main()).toHaveClass(/jali-workspace/);
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.locator("header.jali-pane-header")).toHaveCount(0);
    for (const r of await page.getByRole("region").all())
      expect(
        (await r.getAttribute("aria-labelledby")) !== null ||
          (await r.getAttribute("aria-label")) !== null,
      ).toBe(true);

    // Dividers are checked on the chain, where the layout is not folded into one switcher.
    await page.getByRole("button", { name: "Order → customer chain" }).click();
    await expect(app.pane("customer")).toBeVisible();
    const seps = page.getByRole("separator");
    const sc = await seps.count();
    expect(sc).toBeGreaterThan(0);
    for (let i = 0; i < sc; i++) {
      const s = seps.nth(i);
      for (const a of [
        "aria-valuenow",
        "aria-valuemin",
        "aria-valuemax",
        "aria-orientation",
        "aria-controls",
      ]) {
        expect(await s.getAttribute(a), `separator ${i} ${a}`).not.toBeNull();
      }
      const [now, min, max] = [
        await app.attr(s, "aria-valuenow"),
        await app.attr(s, "aria-valuemin"),
        await app.attr(s, "aria-valuemax"),
      ];
      expect(min <= now && now <= max, `separator ${i}: ${min} <= ${now} <= ${max}`).toBe(true);
      expect(await s.getAttribute("tabindex")).toBe("0");
    }

    const live = app.announcer();
    await expect(live).toHaveAttribute("aria-live", "polite");
    await page
      .getByRole("button", { name: /^Close customer/ })
      .first()
      .click();
    await expect(live).toContainText(/closed/i);
  });

  test("focus is visible on the focused pane and on a focused divider", async ({ app }) => {
    await app.open();
    await expect(app.pane("orders")).toHaveCSS("border-top-color", /.+/);
    await app.separator(0).focus();
    const outline = await app.separator(0).evaluate((e) => {
      const c = getComputedStyle(e);
      return `${c.outlineStyle}|${c.outlineWidth}|${c.boxShadow}`;
    });
    console.log("divider focus style:", outline);
    expect(outline).not.toBe("none|0px|none");
  });

  test("forced colours keep the shown tab's underline and the focused pane's ring", async ({
    app,
    page,
  }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await app.open();
    await app.tuck("customer").click();
    await expect(page.locator('[role="tab"][data-tucked]')).toHaveCount(1);
    // Forced colours drop backgrounds and shadows: the underline keeps a system colour, the focused pane an outline.
    const underline = page.locator(".jali-tab-indicator").first();
    await expect(underline).toBeVisible();
    const highlight = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.cssText = "background: Highlight; forced-color-adjust: none";
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    await expect(underline).toHaveCSS("background-color", highlight);
    const focused = page.locator("section[data-pane].is-focused").first();
    await expect(focused).toHaveCSS("outline-style", "solid");
    await page.screenshot({ path: test.info().outputPath("forced-colors.png") });
  });

  test("forced colours mark the palette's active result", async ({ app, page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await app.open();
    await app.pane("orders").click({ position: { x: 100, y: 10 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ArrowDown");
    const active = page.locator('[role="option"][aria-selected="true"]');
    await expect(active).toHaveCount(1);
    await expect(active).toHaveCSS("outline-style", "solid");
    await expect(page.locator('[role="option"][aria-selected="false"]').first()).not.toHaveCSS(
      "outline-style",
      "solid",
    );
  });
});
