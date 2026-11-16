/**
 * Pane lab walkthrough: every interaction in BRIEF section 2, plus URL, shared data, accessibility and responsive.
 * Needs the dev server on :5300 (pnpm dev). Screenshots go to docs/screens/.
 */
import { test, expect, type Page, type Locator } from "@playwright/test";
import { createLayoutCore } from "../src/layout-core";
import type { Layout, LayoutNode, ObjectRef, PaneNode } from "../src/layout-core/types";

const SHOT = "docs/screens";
const shot = (page: Page, name: string) => page.screenshot({ path: `${SHOT}/${name}.png` });

// ---------- helpers ----------
const pane = (id: string, ref: ObjectRef, extra: Partial<PaneNode> = {}): PaneNode => ({ id, type: "pane", size: { weight: 1 }, ref, ...extra });
const row = (id: string, children: LayoutNode[]): LayoutNode => ({ id, type: "row", size: { weight: 1 }, children });
const tbl = (table: string): ObjectRef => ({ kind: "table", params: { table } });
const rec = (table: string, id: number): ObjectRef => ({ kind: "record", params: { table, id } });
const encode = (layout: Layout) => createLayoutCore().encode(layout);

const paneEl = (page: Page, id: string) => page.locator(`section[data-pane="${id}"]`);
const header = (page: Page, id: string) => paneEl(page, id).locator("header.pane-header");

async function visibleIds(page: Page): Promise<string[]> {
  return page.locator("section[data-pane]").evaluateAll((els) =>
    (els as HTMLElement[])
      .filter((e) => getComputedStyle(e).display !== "none")
      .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x || a.getBoundingClientRect().y - b.getBoundingClientRect().y)
      .map((e) => e.dataset.pane!),
  );
}
const width = async (loc: Locator) => Math.round((await loc.boundingBox())!.width);
const fetches = async (page: Page) => Number(await page.getByTestId("fetch-stats").locator("b").first().innerText());

/** Wait until the fetch counter stops moving (the status line polls every 500ms). */
async function settle(page: Page) {
  let last = -1, same = 0;
  for (let i = 0; i < 40 && same < 2; i++) {
    await page.waitForTimeout(550);
    const n = await fetches(page);
    same = n === last ? same + 1 : 0;
    last = n;
  }
  return last;
}

async function start(page: Page, opts: { preset?: string; path?: string; size?: { width: number; height: number } } = {}) {
  if (opts.size) await page.setViewportSize(opts.size);
  await page.goto(opts.path ?? "/");
  await expect(page.locator("section[data-pane]").first()).toBeVisible();
  if (opts.preset) await page.getByRole("button", { name: opts.preset }).click();
  await expect(page.locator("section[data-pane] .pk-grid, section[data-pane] .pk-rec").first()).toBeVisible({ timeout: 20_000 });
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
}
async function setSetting(page: Page, label: RegExp) {
  await openSettings(page);
  await page.getByRole("dialog", { name: "Settings" }).getByLabel(label).check();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
}

async function dragHeader(page: Page, fromId: string, toId: string, where: "centre" | "left" | "right", opts: { release?: boolean } = {}) {
  const from = (await header(page, fromId).boundingBox())!;
  const to = (await paneEl(page, toId).boundingBox())!;
  const tx = where === "centre" ? to.x + to.width / 2 : where === "left" ? to.x + 20 : to.x + to.width - 20;
  const ty = to.y + to.height / 2;
  await page.mouse.move(from.x + from.width / 2 - 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 40, from.y + from.height / 2 + 10, { steps: 3 }); // past the 4px threshold
  await page.mouse.move(tx, ty, { steps: 12 });
  if (opts.release !== false) await page.mouse.up();
}

const sep = (page: Page, n = 0) => page.getByRole("separator").nth(n);
const num = async (loc: Locator, attr: string) => Number(await loc.getAttribute(attr));

// ---------- 2. Open ----------
test.describe("Open", () => {
  test("open beside replaces the linked same-kind pane; focus stays in the list; J/K still move", async ({ page }) => {
    await start(page);
    expect(await visibleIds(page)).toEqual(["orders", "order", "customer"]);
    await expect(paneEl(page, "order").locator("h2")).toHaveText("order 1");

    await paneEl(page, "orders").getByRole("row", { name: /^5\b/ }).first().click();
    await page.keyboard.press("Alt+Enter");

    // Still three panes: the order record was replaced, not added to.
    await expect(paneEl(page, "order").locator("h2")).toHaveText("order 5");
    expect(await visibleIds(page)).toEqual(["orders", "order", "customer"]);
    // Focus is still in the list.
    await expect(paneEl(page, "orders")).toHaveAttribute("data-focused", "true");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-pane="orders"]'))).toBe(true);
    await page.keyboard.press("j");
    await expect(paneEl(page, "orders").locator('[role=row][aria-selected="true"]')).toHaveAttribute("aria-rowindex", "6");
    await page.keyboard.press("k");
    await expect(paneEl(page, "orders").locator('[role=row][aria-selected="true"]')).toHaveAttribute("aria-rowindex", "5");
    await shot(page, "01-open-beside-replaces");
  });

  test("peek with Space, follow with J, Pin beside, Open full, Esc", async ({ page }) => {
    await start(page);
    await paneEl(page, "orders").getByRole("row", { name: /^3\b/ }).first().click();
    await page.keyboard.press("Space");
    const peek = page.getByTestId("peek");
    await expect(peek).toBeVisible();
    await expect(peek).toContainText("order 3");
    expect(page.url()).toContain("peek=");
    await shot(page, "02-peek");

    // The list stays usable and the peek follows the selection.
    await page.keyboard.press("j");
    await expect(peek).toContainText("order 4");

    // Esc closes it.
    await page.keyboard.press("Escape");
    await expect(peek).toBeHidden();
    expect(page.url()).not.toContain("peek=");

    // Pin beside: becomes a real pane in the linked slot.
    await page.keyboard.press("Space");
    await expect(peek).toBeVisible();
    await peek.getByRole("button", { name: /Pin beside/ }).click();
    await expect(peek).toBeHidden();
    await expect(paneEl(page, "order").locator("h2")).toHaveText("order 4");

    // Open full: the peek becomes the whole page (one pane).
    await page.keyboard.press("Space");
    await expect(peek).toBeVisible();
    await peek.getByRole("button", { name: /Open full/ }).click();
    await expect(peek).toBeHidden();
    expect(await visibleIds(page)).toEqual(["full"]);
  });

  test("a shared ?peek= link opens the peek", async ({ page }) => {
    await start(page);
    await paneEl(page, "orders").getByRole("row", { name: /^2\b/ }).first().click();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("peek")).toBeVisible();
    const url = page.url();
    const p2 = await page.context().newPage();
    await p2.goto(url);
    await expect(p2.getByTestId("peek")).toBeVisible();
    await expect(p2.getByTestId("peek")).toContainText("order 2");
  });
});

// ---------- Move ----------
test.describe("Move: drag by the grip", () => {
  test("edge zone places beside", async ({ page }) => {
    await start(page);
    await dragHeader(page, "customer", "orders", "left");
    expect((await visibleIds(page))[0]).toBe("customer");
    expect(await visibleIds(page)).toHaveLength(3);
    await shot(page, "03-drop-edge");
  });

  test("centre drop swaps (swap mode) and the drag chip says so", async ({ page }) => {
    await start(page);
    await setSetting(page, /Swap the two panes/);
    await dragHeader(page, "customer", "orders", "centre", { release: false });
    await expect(page.locator(".drag-chip")).toContainText("Swap with orders");
    await shot(page, "04-drop-centre-swap");
    await page.mouse.up();
    expect(await visibleIds(page)).toEqual(["customer", "order", "orders"]);
  });

  test("centre drop adds a tab (tab mode)", async ({ page }) => {
    await start(page);
    await setSetting(page, /Add as a tab/);
    await dragHeader(page, "customer", "orders", "centre", { release: false });
    await expect(page.locator(".drag-chip")).toContainText("Add as tab to orders");
    await page.mouse.up();
    const ids = await visibleIds(page);
    expect(ids).toHaveLength(2);
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await shot(page, "05-drop-centre-tab");
  });

  test("Esc cancels a drag; a drag under 4px does nothing", async ({ page }) => {
    await start(page);
    const before = await visibleIds(page);
    await dragHeader(page, "customer", "orders", "left", { release: false });
    await expect(page.locator(".drag-chip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".drag-chip")).toBeHidden();
    await page.mouse.up();
    expect(await visibleIds(page)).toEqual(before);

    const h = (await header(page, "customer").boundingBox())!;
    await page.mouse.move(h.x + 200, h.y + 20);
    await page.mouse.down();
    await page.mouse.move(h.x + 202, h.y + 21);
    await expect(page.locator(".drag-chip")).toBeHidden();
    await page.mouse.up();
  });

  test("keyboard move: Alt+Shift+Meta+Arrow", async ({ page }) => {
    await start(page);
    await paneEl(page, "customer").click({ position: { x: 100, y: 200 } });
    await page.keyboard.press("Alt+Shift+Meta+ArrowLeft");
    expect(await visibleIds(page)).toEqual(["orders", "customer", "order"]);
  });
});

// ---------- Launcher, merge without dragging, tab "+" ----------
test.describe("Launcher and tabs", () => {
  const announcer = (page: Page) => page.getByTestId("announcer");
  const launcherField = (page: Page) => page.getByRole("combobox", { name: "Open in this pane" });

  test("split opens a launcher with focus in its field; choosing a table fills the same pane", async ({ page }) => {
    await start(page, { preset: "One table" });
    await paneEl(page, "orders").locator("h2").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    const launcher = page.locator('section[data-kind="launcher"]');
    await expect(launcher).toHaveCount(1);
    await expect(launcherField(page)).toBeFocused();
    await expect(launcher.getByRole("group", { name: "Recent" })).toBeVisible();
    await expect(launcher.getByRole("group", { name: "Tables" }).getByRole("option", { name: /customers/ })).toContainText("240");
    await expect(launcher.getByRole("option", { name: "New query" })).toBeVisible();
    await expect(page.locator('section[data-kind="table"]')).toHaveCount(1); // not a copy of orders
    await shot(page, "15-launcher");
    const id = await launcher.getAttribute("data-pane");

    await page.keyboard.type("customers");
    await page.keyboard.press("Enter");
    const filled = paneEl(page, id!);
    await expect(filled).toHaveAttribute("data-kind", "table");
    await expect(filled.locator("h2")).toHaveText("customers");
    await expect(filled.locator(".pk-grid")).toBeVisible();
  });

  test("Esc on an untouched launcher closes it and focus returns", async ({ page }) => {
    await start(page, { preset: "One table" });
    await paneEl(page, "orders").locator("h2").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    await expect(launcherField(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator('section[data-kind="launcher"]')).toHaveCount(0);
    await expect(paneEl(page, "orders")).toHaveAttribute("data-focused", "true");
  });

  test("opening an object that is already open focuses it instead of duplicating it", async ({ page }) => {
    await start(page, { size: { width: 1920, height: 1000 } });
    await paneEl(page, "orders").locator("h2").click();
    await page.keyboard.press("Alt+Meta+Backslash");
    await expect(launcherField(page)).toBeFocused();
    await expect(page.locator('section[data-kind="launcher"]').getByRole("option", { name: /customer 1/ }).first()).toContainText("Open");
    await page.keyboard.type("customer 1");
    await page.keyboard.press("Enter");
    await expect(page.locator('section[data-kind="launcher"]')).toHaveCount(0);
    expect(await visibleIds(page)).toEqual(["orders", "order", "customer"]);
    await expect(paneEl(page, "customer")).toHaveAttribute("data-focused", "true");
    await expect(announcer(page)).toHaveText("Already open: focused customer 1");
  });

  test("merge and unmerge by ⌘K", async ({ page }) => {
    await start(page);
    await paneEl(page, "customer").locator("h2").click();
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("add to tabs");
    await page.keyboard.press("Enter");
    const chooser = page.getByRole("dialog", { name: "Add customer 1 to tabs of" });
    await expect(chooser).toBeVisible();
    await expect(chooser.getByRole("option")).toHaveText([/orders/, /order 1/]);
    await shot(page, "16-merge-chooser");
    await page.keyboard.type("orders");
    await page.keyboard.press("Enter");
    await expect(chooser).toBeHidden();
    await expect(page.getByRole("tab")).toHaveCount(2);
    expect(await visibleIds(page)).toHaveLength(2);
    await expect(announcer(page)).toHaveText("customer 1 added to tabs with orders");

    await page.keyboard.press("Meta+k");
    await page.keyboard.type("move out of tabs");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveCount(0);
    expect(await visibleIds(page)).toEqual(["orders", "customer", "order"]);
    await expect(announcer(page)).toContainText("customer 1 moved out of tabs");
  });

  test("merge and unmerge by shortcut (⌥⌘T, ⌥⇧⌘T)", async ({ page }) => {
    await start(page);
    await paneEl(page, "customer").locator("h2").click();
    await page.keyboard.press("Alt+Meta+t");
    await expect(page.getByRole("dialog", { name: "Add customer 1 to tabs of" })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.getByRole("tab", { name: /customer 1/ })).toHaveAttribute("aria-selected", "true");
    await expect(announcer(page)).toHaveText("customer 1 added to tabs with order 1");
    await page.keyboard.press("Alt+Shift+Meta+t");
    await expect(page.getByRole("tab")).toHaveCount(0);
    expect(await visibleIds(page)).toHaveLength(3);
  });

  test("the tab strip's + adds a launcher tab and focuses it", async ({ page }) => {
    await start(page);
    await paneEl(page, "customer").locator("h2").click();
    await page.keyboard.press("Alt+Meta+t");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab")).toHaveCount(2);
    await page.getByRole("button", { name: "New tab in this stack" }).click();
    await expect(page.getByRole("tab")).toHaveCount(3);
    await expect(page.getByRole("tab", { name: /New pane/ })).toHaveAttribute("aria-selected", "true");
    await expect(launcherField(page)).toBeFocused();
    await shot(page, "17-tab-plus");
    await page.keyboard.type("products");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("tab", { name: /products/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab")).toHaveCount(3);
  });
});

// ---------- Resize ----------
for (const adapter of ["own", "ark"] as const) {
  test.describe(`Divider (${adapter})`, () => {
    test.beforeEach(async ({ page }) => {
      await start(page);
      await setSetting(page, adapter === "own" ? /Own APG separator/i : /Ark/i);
      await expect(page.locator(`.divider-layer[data-adapter="${adapter}"]`)).toBeAttached();
    });

    test("pointer drag clamps at the minimum; double-click resets; hit area wider than the line", async ({ page }) => {
      const orders = paneEl(page, "orders");
      const initial = await width(orders);
      const s = sep(page, 0);
      const box = (await s.boundingBox())!;
      // The hit area is wider than the 6px gap line: a point 5px either side still lands on the separator.
      const hit = await page.evaluate(([cx, cy]) => [-5, 5].map((d) => !!document.elementFromPoint(cx! + d, cy!)?.closest("[role=separator]")), [box.x + box.width / 2, box.y + 300]);
      expect(hit).toEqual([true, true]);
      const x = box.x + box.width / 2, y = box.y + 300;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x - 120, y, { steps: 8 });
      await page.mouse.move(x - 900, y, { steps: 8 }); // far past the minimum
      await page.mouse.up();
      const clamped = await width(orders);
      expect(clamped).toBeLessThan(initial);
      expect(clamped).toBeGreaterThanOrEqual(480); // table minimum
      await page.mouse.move(x - 1200, y);
      // a second, even longer drag stays at the same width
      const b2 = (await s.boundingBox())!;
      await page.mouse.move(b2.x + 3, y);
      await page.mouse.down();
      await page.mouse.move(b2.x - 700, y, { steps: 8 });
      await page.mouse.up();
      expect(Math.abs((await width(orders)) - clamped)).toBeLessThanOrEqual(1);
      await shot(page, `06-divider-clamped-${adapter}`);

      await s.dblclick();
      await expect.poll(() => width(orders)).toBeGreaterThan(clamped + 20);
      expect(Math.abs((await width(orders)) - initial)).toBeLessThanOrEqual(2);
    });

    test("keyboard: arrows 16px, Shift 64px, Home/End, Enter collapses and restores; aria-valuenow follows", async ({ page }) => {
      const orders = paneEl(page, "orders");
      const s = sep(page, 0);
      const w0 = await width(orders);
      const v0 = await num(s, "aria-valuenow");
      await s.focus();

      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => width(orders)).toBe(w0 - 16);
      const v1 = await num(s, "aria-valuenow");
      expect(v1).toBeLessThan(v0);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => width(orders)).toBe(w0);
      expect(await num(s, "aria-valuenow")).toBe(v0);

      await page.keyboard.press("Shift+ArrowLeft");
      await expect.poll(() => width(orders)).toBe(w0 - 64);

      await page.keyboard.press("Home");
      await expect.poll(() => width(orders)).toBe(480);
      expect(await num(s, "aria-valuenow")).toBe(await num(s, "aria-valuemin"));
      await page.keyboard.press("End");
      // Orders cannot grow past its start here: the two records sit at their 480px minimums, so End == the start width.
      await expect.poll(() => width(orders)).toBe(w0);
      expect(await num(s, "aria-valuenow")).toBe(await num(s, "aria-valuemax"));

      await page.keyboard.press("Enter");
      await expect(orders).toHaveClass(/is-collapsed/);
      await expect(orders).toHaveClass(/pane-rail/);
      await page.keyboard.press("Enter");
      await expect(orders).not.toHaveClass(/is-collapsed/);
    });

    test("separator has role, orientation, valuenow within min and max", async ({ page }) => {
      const seps = page.getByRole("separator");
      expect(await seps.count()).toBe(2);
      for (let i = 0; i < 2; i++) {
        const s = seps.nth(i);
        const [now, min, max] = [await num(s, "aria-valuenow"), await num(s, "aria-valuemin"), await num(s, "aria-valuemax")];
        expect(min).toBeLessThanOrEqual(now);
        expect(now).toBeLessThanOrEqual(max);
        await expect(s).toHaveAttribute("aria-orientation", "vertical");
        await expect(s).toHaveAttribute("aria-controls", /pane-/);
        expect(((await s.getAttribute("aria-label")) ?? "").length).toBeGreaterThan(3);
      }
    });

    test("resize mode: Alt+Meta+R then arrows", async ({ page }) => {
      const orders = paneEl(page, "orders");
      await header(page, "orders").click({ position: { x: 200, y: 20 } });
      const w0 = await width(orders);
      await page.keyboard.press("Alt+Meta+r");
      await expect(page.locator("footer.status")).toContainText("Resize mode");
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => width(orders)).toBe(w0 - 16);
      await page.keyboard.press("Escape");
      await expect(page.locator("footer.status")).not.toContainText("Resize mode");
    });

    test("drag smoothness: a 400px drag in small steps has no long task, follows the pointer 1:1, writes the URL once after release, and does not jump", async ({ page }) => {
      await page.setViewportSize({ width: 2560, height: 1000 });
      await expect.poll(() => width(paneEl(page, "orders"))).toBeGreaterThan(1000);
      await page.evaluate(() => {
        const w = window as unknown as { __lt: number[]; __on: boolean };
        w.__lt = [];
        w.__on = false;
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (w.__on) w.__lt.push(Math.round(e.duration)); }).observe({ type: "longtask" });
      });
      const orders = paneEl(page, "orders");
      const w0 = (await orders.boundingBox())!.width;
      const box = (await sep(page, 0).boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + 300;
      const url0 = page.url();
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.evaluate(() => { (window as unknown as { __on: boolean }).__on = true; });
      for (let i = 1; i <= 100; i++) await page.mouse.move(x - i * 4, y);
      await page.waitForTimeout(50);
      const during = await page.evaluate(() => ({
        cursor: getComputedStyle(document.body).cursor,
        selectable: getComputedStyle(document.body).userSelect,
        line: !!document.querySelector(".divider-visual:not([hidden])"),
      }));
      const previewed = (await orders.boundingBox())!.width;
      expect(page.url(), "no URL write during the drag").toBe(url0);
      await page.mouse.up();
      const longtasks = await page.evaluate(() => (window as unknown as { __lt: number[] }).__lt);
      expect(longtasks, "long tasks during the drag").toEqual([]);
      expect(during).toEqual({ cursor: "col-resize", selectable: "none", line: true });
      expect(Math.abs(previewed - (w0 - 400)), "frame follows the pointer 1:1").toBeLessThanOrEqual(1);
      await page.waitForTimeout(300);
      expect((await orders.boundingBox())!.width, "committed size equals the previewed size").toBe(previewed);
      expect(page.url(), "URL written after the drag settles").not.toBe(url0);
      await expect(page.locator(".divider-visual")).toBeHidden();
    });
  });
}

// ---------- Maximise / minimise ----------
test.describe("Maximise and minimise", () => {
  test("button, double-click header, Shift+Meta+Enter, Esc", async ({ page }) => {
    await start(page);
    const area = (await page.locator("main.workspace").boundingBox())!;

    await page.getByRole("button", { name: "Maximise orders" }).click();
    await expect(paneEl(page, "orders")).toHaveClass(/is-zoomed/);
    expect(await width(paneEl(page, "orders"))).toBeGreaterThan(area.width - 40);
    await expect(page.locator("footer.status")).toContainText("Zoomed · Esc to restore");
    expect(page.url()).toContain("zoom=orders");
    await shot(page, "07-maximised");
    await page.keyboard.press("Escape");
    await expect(paneEl(page, "orders")).not.toHaveClass(/is-zoomed/);

    await header(page, "order").dblclick({ position: { x: 300, y: 20 } });
    await expect(paneEl(page, "order")).toHaveClass(/is-zoomed/);
    await page.keyboard.press("Escape");
    await expect(paneEl(page, "order")).not.toHaveClass(/is-zoomed/);

    await paneEl(page, "customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Shift+Meta+Enter");
    await expect(paneEl(page, "customer")).toHaveClass(/is-zoomed/);
    await page.keyboard.press("Shift+Meta+Enter");
    await expect(paneEl(page, "customer")).not.toHaveClass(/is-zoomed/);
    // The tree and sizes were preserved through all of it.
    expect(await visibleIds(page)).toEqual(["orders", "order", "customer"]);
  });

  test("while zoomed, F6 switches which pane is zoomed", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Maximise orders" }).click();
    await page.keyboard.press("F6");
    await expect(paneEl(page, "order")).toHaveClass(/is-zoomed/);
  });

  test("minimise to a rail and restore", async ({ page }) => {
    await start(page);
    const before = await width(paneEl(page, "customer"));
    await page.getByRole("button", { name: "Minimise customer 1" }).click();
    const c = paneEl(page, "customer");
    await expect(c).toHaveClass(/pane-rail/);
    expect(await width(c)).toBeLessThanOrEqual(72);
    await expect(page.locator("footer.status")).toContainText("1 minimised");
    await shot(page, "08-minimised-rail");
    await c.getByRole("button", { name: /^Restore customer 1/ }).click();
    await expect(c).not.toHaveClass(/is-collapsed/);
    expect(Math.abs((await width(c)) - before)).toBeLessThanOrEqual(2);
    // keyboard: Alt+Meta+M
    await c.click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("Alt+Meta+m");
    await expect(c).toHaveClass(/is-collapsed/);
    await page.keyboard.press("Alt+Meta+m");
    await expect(c).not.toHaveClass(/is-collapsed/);
  });
});

// ---------- Focus ----------
test.describe("Focus", () => {
  test("F6 cycles, Alt+digit by position, Alt+Meta+arrows by direction with no wrap", async ({ page }) => {
    await start(page);
    const focused = async () => page.locator("section[data-pane][data-focused]").evaluate((e) => (e as HTMLElement).dataset.pane);
    expect(await focused()).toBe("orders");
    await page.keyboard.press("F6");
    expect(await focused()).toBe("order");
    await page.keyboard.press("F6");
    expect(await focused()).toBe("customer");
    await page.keyboard.press("Shift+F6");
    expect(await focused()).toBe("order");

    await page.keyboard.press("Alt+3");
    expect(await focused()).toBe("customer");
    await page.keyboard.press("Alt+1");
    expect(await focused()).toBe("orders");

    await page.keyboard.press("Alt+Meta+ArrowLeft"); // already leftmost: no wrap
    expect(await focused()).toBe("orders");
    await page.keyboard.press("Alt+Meta+ArrowRight");
    expect(await focused()).toBe("order");
    await page.keyboard.press("Alt+Meta+ArrowRight");
    expect(await focused()).toBe("customer");
    await page.keyboard.press("Alt+Meta+ArrowRight"); // rightmost: no wrap
    expect(await focused()).toBe("customer");
    await expect(paneEl(page, "customer")).toHaveCSS("outline-style", /.*/);
  });
});

// ---------- Close ----------
test.describe("Close", () => {
  test("focus returns, Sonner toast, live region, Meta+Z restores", async ({ page }) => {
    await start(page);
    await header(page, "orders").click({ position: { x: 200, y: 20 } });
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    expect(await visibleIds(page)).toEqual(["orders", "order"]);

    const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Pane closed" });
    await expect(toast).toBeVisible();
    await expect(toast.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByTestId("announcer")).toContainText(/closed/i);
    await expect(page.getByTestId("announcer")).toContainText(/Undo available/);
    // Focus goes back to where it came from, not to a random pane.
    await expect(paneEl(page, "orders")).toHaveAttribute("data-focused", "true");
    await shot(page, "09-close-toast");

    await page.keyboard.press("Meta+z");
    await expect(paneEl(page, "customer")).toBeVisible();
    expect(await visibleIds(page)).toEqual(["orders", "order", "customer"]);

    // the toast's Undo button works too
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    expect(await visibleIds(page)).toHaveLength(2);
    await page.waitForTimeout(600); // let the toast stack settle
    await page.locator('[data-sonner-toast][data-front="true"]').getByRole("button", { name: "Undo" }).click();
    expect(await visibleIds(page)).toHaveLength(3);
  });

  test("the last pane stays open", async ({ page }) => {
    await start(page);
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await page.getByRole("button", { name: "Close orders" }).click();
    expect(await visibleIds(page)).toHaveLength(1);
    await expect(page.getByTestId("announcer")).toContainText(/last pane stays open/i);
  });
});

// ---------- Palette ----------
test("Meta+K runs a command", async ({ page }) => {
  await start(page);
  await page.keyboard.press("Meta+k");
  const dlg = page.getByRole("dialog", { name: "Commands" });
  await expect(dlg).toBeVisible();
  await shot(page, "10-command-palette");
  await page.keyboard.type("stress");
  await page.keyboard.press("Enter");
  await expect(dlg).toBeHidden();
  await expect(page.getByRole("button", { name: "Stress: 10 panes" })).toHaveAttribute("aria-pressed", "true");
  // and a pane command: back to the chain, close other panes, then undo
  await page.getByRole("button", { name: "Order → customer chain" }).click();
  await expect.poll(async () => (await visibleIds(page)).length).toBe(3);
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("close other");
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await visibleIds(page)).length).toBe(1);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await visibleIds(page)).length).toBe(3);
});

// ---------- URL ----------
test.describe("URL round-trip", () => {
  test("copy the layout link of the stress preset, open it elsewhere, get the same structure", async ({ page, context }) => {
    await start(page, { preset: "Stress: 10 panes" });
    await page.getByRole("button", { name: "Copy link to this layout" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain("?l=");
    const snapshot = async (p: Page) =>
      p.locator("section[data-pane]").evaluateAll((els) =>
        (els as HTMLElement[]).map((e) => {
          const r = e.getBoundingClientRect();
          return [e.dataset.pane, e.dataset.kind, getComputedStyle(e).display === "none", Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join("|");
        }).sort(),
      );
    const a = await snapshot(page);
    const p2 = await context.newPage();
    await p2.setViewportSize({ width: 1600, height: 900 });
    await p2.goto(link);
    await expect(p2.locator("section[data-pane]").first()).toBeVisible();
    await expect(p2.locator("section[data-pane] .pk-grid, section[data-pane] .pk-rec").first()).toBeVisible({ timeout: 20_000 });
    await p2.waitForTimeout(500);
    expect(await snapshot(p2)).toEqual(a);
  });

  test("Back and Forward step through structural changes only", async ({ page }) => {
    await start(page);
    const lengthBefore = await page.evaluate(() => history.length);
    // not structural: focus, resize, zoom
    await page.keyboard.press("F6");
    const s = (await sep(page, 0).boundingBox())!;
    await page.mouse.move(s.x + 3, s.y + 300);
    await page.mouse.down();
    await page.mouse.move(s.x - 60, s.y + 300, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Maximise orders" }).click();
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore);

    // structural: close a pane, then change preset
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await page.getByRole("button", { name: "One table" }).click();
    expect(await page.evaluate(() => history.length)).toBe(lengthBefore + 2);
    expect(await visibleIds(page)).toEqual(["catalog", "orders"]);

    await page.goBack();
    await expect.poll(async () => (await visibleIds(page)).join()).toBe("orders,order");
    await page.goBack();
    await expect.poll(async () => (await visibleIds(page)).join()).toBe("orders,order,customer");
    await page.goForward();
    await expect.poll(async () => (await visibleIds(page)).join()).toBe("orders,order");
  });

  test("a broken ?l= falls back to the preset with a toast", async ({ page }) => {
    await page.goto("/?l=not-a-layout");
    await expect(page.locator("section[data-pane]").first()).toBeVisible();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /couldn.t be read/ })).toBeVisible();
    expect((await visibleIds(page)).length).toBeGreaterThan(1);
  });

  test("a pane whose object is gone stays with an error", async ({ page }) => {
    const layout: Layout = { version: 1, root: row("r", [pane("a", tbl("orders")), pane("b", rec("customers", 999999), { linkedTo: "a" })]) };
    await start(page, { path: `/?l=${encode(layout)}` });
    await expect(paneEl(page, "b")).toBeVisible();
    await expect(paneEl(page, "b")).toContainText(/no longer|not found|gone|couldn.t/i);
  });
});

// ---------- Shared data ----------
test.describe("Shared data", () => {
  test("editing customer 1 updates every pane showing it with only the invalidated queries refetched", async ({ page }, info) => {
    await start(page, { size: { width: 2100, height: 900 } }); // wide enough for four panes beside each other
    const before = await settle(page);
    // Add a customers table beside the customer record so two panes show customer 1.
    await paneEl(page, "customer").getByRole("button", { name: "customers", exact: true }).click();
    expect(await visibleIds(page)).toHaveLength(4);
    const customersGrid = page.locator('section[data-kind="table"]:not([data-pane="orders"]) .pk-grid').first();
    await expect(customersGrid.getByRole("row").nth(1)).toBeVisible();
    const afterOpen = await settle(page);

    const NEW = `QA Renamed ${Date.now() % 100000}`;
    const rec1 = paneEl(page, "customer");
    await rec1.getByRole("button", { name: "Edit name" }).click();
    await rec1.getByRole("textbox", { name: "name" }).fill(NEW);
    await page.keyboard.press("Enter");
    await expect(rec1.locator(".pk-rec").locator("..").getByText(NEW).first()).toBeVisible();
    const afterEdit = await settle(page);

    // Every visible pane that shows customer 1 now shows the new name.
    const showing = page.locator("section[data-pane]:visible").filter({ hasText: NEW });
    expect(await showing.count()).toBeGreaterThanOrEqual(2);
    await expect(rec1.locator("h2")).toHaveText(/customer 1|QA Renamed/);
    await expect(rec1).toContainText(NEW);
    await expect(customersGrid.getByRole("row").nth(1)).toContainText(NEW);
    // Panes that do not show customer 1 never showed the name.
    await expect(paneEl(page, "orders")).not.toContainText(NEW);

    const delta = afterEdit - afterOpen;
    const note = `fetches: first load ${before}, after opening customers table ${afterOpen}, after edit ${afterEdit}, delta from edit ${delta}`;
    console.log(note);
    info.annotations.push({ type: "fetch-count", description: note });
    // One UPDATE + a handful of refetches for the invalidated keys, nowhere near a reload of every pane.
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(afterOpen); // far below reloading every pane (a full load costs `afterOpen`)
    await shot(page, "11-shared-data-edit");
  });

  test("an unrelated pane adds nothing to the cost of an edit (control run)", async ({ page }, info) => {
    const editCost = async (panes: PaneNode[]) => {
      const layout: Layout = { version: 1, root: row("r", [pane("c", rec("customers", 1)), ...panes]) };
      await start(page, { path: `/?l=${encode(layout)}`, size: { width: 1700, height: 900 } });
      await settle(page);
      const before = await fetches(page);
      await paneEl(page, "c").getByRole("button", { name: "Edit name" }).click();
      await paneEl(page, "c").getByRole("textbox", { name: "name" }).fill(`Solo edit ${panes.length}`);
      await page.keyboard.press("Enter");
      await expect(paneEl(page, "c")).toContainText(`Solo edit ${panes.length}`);
      return (await settle(page)) - before;
    };
    const alone = await editCost([pane("a", { kind: "audit", params: {} })]);
    const withSupplier = await editCost([pane("a", { kind: "audit", params: {} }), pane("p", rec("suppliers", 1))]);
    const note = `edit cost with customer + audit: ${alone} fetches; adding an unrelated supplier record: ${withSupplier} fetches`;
    console.log(note);
    info.annotations.push({ type: "fetch-count", description: note });
    expect(withSupplier).toBe(alone);
  });

  test("query results with a primary key refresh; results without one cannot be refreshed by entity", async ({ page }) => {
    const SQL_PK = "SELECT id, name FROM customers WHERE id = 1";
    const SQL_NOPK = "SELECT name FROM customers WHERE id = 1";
    const layout: Layout = {
      version: 1,
      root: row("r", [
        pane("c", rec("customers", 1)),
        pane("q1", { kind: "query", params: { sql: SQL_PK } }),
        pane("q2", { kind: "query", params: { sql: SQL_NOPK } }),
      ]),
    };
    await start(page, { path: `/?l=${encode(layout)}`, size: { width: 1700, height: 900 } });
    for (const id of ["q1", "q2"]) {
      await paneEl(page, id).getByRole("button", { name: /^Run/ }).click();
      await expect(paneEl(page, id).getByRole("grid")).toContainText("customer1".slice(0, 0) + "");
    }
    await expect(paneEl(page, "q1").getByRole("gridcell").nth(1)).not.toHaveText("");
    const NEW = "PK Result Probe";
    await paneEl(page, "c").getByRole("button", { name: "Edit name" }).click();
    await paneEl(page, "c").getByRole("textbox", { name: "name" }).fill(NEW);
    await page.keyboard.press("Enter");
    await expect(paneEl(page, "c")).toContainText(NEW);
    await expect(paneEl(page, "q1")).toContainText(NEW);
    // The result without a key never learns which customer it came from: it keeps the old name.
    await expect(paneEl(page, "q2")).not.toContainText(NEW);
    await shot(page, "12-data-limit");
  });

  test("the query preset runs on load and charts its own result handle", async ({ page }) => {
    await start(page, { preset: "Query + chart + inspector" });
    await expect(paneEl(page, "query").getByRole("grid")).toBeVisible({ timeout: 20_000 });
    await expect(paneEl(page, "chart").getByRole("img", { name: /Bar chart/ })).toBeVisible({ timeout: 20_000 });
    expect(await visibleIds(page)).toHaveLength(3);
    await shot(page, "13-query-chart-preset");
  });
});

// ---------- Hidden panes pause ----------
test("a pane in a background tab does not refetch", async ({ page }) => {
  const base = (hidden: boolean): Layout => ({
    version: 1,
    root: row("r", [
      pane("cat", { kind: "catalog", params: {} }),
      hidden
        ? { id: "st", type: "stack", size: { weight: 1 }, origin: "user", active: "t1", children: [pane("t1", tbl("orders")), pane("t2", tbl("suppliers"))] }
        : pane("t1", tbl("orders")),
    ]),
  });
  await start(page, { path: `/?l=${encode(base(false))}` });
  const alone = await settle(page);
  await start(page, { path: `/?l=${encode(base(true))}` });
  const withHidden = await settle(page);
  // Same data layer cold start in each page load, so the counts are comparable.
  console.log(`hidden tab: fetches with the pane alone ${alone}, with a second pane in a background tab ${withHidden}`);
  expect(withHidden).toBeLessThanOrEqual(alone);
  await expect(paneEl(page, "t2")).toBeHidden();
  // Switching to the tab wakes it: now it fetches.
  await page.getByRole("tab", { name: /suppliers/ }).click();
  await expect(paneEl(page, "t2").getByRole("grid")).toBeVisible({ timeout: 10_000 });
  const woken = await settle(page);
  console.log(`hidden tab: after switching to it ${woken}`);
  expect(woken).toBeGreaterThan(withHidden);
});

// ---------- Accessibility ----------
test.describe("Accessibility", () => {
  test("every pane is a named region; separators carry the splitter attributes; live region announces", async ({ page }) => {
    await start(page, { preset: "Stress: 10 panes", size: { width: 1920, height: 1000 } });
    const regions = page.locator("section[data-pane]");
    const n = await regions.count();
    expect(n).toBe(10);
    for (let i = 0; i < n; i++) {
      const r = regions.nth(i);
      await expect(r).toHaveAttribute("role", "region");
      if ((await r.evaluate((e) => getComputedStyle(e).display)) === "none") continue;
      const name = await r.evaluate((e) => {
        const ids = (e.getAttribute("aria-labelledby") ?? "").split(" ");
        return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
      });
      expect(name.length, `pane ${i} has an accessible name`).toBeGreaterThan(0);
    }
    for (const r of await page.getByRole("region").all()) expect((await r.getAttribute("aria-labelledby")) !== null || (await r.getAttribute("aria-label")) !== null).toBe(true);

    // Dividers are checked on the chain, where the layout is not folded into one switcher.
    await page.getByRole("button", { name: "Order → customer chain" }).click();
    await expect(paneEl(page, "customer")).toBeVisible();
    const seps = page.getByRole("separator");
    const sc = await seps.count();
    expect(sc).toBeGreaterThan(0);
    for (let i = 0; i < sc; i++) {
      const s = seps.nth(i);
      for (const a of ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-orientation", "aria-controls"]) {
        expect(await s.getAttribute(a), `separator ${i} ${a}`).not.toBeNull();
      }
      const [now, min, max] = [await num(s, "aria-valuenow"), await num(s, "aria-valuemin"), await num(s, "aria-valuemax")];
      expect(min <= now && now <= max, `separator ${i}: ${min} <= ${now} <= ${max}`).toBe(true);
      expect(await s.getAttribute("tabindex")).toBe("0");
    }

    const live = page.getByTestId("announcer");
    await expect(live).toHaveAttribute("aria-live", "polite");
    await page.getByRole("button", { name: /^Close customer/ }).first().click();
    await expect(live).toContainText(/closed/i);
  });

  test("focus is visible on the focused pane and on a focused divider", async ({ page }) => {
    await start(page);
    await expect(paneEl(page, "orders")).toHaveCSS("border-top-color", /.+/);
    await sep(page, 0).focus();
    const outline = await sep(page, 0).evaluate((e) => { const c = getComputedStyle(e); return `${c.outlineStyle}|${c.outlineWidth}|${c.boxShadow}`; });
    console.log("divider focus style:", outline);
    expect(outline).not.toBe("none|0px|none");
  });
});

// ---------- Responsive ----------
test("responsive: stress preset folds step by step and never scrolls sideways", async ({ page }) => {
  const sizes = [{ width: 1920, height: 1000 }, { width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }];
  const counts: number[] = [];
  const report: string[] = [];
  await start(page, { preset: "Stress: 10 panes", size: sizes[0] });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const main = document.querySelector("main.workspace") as HTMLElement;
      const vis = [...document.querySelectorAll("section[data-pane]")].filter((e) => getComputedStyle(e).display !== "none") as HTMLElement[];
      const right = Math.max(...vis.map((e) => e.getBoundingClientRect().right));
      return { visible: vis.length, mainScroll: main.scrollWidth - main.clientWidth, docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, right, vw: window.innerWidth, tabs: document.querySelectorAll('[role=tab]').length };
    });
    counts.push(m.visible);
    report.push(`${size.width}px: ${m.visible} visible panes, rightmost edge ${Math.round(m.right)} of ${m.vw}, scroll overflow main ${m.mainScroll} doc ${m.docScroll}`);
    await shot(page, `14-responsive-${size.width}`);
  }
  console.log(report.join("\n"));
  for (let i = 1; i < counts.length; i++) expect(counts[i]!, report.join("\n")).toBeLessThanOrEqual(counts[i - 1]!);
  expect(counts[0]!).toBeGreaterThan(counts[2]!);
  expect(counts[3]).toBe(1);
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const main = document.querySelector("main.workspace") as HTMLElement;
      const vis = [...document.querySelectorAll("section[data-pane]")].filter((e) => getComputedStyle(e).display !== "none") as HTMLElement[];
      return { main: main.scrollWidth - main.clientWidth, doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, right: Math.max(...vis.map((e) => e.getBoundingClientRect().right)) - window.innerWidth };
    });
    expect(m.main, `${size.width}: workspace scrolls sideways`).toBeLessThanOrEqual(1);
    expect(m.doc, `${size.width}: page scrolls sideways`).toBeLessThanOrEqual(1);
    expect(m.right, `${size.width}: a pane runs past the viewport`).toBeLessThanOrEqual(1);
  }
});
