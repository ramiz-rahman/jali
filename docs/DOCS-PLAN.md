# Jali docs: the plan

19 Nov 2026, brought up to date 23 Nov 2026. What the site holds, how a page is built, and how it is made. The reasoning is in `docs/research/docs-sites.md`. Each item says whether it is done.

## The site

```
Home              what Jali is in one sentence, a live tour, the quickstart in three files, one package    done
Get started
  Introduction    the problem, what you get, when not to use it                                         done
  Why Jali        an honest comparison with dockview, FlexLayout, react-mosaic, Golden Layout,           done
                  react-resizable-panels, and the bundle cost
  Installation    install, styles, Vite, Next.js App Router, server rendering, TypeScript, monorepos    done
  Quickstart      the minimal app, step by step, with the live app above its code                       done
  Key concepts    the vocabulary                                                                         done
  Using Jali with coding agents                                                                          done
Learn             one idea per page, each with a live part where it helps
  The layout tree · How a layout fits · Opening and linking · Following a list · Curated pages          done
  Accessibility   what Jali guarantees, the keyboard map, screen readers, forced colours                done
Guides            one page per question a reader asks (18 pages merged into 9, 23 Nov 2026; old addresses redirect)
  Define a pane kind (and what people may do with panes) · Lay out panes (presets, tabs, rows that      done
  scroll, auto layout) · Keep the layout in the URL · Unsaved work and pane state · Commands and keys
  Theme and words (theming, translating, Chakni) · Fit Jali into your app (features, your own chrome,   done
  two instances, agents) · Test your layouts · Troubleshooting and FAQ
Reference
  jali · jali types · the layout namespace · jali/react · Features · jali/testing · jali/agent          done
  Tokens · Parts · Commands                                                                              done
Examples          the six apps, each hosted at /apps/<name>/, with a screenshot and three links into     done
                  the running app in the state that shows a feature (src/examples/data.ts)
```

## A page

- Three columns at 1280px and up: nav, the page at about 70 characters, "On this page". Below 1024px the TOC goes behind a button; below 768px so does the nav. Done.
- Under the title: a one-line summary, then **Copy page (Markdown)**, **View as Markdown**, **Open in Claude**. Done.
- Code: filename header, copy, package-manager tabs remembered across the site, highlighted lines. Done. Identifiers that link to their reference entry: not yet.
- Reference entries: the symbol, one line on what it does, where it is from, a minimal example, then each option (name, type, default, one paragraph). Done. Stripe's two columns for core functions: not yet.
- Ends with "Next", then **Edit this page** (on `master`) and **Report an issue**. Done.

## The live parts (all real Jali)

Tree view, Frame, Spotlight and the build-along Quickstart. Done.

## How it is made

- **`apps/docs`:** Astro with React MDX, so pages import `jali` from source and every diagram is the real thing. Static output: each page prerendered, then the live parts hydrated as islands. Done.
- **Search:** a built-in index of titles, summaries, headings and entry names. Full-text search (Pagefind): not yet.
- **For agents:** every page also as `.md`; `llms.txt` (an index) and `llms-full.txt` (everything), from the same sources; the same Markdown shipped inside `jali` as `docs/` (`pnpm agent-docs`). Done.
- **The reference stays true:**
  - a test checks that every name `jali` exports, from every entry an app imports (`jali/agent` included), has a reference entry (`docs-reference`). Done.
  - every code sample typechecks: the `?raw` sample files with `tsc -p apps/docs`, and every fenced `ts and `tsx block with `pnpm docs-check`. Done.
  - every `<Params>` table in the reference is compared with the type it documents, names and required flags (`pnpm docs-check`). Done. The type column is written by hand: not yet compared.
  - the tests the guides show run with the docs' tests. Done.

## Not yet

- "Open in StackBlitz": it needs the public repository. (The examples are hosted with the site: `pnpm build:site`.)
- Identifiers linked to their reference entry inside code blocks.
- Full-text search.
- A changelog and release notes, from the first release.
