/**
 * The quality checks every example's browser tests share (docs/EXAMPLES-STANDARD.md): an axe scan, a width sweep from
 * a phone to a wide screen, and a console guard. An example's spec imports `test` and `expect` from here instead of
 * from Playwright, so the console guard runs in every test it has, and calls `qualitySuite` once with its layouts.
 *
 *   import { qualitySuite, test, expect } from "../../shared/e2e/quality";
 *   qualitySuite({ storage: "markets", layouts: [{ name: "Equities", open: (page) => page.goto("/") }] });
 *
 * The console guard fails a test on any console error or warning, and on any uncaught error in the page. An example
 * that must live with one names it in `consoleAllow`, with a pattern as narrow as the message allows.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page, type TestInfo } from "@playwright/test";

export { expect };

/** Widths from a small phone to a wide screen, with the usual breakpoints between. */
export const WIDTHS = [360, 390, 480, 600, 768, 900, 1024, 1280, 1440, 1680, 1920, 2200] as const;
/** A short screen too: a laptop's, and a phone's. */
const HEIGHT = (width: number) => (width < 768 ? 780 : 900);

export type Theme = "light" | "dark";
export const THEMES: readonly Theme[] = ["light", "dark"];

interface QualityOptions {
  /** Console messages this example can't avoid, matched against the text; one pattern, as narrow as the messages
   *  allow. (One, not a list: Playwright reads an array given to `test.use` as a value and its options.) */
  consoleAllow: RegExp | null;
}

/** WebKit's words for a load the page being left never finished: a fetch, a lazy module, MapLibre's worker. */
const CANCELLED =
  /due to access control checks\.$|^Importing a module script failed\.$|^Error: Worker failed to load\./;

/**
 * Whether a console message is WebKit's word on a load a navigation cancelled: a reload or a `goto` leaving a page
 * still fetching, or still starting a worker or a lazy module. Chrome drops these silently; WebKit writes each as an
 * error. They are the browser's, not the app's, so a console check passes them over: only these messages, and only
 * while the page is being left (from its navigation's request to the next page's DOMContentLoaded). The same message
 * at any other time still fails.
 */
export function cancelledByLeaving(page: Page): (text: string) => boolean {
  let leaving = false;
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) leaving = true;
  });
  page.on("domcontentloaded", () => (leaving = false));
  return (text) => leaving && CANCELLED.test(text);
}

export const test = base.extend<QualityOptions & { consoleGuard: void }>({
  consoleAllow: [null, { option: true }],
  consoleGuard: [
    async ({ page, consoleAllow }, use, info) => {
      const heard: string[] = [];
      const cancelled = cancelledByLeaving(page);
      const allowed = (text: string) => cancelled(text) || !!consoleAllow?.test(text);
      page.on("console", (m) => {
        const type = m.type();
        if ((type === "error" || type === "warning") && !allowed(m.text()))
          heard.push(`console.${type}: ${m.text()}`);
      });
      page.on("pageerror", (e) => {
        if (!allowed(e.message)) heard.push(`uncaught: ${e.message}`);
      });
      await use();
      // A test that already failed says why; this one only adds what the console said.
      if (info.status === info.expectedStatus)
        expect(heard, "nothing in the console (EXAMPLES-STANDARD: no errors, no warnings)").toEqual(
          [],
        );
    },
    { auto: true },
  ],
});

// ---------- the theme ----------

/**
 * Opens every page of this test in `theme`, by storing Jali's theme setting before the app starts. Jali keeps its
 * settings under `<storage>:settings`, the `storage` the example passes to `createJali`. Only the first load is
 * changed: a test that switches the theme itself keeps its choice across a reload.
 */
export async function useJaliTheme(page: Page, storage: string, theme: Theme) {
  await page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("quality:theme-set")) return;
      sessionStorage.setItem("quality:theme-set", "1");
      let settings: Record<string, unknown> = {};
      try {
        settings = JSON.parse(localStorage.getItem(key) ?? "{}") ?? {};
      } catch {
        // a bad stored value: Jali falls back on its own, and this replaces it
      }
      localStorage.setItem(key, JSON.stringify({ ...settings, theme: value }));
    },
    [`${storage}:settings`, theme] as const,
  );
  await page.emulateMedia({ colorScheme: theme });
}

// ---------- axe ----------

export interface AxeViolation {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: string[];
}

/** One violation known to be Jali's, not the example's: the rule, and the node axe names, as it prints it. */
export interface KnownViolation {
  rule: string;
  /** axe's selector for the node, e.g. ".jali-page-tabs". */
  target: string;
  /** Why, in one line: where it is recorded for Jali to fix. */
  reason: string;
}

/**
 * axe on the whole page, against WCAG 2.2 A and AA and axe's best practices. `exclude` leaves selectors out of every
 * rule; `known` leaves one node out of one rule.
 */
export async function axe(
  page: Page,
  {
    exclude = [],
    known = [],
  }: { exclude?: readonly string[]; known?: readonly KnownViolation[] } = {},
): Promise<AxeViolation[]> {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "wcag22aa",
    "best-practice",
  ]);
  for (const s of exclude) builder = builder.exclude(s);
  const { violations } = await builder.analyze();
  return violations
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes
        .map((n) => n.target.join(" "))
        .filter((t) => !known.some((k) => k.rule === v.id && k.target === t))
        .slice(0, 5),
    }))
    .filter((v) => v.nodes.length);
}

// ---------- the width sweep ----------

export interface FitProblem {
  width: number;
  problem: "page scrolls sideways" | "off screen" | "cut off" | "covered";
  what: string;
}

/** Two frames: Jali refits on a resize and paints after, and a ResizeObserver in a pane answers in between. */
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );

/**
 * What doesn't fit at the page's current size. Reads every control a person could use (buttons, links, fields, tabs,
 * options, sliders) that is on screen:
 *
 * - **page scrolls sideways**: the document is wider than the window.
 * - **off screen**: a control reaches past the window's left or right edge, and nothing it is in scrolls sideways.
 * - **cut off**: less than half a control shows, because a box it is in clips it and doesn't scroll.
 * - **covered**: the middle of a control is under something else, so a click there misses it.
 *
 * A control scrolled out of a scrolling box, hidden, or inert is not on screen and is not read. `ignore` leaves out
 * controls inside these selectors.
 */
export function fitProblems(page: Page, ignore: readonly string[] = []) {
  return page.evaluate((ignore) => {
    type Problem = { problem: string; what: string };
    const out: Problem[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth + 1)
      out.push({
        problem: "page scrolls sideways",
        what: `${root.scrollWidth}px wide in ${root.clientWidth}px`,
      });

    const CONTROLS =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="option"], [role="slider"], [role="menuitem"], [role="checkbox"], [role="switch"], [tabindex="0"]';
    const name = (el: Element) => {
      const label =
        el.getAttribute("aria-label") ||
        el.getAttribute("title") ||
        (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      const id = el.closest("[data-pane]")?.getAttribute("data-pane");
      return `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} "${label}"${id ? ` in pane ${id}` : ""}`;
    };
    const clips = (s: CSSStyleDeclaration) =>
      s.overflowX !== "visible" || s.overflowY !== "visible";
    const scrolls = (el: Element, s: CSSStyleDeclaration, axis: "x" | "y") => {
      const o = axis === "x" ? s.overflowX : s.overflowY;
      return (
        (o === "auto" || o === "scroll") &&
        (axis === "x" ? el.scrollWidth > el.clientWidth + 1 : el.scrollHeight > el.clientHeight + 1)
      );
    };

    for (const el of document.querySelectorAll<HTMLElement>(CONTROLS)) {
      if (ignore.some((s) => el.closest(s))) continue;
      if (el.closest("[inert], [aria-hidden='true']")) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;

      // What shows of it: the window, cut by every box it is in that clips.
      let [left, top, right, bottom] = [0, 0, root.clientWidth, root.clientHeight];
      let scrollX = false;
      let scrolled = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (!clips(s)) continue;
        if (scrolls(a, s, "x")) scrollX = true;
        const ar = a.getBoundingClientRect();
        const cut =
          ar.left > r.left + 1 ||
          ar.right < r.right - 1 ||
          ar.top > r.top + 1 ||
          ar.bottom < r.bottom - 1;
        if (cut && (scrolls(a, s, "x") || scrolls(a, s, "y"))) scrolled = true;
        left = Math.max(left, ar.left);
        top = Math.max(top, ar.top);
        right = Math.min(right, ar.right);
        bottom = Math.min(bottom, ar.bottom);
      }
      const shown = Math.max(0, Math.min(right, r.right) - Math.max(left, r.left));
      const shownH = Math.max(0, Math.min(bottom, r.bottom) - Math.max(top, r.top));
      // Scrolled away inside a box that scrolls, or wholly out of a box that hides it on purpose: not on screen.
      if (scrolled || shown * shownH === 0) continue;

      if (!scrollX && (r.left < -1 || r.right > root.clientWidth + 1)) {
        out.push({ problem: "off screen", what: name(el) });
        continue;
      }
      if (shown * shownH < (r.width * r.height) / 2) {
        out.push({ problem: "cut off", what: name(el) });
        continue;
      }
      const x = (Math.max(left, r.left) + Math.min(right, r.right)) / 2;
      const y = (Math.max(top, r.top) + Math.min(bottom, r.bottom)) / 2;
      const hit = document.elementFromPoint(x, y);
      // Scrolled under something pinned in the same scrolling box (a sticky header, a mixer's master): it scrolls
      // back out, so it is not covered.
      let pinned = false;
      for (let a = hit; a && !pinned; a = a.parentElement)
        if (getComputedStyle(a).position === "sticky") {
          let box = a.parentElement;
          while (
            box &&
            !(scrolls(box, getComputedStyle(box), "x") || scrolls(box, getComputedStyle(box), "y"))
          )
            box = box.parentElement;
          pinned = !!box?.contains(el);
        }
      if (pinned) continue;
      // Its own content, or a box round it that takes the click for it (a label, a row), is fine. So is a toast, and
      // a tiled layout's divider, whose hit area reaches 3px over the panes' edges. Stacked view's divider stays in
      // the room between its panes, so it covers nothing.
      if (
        hit &&
        !el.contains(hit) &&
        !hit.contains(el) &&
        !hit.closest("[data-sonner-toaster], .jali-divider")
      )
        out.push({ problem: "covered", what: `${name(el)}, by ${name(hit)}` });
    }
    return out;
  }, ignore);
}

/** How long a width may take to settle before what doesn't fit is reported. */
const SETTLE_MS = 3000;

/** Every width in `widths`, then back to the size the test started at. Returns what didn't fit, at which width. */
export async function sweep(
  page: Page,
  { widths = WIDTHS, ignore = [] }: { widths?: readonly number[]; ignore?: readonly string[] } = {},
): Promise<FitProblem[]> {
  const start = page.viewportSize();
  const found: FitProblem[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: HEIGHT(width) });
    // The layout settles over a few frames (a refit, then a pane's ResizeObserver, then the paint), and a loaded
    // machine takes more of them than a quiet one: read it again until it fits or the time is up, so a problem that
    // is only the layout on its way is not reported, and one that stays is.
    let problems: Awaited<ReturnType<typeof fitProblems>> = [];
    for (const end = Date.now() + SETTLE_MS; ;) {
      await settle(page);
      await settle(page);
      problems = await fitProblems(page, ignore);
      if (!problems.length || Date.now() > end) break;
    }
    for (const p of problems) found.push({ width, ...(p as Omit<FitProblem, "width">) });
  }
  if (start) await page.setViewportSize(start);
  return found;
}

// ---------- the suite ----------

export interface Layout {
  /** The layout's name, as the example's top bar shows it. */
  name: string;
  /** Opens the app on this layout, and waits until its panes have their content. */
  open(page: Page): Promise<unknown>;
}

export interface Known {
  /** Why this check is known to fail, in one line. */
  reason: string;
  /** Which checks: a layout name and "axe" or "sweep"; every one when left out. */
  layout?: string;
  check?: "axe" | "sweep";
  theme?: Theme;
}

/**
 * The standard's checks for every layout in both themes: axe finds no violations, and from 360 to 2200px nothing
 * scrolls sideways, is off screen, cut off or covered. `fixme` marks a check known to fail, with the reason, so the
 * report shows it until it is fixed.
 */
export function qualitySuite({
  storage,
  layouts,
  axeExclude = [],
  axeKnown = [],
  sweepIgnore = [],
  fixme = [],
}: {
  /** The `storage` the example passes to `createJali`, where Jali keeps the theme. */
  storage: string;
  layouts: readonly Layout[];
  /** Left out of the axe scan: say why beside each. */
  axeExclude?: readonly string[];
  /** Violations that are Jali's to fix, not the example's, each with where it is recorded. */
  axeKnown?: readonly KnownViolation[];
  /** Left out of the width sweep: say why beside each. */
  sweepIgnore?: readonly string[];
  fixme?: readonly Known[];
}) {
  const known = (info: TestInfo, layout: string, check: "axe" | "sweep", theme: Theme) => {
    const k = fixme.find(
      (f) =>
        (!f.layout || f.layout === layout) &&
        (!f.check || f.check === check) &&
        (!f.theme || f.theme === theme),
    );
    if (k) info.fixme(true, k.reason);
  };

  test.describe("the standard's checks", () => {
    for (const theme of THEMES)
      for (const layout of layouts) {
        test(`${layout.name}, ${theme}: no accessibility violations`, async ({ page }, info) => {
          known(info, layout.name, "axe", theme);
          await useJaliTheme(page, storage, theme);
          await layout.open(page);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          await settle(page);
          expect(await axe(page, { exclude: axeExclude, known: axeKnown })).toEqual([]);
        });

        test(`${layout.name}, ${theme}: fits from 360 to 2200px`, async ({ page }, info) => {
          known(info, layout.name, "sweep", theme);
          await useJaliTheme(page, storage, theme);
          await layout.open(page);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          expect(await sweep(page, { ignore: sweepIgnore })).toEqual([]);
        });
      }
  });
}
