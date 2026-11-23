/**
 * What the layouts are for: a lesson step moves the tools beside it, the packet list moves its details, and the
 * scans and live panes show what they say. Imported from the shared quality module, so the console guard runs.
 */
import { expect, test } from "../../shared/e2e/quality";
import { openLayout } from "./open";

/** A pane by its title, as Jali's header shows it ("Packet 4 · …"), or as its tab does when it shares a place. */
const paneTitled = (page: import("@playwright/test").Page, title: RegExp) =>
  page.locator(".jali-pane-title h2, [role=tab]", { hasText: title });

test("the course: stepping a lesson moves the packet, bytes and ladder beside it", async ({
  page,
}) => {
  await openLayout(page, "Course");
  const packetTitle = page.locator(".jali-pane-title h2", { hasText: /^Packet \d+ ·/ });
  await expect(packetTitle).toHaveCount(1);
  const first = await packetTitle.textContent();
  // Step on until the lesson shows another packet; every following tool moves with it.
  const next = page.getByRole("button", { name: /^Next$/ }).last();
  for (let i = 0; i < 6 && (await packetTitle.textContent()) === first; i++) await next.click();
  await expect(packetTitle).not.toHaveText(first ?? "");
  const n = (await packetTitle.textContent())?.match(/^Packet (\d+)/)?.[1];
  await expect(paneTitled(page, new RegExp(`^Bytes · packet ${n}$`)).first()).toBeAttached();
});

test("the packet lab: J in the list moves the dissection, the bytes and the layers", async ({
  page,
}) => {
  await openLayout(page, "Packet lab");
  const list = page.getByRole("listbox").first();
  await list.focus();
  await page.keyboard.press("j");
  await expect(page.locator(".jali-pane-title h2", { hasText: /^Packet 2 ·/ })).toHaveCount(1);
  await expect(paneTitled(page, /^Bytes · packet 2$/).first()).toBeAttached();
  await expect(paneTitled(page, /^Layers · packet 2$/).first()).toBeAttached();
});

test("the packet lab: picking an arrow in the ladder moves the list, and everything following it", async ({
  page,
}) => {
  await openLayout(page, "Packet lab");
  const ladder = page.getByRole("listbox", { name: /^Sequence diagram of / });
  await ladder.getByRole("option").nth(2).click();
  const list = page.getByRole("listbox", { name: /^Packets in / });
  const chosen = await list
    .getByRole("option", { selected: true })
    .locator(".pk-c-no")
    .textContent();
  expect(chosen).not.toBe("1");
  await expect(paneTitled(page, new RegExp(`^Bytes · packet ${chosen}$`)).first()).toBeAttached();
});

test("home network: picking a scan in Scans selects it, ready to open in its pane", async ({
  page,
}) => {
  await openLayout(page, "Home network");
  await page
    .getByRole("listbox", { name: "Scans" })
    .getByRole("option", { name: /^Path to / })
    .click();
  await expect(page.getByRole("button", { name: "Open in Path" })).toBeVisible();
});

test("home network: the sample scans load, marked made up", async ({ page }) => {
  await openLayout(page, "Home network");
  await expect(
    page.locator(".scan-head-title", { hasText: /^Wi-Fi · \d+ networks$/ }),
  ).toBeVisible();
  await expect(
    page.locator(".scan-head-title", { hasText: /^Devices · \d+ entries$/ }),
  ).toBeVisible();
  await expect(page.getByText(/SAMPLE · MADE UP/i).first()).toBeVisible();
});

test("connection: the trace is read on open, and nothing heavier runs until asked", async ({
  page,
}) => {
  const asked: string[] = [];
  page.on("request", (r) => {
    if (/__down|__up|dns-query|resolve\?/.test(r.url())) asked.push(r.url());
  });
  await openLayout(page, "Connection");
  await expect(page.getByText("X25519MLKEM768").first()).toBeVisible();
  expect(asked).toEqual([]);
});
