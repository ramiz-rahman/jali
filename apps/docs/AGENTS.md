# Working on the Jali docs (apps/docs)

Read first: `docs/DOCS-PLAN.md` (what the site holds), `docs/research/docs-sites.md` (the direction, and what Stripe, Better Auth, WorkOS and General Translation do), and the packages' READMEs (`packages/core`, `packages/react`).

## Run it

- `cd apps/docs && JALI_DOCS_CACHE=node_modules/.vite-<you> pnpm exec astro dev --port <your port> --ignore-lock`. Your own cache directory and port, always: two dev servers sharing a cache break each other. `--ignore-lock` keeps the server in the foreground (Astro starts it in the background when a coding agent runs it); strict ports come from astro.config.mjs, since Astro ignores `--strictPort`.
- Ports: 5400 lead, 5401 shell, 5402 live, 5403 concepts, 5404 reference, 5405 guides. The example apps' servers are 5300 (Data Studio) and 5350 (Loan review); leave them alone.
- The site is Astro (`astro.config.mjs`): `pnpm build` prerenders every page to static HTML in `dist/` (with sitemap, robots.txt and a `.md` copy of each page); a page that fails to prerender fails the build. Pages are static: the chrome, TOC and content are rendered at build time (`src/shell/render.tsx`, `src/shell/Shell.tsx`), code highlighted there. In the browser, `src/client/enhance.ts` runs the page tools (theme, copy, wrap, tabs, TOC, drawer, search), and only the live parts hydrate, as islands (`src/shell/island.tsx`, `src/client/islands.ts`), when they come near the screen. Live workspaces render in the browser only (`src/live/ClientOnly.tsx`). Measure with `node apps/docs/scripts/measure.mjs` against `astro preview`.
- `npx tsc --noEmit -p apps/docs` must pass. Check your pages in a real browser (Playwright, `channel: "chrome"`), at 1440 and 390 wide, light and dark.

## Who owns what (edit only your files)

| Area                | Files                                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and design    | `src/shell/**`, `src/styles/**`, `src/site/**`, `src/layouts/**`, `src/pages/**` (Astro routes), `astro.config.mjs`, `src/docs/index.mdx`, `src/docs/get-started/introduction.mdx`, `src/docs/_lab.mdx` |
| Live parts          | `src/live/**`, `src/docs/_live.mdx` (a test page)                                                                                                                                                       |
| Concepts            | `src/docs/get-started/{quickstart,key-concepts,coding-agents}.mdx`, `src/docs/learn/**`, `src/samples/concepts/**`                                                                                      |
| Reference           | `src/docs/reference/**`, `src/reference/**`, `src/samples/reference/**`                                                                                                                                 |
| Guides and examples | `src/docs/guides/**`, `src/docs/examples/**`, `src/samples/guides/**`                                                                                                                                   |

Never edit `packages/**`, the example apps (`examples/`) or another area's files. If the packages are wrong, unclear or missing something, say so in your report with the file and line; don't work around it in the docs.

## Contracts (names and props are fixed; implementations may change)

- **Pages** are MDX under `src/docs` (`src/pages` holds Astro's routes), path = URL (`learn/layout-tree.mdx` is `/learn/layout-tree`). Frontmatter: `title`, `summary` (one plain sentence). The nav is `src/site/nav.ts`. The summary is also the page's meta description for search engines, so make it a sentence that stands alone. Don't repeat the title as an `# h1` in the page: the shell renders title and summary.
- **MDX components, available without import** (`src/shell/mdx.tsx`): `<Code code lang filename highlight="3-5" />`, `<Callout type="note|tip|warning" title>`, `<Steps>` / `<Step title>`, `<Tabs group>` / `<Tab label>`, `<Install packages="…" />`, `<Cards>` / `<Card title href>`. Fenced code blocks also work (Shiki at build time, light and dark). They render static HTML: no hooks or state; behaviour goes in `src/client/enhance.ts`.
- **Live parts** (`import { TreeView, Frame, Spotlight, QuickstartApp } from "../../live"`), each an island, so their props must be JSON (strings, numbers, booleans): `<QuickstartApp height caption />` (the Quickstart's notes app), `<TreeView layout panels height caption detail tries tour />`, `<Frame layout width minWidth height caption />`, `<Spotlight layout target height caption />`. `layout` is a demo layout id from `src/live/demo.ts` (`two`, `chain`, `nested`, `stack`, `strip`, `crowded`); `target` is `shelf`, `follow`, `drop-zones`, `tabs`, `divider` or a selector.
  - TreeView `panels` says what sits beside the workspace: `auto` (the default: map and JSON side by side when wide, else a Map | JSON toggle), `map`, `json`, `map+json`, or `side` (the hero: one closable panel beside the workspace showing map, JSON or both). `detail` shows sizes and the overlay card, for pages that teach the model. `tries={false}` drops the row of things to try. `tour` plays the scripted tour (`src/live/Tour.tsx`); it belongs on the home page's hero only.
- **Never write multi-line code inline as `<Code code={`…`} />`:** MDX strips each line's leading spaces. Use a fenced block (```tsx filename="src/x.tsx" highlight="3-5") or a `?raw` sample file.
- **A summary containing ": " must be quoted** in the frontmatter, or the page fails to build.
- **Code samples that must stay true** live as real `.tsx` files under `src/samples/<area>/` and are shown with `import code from "../../samples/…/x.tsx?raw"` and `<Code code={code} … />`. The typecheck covers them, so a sample that no longer matches the packages fails the build.

## Writing

- Plain, short sentences. Say what something does for the reader, then how. One idea per paragraph. No marketing words ("powerful", "seamless", "robust"), no em dashes, no jargon a reader has to look up; when a Jali word is needed, link it to Key concepts the first time.
- Every fact about behaviour comes from the code (`packages/core/src`, `packages/react/src`) or the repo's tests and decisions (`docs/DECISIONS.md`). Don't guess. If you can't confirm something, leave it out and say so in your report.
- Examples use neutral, real-feeling domains (orders, customers, notes, tickets), never "foo/bar".

## Git

Don't commit, stage or switch branches. The lead reviews and commits each area. Don't install packages: if you need one, say why in your report.
