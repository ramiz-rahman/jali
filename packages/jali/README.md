# jali

Panes that fold into tabs rather than squeeze, follow each other, and come back from a link exactly as they were.

```sh
npm install jali
```

React 18.2 or later is an optional peer: the framework-free core (`jali`) needs nothing.

```tsx
import { createRoot } from "react-dom/client";
import { createJali, row } from "jali";
import { JaliRoot, definePane } from "jali/react";
import { urlSync } from "jali/url";
import "jali/styles.css";

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
  features: [urlSync()], // the layout in the address; or defaultFeatures() from "jali/features" for all of Jali's usual ones
});

createRoot(document.getElementById("root")!).render(<JaliRoot jali={jali} />);
```

## Entries

| Import                                                                                                     | What it holds                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `jali`                                                                                                     | Kinds, layouts, `createJali`, actions, events, ports, commands. No framework.  |
| `jali/react`                                                                                               | `<JaliRoot>`, `definePane`, the hooks and the chrome parts                     |
| `jali/page`                                                                                                | `definePage`: a curated page, opt-in                                           |
| `jali/features`                                                                                            | `defaultFeatures()`: the address, ⌘K, Settings, the chooser and `data-pressed` |
| `jali/url`, `jali/palette`, `jali/settings`, `jali/chooser`, `jali/rename`, `jali/pop-out`, `jali/pressed` | One feature each: an app ships only the features it imports                    |
| `jali/testing`                                                                                             | `createTestJali` and what a rendered pane would report                         |
| `jali/styles.css`, `jali/theme.css`, `jali/tailwind.css`                                                   | The styles, in the `jali` cascade layer                                        |
| `jali/adapter`                                                                                             | For a framework adapter. **May change in any minor version.**                  |

## Docs, here too

`docs/` in this package holds the docs for the installed version, as Markdown: `node_modules/jali/docs/README.md`
lists every page. A coding agent should read `docs/get-started/coding-agents.md` before writing Jali code.
