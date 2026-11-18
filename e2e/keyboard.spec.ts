import { test, expect } from "./fixtures/lab";

/**
 * The keyboard ladder in a real browser: content first, then the pane layer (docs/DECISIONS.md "Keyboard").
 * Playwright sends keys to the page over CDP, past the browser's own accelerators, so these show what the page does
 * with a key that reaches it; which keys reach a page at all is in docs/research/keyboard-shortcuts.md.
 */
test.describe("Keyboard ladder", () => {
  test("⌘Z / Ctrl+Z in the SQL editor is the editor's undo; a closed pane stays closed", async ({
    lab,
    page,
  }) => {
    await lab.open({ preset: "Query + chart + inspector" });
    const before = await lab.visibleCount();
    await page
      .getByRole("button", { name: /^Close / })
      .last()
      .click();
    await expect.poll(() => lab.visibleCount()).toBe(before - 1);
    const editor = page.locator("section[data-pane] textarea").first();
    await editor.click();
    await page.keyboard.type(" -- note");
    await expect(editor).toHaveValue(/-- note/);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(editor).not.toHaveValue(/-- note/);
    await expect.poll(() => lab.visibleCount()).toBe(before - 1);
    // The pane layer's undo has its own chord, from inside the editor too.
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => lab.visibleCount()).toBe(before);
  });

  test("J/K in a grid move its rows; the pane layer takes no character key", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.grid("orders").click({ position: { x: 120, y: 60 } });
    const focused = await lab.focusedId();
    await page.keyboard.press("j");
    await page.keyboard.press("k");
    await expect.poll(() => lab.focusedId()).toBe(focused);
    await expect(page.getByRole("dialog", { name: "Commands" })).toHaveCount(0);
  });

  test("Esc: the launcher's search first, then the launcher; a peek before maximise", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.pane("orders").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+m");
    await expect(lab.isZoomed("orders")).toHaveCount(1);
    await lab.grid("orders").focus();
    await page.keyboard.press("Space");
    await expect(lab.peek()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(lab.peek()).toHaveCount(0);
    await expect(lab.isZoomed("orders")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(lab.isZoomed("orders")).toHaveCount(0);
  });

  test("Settings lists the keys in this platform's words", async ({ lab, page }) => {
    await lab.open();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.type("open settings");
    await page.keyboard.press("Enter");
    const list = page.getByRole("dialog", { name: "Settings" }).getByLabel("Keyboard shortcuts");
    const mac = await page.evaluate(() => /Mac/.test(navigator.platform));
    await expect(list.locator('[data-command-id="pane.zoom"] kbd')).toHaveText(
      mac ? "⇧⌘↵ or ⌘K ⌘M" : "Ctrl+Shift+Enter or Ctrl+K Ctrl+M",
    );
    await expect(list.locator('[data-command-id="pane.split.right"] kbd')).toHaveText(
      mac ? "⌘\\" : "Ctrl+\\",
    );
  });

  test("F6 reaches the review queue, where J/K move through applications", async ({
    lab,
    page,
  }) => {
    await lab.open({
      path: "/?app=review&item=4&tab=application",
      size: { width: 1440, height: 900 },
    });
    const queue = page.getByRole("listbox", { name: "Loan applications" });
    for (
      let i = 0;
      i < 8 && !(await queue.evaluate((q) => q.contains(document.activeElement)));
      i++
    )
      await page.keyboard.press("F6");
    await expect(queue.getByRole("option", { selected: true })).toBeFocused();
    await page.keyboard.press("j");
    await expect(page).not.toHaveURL(/item=4&/);
  });
});
