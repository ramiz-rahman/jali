# jali-layout

A new layout primitive for React apps. Split any part of your app into adaptive tiling panes, from two side by side to over a dozen in rows, columns and tabs. You describe each pane once; your users arrange them the way they work, on any screen.

```sh
npm install jali-layout
```

React 18.2 or later is an optional peer: the framework-free core (`jali-layout`) needs nothing.

```tsx
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali-layout";
import { JaliRoot, definePane } from "jali-layout/react";
import { urlSync } from "jali-layout/url";
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
  features: [urlSync()], // the layout in the address; or defaultFeatures() from "jali-layout/features" for all of Jali's usual ones
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
```

## Entries

| Import                                                                                                                                                      | What it holds                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `jali-layout`                                                                                                                                               | Kinds, layouts, `createJali`, actions, events, ports, commands. No framework.  |
| `jali-layout/react`                                                                                                                                         | `<JaliRoot>`, `definePane`, the hooks and the chrome parts                     |
| `jali-layout/page`                                                                                                                                          | `definePage`: a curated page, opt-in                                           |
| `jali-layout/features`                                                                                                                                      | `defaultFeatures()`: the address, ⌘K, Settings, the chooser and `data-pressed` |
| `jali-layout/url`, `jali-layout/palette`, `jali-layout/settings`, `jali-layout/chooser`, `jali-layout/rename`, `jali-layout/pop-out`, `jali-layout/pressed` | One feature each: an app ships only the features it imports                    |
| `jali-layout/testing`                                                                                                                                       | `createTestJali` and what a rendered pane would report                         |
| `jali-layout/styles.css`, `jali-layout/theme.css`, `jali-layout/tailwind.css`                                                                               | The styles, in the `jali` cascade layer                                        |
| `jali-layout/adapter`                                                                                                                                       | For a framework adapter. **May change in any minor version.**                  |

## Docs, here too

`docs/` in this package holds the docs for the installed version, as Markdown: `node_modules/jali-layout/docs/README.md`
lists every page. A coding agent should read `docs/get-started/coding-agents.md` before writing Jali code.
