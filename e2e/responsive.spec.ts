import { test, expect } from "./fixtures/lab";

const SIZES = [
  { width: 1920, height: 1000 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

test("responsive: stress preset folds step by step and never scrolls sideways", async ({
  lab,
  page,
}) => {
  const counts: number[] = [];
  const report: string[] = [];
  await lab.open({ size: SIZES[0] });
  await lab.preset("Stress: 10 panes");
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await lab.stable();
    const m = await page.evaluate(() => {
      const main = document.querySelector('main[aria-label="Panes"]') as HTMLElement;
      const vis = [...document.querySelectorAll("section[data-pane]")].filter(
        (e) => getComputedStyle(e).display !== "none",
      ) as HTMLElement[];
      const right = Math.max(...vis.map((e) => e.getBoundingClientRect().right));
      return {
        visible: vis.length,
        mainScroll: main.scrollWidth - main.clientWidth,
        docScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        right,
        vw: window.innerWidth,
      };
    });
    counts.push(m.visible);
    report.push(
      `${size.width}px: ${m.visible} visible panes, rightmost edge ${Math.round(m.right)} of ${m.vw}, scroll overflow main ${m.mainScroll} doc ${m.docScroll}`,
    );
    await lab.shot(`14-responsive-${size.width}`);
  }
  console.log(report.join("\n"));
  for (let i = 1; i < counts.length; i++)
    expect(counts[i]!, report.join("\n")).toBeLessThanOrEqual(counts[i - 1]!);
  expect(counts[0]!).toBeGreaterThan(counts[2]!);
  expect(counts[3]).toBe(1);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await lab.stable();
    const m = await page.evaluate(() => {
      const main = document.querySelector('main[aria-label="Panes"]') as HTMLElement;
      const vis = [...document.querySelectorAll("section[data-pane]")].filter(
        (e) => getComputedStyle(e).display !== "none",
      ) as HTMLElement[];
      return {
        main: main.scrollWidth - main.clientWidth,
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        right: Math.max(...vis.map((e) => e.getBoundingClientRect().right)) - window.innerWidth,
      };
    });
    expect(m.main, `${size.width}: workspace scrolls sideways`).toBeLessThanOrEqual(1);
    expect(m.doc, `${size.width}: page scrolls sideways`).toBeLessThanOrEqual(1);
    expect(m.right, `${size.width}: a pane runs past the viewport`).toBeLessThanOrEqual(1);
  }
});

test("responsive: single view has a pane switcher that switches panes and restores the layout", async ({
  lab,
  page,
}) => {
  await lab.open({ size: { width: 1440, height: 900 } });
  await lab.preset("Stress: 10 panes");
  const urlBefore = new URL(page.url()).search;
  const wide = await lab.visibleIds();
  await page.setViewportSize({ width: 390, height: 844 });
  const sw = page.getByRole("navigation", { name: "Panes" });
  await expect(sw).toBeVisible();
  await expect(lab.main().getByRole("separator")).toHaveCount(0);
  await expect(lab.announcer()).toContainText("Single view");
  const tabs = sw.getByRole("tab");
  expect(await tabs.count()).toBeGreaterThan(5);
  await expect(sw.getByRole("tab", { selected: true })).toHaveCount(1);
  await tabs.nth(3).click();
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => lab.visibleCount()).toBe(1);
  expect(new URL(page.url()).search).toBe(urlBefore);
  const sideways = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sideways).toBeLessThanOrEqual(1);
  await lab.shot("15-single-view-390");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(sw).toHaveCount(0);
  // Exact restore: the same panes show as before single view, even though the switcher moved focus to another pane.
  await expect
    .poll(async () => (await lab.visibleIds()).slice().sort())
    .toEqual(wide.slice().sort());
  // And again from a different pane picked in single view (the last tab).
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sw).toBeVisible();
  await tabs.last().click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(sw).toHaveCount(0);
  await expect
    .poll(async () => (await lab.visibleIds()).slice().sort())
    .toEqual(wide.slice().sort());
});
