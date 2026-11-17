/**
 * Pane stability: sticky folding, deterministic resize, minimise / expand semantics, rail ARIA, light and dark shots.
 * Written against the intended behaviour; needs the dev server on :5300.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";

const SHOT = "docs/screens";
const paneEl = (page: Page, id: string) => page.locator(`section[data-pane="${id}"]`);
const announcer = (page: Page) => page.getByTestId("announcer");

async function start(page: Page, opts: { preset?: string; size?: { width: number; height: number } } = {}) {
  if (opts.size) await page.setViewportSize(opts.size);
  await page.goto("/");
  await expect(page.locator("section[data-pane]:visible").first()).toBeVisible();
  if (opts.preset) await page.getByRole("button", { name: opts.preset }).click();
  await expect(page.locator("section[data-pane] .pk-grid, section[data-pane] .pk-rec").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(400);
}

type Rect = { x: number; y: number; w: number; h: number };
type Snap = { rects: Record<string, Rect>; groups: string[] };

/** Visible panes keyed by their tab group (sorted tab names) or, when untabbed, by pane id; plus every group's membership. */
async function snap(page: Page): Promise<Snap> {
  return page.locator("section[data-pane]").evaluateAll((els) => {
    const rects: Record<string, Rect> = {};
    const groups: string[] = [];
    for (const e of els as HTMLElement[]) {
      if (getComputedStyle(e).display === "none") continue;
      const tabs = Array.from(e.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? "").trim()).sort();
      const key = tabs.length ? `tabs:${tabs.join("|")}` : `pane:${e.dataset.pane}`;
      if (tabs.length) groups.push(key);
      const r = e.getBoundingClientRect();
      rects[key] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    return { rects, groups: groups.sort() };
  });
}

function expectSame(a: Snap, b: Snap, label: string, skip: string[] = []) {
  expect(b.groups, `${label}: tab membership`).toEqual(a.groups);
  const ka = Object.keys(a.rects).filter((k) => !skip.includes(k)).sort();
  const kb = Object.keys(b.rects).filter((k) => !skip.includes(k)).sort();
  expect(kb, `${label}: visible panes`).toEqual(ka);
  for (const k of ka) {
    const [p, q] = [a.rects[k]!, b.rects[k]!];
    for (const f of ["x", "y", "w", "h"] as const) {
      expect(Math.abs(p[f] - q[f]), `${label}: ${k} ${f} ${p[f]} -> ${q[f]}`).toBeLessThanOrEqual(1);
    }
  }
}

/** Record every non-empty text the live region ever shows. */
async function recordAnnouncements(page: Page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="announcer"]')!;
    const w = window as unknown as { __ann: string[] };
    w.__ann = [];
    new MutationObserver(() => { const t = (el.textContent ?? "").trim(); if (t) w.__ann.push(t); }).observe(el, { childList: true, characterData: true, subtree: true });
  });
}
const announced = (page: Page) => page.evaluate(() => (window as unknown as { __ann: string[] }).__ann);

const focusedPane = (page: Page) => page.locator("section[data-pane][data-focused]").evaluate((e) => (e as HTMLElement).dataset.pane).catch(() => null);
const focusIn = (page: Page, id: string) => page.evaluate((i) => !!document.activeElement?.closest(`section[data-pane="${i}"]`), id);
const activeIsRailOf = (page: Page, id: string) =>
  page.evaluate((i) => { const a = document.activeElement as HTMLElement | null; return !!a && !!a.closest(`section[data-pane="${i}"]`) && (a.closest(".rail") !== null || a.matches(".rail")); }, id);

const SIZES = [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }];

for (const size of SIZES) {
  test.describe(`stress ${size.width}x${size.height}`, () => {
    test("clicking any tab changes only its own group", async ({ page }) => {
      await start(page, { preset: "Stress: 10 panes", size });
      const base = await snap(page);
      const groupKeys = Object.keys(base.rects).filter((k) => k.startsWith("tabs:"));
      expect(base.groups.length, "stress preset should have tab groups at this size").toBeGreaterThan(0);
      for (const key of groupKeys) {
        const names = key.slice(5).split("|");
        for (const name of names) {
          // Re-find the group each time: it is keyed by its tab names.
          const group = page.locator("section[data-pane]:visible").filter({ has: page.locator('[role="tab"]') }).filter({
            has: page.getByRole("tab", { name, exact: false }),
          });
          const g = await findGroup(page, names);
          const tab = g.getByRole("tab").filter({ hasText: name }).first();
          void group;
          await tab.click();
          await page.waitForTimeout(150);
          const now = await snap(page);
          expectSame(base, now, `click tab "${name}"`, [key]); // the group's own rect is also checked below
          expect(now.groups).toEqual(base.groups);
          const own = now.rects[key]!, was = base.rects[key]!;
          expect(Math.abs(own.w - was.w) + Math.abs(own.h - was.h), `${key} own rect`).toBeLessThanOrEqual(2);
        }
      }
    });

    test("F6 through every pane changes nothing", async ({ page }) => {
      await start(page, { preset: "Stress: 10 panes", size });
      const base = await snap(page);
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("F6");
        await page.waitForTimeout(80);
        expectSame(base, await snap(page), `F6 press ${i + 1}`);
      }
    });
  });
}

async function findGroup(page: Page, names: string[]): Promise<Locator> {
  const idx = await page.locator("section[data-pane]").evaluateAll((els, want) => {
    return (els as HTMLElement[]).findIndex((e) => {
      if (getComputedStyle(e).display === "none") return false;
      const tabs = Array.from(e.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? "").trim()).sort();
      return tabs.join("|") === (want as string[]).join("|");
    });
  }, names);
  expect(idx, `group ${names.join("|")} exists`).toBeGreaterThanOrEqual(0);
  return page.locator("section[data-pane]").nth(idx);
}

test("resize 1920 -> 1024 -> 1920 restores rects and membership", async ({ page }) => {
  await start(page, { preset: "Stress: 10 panes", size: { width: 1920, height: 1080 } });
  const a = await snap(page);
  await page.setViewportSize({ width: 1024, height: 1080 });
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(500);
  expectSame(a, await snap(page), "after round trip");
});

test.describe("minimise and expand", () => {
  const minBtn = (page: Page, t: string) => page.getByRole("button", { name: `Minimise ${t}` });

  test("mouse minimise gives space to the neighbour only; expand restores exactly; focus follows", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await minBtn(page, "customer 1").click();
    await page.waitForTimeout(300);
    const mid = await snap(page);
    // Pane count and membership elsewhere unchanged: orders is not a neighbour and keeps its rect.
    expect(mid.groups).toEqual(before.groups);
    for (const k of ["pane:orders"]) {
      for (const f of ["x", "y", "w", "h"] as const) expect(Math.abs(mid.rects[k]![f] - before.rects[k]![f]), `orders ${f}`).toBeLessThanOrEqual(1);
    }
    expect(mid.rects["pane:order"]!.w).toBeGreaterThan(before.rects["pane:order"]!.w + 50);
    expect(Object.keys(mid.rects).sort()).toEqual(Object.keys(before.rects).sort());
    await expect(paneEl(page, "customer")).toHaveClass(/pane-rail/);
    // focus moves to the neighbour that grew
    await expect.poll(() => focusedPane(page)).toBe("order");
    expect(await focusIn(page, "order")).toBe(true);

    // expand gives it back exactly and focuses it
    await paneEl(page, "customer").getByRole("button", { name: /^Expand customer 1/ }).click();
    await page.waitForTimeout(300);
    expectSame(before, await snap(page), "after expand");
    await expect.poll(() => focusedPane(page)).toBe("customer");
    expect(await focusIn(page, "customer")).toBe(true);
  });

  test("keyboard minimise keeps focus on the rail; expand focuses the restored pane", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await paneEl(page, "customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Alt+Meta+m");
    await expect(paneEl(page, "customer")).toHaveClass(/pane-rail/);
    expect(await activeIsRailOf(page, "customer"), "focus on the rail").toBe(true);
    await page.keyboard.press("Alt+Meta+m");
    await page.waitForTimeout(300);
    await expect(paneEl(page, "customer")).not.toHaveClass(/pane-rail/);
    expect(await focusIn(page, "customer")).toBe(true);
    await expect.poll(() => focusedPane(page)).toBe("customer");
    expectSame(before, await snap(page), "after keyboard round trip");
  });

  test("Alt+Meta+M with no focus acts on the most recently focused pane", async ({ page }) => {
    await start(page);
    await paneEl(page, "order").click({ position: { x: 100, y: 300 } });
    await page.locator("footer.status").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Alt+Meta+m");
    await expect(paneEl(page, "order")).toHaveClass(/pane-rail/);
  });

  test("clicking anywhere on the rail expands it; Enter and Space too", async ({ page }) => {
    await start(page);
    const c = paneEl(page, "customer");
    await minBtn(page, "customer 1").click();
    await expect(c).toHaveClass(/pane-rail/);
    const box = (await c.boundingBox())!;
    for (const y of [box.y + 12, box.y + box.height / 2, box.y + box.height - 12]) {
      await page.mouse.click(box.x + box.width / 2, y);
      await expect(c, `click at y=${Math.round(y)}`).not.toHaveClass(/pane-rail/);
      await minBtn(page, "customer 1").click();
      await expect(c).toHaveClass(/pane-rail/);
    }
    for (const key of ["Enter", "Space"]) {
      await c.getByRole("button", { name: /^Expand customer 1/ }).focus();
      await page.keyboard.press(key);
      await expect(c, key).not.toHaveClass(/pane-rail/);
      await minBtn(page, "customer 1").click();
      await expect(c).toHaveClass(/pane-rail/);
    }
  });

  test("announcements say minimised and expanded, never collapsed", async ({ page }) => {
    await start(page);
    await recordAnnouncements(page);
    await minBtn(page, "customer 1").click();
    await expect.poll(() => announced(page)).toEqual(expect.arrayContaining([expect.stringMatching(/minimised/i)]));
    await paneEl(page, "customer").getByRole("button", { name: /^Expand customer 1/ }).click();
    await expect.poll(() => announced(page).then((a) => a.some((m) => /expanded/i.test(m)))).toBe(true);
    expect((await announced(page)).filter((m) => /collapsed|restored/i.test(m))).toEqual([]);
  });

  test("the last open pane cannot be minimised: disabled button, truthful announcement", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await expect.poll(async () => page.locator("section[data-pane]:visible").count()).toBe(1);
    await expect(minBtn(page, "orders")).toBeDisabled();
    await recordAnnouncements(page);
    await paneEl(page, "orders").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Alt+Meta+m");
    await expect.poll(() => announced(page)).toEqual(expect.arrayContaining([expect.stringMatching(/(can.?t|cannot|not) .*minimised|minimised/i)]));
    const msgs = await announced(page);
    expect(msgs.some((m) => /(can.?t|cannot)/i.test(m) && /minimised/i.test(m)), `got ${JSON.stringify(msgs)}`).toBe(true);
    expect(msgs.some((m) => /collapsed/i.test(m))).toBe(false);
    await expect(paneEl(page, "orders")).not.toHaveClass(/pane-rail/);
  });

  test("no announcement fires for a no-op", async ({ page }) => {
    await start(page);
    await paneEl(page, "orders").click({ position: { x: 100, y: 300 } });
    await page.waitForTimeout(600);
    await recordAnnouncements(page);
    await page.keyboard.press("Alt+Meta+ArrowLeft"); // already leftmost, no wrap
    await page.keyboard.press("Alt+1"); // already focused
    await page.waitForTimeout(500);
    expect(await announced(page)).toEqual([]);
  });
});

test("ARIA: fixed minimise label without aria-pressed; rail is a button named Expand <title>", async ({ page }) => {
  await start(page);
  const btn = page.getByRole("button", { name: "Minimise customer 1" });
  await expect(btn).toHaveCount(1);
  expect(await btn.getAttribute("aria-pressed")).toBeNull();
  await btn.click();
  const c = paneEl(page, "customer");
  const rail = c.getByRole("button", { name: /^Expand customer 1/ });
  await expect(rail).toHaveCount(1);
  // The rail button spans the whole rail, not a small icon.
  const [rb, cb] = [(await rail.boundingBox())!, (await c.boundingBox())!];
  expect(rb.width).toBeGreaterThanOrEqual(cb.width - 4);
  expect(rb.height).toBeGreaterThanOrEqual(cb.height - 4);
  // The minimise label does not change when state does: no "Restore" or "Expand" variant of the header button.
  await expect(page.getByRole("button", { name: /^Restore customer 1/ })).toHaveCount(0);
  await rail.click();
  const again = page.getByRole("button", { name: "Minimise customer 1" });
  await expect(again).toHaveCount(1);
  expect(await again.getAttribute("aria-pressed")).toBeNull();
});

for (const mode of ["light", "dark"] as const) {
  test(`screenshots: rail and pane header in ${mode}`, async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Settings" }).click();
    const dlg = page.getByRole("dialog", { name: "Settings" });
    await dlg.getByLabel(new RegExp(`^${mode}$`, "i")).check();
    await page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
    await paneEl(page, "orders").click({ position: { x: 100, y: 300 } });
    await page.getByRole("button", { name: "Minimise customer 1" }).click();
    const rail = paneEl(page, "customer");
    await expect(rail).toHaveClass(/pane-rail/);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    await rail.screenshot({ path: `${SHOT}/60-rail-${mode}.png` });
    await paneEl(page, "orders").locator("header.pane-header").screenshot({ path: `${SHOT}/60-header-focused-${mode}.png` });
    await paneEl(page, "order").locator("header.pane-header").screenshot({ path: `${SHOT}/60-header-unfocused-${mode}.png` });
  });
}
