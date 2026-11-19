/** `vp test` in apps/docs: the unit tests only. e2e/ holds Playwright specs (`pnpm exec playwright test -c apps/docs`). */
import { configDefaults, defineConfig } from "vite-plus";

export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
} as never);
