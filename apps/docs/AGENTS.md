# Working on the Jali docs (apps/docs)

Read first: `docs/DOCS-PLAN.md` (what the site holds), `docs/research/docs-sites.md` (the direction, and what Stripe, Better Auth, WorkOS and General Translation do), and the packages' READMEs (`packages/core`, `packages/react`).

## Run it
- `cd apps/docs && JALI_DOCS_CACHE=node_modules/.vite-<you> pnpm exec vp dev --port <your port> --strictPort`. Your own cache directory and port, always: two dev servers sharing a cache break each other.
- Ports: 5400 lead, 5401 shell, 5402 live, 5403 concepts, 5404 reference, 5405 guides. The lab's own server is 5300; leave it alone.
- `npx tsc --noEmit -p apps/docs` must pass. Check your pages in a real browser (Playwright, `channel: "chrome"`), at 1440 and 390 wide, light and dark.

## Who owns what (edit only your files)
| Area | Files |
|---|---|
| Shell and design | `src/shell/**`, `src/styles/**`, `src/site/**`, `index.html`, `src/pages/index.mdx`, `src/pages/get-started/introduction.mdx`, `src/pages/_lab.mdx` |
| Live parts | `src/live/**`, `src/pages/_live.mdx` (a test page) |
| Concepts | `src/pages/get-started/{quickstart,key-concepts,coding-agents}.mdx`, `src/pages/learn/**`, `src/samples/concepts/**` |
| Reference | `src/pages/reference/**`, `src/reference/**`, `src/samples/reference/**` |
| Guides and examples | `src/pages/guides/**`, `src/pages/examples/**`, `src/samples/guides/**` |

Never edit `packages/**`, the lab (`src/` at the repo root) or another area's files. If the packages are wrong, unclear or missing something, say so in your report with the file and line; don't work around it in the docs.

## Contracts (names and props are fixed; implementations may change)
- **Pages** are MDX under `src/pages`, path = URL (`learn/layout-tree.mdx` is `/learn/layout-tree`). Frontmatter: `title`, `summary` (one plain sentence). The nav is `src/site/nav.ts`. Don't repeat the title as an `# h1` in the page: the shell renders title and summary.
- **MDX components, available without import** (`src/shell/mdx.tsx`): `<Code code lang filename highlight="3-5" />`, `<Callout type="note|tip|warning" title>`, `<Steps>` / `<Step title>`, `<Tabs group>` / `<Tab label>`, `<Install packages="…" />`, `<Cards>` / `<Card title href>`. Fenced code blocks also work (Shiki, light and dark).
- **Live parts** (`import { TreeView, Frame, Spotlight } from "../../live"`): `<TreeView layout json height caption />`, `<Frame layout width minWidth height caption />`, `<Spotlight layout target height caption />`. `layout` is a demo layout id from `src/live/demo.ts` (`two`, `chain`, `nested`, `stack`, `crowded`); `target` is `shelf`, `follow`, `drop-zones`, `tabs`, `divider` or a selector.
- **Never write multi-line code inline as `<Code code={`…`} />`:** MDX strips each line's leading spaces. Use a fenced block (```tsx filename="src/x.tsx" highlight="3-5") or a `?raw` sample file.
- **A summary containing ": " must be quoted** in the frontmatter, or the page fails to build.
- **Code samples that must stay true** live as real `.tsx` files under `src/samples/<area>/` and are shown with `import code from "../../samples/…/x.tsx?raw"` and `<Code code={code} … />`. The typecheck covers them, so a sample that no longer matches the packages fails the build.

## Writing
- Plain, short sentences. Say what something does for the reader, then how. One idea per paragraph. No marketing words ("powerful", "seamless", "robust"), no em dashes, no jargon a reader has to look up; when a Jali word is needed, link it to Key concepts the first time.
- Every fact about behaviour comes from the code (`packages/core/src`, `packages/react/src`) or the lab's tests and decisions (`docs/DECISIONS.md`). Don't guess. If you can't confirm something, leave it out and say so in your report.
- Examples use neutral, real-feeling domains (orders, customers, notes, tickets), never "foo/bar".

## Git
Don't commit, stage or switch branches. The lead reviews and commits each area. Don't install packages: if you need one, say why in your report.
