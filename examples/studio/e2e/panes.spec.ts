import { expect, test, type Page } from "@playwright/test";

/*
 * Every pane holds up at every size: each layout at a range of window widths and heights, light and dark. In every
 * pane on screen:
 *  - the pane's body doesn't scroll sideways (a list may scroll down; the mixer's modules may scroll sideways in
 *    their own scroller, with the master pinned);
 *  - every visible control (key, slider, field) is wholly inside its pane, or in a scroller wholly inside it;
 *  - no two keys in a keyset overlap;
 *  - no printed legend is clipped.
 */
const SIZES = [
  [760, 700],
  [1024, 760],
  [1280, 800],
  [1440, 900],
  [1920, 1200],
] as const;
const LAYOUTS = ["edit", "mix", "review", "compare"] as const;
const SCROLLERS = ".mx-modules, .tr-rows, .lib-rows, .mk-rows, .clip";
const LEGENDS =
  ".face-legend, .legend, .pane-label, .toolbar-note, .mx-pan-legend, .mx-db, .mx-label, .clip-stats, .clip-range, .mk-time, .tl-track, .lib-show, .lib-meta > span:first-child, .tr-time, .tr-speaker-name, .key";

async function check(page: Page) {
  return page.evaluate(
    ({ scrollers, legends }) => {
      const problems: string[] = [];
      const r = (el: Element) => el.getBoundingClientRect();
      const visible = (el: Element) => {
        const b = r(el);
        return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      for (const pane of document.querySelectorAll<HTMLElement>(".jali-pane")) {
        if (!visible(pane) || pane.getAttribute("aria-hidden") === "true") continue;
        const kind = pane.dataset.kind ?? "?";
        const body = pane.querySelector<HTMLElement>(".pane-body");
        if (!body || !visible(body)) continue;
        if (body.scrollWidth > body.clientWidth + 1)
          problems.push(`${kind}: the pane scrolls sideways`);
        const pb = r(pane);
        for (const el of body.querySelectorAll(".key, [role=slider], textarea, input, select")) {
          if (!visible(el)) continue;
          // Inside a scroller it can be scrolled to: the scroller itself must be inside the pane.
          const scroller = el.closest(scrollers);
          const b = r(scroller ?? el);
          const inside =
            b.left >= pb.left - 1 &&
            b.right <= pb.right + 1 &&
            b.top >= pb.top - 1 &&
            b.bottom <= pb.bottom + 1;
          if (!inside)
            problems.push(
              `${kind}: "${el.getAttribute("aria-label") ?? el.textContent?.trim()}" outside its pane`,
            );
        }
        for (const set of body.querySelectorAll(".keyset")) {
          const keys = [...set.querySelectorAll(":scope > .key")].filter(visible).map(r);
          for (let i = 1; i < keys.length; i++)
            if (
              keys[i]!.left < keys[i - 1]!.right - 0.5 &&
              keys[i]!.top < keys[i - 1]!.bottom - 0.5
            )
              problems.push(`${kind}: keys overlap in a keyset`);
        }
        for (const el of body.querySelectorAll<HTMLElement>(legends)) {
          if (!visible(el) || getComputedStyle(el).textOverflow === "ellipsis") continue;
          if (el.scrollWidth > el.clientWidth + 1)
            problems.push(`${kind}: clipped "${el.textContent?.trim()}"`);
        }
      }
      return problems;
    },
    { scrollers: SCROLLERS, legends: LEGENDS },
  );
}

for (const dark of [false, true]) {
  test(`every pane fits, every layout and size, ${dark ? "dark" : "light"}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
    const failures: string[] = [];
    for (const preset of LAYOUTS) {
      for (const [width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await page.goto(`/?preset=${preset}`);
        await expect(page.locator(".jali-pane").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const select = page.locator(".layout-menu select");
        if (await select.isVisible()) await select.selectOption(preset);
        else
          await page
            .getByRole("navigation", { name: "Layouts" })
            .getByRole("button", { name: new RegExp(preset, "i") })
            .click();
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        for (const p of await check(page)) failures.push(`${preset} ${width}×${height}: ${p}`);
      }
    }
    expect([...new Set(failures)]).toEqual([]);
  });
}
