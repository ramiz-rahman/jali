/** Tabs: made by you vs made by the layout; the overflow menu when a strip cannot show every tab. */
import { test, expect, review } from "./fixtures/app";

const strip = (page: import("@playwright/test").Page) =>
  page
    .locator(".jali-tabbar")
    .filter({ has: page.locator(".jali-tab-more") })
    .first();

test.describe("tab overflow and marks", () => {
  test('folded panes wait behind one "N folded" chip, not as tabs; its menu says why, and a pick shows the pane there', async ({
    app,
    page,
  }) => {
    await app.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    // No folded tabs: the strip is yours. The chip counts the rest.
    await expect(page.locator('[role="tab"][data-folded]')).toHaveCount(0);
    const chip = page.locator(".jali-tab-folded").first();
    const n = Number((await chip.innerText()).match(/\d+/)![0]);
    expect(n).toBeGreaterThan(3);
    await expect(chip).toHaveAccessibleName(`${n} folded panes`);
    await expect(chip).toHaveAttribute("aria-description", "Folded: returns when there's room");
    // Not on the shelf: that is for panes you tucked.
    await expect(page.locator("[data-shelf]")).toHaveCount(0);

    await chip.click();
    const menu = page.getByRole("menu", { name: "Folded panes" });
    await expect(menu).toContainText("No room to show these side by side");
    const items = menu.getByRole("menuitem");
    await expect(items).toHaveCount(n);
    await page.keyboard.press("Escape");
    await expect(chip).toBeFocused();

    // A pick shows it in this place, and the pane it replaces waits behind the chip instead.
    await chip.click();
    const target = await items.first().getAttribute("data-item");
    await items.first().click();
    const tab = page.locator(`[role="tab"][data-tab="${target}"]`);
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`section[data-pane="${target}"]`)).toBeVisible();
    await expect(chip).toContainText(`${n} folded`);
  });

  test("the overflow button counts hidden tabs; the menu lists all of them, keys work, the chosen tab is shown", async ({
    app,
    page,
  }) => {
    await app.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    // Two tabs of yours (tuck the last pane into its neighbour), in a strip too narrow for them.
    await page.evaluate(() => {
      const shown = [...document.querySelectorAll<HTMLElement>("section[data-pane]")].filter(
        (e) => e.style.display !== "none",
      );
      (
        window as unknown as { __jali: { actions: { tuck(id: string): void } } }
      ).__jali.actions.tuck(shown.at(-1)!.dataset.pane!);
    });
    await page.addStyleTag({ content: ".jali-tabs { max-width: 4rem; }" });
    const bar = strip(page);
    const more = bar.locator(".jali-tab-more");
    await expect(more).toBeVisible();
    // The menu lists every pane in the group: its tabs, and those behind the folded chip.
    const folded = Number(
      (
        (
          await bar
            .locator(".jali-tab-folded")
            .innerText()
            .catch(() => "0")
        ).match(/\d+/) ?? ["0"]
      )[0],
    );
    const total = (await bar.getByRole("tab").count()) + folded;
    const n = Number(await more.getAttribute("data-hidden-count"));
    expect(n).toBeGreaterThan(0);
    await expect(more).toHaveText(new RegExp(`\\+${n}`));
    await more.click();
    const menu = page.getByRole("menu", { name: "Tabs in this group" });
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitem");
    await expect(items).toHaveCount(total);
    await expect(items.first()).toBeFocused(); // the active tab leads
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.last()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(more).toBeFocused();
    // Choose the last tab: it becomes the shown one and scrolls into the strip.
    await more.click();
    await page.keyboard.press("End");
    const target = await items.last().getAttribute("data-item");
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    const tab = page.locator(`[role="tab"][data-tab="${target}"]`);
    await expect(tab).toHaveAttribute("aria-selected", "true");
    const [t, s] = await Promise.all([
      tab.boundingBox(),
      page.locator(".jali-tabs").first().boundingBox(),
    ]);
    expect(t!.x).toBeGreaterThanOrEqual(s!.x - 1);
    expect(t!.x + t!.width).toBeLessThanOrEqual(s!.x + s!.width + 1);
  });

  test("a tab's width does not change when it is hovered or its state shows", async ({
    app,
    page,
  }) => {
    await app.open({ preset: "Stress: 10 panes", size: { width: 1440, height: 900 } });
    const tab = page.locator('[role="tab"]').first();
    const before = (await tab.boundingBox())!.width;
    await tab.hover();
    expect((await tab.boundingBox())!.width).toBe(before);
  });

  test("the loan review shows no overflow button and no folded marks for its page views", async ({
    app,
    page,
  }) => {
    await app.open({
      path: review("?page=loan-review&item=4&tab=application"),
      size: { width: 1280, height: 900 },
    });
    await expect(page.locator(".jali-tab-more")).toHaveCount(0);
    await expect(page.locator("[data-folded]")).toHaveCount(0);
  });

  test("a narrow strip shows its active tab whole, the first one included (finding 30)", async ({
    app,
    page,
  }) => {
    await app.open({ preset: "Stress: 10 panes", size: { width: 1280, height: 900 } });
    for (const width of [1280, 1100, 900, 800]) {
      await page.setViewportSize({ width, height: 900 });
      await app.stable();
      const cut = await page.locator(".jali-tabs").evaluateAll((strips) =>
        strips.flatMap((s) => {
          const tab = s.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
          if (!tab || !s.checkVisibility()) return [];
          const a = tab.getBoundingClientRect(),
            b = s.getBoundingClientRect();
          return a.left < b.left - 1 || a.right > b.right + 1
            ? [
                `${tab.textContent} ${Math.round(a.left - b.left)}..${Math.round(a.right - b.right)}`,
              ]
            : [];
        }),
      );
      expect(cut, `width ${width}`).toEqual([]);
    }
    // A strip narrower than its active tab shows the tab's start ("Ord…"), never its end ("ders").
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addStyleTag({ content: ".jali-tabs { max-width: 3rem; }" });
    const first = page.locator(".jali-tabs").first().locator('[role="tab"]').first();
    // By key: in a 3rem strip the shown tab, shortened to fit, covers where a pointer would land.
    await first.focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("aria-selected", "true");
    const [t, s] = await Promise.all([
      first.boundingBox(),
      page.locator(".jali-tabs").first().boundingBox(),
    ]);
    expect(Math.round(t!.x)).toBeGreaterThanOrEqual(Math.round(s!.x) - 1);
  });
});
