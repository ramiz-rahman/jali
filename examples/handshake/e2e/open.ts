/**
 * Opening the app in the tests: with Cloudflare's trace answered from a recorded reply (the Connection pane reads
 * it on open), and every other live service refused, so no test depends on the network. Then a layout.
 */
import { expect, type Page } from "@playwright/test";

/** A trace as Cloudflare sends it, recorded from a real Chrome page. */
const TRACE = [
  "fl=530f46",
  "h=speed.cloudflare.com",
  "ip=203.0.113.52",
  "ts=1795387226.000",
  "visit_scheme=https",
  "colo=DAC",
  "sliver=none",
  "http=http/1.1",
  "loc=BD",
  "tls=TLSv1.3",
  "sni=plaintext",
  "warp=off",
  "gateway=off",
  "rbi=off",
  "kex=X25519MLKEM768",
  "",
].join("\n");

const LIVE =
  /speed\.cloudflare\.com|cloudflare-dns\.com|one\.one\.one\.one|dns\.google|rdap\.org|stat\.ripe\.net|certspotter\.com/;

export async function stubNetwork(page: Page) {
  await page.route(LIVE, (route) =>
    route.request().url().includes("/cdn-cgi/trace")
      ? route.fulfill({
          status: 200,
          contentType: "text/plain",
          headers: { "access-control-allow-origin": "*" },
          body: TRACE,
        })
      : route.abort("internetdisconnected"),
  );
}

export const layoutButton = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Layouts" }).getByRole("button", { name });

/** The app on the layout called `name` ("Course", the first, "Packet lab", "Connection", "Home network"). */
export async function openLayout(page: Page, name = "Course") {
  await stubNetwork(page);
  await page.goto("/");
  await expect(layoutButton(page, "Course")).toHaveAttribute("aria-pressed", "true");
  if (name !== "Course") {
    await layoutButton(page, name).click();
    await expect(layoutButton(page, name)).toHaveAttribute("aria-pressed", "true");
  }
}
