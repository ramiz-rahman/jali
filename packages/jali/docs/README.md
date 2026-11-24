# Jali docs

The docs for this version of Jali (0.0.0), as Markdown, for people and coding agents. Start with
[Using Jali with coding agents](get-started/coding-agents.md), then the Quickstart and Key concepts.
Written from the docs site by tooling/agent-docs.mjs; don't edit these files.

## Get started

- [Introduction](get-started/introduction.md): What Jali is, the problem it solves, and when not to use it.
- [Why Jali](get-started/why-jali.md): How Jali compares with dockview, FlexLayout, react-mosaic, Golden Layout and react-resizable-panels, and when one of them is the better choice.
- [Installation](get-started/installation.md): Add Jali to a React app with Vite, Next.js or another bundler, render it on the server, and set up TypeScript.
- [Quickstart](get-started/quickstart.md): Build the smallest Jali app, two notes side by side, then open a third from a button.
- [Key concepts](get-started/key-concepts.md): Every word Jali uses, defined in a sentence or two, most with an example or a picture.
- [Using Jali with coding agents](get-started/coding-agents.md): The rules a coding agent, or a person, should follow when adding Jali to an app.

## Learn

- [The layout tree](learn/layout-tree.md): A layout is a tree of rows, columns, stacks and panes, with a size on every node, and notes beside it for what is hidden.
- [How a layout fits](learn/fitting.md): Each kind says how narrow it can go, and when the panes don't fit, Jali folds them into tabs one at a time and brings them back in reverse as room returns.
- [Opening and linking](learn/opening-and-linking.md): A pane opens other objects beside itself, in its own place, or in a peek, and Jali keeps a chain of links from filling the screen.
- [Following a list](learn/following.md): A list reports its selection, and a detail opened from it follows that selection, in place, until the person keeps it.
- [Curated pages](learn/curated-pages.md): A designed page about one item, with tabs of views, that the person can read one view at a time or lay out side by side.
- [Accessibility](learn/accessibility.md): What Jali guarantees for keyboard, screen reader and forced-colours users, the keys it uses, and what your panes still have to do.

## Guides

- [Define a pane kind](guides/pane-kinds.md): Describe one kind of pane: what it shows, how narrow it can go, the component that draws it, and what people may do with it.
- [Lay out panes](guides/layouts.md): Write the layouts Jali opens on, put panes in tabs and in rows that scroll sideways, and let Jali tidy them when they pile up.
- [Keep the layout in the URL](guides/url-and-routers.md): Put the layout in the address so links reopen it and Back steps through it, with or without a router.
- [Unsaved work and pane state](guides/unsaved-work-and-pane-state.md): Ask before a pane's unsaved work is lost, keep what a person expects back, and add a pane's commands to ⌘K.
- [Commands and keys](guides/commands-and-keys.md): Rebind Jali's keys, share ⌘K and the keyboard with your app, let your content keep the keys it needs, and show the right shortcut.
- [Theme and words](guides/theming.md): Make Jali look like your app with its tokens and parts, speak your language, and share one theme with Chakni.
- [Fit Jali into your app](guides/your-app.md): Choose the features you ship, put your own chrome around the panes, run two instances on one page, and let an agent arrange panes.
- [Test your layouts](guides/testing.md): Test your layouts and pane rules without a browser, by running Jali's actions and reading its state with jali/testing.
- [Troubleshooting and FAQ](guides/troubleshooting.md): Fixes for the problems people meet first, Jali's development warnings, and answers to common questions.

## Reference

- [jali](reference/core.md): Every function and constant jali exports, with its options, defaults and what it returns.
- [jali types](reference/core/types.md): Every type jali exports, with its fields, and every instance action.
- [jali/react](reference/react.md): Every component, hook and type jali/react exports, with its props, defaults and what it returns.
- [Features](reference/features.md): What an instance does beyond laying out panes, each a value from its own entry, so an app ships only what it uses.
- [jali/testing](reference/testing.md): An instance for tests, keys, and what a rendered pane would report, without the adapter's internals.
- [Tokens](reference/tokens.md): Every public Jali token, what reads it, its light and dark values, and how the Tailwind bridge maps it.
- [Parts](reference/parts.md): Every part of Jali you can style, its element, its selector, and the attributes that carry its state.
- [Commands](reference/commands.md): Every command, its default keys on a Mac and on Windows and Linux, and when it is refused.

## Examples

- [Overview](examples.md): Six real apps built on Jali, each running here: a database browser, a loan review, a market terminal, an audio editor, a trip planner and a network lab.
- [Data Studio](examples/data-studio.md): A database browser where the person builds the layout: tables, records, related records, SQL queries and charts, each in a pane.
- [Loan review](examples/loan-review.md): An underwriter works through a queue of mortgage applications, one curated page per application.
- [Markets](examples/markets.md): A market terminal for shares, bonds, currencies, indices and crypto, laid out as desks.
- [Studio](examples/studio.md): An audio session editor: a transcript that lights up word by word, a timeline, a mixer and markers, all following one playhead.
- [Trips](examples/trips.md): A map-first planner for a week in Thailand: the days, each day's stops and travel, hotels to compare, and the budget, around a big map.
- [Handshake](examples/handshake.md): A network lab with the course beside the tools: read packets layer by layer, measure your connection, and learn how it all works.
