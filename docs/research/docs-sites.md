# What Jali's docs take from Stripe, Better Auth, WorkOS and General Translation

19 Nov 2026. Each site was read in a browser at 1440 × 900 (light and dark) and 390 × 844: home, a guide, a quickstart, reference pages. Screenshots are in `docs/research/docs-sites/` (kept locally, not in git). Measurements are computed styles.

## What each does best

### Stripe (docs.stripe.com and its API reference)
- **Three columns:** section nav at the left (collapsible), the page in the middle, "On this page" at the right with *Optional* marked on optional steps. A row of product tabs across the top.
- **Reading measure:** body 16px on 26px lines, at 814px wide; h1 32/40 bold; h2 24/32 *regular*. System UI font, navy-grey text (`#3c4257`), indigo links. Calm, never loud.
- **Choose your path first:** chips (Checkout, Elements, Mobile) and tabs at the top change what the whole page says. A language choice (Frontend: HTML, React; Backend: Ruby, Node) is remembered and rewrites every code sample.
- **The quickstart is two panes.** Steps scroll on the left; on the right, a sticky **live preview** sits above a multi-file editor (`server.rb`, `checkout.html`). The step you are reading lights up the lines it is about, and the editor scrolls to them. "Download example" gives the whole project.
- **Code is linked.** Identifiers in samples have a dotted underline and lead to their reference entry. Line ranges are highlighted to say "this part".
- **API reference is two columns per entry:** prose and parameters on the left (503px), a sticky dark request and response on the right. A parameter is its name in mono, its type in small grey, one paragraph, and "Show child parameters" to open nested ones. Enums get a boxed list of values with what each means.
- **Built for agents too:** every page has "Ask about this page", "Copy for LLM", "View as Markdown" and "Set up agent"; the footer points to `llms.txt`.
- **Endings:** "See also" links, "Was this page helpful?", then where to get help.

### Better Auth (better-auth.com/docs)
- **An engineered, monochrome look:** Geist and Geist Mono, black on white (and the reverse in dark), uppercase tracked labels in the top tabs, thin rules. Nothing decorative except a faint grid behind feature cards.
- **Installation is a numbered path:** circled step numbers joined by a vertical rail, so you always know where you are and how far is left. The right-hand TOC mirrors the steps and ends with "That's it!".
- **Code blocks carry their context:** a filename header (`auth.ts`, `.env`), package-manager tabs (npm, pnpm, yarn, bun) that stay chosen, and for API calls a **Parameters panel attached under the code**: each parameter with its type and *required* in colour.
- **A sidebar for a big surface:** sections with icons that expand in place, a version switcher, search with ⌘K, and "Ask AI ⌘I" floating at the bottom right. "Copy MD" and "Open in" (an AI assistant) on every page.
- Callouts are dashed-border boxes with an info icon: present, but quieter than the code.

### WorkOS (workos.com/docs)
- **Warm and soft:** Untitled Sans, a 20/28 muted lead paragraph under each title, a very light lilac wash behind the page. Generous space; it feels unhurried.
- **The product switcher is in the title** ("WorkOS AuthKit ▾"), and a **framework switcher sits at the top right of a guide** ("React ▾"): one guide, rewritten per stack.
- **The TOC is numbered** (1 Configure your project, 2 Add AuthKit to your app) with sub-steps under each.
- **Screenshots with a spotlight:** dashboard screenshots are framed in browser chrome, dimmed, with the one panel that matters lit up. You see the whole and are told where to look.
- **Reference:** an endpoint's signature card at the right (`POST /audit_logs/events`, then its fields as an expandable tree, then Parameters and Returns), the request beside the prose, and an "Up next" card at the end.

### General Translation (generaltranslation.com/docs)
- **Reference pages named after the thing:** the title is `<T>` or `useGT`, the subtitle says what it does in one line, then "Available in gt-react, gt-next, …". Then a minimal example, "How it works", the props table, and one section per prop (`Type string · Optional · Deprecated`). The right TOC lists the props as code chips.
- **Inline code that links:** `<GTProvider>` in a sentence is blue and goes to its page.
- **A vocabulary page:** "Key concepts", linked from the home page ("New to localization? Start with Key concepts").
- **A page for agents:** "Using coding agents" sits in Get Started, next to the quickstarts.
- **A section switcher at the top of the sidebar** ("React · Next.js, TanStack & more"), "Last updated" under the title, and a footer row: Edit this page, Report an issue, Ask a question.

## Where they agree (so Jali should too)
1. Three columns on desktop: nav, a page of about 70 characters a line, and "On this page". On a phone, one column with nav and TOC behind buttons.
2. Choices that change the whole page (integration, framework, package manager) sit at the top, are remembered, and rewrite every sample.
3. Code always says where it goes (a filename) and can be copied; long samples highlight the lines that matter.
4. Reference entries are short and the same shape every time: what it is, a minimal example, then each option with its type and default.
5. Every page is also Markdown, for agents: copy, view, open in an assistant, and an `llms.txt`.

## Where Jali's docs should go further
Jali is a visual, spatial library. A reader should not have to imagine the layout tree, folding or following: they should hold it.

- **The docs run on Jali.** Every diagram is a real workspace, not a picture of one. This is the signature, the way Stripe's live checkout preview is theirs.
- **The layout tree, live.** A workspace at the left and its tree at the right, drawn as a diagram, kept in step: hover a node and its pane lights up; drag a divider and the sizes change in the tree; narrow the frame and watch a pane fold into a tab, and the fold appear in the overlay. A toggle shows the same layout as JSON, which is what goes in the URL.
- **Stripe's quickstart, with the workspace as the preview.** Steps scroll on the left; at the right, the app being built (live) above its code, with the current step's lines lit.
- **WorkOS's spotlight, but live.** When a page explains the shelf, the follow link or the drop zones, the live workspace dims everything else and lights that part.
- **For agents:** each page as Markdown, `llms.txt` and `llms-full.txt`, and an "Using Jali with coding agents" page with the rules an agent must follow (kinds are pure data, content claims its keys, report unsaved work, and so on).

## Look and feel
- **Jali's own brand, quietly:** stone ground (`#EFEAE2`) and warm neutrals, Nil indigo (`#4456C7` on light, `#8C9BEA` on dark) as the only accent, used for links, focus and the live diagrams. Keep Nil deep, never bright.
- **Type:** Atkinson Hyperlegible Next for headings (the wordmark's face), IBM Plex Sans for reading (the workspace's face, so the docs and the live panes match), IBM Plex Mono for code. Body 16/26 at about 70 characters; h2 in regular weight, like Stripe, so headings guide without shouting.
- **The lattice as the only ornament:** the jali bars from the logo, faint, behind the home page's opening and section breaks (as Stripe uses its dot grid and Better Auth its square grid). Nothing else decorative.
- **Restraint like Better Auth, warmth like WorkOS:** thin rules, no shadows on cards, generous space, one accent.
