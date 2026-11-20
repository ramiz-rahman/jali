/**
 * The standard's checks on every layout, in both themes: axe and the width sweep; the console guard runs in each.
 * And the map's own: from 360 to 2200px, everything on the map shows whole and clear.
 */
import { expect, type Page } from "@playwright/test";
import { qualitySuite, test, WIDTHS } from "../../shared/e2e/quality";

const LAYOUTS = ["Plan", "Days", "Stay", "Budget"];

/** The trip on `name`'s layout, once its panes are on screen. */
async function open(page: Page, name: string) {
  await page.goto("/");
  await expect(page.locator(".jali-pane").first()).toBeVisible();
  const key = page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });
  await key.click();
  await expect(key).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".jali-pane").first()).toBeVisible();
}

qualitySuite({
  storage: "trips-thailand",
  layouts: LAYOUTS.map((name) => ({ name, open: (page) => open(page, name) })),
});

/**
 * What on a map shown now breaks the pin layout's promise: a pin or a city badge that isn't wholly inside the map,
 * that sits even partly under something floating over it (the days, the summary, the route key, the card, MapLibre's
 * buttons and attribution), or that overlaps another pin or badge. The shared sweep only asks whether a control's
 * middle can be clicked; this asks for the whole of it.
 */
const mapClashes = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const name = (el: Element) => el.getAttribute("aria-label")?.split(".")[0] ?? "?";
    // Half a pixel of rounding either way is not an overlap.
    const clash = (a: DOMRect, b: DOMRect) =>
      a.left < b.right - 0.5 &&
      b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 &&
      b.top < a.bottom - 0.5;
    for (const map of document.querySelectorAll<HTMLElement>(".pane-body.map")) {
      const canvas = map.querySelector(".map-canvas");
      if (!canvas?.checkVisibility() || map.closest("[inert], [aria-hidden='true']")) continue;
      const box = canvas.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const marks = [...map.querySelectorAll<HTMLElement>(".pin, .city-badge")]
        .filter((el) => el.checkVisibility({ visibilityProperty: true }))
        .map((el) => ({ el, r: el.getBoundingClientRect() }));
      const floating = [
        ...map.querySelectorAll<HTMLElement>(
          ".map-top > *, .map-legend, .map-card, .map-failed, .maplibregl-ctrl",
        ),
      ]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0);
      for (const [i, m] of marks.entries()) {
        const { r } = m;
        if (
          r.left < box.left - 0.5 ||
          r.top < box.top - 0.5 ||
          r.right > box.right + 0.5 ||
          r.bottom > box.bottom + 0.5
        )
          out.push(`${name(m.el)}: past the map's edge`);
        for (const f of floating)
          if (clash(r, f.r)) out.push(`${name(m.el)}: under ${f.el.className || f.el.tagName}`);
        for (const o of marks.slice(i + 1))
          if (clash(r, o.r)) out.push(`${name(m.el)}: over ${name(o.el)}`);
      }
    }
    return out;
  });

/** Every width, as the sweep goes, and what clashed at each. */
async function sweepMap(page: Page) {
  const found: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 780 : 900 });
    // The map frames its day again as its box changes (instantly, with reduced motion), then lays its pins out.
    for (let i = 0; i < 3; i++)
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
    for (const c of await mapClashes(page)) found.push(`${width}px: ${c}`);
  }
  return found;
}

test.describe("the map", () => {
  for (const name of LAYOUTS)
    test(`${name}: pins and city badges show whole, clear of the controls and of each other, from 360 to 2200px`, async ({
      page,
    }) => {
      await open(page, name);
      expect(await sweepMap(page), "the layout's own day").toEqual([]);
      // The whole trip: a badge for each city.
      await page.setViewportSize({ width: 1440, height: 900 });
      const map = page.locator('.jali-pane[data-kind="map"]').first();
      await map
        .getByRole("group", { name: "Days on the map" })
        .getByRole("button", { name: "All" })
        .click();
      await expect(map.getByRole("button", { name: /^Phuket, Days/ })).toBeVisible();
      expect(await sweepMap(page), "every day").toEqual([]);
    });
});
