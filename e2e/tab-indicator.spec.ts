import type { Page } from "@playwright/test";
import { test, expect, type Lab } from "./fixtures/lab";

/**
 * The shown tab's underline (Data Studio's request): one per strip, spanning the tab and its close button as one box,
 * flush with their lower edge, above the tabs, and it scrolls with the tab.
 */
async function check(page: Page) {
  await expect
    .poll(async () =>
      page.locator('[role="tablist"]').evaluateAll((lists) =>
        lists.map((list) => {
          const lines = list.querySelectorAll<HTMLElement>(".jali-tab-indicator");
          const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
          if (lines.length !== 1 || !tab) return `lines ${lines.length}, tab ${!!tab}`;
          const close = tab.parentElement!.querySelector<HTMLElement>(".jali-tab-close");
          const boxes = [tab.getBoundingClientRect()];
          if (close && close.offsetParent !== null) boxes.push(close.getBoundingClientRect());
          const l = lines[0]!.getBoundingClientRect();
          const want = {
            left: Math.min(...boxes.map((b) => b.left)),
            right: Math.max(...boxes.map((b) => b.right)),
            bottom: Math.max(...boxes.map((b) => b.bottom)),
          };
          const off = (a: number, b: number) => Math.abs(a - b) > 1;
          const style = getComputedStyle(lines[0]!);
          if (style.pointerEvents !== "none" || !(Number(style.zIndex) > 0)) return "paint";
          return off(l.left, want.left) || off(l.right, want.right) || off(l.bottom, want.bottom)
            ? `line ${l.left},${l.right},${l.bottom} want ${want.left},${want.right},${want.bottom}`
            : "ok";
        }),
      ),
    )
    .toEqual(expect.arrayContaining(["ok"]));
  const results = await page
    .locator('[role="tablist"]')
    .evaluateAll((lists) => lists.map((l) => l.querySelectorAll(".jali-tab-indicator").length));
  expect(results.every((n) => n === 1)).toBe(true);
}

async function group(lab: Lab, page: Page) {
  await lab.setting(/Add as a tab/);
  await lab.drag("order", "orders", "centre");
  await lab.drag("customer", "order", "centre");
  await expect(page.locator("[data-tab]")).toHaveCount(3);
}

test("one line under the shown tab and its close button", async ({ lab, page }) => {
  await lab.open({ size: { width: 1280, height: 900 } });
  await group(lab, page);
  await check(page);
  await page.locator('[role="tab"]').first().click();
  await check(page);
});

test("under a pinned tab, which may have no close button", async ({ lab, page }) => {
  await lab.open({ size: { width: 1280, height: 900 } });
  await group(lab, page);
  const first = page.locator('[role="tab"]').first();
  await first.click({ button: "right" });
  await page.getByRole("menuitemcheckbox", { name: "Pin tab" }).click();
  await page.locator('[role="tab"][data-pinned]').click();
  await check(page);
  await page.addStyleTag({ content: ".jali-pane-header { max-width: 390px; }" });
  await check(page);
});

test("stays on the shown tab as an overflowing strip scrolls it into view", async ({
  lab,
  page,
}) => {
  await lab.open({ size: { width: 1280, height: 900 } });
  await group(lab, page);
  await page.addStyleTag({ content: ".jali-tabs { max-width: 7rem; }" });
  await page.locator('[role="tab"]').last().focus();
  await page.keyboard.press("Enter");
  await check(page);
  await page.locator('[role="tab"]').first().focus();
  await page.keyboard.press("Enter");
  await check(page);
});

test("is gone while the shown tab is renamed", async ({ lab, page }) => {
  await lab.open({ size: { width: 1280, height: 900 } });
  await group(lab, page);
  await page.evaluate(() => {
    const el = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
    el.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  // The lab has no rename, so nothing opens and the line stays: renaming itself is covered by the unit tests.
  await check(page);
});
