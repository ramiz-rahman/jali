# Jali

A new layout primitive for React apps. Split any part of your app into adaptive tiling panes, from two side by side to over a dozen in rows, columns and tabs. You describe each pane once; your users arrange them the way they work, on any screen.

Jali lays out an app's panes (lists, records, editors) in rows, columns and tabs, and keeps the layout usable on every screen: when there isn't room, panes fold into tabs of their neighbours and come back when there is. Its core has no framework and no dependencies; React renders it.

## Quick start

```sh
npm install jali-layout
```

```tsx
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import { defaultFeatures } from "jali-layout/features";
import "jali-layout/styles.css";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params, openBeside }) => (
    <button onClick={() => openBeside(note({ id: params.id + 1 }))}>
      Open note {params.id + 1}
    </button>
  ),
});

const jali = createJali({
  panes: [note],
  layout: row(note({ id: 1 }), note({ id: 2 })),
  features: defaultFeatures(), // the layout in the URL, ⌘K, Settings, the chooser
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
```

Give the root element a height, and name the CSS layers once (`@layer base, jali;`). The [Quickstart](https://jali.ramizrahman.com/get-started/quickstart) explains each line.

## Links

- **Docs:** [jali.ramizrahman.com](https://jali.ramizrahman.com): [Installation](https://jali.ramizrahman.com/get-started/installation), [Key concepts](https://jali.ramizrahman.com/get-started/key-concepts), [Why Jali](https://jali.ramizrahman.com/get-started/why-jali), [Reference](https://jali.ramizrahman.com/reference/core).
- **For coding agents:** the docs ship inside the package, `node_modules/jali-layout/docs/`, and as [llms.txt](https://jali.ramizrahman.com/llms.txt). The agent skill is [`skills/jali`](skills/jali/SKILL.md).
- **Examples:** six apps in [`examples/`](examples), each [running on the site](https://jali.ramizrahman.com/examples): [Data Studio](examples/data-studio), [Loan review](examples/loan-review), [Markets](examples/markets), [Studio](examples/studio), [Trips](examples/trips) and [Handshake](examples/handshake). Run one with `pnpm install` and `pnpm data-studio`.
- **The package:** [`packages/jali`](packages/jali) is the one published package, `jali-layout`.
- **Working on Jali:** [CONTRIBUTING.md](CONTRIBUTING.md) (setup, checks, practice) and [ARCHITECTURE.md](ARCHITECTURE.md) (how it is built). The product brief is [docs/BRIEF.md](docs/BRIEF.md), and every decision is in [docs/DECISIONS.md](docs/DECISIONS.md).

Jali and its example apps are designed and built by [Ramiz Rahman](https://ramizrahman.com/). Licence: [Apache-2.0](LICENSE).
