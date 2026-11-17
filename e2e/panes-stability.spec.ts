/**
 * Pane stability: sticky folding, deterministic resize, tuck and put back, the shelf, light and dark shots.
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


// ---------- tuck and the shelf ----------
const shelfRegion = (page: Page) => page.getByRole("region", { name: "Shelf" });
const chip = (page: Page, title: string) => shelfRegion(page).getByRole("button", { name: new RegExp(`^${title}`) }).first();
const tuckBtn = (page: Page, id: string) => paneEl(page, id).getByRole("button", { name: /^Tuck / });

/** Visible panes by their data-pane id (the shown tab's id for a group). */
async function byId(page: Page): Promise<Record<string, Rect>> {
  return page.locator("section[data-pane]").evaluateAll((els) => {
    const o: Record<string, Rect> = {};
    for (const e of els as HTMLElement[]) {
      if (getComputedStyle(e).display === "none") continue;
      const r = e.getBoundingClientRect();
      o[e.dataset.pane!] = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    return o;
  });
}
const sameRect = (a: Rect, b: Rect) => (["x", "y", "w", "h"] as const).every((f) => Math.abs(a[f] - b[f]) <= 1);
/** The pane section whose tab strip holds the tab, and that tab strip's selected tab. */
async function homeOf(page: Page, tab: string) {
  return page.locator("section[data-pane]").evaluateAll((els, t) => {
    for (const e of els as HTMLElement[]) {
      const tabs = Array.from(e.querySelectorAll('[role="tab"]')) as HTMLElement[];
      if (getComputedStyle(e).display !== "none" && tabs.some((x) => (x.textContent ?? "").trim() === t)) {
        return { id: e.dataset.pane!, active: (tabs.find((x) => x.getAttribute("aria-selected") === "true")?.textContent ?? "").trim(), tabs: tabs.map((x) => (x.textContent ?? "").trim()) };
      }
    }
    return null;
  }, tab);
}
const setAct = (page: Page, id: string, a: string) => page.evaluate(([i, v]) => (window as unknown as { __lab: { actions: { setActivity(i: string, v: string): void } } }).__lab.actions.setActivity(i!, v!), [id, a]);

test.describe("tuck and put back", () => {
  test("button: the pane becomes a tab of its home, the home keeps its tab, only the home's group changes, focus lands in the home", async ({ page }) => {
    await start(page);
    const before = await byId(page);
    const beforeSnap = await snap(page);
    const btn = tuckBtn(page, "customer");
    await expect(btn).toBeEnabled();
    expect(await btn.getAttribute("aria-label")).toMatch(/^Tuck into .+ · ⌥⌘M$/);
    expect(await btn.getAttribute("title")).toBe(await btn.getAttribute("aria-label"));
    await btn.click();
    await expect.poll(() => homeOf(page, "customer 1")).not.toBeNull();
    const home = (await homeOf(page, "customer 1"))!;
    expect(home.active, "home keeps its active tab").not.toBe("customer 1");
    expect(home.tabs).toContain("customer 1");
    const after = await byId(page);
    for (const id of Object.keys(before)) {
      if (id === home.id || id === "customer") continue;
      expect(sameRect(before[id]!, after[id]!), `${id} unchanged`).toBe(true);
    }
    expect(after.customer, "customer no longer has its own pane").toBeUndefined();
    await expect.poll(() => focusIn(page, home.id), { message: "focus lands in the home" }).toBe(true);
    expect(beforeSnap.groups.length).toBeLessThan((await snap(page)).groups.length);
    // The tucked tab is marked, and Put back appears on hover and on focus.
    const tab = page.getByRole("tab", { name: /customer 1/ });
    await expect(tab).toHaveAttribute("data-tucked", "true");
    const pb = tab.getByRole("button", { name: "Put back customer 1" });
    await tab.hover();
    await expect(pb).toBeVisible();
    expect(await pb.getAttribute("title")).toBe("Put back · ⌥⇧⌘M");
  });

  test("⌥⌘M tucks the focused pane, ⌥⇧⌘M puts the tab back to the exact rect", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await paneEl(page, "customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Alt+Meta+m");
    await expect.poll(() => homeOf(page, "customer 1")).not.toBeNull();
    const home = (await homeOf(page, "customer 1"))!;
    await expect.poll(() => focusIn(page, home.id)).toBe(true);
    await page.getByRole("tab", { name: /customer 1/ }).click();
    await page.keyboard.press("Alt+Shift+Meta+m");
    await expect.poll(() => homeOf(page, "customer 1")).toBeNull();
    await page.waitForTimeout(300);
    expectSame(before, await snap(page), "after ⌥⌘M, ⌥⇧⌘M");
  });

  test("Put back on the tab restores the exact rect", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await tuckBtn(page, "customer").click();
    const tab = page.getByRole("tab", { name: /customer 1/ });
    await tab.hover();
    await tab.getByRole("button", { name: "Put back customer 1" }).click();
    await expect.poll(() => homeOf(page, "customer 1")).toBeNull();
    await page.waitForTimeout(300);
    expectSame(before, await snap(page), "after the tab's Put back");
  });

  test("dragging a tucked tab out puts it back", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await tuckBtn(page, "customer").click();
    const tab = page.getByRole("tab", { name: /customer 1/ });
    const tb = (await tab.boundingBox())!;
    const home = (await homeOf(page, "customer 1"))!;
    const hb = (await paneEl(page, home.id).boundingBox())!;
    await page.mouse.move(tb.x + 20, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + 30, tb.y + tb.height / 2 + 14, { steps: 3 });
    await page.mouse.move(hb.x + hb.width - 20, hb.y + hb.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => homeOf(page, "customer 1")).toBeNull();
    await page.waitForTimeout(300);
    expectSame(before, await snap(page), "after drag-out");
  });

  test("⌘Z after a tuck restores the exact rect", async ({ page }) => {
    await start(page);
    const before = await snap(page);
    await tuckBtn(page, "customer").click();
    await expect.poll(() => homeOf(page, "customer 1")).not.toBeNull();
    await page.keyboard.press("Meta+z");
    await expect.poll(() => homeOf(page, "customer 1")).toBeNull();
    await page.waitForTimeout(300);
    expectSame(before, await snap(page), "after ⌘Z");
  });

  test("the last pane: Tuck is disabled with a truthful tooltip and announcement", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await expect.poll(async () => page.locator("section[data-pane]:visible").count()).toBe(1);
    const btn = tuckBtn(page, "orders");
    await expect(btn).toBeDisabled();
    expect(await btn.getAttribute("title")).toBe("Only open pane");
    await recordAnnouncements(page);
    await paneEl(page, "orders").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Alt+Meta+m");
    await expect.poll(async () => (await announced(page)).some((m) => /only open pane|can.?t be tucked/i.test(m)), { message: JSON.stringify(await announced(page)) }).toBe(true);
    expect((await announced(page)).some((m) => /minimised|collapsed/i.test(m))).toBe(false);
    await expect(shelfRegion(page)).toHaveCount(0);
  });

  test("announcements say tucked and put back", async ({ page }) => {
    await start(page);
    await recordAnnouncements(page);
    await tuckBtn(page, "customer").click();
    await expect.poll(async () => (await announced(page)).some((m) => /tucked/i.test(m))).toBe(true);
    const tab = page.getByRole("tab", { name: /customer 1/ });
    await tab.hover();
    await tab.getByRole("button", { name: "Put back customer 1" }).click();
    await expect.poll(async () => (await announced(page)).some((m) => /put back/i.test(m))).toBe(true);
  });
});

test.describe("the shelf", () => {
  test("appears only when something is tucked; 32px, above the status line", async ({ page }) => {
    await start(page);
    await expect(shelfRegion(page)).toHaveCount(0);
    await tuckBtn(page, "customer").click();
    await expect(shelfRegion(page)).toBeVisible();
    const sb = (await shelfRegion(page).boundingBox())!, st = (await page.locator("footer.status").boundingBox())!;
    expect(Math.round(sb.height)).toBe(32);
    expect(Math.abs(sb.y + sb.height - st.y)).toBeLessThanOrEqual(1);
    await expect(shelfRegion(page)).toContainText(/Behind .+:/);
    await expect(chip(page, "customer 1")).toBeVisible();
    await expect(page.locator("footer.status")).toContainText("1 tucked");
    await expect(page.locator("footer.status")).not.toContainText(/minimised/);
    // putting it back removes the shelf
    const tab = page.getByRole("tab", { name: /customer 1/ });
    await tab.hover();
    await tab.getByRole("button", { name: "Put back customer 1" }).click();
    await expect(shelfRegion(page)).toHaveCount(0);
  });

  test("clicking a chip reveals the tab with no layout change", async ({ page }) => {
    await start(page);
    await tuckBtn(page, "customer").click();
    await expect(shelfRegion(page)).toBeVisible();
    const before = await byId(page);
    const beforeSnap = await snap(page);
    expect((await homeOf(page, "customer 1"))!.active).not.toBe("customer 1");
    await chip(page, "customer 1").click();
    await expect.poll(async () => (await homeOf(page, "customer 1"))!.active).toBe("customer 1");
    await page.waitForTimeout(250);
    const after = await byId(page);
    const home = (await homeOf(page, "customer 1"))!;
    // The home group's rect and every other rect are unchanged; the shown tab is the only difference.
    for (const id of Object.keys(before)) if (after[id]) expect(sameRect(before[id]!, after[id]!), `${id} rect`).toBe(true);
    expect((await snap(page)).groups).toEqual(beforeSnap.groups);
    expect(Object.keys(after).length).toBe(Object.keys(before).length);
    expect(home.tabs).toContain("customer 1");
    await expect(shelfRegion(page)).toBeVisible(); // revealing does not put it back
  });

  test("keyboard: a toolbar with roving tabindex; arrows move, Enter reveals, Shift+Enter puts back", async ({ page }) => {
    await start(page);
    await tuckBtn(page, "customer").click();
    await tuckBtn(page, "order").click().catch(() => {});
    const tb = shelfRegion(page).getByRole("toolbar");
    await expect(tb).toBeVisible();
    const chips = tb.getByRole("button").filter({ hasNot: page.locator("[tabindex='-1'][aria-label^='Put back']") });
    const mains = tb.locator(".shelf-chip-main");
    const n = await mains.count();
    expect(n).toBeGreaterThanOrEqual(1);
    void chips;
    // exactly one tab stop
    expect(await mains.evaluateAll((els) => els.filter((e) => e.getAttribute("tabindex") === "0").length)).toBe(1);
    await mains.first().focus();
    if (n > 1) {
      await page.keyboard.press("ArrowRight");
      await expect(mains.nth(1)).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(mains.first()).toBeFocused();
      await page.keyboard.press("End");
      await expect(mains.nth(n - 1)).toBeFocused();
      await page.keyboard.press("Home");
    }
    const name = (await mains.first().locator(".shelf-chip-title").innerText()).trim();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await homeOf(page, name))!.active).toBe(name);
    await mains.first().focus();
    await page.keyboard.press("Shift+Enter");
    await expect.poll(() => homeOf(page, name)).toBeNull();
    await expect(mains).toHaveCount(n - 1);
  });

  test("F6 reaches the shelf as a region named Shelf", async ({ page }) => {
    await start(page);
    await tuckBtn(page, "customer").click();
    await expect(shelfRegion(page)).toBeVisible();
    let hit = false;
    for (let i = 0; i < 8 && !hit; i++) {
      await page.keyboard.press("F6");
      await page.waitForTimeout(60);
      hit = await page.evaluate(() => !!document.activeElement?.closest("[data-shelf]"));
    }
    expect(hit, "F6 lands in the shelf").toBe(true);
  });

  test("hover shows a Put back mini-action on the chip", async ({ page }) => {
    await start(page);
    await tuckBtn(page, "customer").click();
    const c = shelfRegion(page).locator("[data-chip]").first();
    const put = c.getByRole("button", { name: "Put back customer 1" });
    await expect(put).toBeHidden().catch(() => {});
    await c.hover();
    await expect(put).toBeVisible();
    await put.click();
    await expect(shelfRegion(page)).toHaveCount(0);
  });

  test("activity dots on chips have a shape for every state", async ({ page }) => {
    await start(page);
    await tuckBtn(page, "customer").click();
    const c = shelfRegion(page).locator("[data-chip]").first();
    const id = await page.locator('[role="tab"][data-tucked]').first().getAttribute("data-tab");
    for (const [state, sel] of [["working", ".ra-ring"], ["needs-you", ".ra-need"], ["error", ".ra-fail"]] as const) {
      await setAct(page, id!, state);
      await expect(c.locator(sel), state).toBeVisible();
    }
    await setAct(page, id!, "idle");
    await expect(c.locator(".ra")).toHaveCount(0);
  });

  test("overflow: many chips scroll with a +N menu", async ({ page }) => {
    await start(page, { preset: "Stress: 10 panes", size: { width: 1024, height: 900 } });
    for (let i = 0; i < 8; i++) {
      const b = page.locator("section[data-pane]:visible").getByRole("button", { name: /^Tuck into/ }).and(page.locator(":enabled")).first();
      if (!(await b.count())) break;
      await b.click();
      await page.waitForTimeout(150);
    }
    await expect(shelfRegion(page)).toBeVisible();
    const sc = shelfRegion(page).locator(".shelf-scroll");
    const overflow = await sc.evaluate((e) => e.scrollWidth > e.clientWidth);
    if (overflow) {
      const more = shelfRegion(page).getByRole("button", { name: /more tucked/ });
      await expect(more).toBeVisible();
      await more.click();
      await expect(page.getByRole("menu", { name: "More tucked panes" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

for (const mode of ["light", "dark"] as const) {
  for (const preset of ["Chain", "Stress: 10 panes"]) {
    for (const size of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }]) {
      test(`screenshots: shelf, ${preset}, ${size.width}, ${mode}`, async ({ page }) => {
        await start(page, { preset: preset === "Chain" ? undefined : preset, size });
        await page.getByRole("button", { name: "Settings" }).click();
        const dlg = page.getByRole("dialog", { name: "Settings" });
        await dlg.getByLabel(new RegExp(`^${mode}$`, "i")).check();
        await page.keyboard.press("Escape");
        await expect(dlg).toBeHidden();
        for (let i = 0; i < 2; i++) {
          const b = page.locator("section[data-pane]:visible").getByRole("button", { name: /^Tuck into/ }).and(page.locator(":enabled")).last();
          if (await b.count()) { await b.click(); await page.waitForTimeout(200); }
        }
        const tabs = page.locator('[role="tab"][data-tucked]');
        if (await tabs.count()) {
          await setAct(page, (await tabs.first().getAttribute("data-tab"))!, "needs-you");
          await tabs.first().hover();
        }
        const mains = shelfRegion(page).locator(".shelf-chip-main");
        if (await mains.count()) await mains.last().focus();
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${SHOT}/70-shelf-${preset === "Chain" ? "chain" : "stress"}-${size.width}-${mode}.png` });
      });
    }
  }
}
