/**
 * The reader's platform, per Playwright project (playwright.config.ts): `navigator.platform` is set before any page
 * script runs, so the site's Mac check (⌘K or Ctrl K) sees "MacIntel" in one project and "Win32" in the other.
 */
import { test as base } from "@playwright/test";

export interface PlatformOptions {
  /** `navigator.platform` in every page: "MacIntel", "Win32", "Linux x86_64". */
  platform: string;
}

export const test = base.extend<PlatformOptions>({
  platform: ["MacIntel", { option: true }],
  context: async ({ context, platform }, use) => {
    await context.addInitScript((value) => {
      Object.defineProperty(Navigator.prototype, "platform", {
        get: () => value,
        configurable: true,
      });
    }, platform);
    await use(context);
  },
});

export { expect } from "@playwright/test";
