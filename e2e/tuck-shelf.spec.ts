/** Tuck and put back, and the shelf in the status line. */
import { test, expect, Lab } from "./fixtures/lab";

test.describe("tuck and put back", () => {
  test("button: the pane becomes a tab of its home, the home keeps its tab, only the home's group changes, focus lands in the home", async ({
    lab,
  }) => {
    await lab.open();
    const before = await lab.byId();
    const beforeSnap = await lab.snap();
    const btn = lab.tuck("customer");
    await expect(btn).toBeEnabled();
    expect(await btn.getAttribute("aria-label")).toMatch(
      /^Tuck into .+ · (⌘K ⌘\[|Ctrl\+K Ctrl\+\[)$/,
    );
    expect(await btn.getAttribute("title")).toBe(await btn.getAttribute("aria-label"));
    await btn.click();
    await expect.poll(() => lab.homeOf("customer 1")).not.toBeNull();
    const home = (await lab.homeOf("customer 1"))!;
    expect(home.active, "home keeps its active tab").not.toBe("customer 1");
    expect(home.tabs).toContain("customer 1");
    await lab.stable();
    const after = await lab.byId();
    for (const id of Object.keys(before)) {
      if (id === home.id || id === "customer") continue;
      expect(Lab.sameRect(before[id]!, after[id]!), `${id} unchanged`).toBe(true);
    }
    expect(after.customer, "customer no longer has its own pane").toBeUndefined();
    await expect
      .poll(() => lab.focusIn(home.id), { message: "focus lands in the home" })
      .toBe(true);
    expect(beforeSnap.groups.length).toBeLessThan((await lab.snap()).groups.length);
    // The tucked tab is marked, and Put back appears on hover and on focus.
    const tab = lab.tab(/customer 1/);
    await expect(tab).toHaveAttribute("data-tucked", "true");
    const pb = lab
      .tabButtons(/customer 1/)
      .getByRole("button", { name: "Put back customer 1", includeHidden: true });
    await tab.hover();
    await expect(pb).toBeVisible();
    expect(await pb.getAttribute("title")).toMatch(/^Put back · (⌘K ⌘\]|Ctrl\+K Ctrl\+\])$/);
  });

  test("⌘K ⌘[ tucks the focused pane, ⌘K ⌘] puts the tab back to the exact rect", async ({
    lab,
    page,
  }) => {
    await lab.open();
    const before = await lab.snap();
    await lab.pane("customer").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+BracketLeft");
    await expect.poll(() => lab.homeOf("customer 1")).not.toBeNull();
    const home = (await lab.homeOf("customer 1"))!;
    await expect.poll(() => lab.focusIn(home.id)).toBe(true);
    await lab.tab(/customer 1/).click();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+BracketRight");
    await expect.poll(() => lab.homeOf("customer 1")).toBeNull();
    await lab.expectSnap(before, "after ⌘K ⌘[, ⌘K ⌘]");
  });

  test("Put back on the tab restores the exact rect", async ({ lab }) => {
    await lab.open();
    const before = await lab.snap();
    await lab.tuck("customer").click();
    await lab.putBackTab(/customer 1/);
    await expect.poll(() => lab.homeOf("customer 1")).toBeNull();
    await lab.expectSnap(before, "after the tab's Put back");
  });

  test("a focused tucked tab: ⌘K ⌘] puts it back, Delete closes a tab, and its buttons stay out of the tab order", async ({
    lab,
    page,
  }) => {
    await lab.open();
    const before = await lab.snap();
    await lab.tuck("customer").click();
    const tab = lab.tab(/customer 1/);
    await expect(tab).toHaveAttribute("aria-keyshortcuts", "Delete Backspace Shift+F10");
    await expect(tab).toHaveAttribute(
      "aria-description",
      /^Tucked here\. (⌘K ⌘\]|Ctrl\+K Ctrl\+\]) puts it back\. Delete closes it\.$/,
    );
    await tab.focus();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+BracketRight");
    await expect.poll(() => lab.homeOf("customer 1")).toBeNull();
    await lab.expectSnap(before, "after ⌘K ⌘] on the focused tab");

    await lab.tuck("customer").click();
    await expect.poll(() => lab.homeOf("customer 1")).not.toBeNull();
    await lab.tab(/customer 1/).focus();
    // Tab leaves the tab without stopping on its Put back or Close.
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest(".jali-tab-actions"))).toBe(
      false,
    );
    await lab.tab(/customer 1/).focus();
    await page.keyboard.press("Delete");
    await expect(lab.tab(/customer 1/)).toHaveCount(0);
    await expect(lab.pane("customer")).toHaveCount(0);
  });

  test("dragging a tucked tab out puts it back", async ({ lab, page }) => {
    await lab.open();
    const before = await lab.snap();
    await lab.tuck("customer").click();
    const tb = (await lab.tab(/customer 1/).boundingBox())!;
    const home = (await lab.homeOf("customer 1"))!;
    const hb = (await lab.pane(home.id).boundingBox())!;
    await page.mouse.move(tb.x + 20, tb.y + tb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + 30, tb.y + tb.height / 2 + 14, { steps: 3 });
    await page.mouse.move(hb.x + hb.width - 20, hb.y + hb.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => lab.homeOf("customer 1")).toBeNull();
    await lab.expectSnap(before, "after drag-out");
  });

  test("⌘K ⌘Z after a tuck restores the exact rect", async ({ lab, page }) => {
    await lab.open();
    const before = await lab.snap();
    await lab.tuck("customer").click();
    await expect.poll(() => lab.homeOf("customer 1")).not.toBeNull();
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => lab.homeOf("customer 1")).toBeNull();
    await lab.expectSnap(before, "after ⌘K ⌘Z");
  });

  test("the last pane: no Tuck button (a lone pane is quiet), and ⌘K ⌘[ says why", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await page.getByRole("button", { name: "Close order 1", exact: true }).click();
    await page.getByRole("button", { name: "Close customer 1", exact: true }).click();
    await expect.poll(() => lab.visibleCount()).toBe(1);
    await expect(lab.tuck("orders")).toHaveCount(0);
    await lab.recordAnnouncements();
    await lab.pane("orders").click({ position: { x: 100, y: 300 } });
    await page.keyboard.press("ControlOrMeta+k");
    await page.keyboard.press("ControlOrMeta+BracketLeft");
    await lab.expectAnnounced(/only open pane|can.?t be tucked/i);
    expect((await lab.announcements()).some((m) => /minimised|collapsed/i.test(m))).toBe(false);
    await expect(lab.shelf()).toHaveCount(0);
  });

  test("announcements say tucked and put back", async ({ lab }) => {
    await lab.open();
    await lab.recordAnnouncements();
    await lab.tuck("customer").click();
    await lab.expectAnnounced(/tucked/i);
    await lab.putBackTab(/customer 1/);
    await lab.expectAnnounced(/put back/i);
  });
});

test.describe("the shelf", () => {
  test("appears only when something is tucked, inside the 28px status line", async ({ lab }) => {
    await lab.open();
    await expect(lab.shelf()).toHaveCount(0);
    const status = lab.status();
    expect(Math.round((await status.boundingBox())!.height)).toBe(28);
    await expect(status).toContainText(/\d+ panes/);
    await lab.tuck("customer").click();
    await expect(lab.shelf()).toBeVisible();
    const sb = (await lab.shelf().boundingBox())!,
      st = (await status.boundingBox())!;
    expect(Math.round(st.height)).toBe(28);
    expect(sb.y, "inside the status line").toBeGreaterThanOrEqual(st.y);
    expect(sb.y + sb.height, "inside the status line").toBeLessThanOrEqual(st.y + st.height + 0.5);
    expect(sb.x, "left side").toBeLessThan(st.x + st.width / 2);
    await expect(lab.shelf()).toContainText(/Behind .+:/);
    await expect(lab.chip("customer 1")).toBeVisible();
    await expect(status).toContainText("1 tucked");
    await expect(status).not.toContainText(/minimised/);
    // the count and focus text moved to the right of the shelf
    const main = (await lab.statusMain().boundingBox())!;
    expect(main.x).toBeGreaterThan(sb.x + 40);
    // putting it back removes the shelf
    await lab.putBackTab(/customer 1/);
    await expect(lab.shelf()).toHaveCount(0);
    expect(Math.round((await status.boundingBox())!.height)).toBe(28);
  });

  test("the shelf never resizes the jali: same height with and without hidden panes", async ({
    lab,
  }) => {
    await lab.open();
    const ws = () =>
      lab.main().evaluate((e) => {
        const r = e.getBoundingClientRect();
        return { y: r.y, h: r.height };
      });
    const base = await ws();
    await lab.tuck("customer").click();
    await expect(lab.shelf()).toBeVisible();
    expect(await ws(), "one tucked").toEqual(base);
    await lab.firstTuckable().click();
    await expect(lab.chips()).toHaveCount(2);
    expect(await ws(), "two tucked").toEqual(base);
    // every pane that is still shown keeps the base top and bottom edges
    for (const r of Object.values(await lab.byId()))
      expect(r.y + r.h).toBeLessThanOrEqual(base.y + base.h + 1);
    // The mini-action is hover-only, so click it in the DOM.
    const put = () =>
      lab
        .shelf()
        .getByRole("button", { name: /^Put back /, includeHidden: true })
        .first();
    await put().dispatchEvent("click");
    await put().dispatchEvent("click");
    await expect(lab.shelf()).toHaveCount(0);
    expect(await ws(), "none tucked").toEqual(base);
  });

  test("clicking a chip reveals the tab with no layout change", async ({ lab }) => {
    await lab.open();
    await lab.tuck("customer").click();
    await expect(lab.shelf()).toBeVisible();
    await lab.stable();
    const before = await lab.byId();
    const beforeSnap = await lab.snap();
    expect((await lab.homeOf("customer 1"))!.active).not.toBe("customer 1");
    await lab.chip("customer 1").click();
    await expect.poll(async () => (await lab.homeOf("customer 1"))!.active).toBe("customer 1");
    await lab.stable();
    const after = await lab.byId();
    const home = (await lab.homeOf("customer 1"))!;
    // The home group's rect and every other rect are unchanged; the shown tab is the only difference.
    for (const id of Object.keys(before))
      if (after[id]) expect(Lab.sameRect(before[id]!, after[id]!), `${id} rect`).toBe(true);
    expect((await lab.snap()).groups).toEqual(beforeSnap.groups);
    expect(Object.keys(after).length).toBe(Object.keys(before).length);
    expect(home.tabs).toContain("customer 1");
    await expect(lab.shelf()).toBeVisible(); // revealing does not put it back
  });

  test("keyboard: a toolbar with roving tabindex; arrows move, Enter reveals, Shift+Enter puts back", async ({
    lab,
    page,
  }) => {
    await lab.open();
    await lab.tuck("customer").click();
    const second = lab.firstTuckable();
    await expect(second, "a visible, tuckable pane remains").toBeVisible();
    await second.click();
    await expect(lab.chips()).toHaveCount(2);
    // A tuck sends focus into the home on the next frame. Moving focus to the shelf before that lands loses it.
    await lab.frames();
    await expect(lab.shelfBar()).toBeVisible();
    const mains = lab.chipMains();
    const n = await mains.count();
    expect(n).toBeGreaterThanOrEqual(1);
    // exactly one tab stop
    expect(
      await mains.evaluateAll(
        (els) => els.filter((e) => e.getAttribute("tabindex") === "0").length,
      ),
    ).toBe(1);
    await mains.first().focus();
    if (n > 1) {
      await page.keyboard.press("ArrowRight");
      await expect(mains.nth(1)).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(mains.first()).toBeFocused();
      await page.keyboard.press("End");
      await expect(mains.nth(n - 1)).toBeFocused();
      await page.keyboard.press("Home");
      await expect(mains.first()).toBeFocused();
    }
    const name = (await mains.first().innerText()).trim();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await lab.homeOf(name))!.active).toBe(name);
    await lab.frames(); // reveal also sends focus to the pane on the next frame
    await mains.first().focus();
    await page.keyboard.press("Shift+Enter");
    await expect.poll(() => lab.homeOf(name)).toBeNull();
    await expect(mains).toHaveCount(n - 1);
  });

  test("F6 reaches the shelf as a region named Shelf", async ({ lab, page }) => {
    await lab.open();
    await lab.tuck("customer").click();
    await expect(lab.shelf()).toBeVisible();
    let hit = false;
    for (let i = 0; i < 8 && !hit; i++) {
      await page.keyboard.press("F6");
      // Focus moves synchronously with the key; allow a few frames before deciding this stop is not the shelf.
      hit = await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest("[data-shelf]")), {
          timeout: 300,
        })
        .toBe(true)
        .then(
          () => true,
          () => false,
        );
    }
    expect(hit, "F6 lands in the shelf").toBe(true);
  });

  test("hover shows a Put back mini-action on the chip", async ({ lab }) => {
    await lab.open();
    await lab.tuck("customer").click();
    const c = lab.chips().first();
    const put = c.getByRole("button", { name: "Put back customer 1", includeHidden: true });
    await expect(put).toBeHidden();
    await c.hover();
    await expect(put).toBeVisible();
    await put.click();
    await expect(lab.shelf()).toHaveCount(0);
  });

  test("activity dots on chips have a shape for every state", async ({ lab, page }) => {
    await lab.open();
    await lab.tuck("customer").click();
    const c = lab.chips().first();
    const id = await page.locator('[role="tab"][data-tucked]').first().getAttribute("data-tab");
    const named = { working: /working/, "needs-you": /needs you/, error: /failed/ } as const;
    for (const state of ["working", "needs-you", "error"] as const) {
      await lab.setActivity(id!, state);
      await expect(c.locator(Lab.shape(state)), state).toBeVisible();
      await expect(
        c.getByRole("button", { name: named[state] }),
        `${state} is in the chip's name`,
      ).toBeVisible();
    }
    await lab.setActivity(id!, "idle");
    await expect(c.locator(".jali-ra")).toHaveCount(0);
  });

  test("overflow: many chips scroll with a +N menu", async ({ lab, page }) => {
    await lab.open({ size: { width: 1024, height: 900 } });
    await lab.preset("Stress: 10 panes");
    for (let i = 0; i < 8; i++) {
      const b = lab.firstTuckable();
      if (!(await b.count())) break;
      await b.click();
      await expect(lab.chips()).toHaveCount(i + 1);
    }
    await expect(lab.shelf()).toBeVisible();
    const overflow = await lab.shelfBar().evaluate((e) => e.scrollWidth > e.clientWidth);
    if (overflow) {
      const more = lab.shelf().getByRole("button", { name: /more tucked/ });
      await expect(more).toBeVisible();
      await more.click();
      await expect(page.getByRole("menu", { name: "More tucked or folded panes" })).toBeVisible();
      await page.keyboard.press("Escape");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
