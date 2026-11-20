/**
 * `vp test` in apps/docs: the unit tests only. e2e/ holds Playwright specs (`pnpm exec playwright test -c apps/docs`).
 * The packages resolve to their source, as in the root config, never to a stale dist/.
 */
import {
  configDefaults,
  defaultClientConditions,
  defaultServerConditions,
  defineConfig,
} from "vite-plus";

export default defineConfig({
  resolve: { conditions: ["source", ...defaultClientConditions] },
  ssr: { resolve: { conditions: ["source", ...defaultServerConditions] } },
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
} as never);
