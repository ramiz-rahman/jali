/**
 * The static pages work without a framework (src/client/enhance.ts), each page type passes axe, and the first view
 * doesn't move. Against the built site.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hydrateAll } from "./islands";

test.describe("search", () => {
  test("⌘K opens it; it finds a reference entry and goes to it", async ({ page }) => {
    await page.goto("/learn/fitting");
    await page.keyboard.press("ControlOrMeta+k");
    const input = page.getByRole("combobox", { name: "Search the docs" });
    await expect(input).toBeFocused();
    await input.fill("createJali");
    const hit = page.getByRole("option").filter({ hasText: "In jali" }).first();
    await expect(hit).toContainText("createJali");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/reference\/core#createJali$/);
    await expect(page.locator("#createJali")).toBeInViewport();
  });

  test('"/" opens it, Escape closes it, and a heading result lands on its section', async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("/");
    const input = page.getByRole("combobox", { name: "Search the docs" });
    await expect(input).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search the docs" })).toBeHidden();
    await page.getByRole("button", { name: "Search the docs" }).click();
    await input.fill("layer line");
    await page.getByRole("option", { name: /Add the styles and the layer line/ }).click();
    await expect(page).toHaveURL(/\/get-started\/quickstart#add-the-styles-and-the-layer-line$/);
  });
});

test("package-manager tabs: arrows switch, each tab has its panel, and the choice is kept", async ({
  page,
}) => {
  await page.goto("/get-started/quickstart");
  const install = page.locator("[data-install]").first();
  const tabs = install.getByRole("tab");
  await expect(tabs).toHaveCount(4); // npm, pnpm, yarn, bun
  for (const tab of await tabs.all()) {
    const panel = await tab.getAttribute("aria-controls");
    await expect(page.locator(`#${panel}`)).toHaveCount(1);
  }
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(install.getByRole("tab", { name: "pnpm" })).toHaveAttribute("aria-selected", "true");
  await expect(install.getByRole("tabpanel")).toHaveText("pnpm add jali");
  await page.goto("/");
  const hero = page.locator("[data-install]").first();
  await expect(hero.getByRole("tab", { name: "pnpm" })).toHaveAttribute("aria-selected", "true");
});

test("copy buttons copy the code as written", async ({ page }) => {
  // What the buttons write, captured as it is written: WebKit lets a click write the clipboard but has no permission
  // to grant for a script to read it back.
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[] };
    w.copied = [];
    const clip = navigator.clipboard;
    const writeText = clip.writeText.bind(clip);
    clip.writeText = (text) => {
      w.copied.push(text);
      return writeText(text);
    };
    const write = clip.write.bind(clip);
    clip.write = async (items) => {
      for (const item of items) w.copied.push(await (await item.getType("text/plain")).text());
      return write(items);
    };
  });
  const copied = () => page.evaluate(() => (window as unknown as { copied: string[] }).copied);
  await page.goto("/get-started/quickstart");
  const block = page.locator("figure.code", { hasText: "jali.ts" }).first();
  await block.hover();
  await block.getByRole("button", { name: "Copy code" }).click();
  await expect(block.getByRole("button", { name: "Copied" })).toBeVisible();
  const text = (await copied()).at(-1)!;
  expect(text).toContain('import { createJali, row } from "jali";');
  expect(text).not.toContain("​");

  await page.getByRole("button", { name: "Copy page" }).click();
  await expect(page.locator("[data-copy-page]")).toHaveAttribute("data-copied", "");
  expect((await copied()).at(-1)).toMatch(/^# Quickstart\n/);
});

test("the theme toggle sets the theme, and it is kept", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/learn/fitting");
  const toggle = page.getByRole("radiogroup", { name: "Colour theme" });
  await expect(toggle.getByRole("radio", { name: "System" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await toggle.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/reference/tokens");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
});

test("a page links to its source on the docs' branch, and to a new issue that names it", async ({
  page,
}) => {
  await page.goto("/learn/fitting");
  await expect(page.getByRole("link", { name: "Edit this page" })).toHaveAttribute(
    "href",
    /\/edit\/master\/apps\/docs\/src\/docs\/learn\/fitting\.mdx$/,
  );
  await expect(page.getByRole("link", { name: "Report an issue" })).toHaveAttribute(
    "href",
    /\/issues\/new\?title=Docs%3A\+How\+a\+layout\+fits/,
  );
});

test("llms-full.txt holds every page as Markdown", async ({ request }) => {
  const text = await (await request.get("/llms-full.txt")).text();
  expect(text).toContain("# Quickstart");
  expect(text).toContain("# How a layout fits");
  expect(text).toContain('import { createJali, row } from "jali";');
});

test("headings are read as their words, without their link", async ({ page }) => {
  await page.goto("/learn/fitting");
  const h2 = page.locator(".prose h2").first();
  const text = (await h2.textContent())!.trim();
  await expect(page.getByRole("heading", { name: text, exact: true, level: 2 })).toHaveCount(1);
});

test("every heading's permalink is a named link the keyboard reaches, outside the heading", async ({
  page,
  browserName,
}) => {
  await page.goto("/learn/fitting");
  const headings = page.locator(".prose :is(h2, h3, h4).heading");
  const n = await headings.count();
  expect(n).toBeGreaterThan(3);
  for (let i = 0; i < n; i++) {
    const h = headings.nth(i);
    const id = (await h.getAttribute("id"))!;
    const text = (await h.textContent())!.trim();
    const level = Number((await h.evaluate((el) => el.tagName)).slice(1));
    // Read as its words alone, and the permalink isn't inside it.
    await expect(page.getByRole("heading", { name: text, exact: true, level })).toHaveCount(1);
    await expect(h.locator("a")).toHaveCount(0);
    const link = page.getByRole("link", { name: `Link to this section: ${text}`, exact: true });
    await expect(link).toHaveAttribute("href", `#${id}`);
  }

  // Tab reaches them in reading order, and each shows itself when it has focus.
  await headings.first().evaluate((el) => {
    el.setAttribute("tabindex", "-1");
    (el as HTMLElement).focus();
  });
  const reached: string[] = [];
  // Safari's Tab skips links; Option+Tab reaches them (as it does in any Mac browser with that setting off).
  const next = browserName === "webkit" ? "Alt+Tab" : "Tab";
  for (let i = 0; i < 400 && reached.length < n; i++) {
    await page.keyboard.press(next);
    const href = await page.evaluate(() =>
      document.activeElement?.matches(".heading-anchor")
        ? document.activeElement.getAttribute("href")
        : null,
    );
    if (!href) continue;
    reached.push(href);
    const anchor = page.locator(":focus");
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveCSS("opacity", "1");
  }
  expect(reached).toEqual(await headings.evaluateAll((els) => els.map((el) => `#${el.id}`)));
});

test("the layout doesn't shift as a page with live parts loads, on a phone", async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as { cls?: number }).cls = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[])
        if (!e.hadRecentInput) (window as { cls?: number }).cls! += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const path of ["/learn/fitting", "/", "/reference/react"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const cls = await page.evaluate(() => (window as { cls?: number }).cls ?? 0);
    expect(cls, `${path}: CLS`).toBeLessThan(0.1);
  }
  await context.close();
});

/** One page of each kind: the landing, a guide, a reference page, a page with live parts, and the 404. */
const PAGE_TYPES = ["/", "/guides/theming", "/reference/react", "/learn/layout-tree", "/nope"];

for (const path of PAGE_TYPES)
  for (const theme of ["light", "dark"] as const)
    test(`axe finds nothing on ${path} (${theme})`, async ({ page }) => {
      // Reduced motion: axe reads colours once, so nothing may be mid-fade.
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(path);
      await hydrateAll(page);
      await page.waitForLoadState("networkidle");
      const said = (vs: { id: string; help: string; nodes: { target: unknown[] }[] }[]) =>
        vs.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
      // WCAG 2.2 A and AA on the whole page, the live workspaces included.
      const wcag = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(said(wcag.violations)).toEqual([]);
      // Best practice too, the live workspaces included: each is named (`createJali({ label })`), so two demos on one
      // page never repeat a landmark.
      const best = await new AxeBuilder({ page }).withTags(["best-practice"]).analyze();
      expect(said(best.violations)).toEqual([]);
    });
