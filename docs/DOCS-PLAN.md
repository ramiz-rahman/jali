# Jali docs: the plan

19 Nov 2026. What the site holds, how a page is built, and how it is made. The reasoning is in `docs/research/docs-sites.md`.

## The site

```
Home              what Jali is in one sentence, a live workspace to try, the two packages, three ways in
Get started
  Introduction    what problem it solves, and when not to use it
  Quickstart      the minimal app, step by step, with the live app above its code (Stripe's quickstart)
  Key concepts    the vocabulary: pane, kind, ref, layout tree, fitting (fold), tuck and the shelf,
                  focus, follow and selection, peek, curated page and profile, presets
  Using Jali with coding agents
Learn             one idea per page, each with a live workspace
  The layout tree       the live tree diagram: rows, columns, stacks, sizes, the overlay
  How a layout fits     minimum widths, folding, what comes back first, the pane cap
  Opening and linking   open beside, open here, peek, one object one pane (on pages)
  Following a list      selection, the following detail, pinning
  Curated pages         a profile, Single and Multiplexed, investigations, Back to the page
Guides            tasks
  Define a pane kind    · Start from presets · Keep the layout in the URL (and with a router)
  Unsaved work and pane state    · Commands and keys    · Theming (tokens, Tailwind, dark)
  Use Jali with Chakni  · Test a workspace    · Two workspaces on one page
Reference
  @jali/core      createUiStore, createPaneKinds, createUrlSync, boot / startUi, ports, layout.*,
                  commands and keymap, activeItemPort, types
  @jali/react     <Jali>, <JaliView>, definePaneKind, PaneComponentProps, usePaneState,
                  useActiveItemPort, the store hooks, the parts
  Tokens          every --jali-* token, light and dark swatches, what reads it
  Commands        every command id, its default keys, what it checks
Examples          minimal · Data Studio · Loan review · with a router · with Chakni
```

## A page

- Three columns at 1280px and up: nav (with a package switcher at its top), the page at about 70 characters, "On this page". Below 1024px the TOC goes behind a button; below 768px so does the nav.
- Under the title: a one-line summary, then **Copy page (Markdown)**, **View as Markdown**, **Open in Claude**.
- Code: filename header, copy, package-manager tabs remembered across the site, highlighted lines, and identifiers that link to their reference entry.
- Reference entries: title is the symbol, one line on what it does, "From @jali/core", a minimal example, then each option (name, type, default, one paragraph). Core functions use Stripe's two columns: prose and options left, a sticky signature and example right.
- Ends with "Next" and "See also", then Edit this page and Report an issue.

## The live parts (all real Jali workspaces)

1. **Tree view:** workspace and tree side by side, kept in step (hover, resize, fold), with a JSON toggle.
2. **Frame:** a workspace in a resizable frame, to show fitting: drag the frame's edge and panes fold and return.
3. **Spotlight:** dims a live workspace except the part a paragraph is about (the shelf, a follow link, a drop zone).
4. **Build-along:** the quickstart's live app above its code; the step in view lights its lines.

## How it is made

- **`apps/docs` in this workspace:** Vite, React and MDX, so pages import `@jali/react` from source and every diagram is the real thing. Not Fumadocs or Starlight: both would make it look like every other docs site (Better Auth and General Translation already look alike), and the live workspaces need full control of the page.
- **Static output:** each page prerendered to HTML at build (fast first paint, works without JS for reading), then hydrated for the live parts.
- **Search:** Pagefind, built from the static pages; no service.
- **For agents:** every MDX page also emitted as `.md`; `llms.txt` (an index) and `llms-full.txt` (everything) built from the same sources.
- **Reference stays true:** a test checks that every name the packages export has a reference entry, and that every code sample on the site typechecks against the packages.

## Order

1. The shell: layout, type, colour, nav, TOC, code blocks, dark mode, phone. Home and Introduction as the first two pages.
2. The tree view and the frame, then Key concepts and The layout tree around them.
3. Quickstart with the build-along.
4. Reference (generated outlines from the packages' types, written prose).
5. Guides, then the remaining Learn pages.
6. Examples, then Markdown, `llms.txt`, search.
