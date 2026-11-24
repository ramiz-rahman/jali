/**
 * Files in apps/docs/public, read while the site is built (an image's size, whether a screenshot exists). The build
 * runs in apps/docs (pnpm --filter, Playwright's webServer, `astro build`) or at the repository's root.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

const PUBLIC = [join(process.cwd(), "public"), join(process.cwd(), "apps/docs/public")].find(
  existsSync,
);

/** The file behind a site address ("/media/x.png"), when it is one of the site's own and exists. */
export function publicFile(src: string): string | undefined {
  if (!PUBLIC || !src.startsWith("/") || src.includes("..")) return undefined;
  const file = join(PUBLIC, src);
  return existsSync(file) ? file : undefined;
}
