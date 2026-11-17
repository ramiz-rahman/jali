/**
 * The page object for the pane lab. Specs get it as `lab`; it knows nothing about CSS classes where a role,
 * an accessible name or a data-* hook will do. Anything still reached by class or structure is listed in
 * HOOKS below, so the ui engineer can see exactly what to turn into a data-testid.
 */
import { test as base, expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

export type Rect = { x: number; y: number; w: number; h: number };
export type Snap = { rects: Record<string, Rect>; groups: string[] };
export type Size = { width: number; height: number };
export type OpenOpts = { preset?: string; path?: string; size?: Size };

/**
 * Selectors that still depend on structure or classes. Each is used only through the method named here.
 *   dragChip      .drag-chip          wanted: data-testid="drag-chip"          (the chip that follows the pointer)
 *   dividerPreview .divider-visual    wanted: data-testid="divider-preview"    (the line shown during a divider drag)
 *   statusMain    .status-main        wanted: data-testid="status-main"        (count and focus text, right of the shelf)
 *   isZoomed      .is-zoomed          wanted: data-zoomed on the pane section  (main already has data-zoomed)
 *   activity dots .ra-ring/-need/-fail wanted: data-shape on the dot          (shape per activity state)
 */
const HOOKS = {
  dragChip: ".drag-chip",
  dividerPreview: ".divider-visual",
  statusMain: ".status-main",
  zoomed: ".is-zoomed",
};
const SHAPES = { working: ".ra-ring", "needs-you": ".ra-need", error: ".ra-fail" } as const;

const SAME = 1; // px tolerance when comparing rects

export class Lab {
  constructor(readonly page: Page, readonly context: BrowserContext, private readonly writeShots: boolean) {}

  // ---------- locators ----------
  /** The pane section with this id (the shown tab's id for a tab group). */
  pane = (id: string) => this.page.locator(`section[data-pane="${id}"]`);
  header = (id: string) => this.pane(id).locator("header").first();
  heading = (id: string) => this.pane(id).getByRole("heading", { level: 2 });
  grid = (id: string) => this.pane(id).getByRole("grid");
  row = (id: string, name: RegExp) => this.pane(id).getByRole("row", { name }).first();
  main = () => this.page.getByRole("main", { name: "Panes" });
  status = () => this.page.getByRole("contentinfo", { name: "Status" });
  statusMain = () => this.page.locator(HOOKS.statusMain);
  announcer = () => this.page.getByTestId("announcer");
  peek = () => this.page.getByTestId("peek");
  separator = (n = 0) => this.page.getByRole("separator").nth(n);
  tabs = () => this.page.getByRole("tab");
  tab = (name: RegExp) => this.page.getByRole("tab", { name });
  launcher = () => this.page.locator('section[data-kind="launcher"]');
  launcherField = () => this.page.getByRole("combobox", { name: "Open in this pane" });
  dragChip = () => this.page.locator(HOOKS.dragChip);
  dividerPreview = () => this.page.locator(HOOKS.dividerPreview);
  toast = (text: string | RegExp) => this.page.locator("[data-sonner-toast]").filter({ hasText: text });
  shelf = () => this.page.getByRole("region", { name: "Shelf" });
  shelfBar = () => this.shelf().getByRole("toolbar", { name: "Tucked and folded panes" });
  /** Tucked chips (made by the person). Folded ones (made by the layout) are foldedChips. */
  chips = () => this.shelf().locator('[data-chip]:not([data-reason="folded"])');
  foldedChips = () => this.shelf().locator('[data-chip][data-reason="folded"]');
  /** The main button of each shelf chip (not its put-back mini-action). */
  chipMains = () => this.shelfBar().getByRole("button", { name: /Enter shows it/ });
  chip = (title: string) => this.shelf().getByRole("button", { name: new RegExp(`^${title}`) }).first();
  isZoomed = (id: string) => this.page.locator(`section[data-pane="${id}"]${HOOKS.zoomed}`);

  // ---------- boot ----------
  // Data Studio shows a grid or a record's Edit button; the loan review's views show links to related records.
  private ready = () => this.page.getByRole("grid").or(this.page.getByRole("button", { name: /^Edit / })).or(this.page.locator("section[data-pane] button[data-ref]")).first();

  /** Load the app (optionally a layout link and viewport), click a preset, wait until real data is on screen. */
  async open(opts: OpenOpts = {}) {
    if (opts.size) await this.page.setViewportSize(opts.size);
    await this.page.goto(opts.path ?? "/");
    await expect(this.page.locator("section[data-pane]:visible").first()).toBeVisible();
    if (opts.preset) await this.preset(opts.preset, false);
    await expect(this.ready()).toBeVisible({ timeout: 20_000 });
    await this.stable();
    return this;
  }
  async preset(name: string, wait = true) {
    await this.page.getByRole("button", { name }).click();
    if (wait) await this.stable();
  }
  /** A second tab on the same context, wrapped in its own Lab. */
  async fork(path: string, size?: Size) {
    const p = await this.context.newPage();
    if (size) await p.setViewportSize(size);
    const lab = new Lab(p, this.context, this.writeShots);
    await lab.open({ path });
    return lab;
  }

  // ---------- settings ----------
  async setting(label: RegExp) {
    const dlg = this.page.getByRole("dialog", { name: "Settings" });
    await this.page.getByRole("button", { name: "Settings" }).click();
    await expect(dlg).toBeVisible();
    await dlg.getByLabel(label).check();
    await this.page.keyboard.press("Escape");
    await expect(dlg).toBeHidden();
  }

  // ---------- reading the layout ----------
  /** Visible panes (not display:none) left to right, then top to bottom. */
  visibleIds(): Promise<string[]> {
    return this.page.locator("section[data-pane]").evaluateAll((els) =>
      (els as HTMLElement[])
        .filter((e) => getComputedStyle(e).display !== "none")
        .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x || a.getBoundingClientRect().y - b.getBoundingClientRect().y)
        .map((e) => e.dataset.pane!),
    );
  }
  visibleCount = async () => (await this.visibleIds()).length;
  focusedId = () => this.page.locator("section[data-pane][data-focused]").evaluate((e) => (e as HTMLElement).dataset.pane).catch(() => null);
  focusIn = (id: string) => this.page.evaluate((i) => !!document.activeElement?.closest(`section[data-pane="${i}"]`), id);
  width = async (loc: Locator) => Math.round((await loc.boundingBox())!.width);
  attr = async (loc: Locator, name: string) => Number(await loc.getAttribute(name));

  /** Visible panes keyed by tab group (sorted tab names) or, untabbed, by pane id; plus every group's membership. */
  snap(): Promise<Snap> {
    return this.page.locator("section[data-pane]").evaluateAll((els) => {
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
  /** Visible panes by data-pane id. */
  byId(): Promise<Record<string, Rect>> {
    return this.page.locator("section[data-pane]").evaluateAll((els) => {
      const o: Record<string, Rect> = {};
      for (const e of els as HTMLElement[]) {
        if (getComputedStyle(e).display === "none") continue;
        const r = e.getBoundingClientRect();
        o[e.dataset.pane!] = { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      return o;
    });
  }
  /** The visible pane whose tab strip holds the tab with this exact title, with its tabs and selected tab. */
  homeOf(title: string) {
    return this.page.locator("section[data-pane]").evaluateAll((els, t) => {
      for (const e of els as HTMLElement[]) {
        const tabs = Array.from(e.querySelectorAll('[role="tab"]')) as HTMLElement[];
        if (getComputedStyle(e).display !== "none" && tabs.some((x) => (x.textContent ?? "").trim() === t)) {
          return { id: e.dataset.pane!, active: (tabs.find((x) => x.getAttribute("aria-selected") === "true")?.textContent ?? "").trim(), tabs: tabs.map((x) => (x.textContent ?? "").trim()) };
        }
      }
      return null;
    }, title);
  }
  /** The tab group on screen with exactly these tab titles. */
  async group(names: string[]): Promise<Locator> {
    const idx = await this.page.locator("section[data-pane]").evaluateAll((els, want) =>
      (els as HTMLElement[]).findIndex((e) => {
        if (getComputedStyle(e).display === "none") return false;
        const tabs = Array.from(e.querySelectorAll('[role="tab"]')).map((t) => (t.textContent ?? "").trim()).sort();
        return tabs.join("|") === (want as string[]).join("|");
      }), names);
    expect(idx, `group ${names.join("|")} exists`).toBeGreaterThanOrEqual(0);
    return this.page.locator("section[data-pane]").nth(idx);
  }

  /** Differences between two snaps as readable lines; empty when they match within 1px. */
  static diff(a: Snap, b: Snap, skip: string[] = []): string[] {
    const out: string[] = [];
    if (JSON.stringify(a.groups) !== JSON.stringify(b.groups)) out.push(`tab membership ${JSON.stringify(a.groups)} -> ${JSON.stringify(b.groups)}`);
    const ka = Object.keys(a.rects).filter((k) => !skip.includes(k)).sort();
    const kb = Object.keys(b.rects).filter((k) => !skip.includes(k)).sort();
    if (JSON.stringify(ka) !== JSON.stringify(kb)) out.push(`visible panes ${JSON.stringify(ka)} -> ${JSON.stringify(kb)}`);
    for (const k of ka) {
      const [p, q] = [a.rects[k], b.rects[k]];
      if (!p || !q) continue;
      for (const f of ["x", "y", "w", "h"] as const) if (Math.abs(p[f] - q[f]) > SAME) out.push(`${k} ${f} ${p[f]} -> ${q[f]}`);
    }
    return out;
  }
  static sameRect = (a: Rect, b: Rect) => (["x", "y", "w", "h"] as const).every((f) => Math.abs(a[f] - b[f]) <= SAME);

  /** Retry until the layout matches `before`, or fail with the differences. */
  async expectSnap(before: Snap, label: string, skip: string[] = []) {
    await expect.poll(async () => Lab.diff(before, await this.snap(), skip), { message: label, timeout: 8_000 }).toEqual([]);
  }

  // ---------- waiting ----------
  /** Wait until the layout stops moving: the same rects on three reads in a row. Replaces fixed sleeps after resize, click and key. */
  async stable() {
    let last = "", same = 0;
    await expect.poll(async () => {
      const s = JSON.stringify(await this.snap());
      same = s === last ? same + 1 : 0;
      last = s;
      return same >= 3;
    }, { intervals: [60], timeout: 10_000, message: "layout settles" }).toBe(true);
  }
  /** Let queued animation frames run. The app moves DOM focus on the next frame after tuck, put back and reveal, so a test that moves focus itself waits for that first. */
  frames = (n = 2) => this.page.evaluate((count) => new Promise<void>((done) => {
    const step = (left: number) => (left <= 0 ? done() : requestAnimationFrame(() => step(left - 1)));
    step(count);
  }), n);
  fetches = async () => Number(await this.page.getByTestId("fetch-stats").locator("b").first().innerText());
  /** Wait until the fetch counter has not moved for 1.1s (the status line samples it every 500ms); returns the final count. */
  async settle() {
    let last = -1, since = Date.now();
    await expect.poll(async () => {
      const n = await this.fetches();
      if (n !== last) { last = n; since = Date.now(); }
      return Date.now() - since >= 1_100;
    }, { intervals: [250], timeout: 25_000, message: "fetch counter settles" }).toBe(true);
    return last;
  }

  // ---------- live region ----------
  /** Record every non-empty text the live region shows from now on. */
  async recordAnnouncements() {
    await this.page.evaluate(() => {
      const el = document.querySelector('[data-testid="announcer"]')!;
      const w = window as unknown as { __ann: string[] };
      w.__ann = [];
      new MutationObserver(() => { const t = (el.textContent ?? "").trim(); if (t) w.__ann.push(t); }).observe(el, { childList: true, characterData: true, subtree: true });
    });
  }
  announcements = () => this.page.evaluate(() => (window as unknown as { __ann: string[] }).__ann);
  /** Retry until some announcement matches. */
  async expectAnnounced(re: RegExp) {
    await expect.poll(async () => (await this.announcements()).some((m) => re.test(m)), { message: `announced ${re}` }).toBe(true);
  }

  // ---------- tuck ----------
  tuck = (id: string) => this.pane(id).getByRole("button", { name: /^Tuck / });
  /** An enabled Tuck button on a visible pane. `which` picks the first or last one in DOM order. */
  firstTuckable = (which: "first" | "last" = "first") => {
    const l = this.page.locator("section[data-pane]:visible").getByRole("button", { name: /^Tuck into/ }).and(this.page.locator(":enabled"));
    return which === "first" ? l.first() : l.last();
  };
  putBackTab = async (title: RegExp) => {
    const tab = this.tab(title);
    await tab.hover();
    await tab.getByRole("button", { name: /^Put back / }).click();
  };
  /** Set a pane's activity through the dev hook the app exposes (window.__lab). */
  setActivity = (id: string, a: string) => this.page.evaluate(([i, v]) => (window as unknown as { __lab: { actions: { setActivity(i: string, v: string): void } } }).__lab.actions.setActivity(i!, v!), [id, a]);
  static shape = (state: keyof typeof SHAPES) => SHAPES[state];

  // ---------- pointer ----------
  /** Drag a pane by its header grip towards another pane's left edge, right edge or centre. Pass release:false to inspect the drop hint. */
  async drag(fromId: string, toId: string, where: "centre" | "left" | "right", opts: { release?: boolean } = {}) {
    const from = (await this.header(fromId).boundingBox())!;
    const to = (await this.pane(toId).boundingBox())!;
    const tx = where === "centre" ? to.x + to.width / 2 : where === "left" ? to.x + 20 : to.x + to.width - 20;
    const ty = to.y + to.height / 2;
    await this.page.mouse.move(from.x + from.width / 2 - 60, from.y + from.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(from.x + from.width / 2 - 40, from.y + from.height / 2 + 10, { steps: 3 }); // past the 4px threshold
    await this.page.mouse.move(tx, ty, { steps: 12 });
    if (opts.release !== false) await this.page.mouse.up();
  }

  // ---------- screenshots ----------
  /** Writes docs/screens/<name>.png in the `screens` project only; a no-op in normal runs. */
  async shot(name: string) {
    if (!this.writeShots) return;
    await this.stable();
    await this.page.screenshot({ path: `docs/screens/${name}.png` });
  }
}

export const test = base.extend<{ lab: Lab }>({
  lab: async ({ page, context }, use, info) => {
    await use(new Lab(page, context, info.project.name === "screens"));
  },
});
export { expect };
