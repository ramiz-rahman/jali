import { expect, test } from "./fixtures/lab";

/**
 * Theming: Jali reads only --jali-* tokens, a host's value wins at any specificity, the Tailwind bridge takes the
 * host's theme (Chakni's token names), and a dark scope gets dark values.
 */
const bridge = { path: "packages/react/src/styles/jali-tailwind.css" };
const focusedBorder = (lab: import("./fixtures/lab").Lab) =>
  lab.page
    .locator("section[data-pane][data-focused]")
    .first()
    .evaluate((e) => getComputedStyle(e).borderTopColor);

test.describe("Theme", () => {
  test("a host's --jali-accent wins with no specificity, and the tints follow it", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await page.addStyleTag({ content: ":root { --jali-accent: rgb(194, 98, 26); }" });
    expect(await focusedBorder(lab)).toBe("rgb(194, 98, 26)");
    const weak = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-jali]")!)
        .getPropertyValue("--jali-accent-weak")
        .trim(),
    );
    expect(weak).toContain("rgb(194, 98, 26)");
  });

  test("the Tailwind bridge takes the host's semantic tokens", async ({ lab, page }) => {
    await lab.open();
    await page.addStyleTag(bridge);
    await page.addStyleTag({
      content: ":root { --color-primary: rgb(194, 98, 26); --color-card: rgb(250, 245, 238); }",
    });
    expect(await focusedBorder(lab)).toBe("rgb(194, 98, 26)");
    const bg = await lab.page
      .locator("section[data-pane]")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe("rgb(250, 245, 238)");
  });

  test("with the bridge but no host token, Jali keeps its own default for the theme in use", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.setting(/^Dark$/);
    await page.addStyleTag(bridge);
    // Nil on dark: #8C9BEA.
    expect(await focusedBorder(lab)).toBe("rgb(140, 155, 234)");
  });

  test("a utility on a part wins over Jali's rule without !important (Jali is in a lower layer)", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await page.addStyleTag({
      content: "section[data-pane][data-focused] { border-color: rgb(0, 128, 0); }",
    });
    expect(await focusedBorder(lab)).toBe("rgb(0, 128, 0)");
  });
});
