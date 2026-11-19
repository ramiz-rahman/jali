import { expect, test } from "./fixtures/app";

/**
 * Theming: Jali reads only --jali-* tokens, a host's value wins at any specificity, the Tailwind bridge takes the
 * host's theme (Chakni's token names), and a dark scope gets dark values.
 */
const bridge = { path: "packages/react/src/styles/jali-tailwind.css" };
const focusedBorder = (app: import("./fixtures/app").App) =>
  app.page
    .locator("section[data-pane][data-focused]")
    .first()
    .evaluate((e) => getComputedStyle(e).borderTopColor);

test.describe("Theme", () => {
  test("a host's --jali-accent wins with no specificity, and the tints follow it", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.addStyleTag({ content: ":root { --jali-accent: rgb(194, 98, 26); }" });
    expect(await focusedBorder(app)).toBe("rgb(194, 98, 26)");
    const weak = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-jali]")!)
        .getPropertyValue("--jali-accent-weak")
        .trim(),
    );
    expect(weak).toContain("rgb(194, 98, 26)");
  });

  test("a host token set in a layer above jali wins (the theme is in the jali layer)", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.addStyleTag({
      content: "@layer components { :root { --jali-accent: rgb(194, 98, 26); } }",
    });
    expect(await focusedBorder(app)).toBe("rgb(194, 98, 26)");
  });

  test("an accent set around a workspace tints its dialogs too, not only the panes", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.addStyleTag({ content: "body { --jali-accent: rgb(194, 98, 26); }" });
    await page.getByRole("button", { name: "Settings" }).click();
    const weak = await page
      .locator(".jali-scrim")
      .first()
      .evaluate((e) => getComputedStyle(e).getPropertyValue("--jali-accent-weak").trim());
    expect(weak).toContain("rgb(194, 98, 26)");
  });

  test("a host token on an ancestor wins with a .dark scope in between, which still gets dark defaults", async ({
    app,
    page,
  }) => {
    await app.open();
    // body (the host's ancestor) sets the accent; #root, between it and the Jali root, is a .dark scope.
    await page.addStyleTag({ content: "body { --jali-accent: rgb(194, 98, 26); }" });
    await page.evaluate(() => document.getElementById("root")!.classList.add("dark"));
    expect(await focusedBorder(app)).toBe("rgb(194, 98, 26)");
    const [weak, surface] = await app.page
      .locator("section[data-pane][data-focused]")
      .first()
      .evaluate((e) => {
        const c = getComputedStyle(e);
        return [
          getComputedStyle(e.closest("[data-jali]")!).getPropertyValue("--jali-accent-weak"),
          c.backgroundColor,
        ];
      });
    // The tints follow the host's accent, at dark's strength; the surface is dark's (#1A1815).
    expect(weak).toContain("rgb(194, 98, 26)");
    expect(surface).toBe("rgb(26, 24, 21)");
  });

  test("a .dark scope with no host token gets the dark palette; a .light scope inside it, the light one", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.evaluate(() => document.getElementById("root")!.classList.add("dark"));
    // Nil on dark: #8C9BEA.
    expect(await focusedBorder(app)).toBe("rgb(140, 155, 234)");
    await page.evaluate(() => document.querySelector("[data-jali]")!.classList.add("light"));
    expect(await focusedBorder(app)).toBe("rgb(68, 86, 199)");
  });

  test("a host token on the Jali root itself wins, and its tints follow there", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.addStyleTag({ content: "[data-jali] { --jali-accent: rgb(194, 98, 26); }" });
    expect(await focusedBorder(app)).toBe("rgb(194, 98, 26)");
    const weak = await page.evaluate(() =>
      getComputedStyle(document.querySelector(".jali-workspace")!)
        .getPropertyValue("--jali-accent-weak")
        .trim(),
    );
    expect(weak).toContain("rgb(194, 98, 26)");
  });

  test("the Tailwind bridge takes the host's semantic tokens", async ({ app, page }) => {
    await app.open();
    await page.addStyleTag(bridge);
    await page.addStyleTag({
      content: ":root { --color-primary: rgb(194, 98, 26); --color-card: rgb(250, 245, 238); }",
    });
    expect(await focusedBorder(app)).toBe("rgb(194, 98, 26)");
    const bg = await app.page
      .locator("section[data-pane]")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe("rgb(250, 245, 238)");
  });

  test("with the bridge but no host token, Jali keeps its own default for the theme in use", async ({
    app,
    page,
  }) => {
    await app.open();
    await app.setting(/^Dark$/);
    await page.addStyleTag(bridge);
    // Nil on dark: #8C9BEA.
    expect(await focusedBorder(app)).toBe("rgb(140, 155, 234)");
  });

  test("a utility on a part wins over Jali's rule without !important (Jali is in a lower layer)", async ({
    app,
    page,
  }) => {
    await app.open();
    await page.addStyleTag({
      content: "section[data-pane][data-focused] { border-color: rgb(0, 128, 0); }",
    });
    expect(await focusedBorder(app)).toBe("rgb(0, 128, 0)");
  });
});
