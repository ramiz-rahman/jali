# Jali docs

The docs for this version of Jali (0.0.0), as Markdown, for people and coding agents. Start with
[Using Jali with coding agents](get-started/coding-agents.md), then the Quickstart and Key concepts.
Written from the docs site by tooling/agent-docs.mjs; don't edit these files.

## Get started

- [Introduction](get-started/introduction.md): What Jali is, the problem it solves, and when not to use it.
- [Quickstart](get-started/quickstart.md): Build the smallest Jali app, two notes side by side, then open a third from a button.
- [Key concepts](get-started/key-concepts.md): Every word Jali uses, defined in a sentence or two, most with an example or a picture.
- [Using Jali with coding agents](get-started/coding-agents.md): The rules a coding agent, or a person, should follow when adding Jali to an app.

## Learn

- [The layout tree](learn/layout-tree.md): A layout is a tree of rows, columns, stacks and panes, with a size on every node, and notes beside it for what is hidden.
- [How a layout fits](learn/fitting.md): Each kind says how narrow it can go, and when the panes don't fit, Jali folds them into tabs one at a time and brings them back in reverse as room returns.
- [Opening and linking](learn/opening-and-linking.md): A pane opens other objects beside itself, in its own place, or in a peek, and Jali keeps a chain of links from filling the screen.
- [Following a list](learn/following.md): A list reports its selection, and a detail opened from it follows that selection, in place, until the person pins it.
- [Curated pages](learn/curated-pages.md): A designed page about one item, with tabs of views, that the person can read one view at a time or lay out side by side.

## Guides

- [Define a pane kind](guides/pane-kinds.md): Describe one kind of pane, what it shows, how narrow it can go, and the component that draws it.
- [Start from presets](guides/presets.md): Give the workspace named layouts to open on and switch between.
- [Auto layout](guides/auto-layout.md): Let Jali arrange the panes on screen from the room there is and each kind's size hints, when they have piled up.
- [Keep the layout in the URL](guides/url-and-routers.md): Put the layout in the address so links reopen it and Back steps through it, with or without a router.
- [Unsaved work and pane state](guides/unsaved-work-and-pane-state.md): Ask before a pane's unsaved work is lost, keep what a person expects back, and add a pane's commands to ⌘K.
- [Tabs](guides/tabs.md): Let people reorder, pin, rename and close tabs, and add your own items to a tab's menu.
- [Rows that scroll sideways](guides/scrolling-rows.md): Keep a sequence of panes at a width you can read, a board's stages or a week of days, in a row that scrolls instead of folding.
- [Choose what people can do with panes](guides/pane-controls.md): Turn a pane's controls on or off, close, tuck, maximise, full screen, move, resize, pin and pop out, for a kind, a whole workspace, or a layout.
- [Commands and keys](guides/commands-and-keys.md): Rebind the workspace's keys, share ⌘K and the keyboard with your app, let your content keep the keys it needs, and show the right shortcut.
- [Theming](guides/theming.md): Make the workspace match your app by setting a few tokens, mapping them from your Tailwind theme, or styling its parts.
- [Translate Jali](guides/translating.md): Show and announce Jali's words in your app's language, or in your own wording, with English as the default.
- [Use Jali with Chakni](guides/chakni.md): Let a list inside a pane drive the pane's following detail through the active-item port, and share one theme.
- [Test a workspace](guides/testing.md): Test your layouts and pane rules without a browser, by running the workspace's actions and reading its state.
- [Two workspaces on one page](guides/two-workspaces.md): Put two workspaces side by side, or one in a dialog, without their links, saved settings or keys getting mixed up.
- [Let an agent use the workspace](guides/agents.md): Give an AI agent the workspace as tools, so it can read what is open and open, arrange and pin panes through Jali's own actions, within the limits your app sets.

## Reference

- [jali](reference/core.md): Every function and constant jali exports, with its options, defaults and what it returns.
- [jali types](reference/core/types.md): Every type jali exports, with its fields, and every workspace action.
- [The layout namespace](reference/core/layout.md): The pure layout operations of jali, each taking a layout and returning a new one.
- [jali/react](reference/react.md): Every component, hook and type jali/react exports, with its props, defaults and what it returns.
- [Features](reference/features.md): What a workspace does beyond laying out panes, each a value from its own entry, so an app ships only what it uses.
- [jali/testing](reference/testing.md): A workspace for tests, keys, and what a rendered pane would report, without the adapter's internals.
- [Tokens](reference/tokens.md): Every public --jali-* token, what reads it, its light and dark values, and how the Tailwind bridge maps it.
- [Parts](reference/parts.md): Every part of the workspace you can style, its element, its selector, and the attributes that carry its state.
- [Commands](reference/commands.md): Every workspace command, its default keys on a Mac and on Windows and Linux, and when it is refused.

## Examples

- [Examples](examples.md): Five working apps built on Jali: a database browser, a loan review, a market terminal, an audio editor and a trip planner.
