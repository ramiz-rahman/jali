import { expect, test, type Page } from "@playwright/test";

/*
 * The top slab never overflows and its parts never collide: a sweep of window widths from 360 to 2200px in 20px
 * steps, light and dark, at 100% and at 125% zoom. At every width:
 *  - neither the slab nor the page scrolls sideways;
 *  - no two of the slab's top-level parts (the mark, the layout keys, the display, the transport keys, the dials,
 *    the tools) overlap;
 *  - every visible control is wholly inside the slab and inside its pocket;
 *  - adjacent groups stand at least the minimum gap apart;
 *  - no text in the slab is clipped.
 */
const MIN_GAP = 8;

async function check(page: Page) {
  return page.evaluate((minGap) => {
    const problems: string[] = [];
    const slab = document.querySelector<HTMLElement>(".slab")!;
    const r = (el: Element) => el.getBoundingClientRect();
    const visible = (el: Element) => {
      const b = r(el);
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const s = r(slab);
    if (slab.scrollWidth > slab.clientWidth + 0.5)
      problems.push(`slab scrolls: ${slab.scrollWidth} > ${slab.clientWidth}`);
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 0.5)
      problems.push(`page scrolls: ${document.documentElement.scrollWidth}`);
    const parts = [
      ".badge",
      ".group-layouts",
      ".player-cutout",
      ".group-transport",
      ".group-rotary",
      ".group-tools",
    ]
      .map((sel) => [sel, slab.querySelector(sel)] as const)
      .filter(([, el]) => el && visible(el)) as [string, Element][];
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++) {
        const a = r(parts[i]![1]);
        const b = r(parts[j]![1]);
        const overlap =
          a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 &&
          a.top < b.bottom - 0.5 &&
          b.top < a.bottom - 0.5;
        if (overlap) problems.push(`${parts[i]![0]} overlaps ${parts[j]![0]}`);
      }
    // Adjacent groups in the same tier: at least the minimum gap.
    const sorted = parts
      .map(([sel, el]) => [sel, r(el)] as const)
      .sort((a, b) => a[1].top - b[1].top || a[1].left - b[1].left);
    for (let i = 1; i < sorted.length; i++) {
      const [pa, a] = sorted[i - 1]!;
      const [pb, b] = sorted[i]!;
      if (Math.abs(a.top - b.top) < 4 && b.left - a.right < minGap - 0.5)
        problems.push(`${pa} and ${pb} only ${(b.left - a.right).toFixed(1)}px apart`);
    }
    // Every control inside the slab and inside its pocket.
    for (const el of slab.querySelectorAll(".key, .face, [role=slider]")) {
      if (!visible(el)) continue;
      const b = r(el);
      const name = el.getAttribute("aria-label") ?? el.textContent?.trim() ?? el.className;
      if (
        b.left < s.left - 0.5 ||
        b.right > s.right + 0.5 ||
        b.top < s.top - 0.5 ||
        b.bottom > s.bottom + 0.5
      )
        problems.push(`${name} outside the slab`);
      const pocket = el.closest(".pocket");
      if (pocket) {
        const p = r(pocket);
        if (
          b.left < p.left - 0.5 ||
          b.right > p.right + 0.5 ||
          b.top < p.top - 0.5 ||
          b.bottom > p.bottom + 0.5
        )
          problems.push(`${name} outside its pocket`);
      }
    }
    // The dials' marks stay on their caps.
    for (const tick of slab.querySelectorAll(".dial-tick, .dial-body")) {
      if (!visible(tick)) continue;
      const cap = r(tick.closest(".rotary")!);
      const b = r(tick);
      if (
        b.left < cap.left - 0.5 ||
        b.right > cap.right + 0.5 ||
        b.top < cap.top - 0.5 ||
        b.bottom > cap.bottom + 0.5
      )
        problems.push(`a dial mark outside its cap`);
    }
    // A dial cap's legend and value never touch its dial: 6px clear.
    for (const cap of slab.querySelectorAll(".rotary")) {
      if (!visible(cap)) continue;
      const dial = cap.querySelector(".dial-body");
      if (!dial) continue;
      const d = r(dial);
      for (const t of cap.querySelectorAll(".face-legend, .rotary-note")) {
        if (!visible(t)) continue;
        const b = r(t);
        const range = document.createRange();
        range.selectNodeContents(t);
        const ink = range.getBoundingClientRect();
        if (ink.right > d.left - 6 && ink.bottom > d.top && ink.top < d.bottom)
          problems.push(
            `"${t.textContent?.trim()}" ${(d.left - ink.right).toFixed(1)}px from its dial (${b.width})`,
          );
      }
    }
    // No clipped text.
    for (const el of slab.querySelectorAll<HTMLElement>(
      ".face-legend, .badge-name, .rotary-note, .pd-title, .pd-show, .pd-time, .pd-state, .tp-now",
    )) {
      if (!visible(el)) continue;
      if (el.scrollWidth > el.clientWidth + 0.5)
        problems.push(`clipped text: "${el.textContent?.trim()}"`);
    }
    return problems;
  }, MIN_GAP);
}

for (const dark of [false, true]) {
  for (const zoom of [1, 1.25]) {
    test(`the slab fits from 360 to 2200px, ${dark ? "dark" : "light"}, ${zoom * 100}% zoom`, async ({
      page,
    }) => {
      test.setTimeout(240_000);
      await page.emulateMedia({ colorScheme: dark ? "dark" : "light", reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await expect(page.locator(".slab")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (zoom !== 1)
        await page.evaluate((z) => (document.documentElement.style.zoom = String(z)), zoom);
      const failures: string[] = [];
      for (let width = 360; width <= 2200; width += 20) {
        await page.setViewportSize({ width, height: 900 });
        // Two frames: the resize observer measures on the next one.
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        for (const p of await check(page)) failures.push(`${width}px: ${p}`);
      }
      expect(failures).toEqual([]);
    });
  }
}

test("at 1440px the four layout keys and the studio name are all on the slab", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  for (const name of ["Edit", "Mix", "Review", "Compare"])
    await expect(
      page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name }),
    ).toBeVisible();
  await expect(page.locator(".badge-name")).toBeVisible();
  // The display keeps the play state and the total time.
  await expect(page.locator(".pd-state")).toBeVisible();
  await expect(page.locator(".pd-total")).toBeVisible();
});
