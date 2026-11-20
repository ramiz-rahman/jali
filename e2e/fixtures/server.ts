/**
 * The dev server each Playwright config starts for its browser tests. The suite starts its own server, on the port of
 * its URL and nowhere else (`--strictPort`), so it never tests another session's checkout: when the port is taken,
 * Playwright stops with "already used" instead of reusing the server there. Set REUSE_SERVER=1 to run against a
 * server you started yourself on that URL. `pnpm verify` passes free ports through the URL variables.
 */
import { fileURLToPath } from "node:url";

/** The repository root, where `vp dev examples/<name>` runs. */
export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** Reuse a server already on the URL only when asked to. */
export const REUSE_SERVER = process.env.REUSE_SERVER === "1";

/** The port of `url`, or the protocol's default. */
export const portOf = (url: string) =>
  new URL(url).port || (new URL(url).protocol === "https:" ? "443" : "80");

/** A `webServer` entry: `vp dev <app>` on `url`'s port, strictly. */
export function devServer(app: string, url: string) {
  return {
    command: `vp dev ${app} --port ${portOf(url)} --strictPort`,
    cwd: ROOT,
    url,
    reuseExistingServer: REUSE_SERVER,
    timeout: 60_000,
  };
}
