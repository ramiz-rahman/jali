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

test("the install line: the menu picks the package manager, from the pointer or the keys, and the choice is kept", async ({
  page,
}) => {
  await page.goto("/get-started/quickstart");
  const install = page.locator("figure.install").first();
  const trigger = install.getByRole("button", { name: "Package manager: npm" });
  const menu = install.getByRole("listbox", { name: "Package manager" });
  const command = install.locator(".install-command:visible");
  await expect(command).toHaveText("npm install jali-layout");
  await expect(menu).toBeHidden();

  // The pointer: open, choose pnpm.
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("option")).toHaveText(["npm", "pnpm", "yarn", "bun", "vp"]);
  await menu.getByRole("option", { name: "pnpm" }).click();
  await expect(menu).toBeHidden();
  await expect(command).toHaveText("pnpm add jali-layout");
  await expect(install.getByRole("button", { name: "Package manager: pnpm" })).toBeFocused();

  // The keys: open on the chosen one, End goes to vp, Enter chooses it; Escape closes without choosing.
  await page.keyboard.press("ArrowDown");
  await expect(menu).toBeFocused();
  await expect(menu.getByRole("option", { name: "pnpm" })).toHaveAttribute("data-active", "");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(command).toHaveText("vp add jali-layout");
  await page.keyboard.press("Enter");
  await page.keyboard.press("y");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(command).toHaveText("vp add jali-layout");

  // A click elsewhere closes it.
  await install.getByRole("button", { name: "Package manager: vp" }).click();
  await page.locator("h1").first().click();
  await expect(menu).toBeHidden();

  await page.goto("/");
  const hero = page.locator("figure.install").first();
  await expect(hero.getByRole("button", { name: "Package manager: vp" })).toBeVisible();
  await expect(hero.locator(".install-command:visible")).toHaveText("vp add jali-layout");
});

test("the landing takes the page's width at every window width, with nothing past the edge", async ({
  page,
}) => {
  for (const width of [360, 600, 768, 780, 900, 1023, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const opening = await page.locator(".landing-opening").boundingBox();
    // The opening spans the page between its gutters (at most 40px each side), whatever the width.
    expect(opening!.width, `opening at ${width}px`).toBeGreaterThan(
      Math.min(width, 1840) - 2 * 40 - 1,
    );
    const footer = await page.locator(".site-footer").boundingBox();
    expect(footer!.width, `footer at ${width}px`).toBeGreaterThan(
      Math.min(width, 1840) - 2 * 40 - 1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `page width at ${width}px`,
    ).toBe(width);
  }
});

test("a docs page's text takes the width it has at every window width", async ({ page }) => {
  for (const width of [360, 600, 767, 768, 900, 1023, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/guides/layouts");
    const text = await page.locator(".prose").first().boundingBox();
    // Below 768px the page is one column: the text spans the window less its 16px gutters, up to its measure. Above, the sidebar takes
    // its column and the text has at least half of what is left, up to its 624px measure.
    if (width < 768) expect(text!.width, `text at ${width}px`).toBe(Math.min(624, width - 32));
    else
      expect(text!.width, `text at ${width}px`).toBeGreaterThan(Math.min(624, (width - 300) / 2));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `page width at ${width}px`,
    ).toBe(width);
  }
});

test("the following demo says what the order pane does, and Keep and Follow again change it", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.locator(".landing-follow-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-island="FollowDemo"]')).toHaveAttribute("data-hydrated", "", {
    timeout: 15_000,
  });
  const state = demo.locator(".landing-follow-state");
  const text = demo.locator(".landing-follow-text");
  await expect(state).toHaveText("Following");
  await expect(text).toContainText("Order 1048 shows the order selected in Orders");

  // Pick another order: the detail follows, in place.
  // Orders by place in the list (1048 at the top, 1045 fourth), not by customer: the demo's names may change.
  const orders = demo.getByRole("listbox", { name: "Orders" }).getByRole("option");
  await orders.nth(3).click();
  await expect(text).toContainText("Order 1045 shows the order selected");

  // Keep it: it stays, and the next order clicked opens beside it, following the list.
  await demo.getByRole("button", { name: "Keep Order 1045" }).click();
  await expect(state).toHaveText("Kept");
  await orders.nth(5).click();
  await expect(state).toHaveText("Kept and following");
  await expect(text).toContainText("Order 1045 is kept. Order 1043 follows the list");

  // Follow again: one detail, following once more, and it catches up with the list.
  await demo.getByRole("button", { name: "Follow again" }).click();
  await expect(state).toHaveText("Following");
  await expect(text).toContainText("Order 1043 shows the order selected");
});

test("with reduced motion, the folded chip's menu opens from the keys with focus on its first pane", async ({
  page,
}) => {
  // This site's reduced-motion reset (every transition 0.01ms) once kept focus out of a menu still being placed.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#quickstart").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-island="QuickstartApp"]')).toHaveAttribute("data-hydrated", "", {
    timeout: 15_000,
  });
  const notes = page.locator(".landing-split");
  // Open notes until some fold behind a chip.
  for (let i = 0; i < 4; i++) await notes.locator(".note button:visible").last().click();
  const chip = notes.locator(".jali-tab-folded:visible").first();
  await chip.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "Folded panes" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await expect(menu).toContainText("Folded for room");
  const shown = await menu.getByRole("menuitem").first().getAttribute("data-item");
  await page.keyboard.press("Enter");
  await expect(notes.locator(`[role="tab"][data-tab="${shown}"]`)).toBeFocused();
});

test("the quickstart starts on note 1; its button opens note 2, and again lights note 2 up rather than copy it", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#quickstart").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-island="QuickstartApp"]')).toHaveAttribute("data-hydrated", "", {
    timeout: 15_000,
  });
  const notes = page.locator(".landing-split section[data-pane]");
  await expect(notes).toHaveCount(1);
  const open = notes.first().getByRole("button", { name: "Open the next note beside" });
  await open.click();
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(1).getByRole("heading", { name: "Note 2", level: 3 })).toBeVisible();
  // Again: no copy of note 2; that pane flashes instead.
  await open.click();
  await expect(notes).toHaveCount(2);
  await expect(notes.nth(1)).toHaveClass(/is-flash/);
});

test("search closes on Esc, and opens again at the top with its heading in sight", async ({
  page,
}) => {
  await page.goto("/get-started/introduction");
  const dialog = page.getByRole("dialog", { name: "Search the docs" });
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Search the docs" })).toBeFocused();
  // Down the list, so it scrolls.
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
  await expect
    .poll(() => page.locator("#search-results").evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // Esc from somewhere else inside it closes it too.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  expect(await page.locator("#search-results").evaluate((el) => el.scrollTop)).toBe(0);
  // The heading is inside the list's visible box (geometry, not toBeInViewport, which misreads a modal dialog).
  await expect(page.locator(".search-group")).toBeVisible();
  const heading = (await page.locator(".search-group").boundingBox())!;
  const shown = (await page.locator("#search-results").boundingBox())!;
  expect(heading.y).toBeGreaterThanOrEqual(shown.y);
  expect(heading.y + heading.height).toBeLessThanOrEqual(shown.y + shown.height);
  await page.locator(".search-foot").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
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
  expect(text).toContain('import { createJali } from "jali-layout";');
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
  expect(text).toContain('import { createJali, row } from "jali-layout";');
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
