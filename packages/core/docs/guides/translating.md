# Translate Jali

Show and announce Jali's words in your app's language, or in your own wording, with English as the default.

Every word Jali shows or says can be replaced. That covers what it announces to screen readers, its toasts, the titles and groups of its commands, and the text of its dialogs, tabs, shelf and buttons, including labels, tooltips and placeholders. English is the default.

## Change a few words

Pass `messages` to `createJali`. Give only the words you want to change. Everything else stays English.

`src/workspace.ts`

```tsx
import { createJali } from "@jali/core";
import { orderKind, ordersKind } from "../../reference/kinds";

// Only what changes: the rest stays English.
export const jali = createJali({
  panes: [ordersKind, orderKind],
  layout: ordersKind(),
  messages: {
    commands: { close: "Close tab", closeOthers: "Close other tabs" },
    palette: { placeholder: "Search commands…" },
    announcements: { closed: (pane) => `${pane} closed. You can undo this.` },
  },
});
```

The words are grouped by area. The type lists every key, so your editor completes them, and a misspelt key is a type error.

| Area | What it holds |
|---|---|
| `announcements` | What the live region says after a change, and why something did not happen |
| `toasts` | The title and description of each toast (`jali.onToast`) |
| `commands`, `commandGroups` | Command titles and the groups they are listed under, in ⌘K and `listCommands` |
| `palette`, `chooser`, `confirmDiscard`, `settings` | The command palette, the chooser ("Add to tabs of…", and the words around your items in `jali.actions.choose`), "Discard unsaved changes?" and the settings panel |
| `pane`, `tabs`, `shelf`, `peek` | A pane's header, its tabs and their menu, the shelf, the peek sheet |
| `workspace`, `page`, `drop` | The panes region and its dividers, a curated page's bar and tabs, the label shown while dragging |
| `keys` | Words in printed keys ("Ctrl", "Esc", "Alt-click"), and how a tooltip shows its shortcut |

## Write a full translation

Start from `en`, Jali's English messages, and give the type `Messages`. A `Messages` must have every area and every key. Spread `en` where you have not translated yet. An area you write out without spreading `en` (`palette` below) must list every key: one you missed is a type error, and so is one a later version of Jali adds.

`src/jali-fr.ts`

```tsx
import { en, type Messages } from "@jali/core";

// A full translation is a `Messages`: leave out a key and the typecheck says which.
export const fr: Messages = {
  ...en,
  announcements: {
    ...en.announcements,
    closed: (pane) => `${pane} fermé · annulation possible`,
    // Plurals are the translation's own: a count comes in as a number.
    discarded: (count) =>
      count === 1 ? "Modifications abandonnées" : `Modifications abandonnées dans ${count} volets`,
    // Directions come in as values ("top", "left"), so the words and their order are yours.
    moved: (pane, edge) =>
      `${pane} déplacé ${{ top: "vers le haut", bottom: "vers le bas", left: "à gauche", right: "à droite" }[edge]}`,
  },
  commands: { ...en.commands, close: "Fermer le volet", focusDirection: (d) => `Volet ${d}` },
  palette: {
    label: "Commandes",
    placeholder: "Tapez une commande…",
    listLabel: "Commandes",
    empty: (query) => `Aucune commande ne correspond à « ${query} ».`,
  },
  // A message with a bold part returns its parts in order: put the bold part where French needs it.
  confirmDiscard: {
    ...en.confirmDiscard,
    title: "Abandonner les modifications ?",
    item: (pane, what, bold) => [bold(pane), " : ", what],
  },
  keys: { ...en.keys, ctrl: "Ctrl", escape: "Échap", space: "Espace" },
};
```

## Values, plurals and word order

A message that needs values is a function: a pane's title, a count, a direction, a key. You write the whole sentence, so you choose the word order and the plural form. Jali never joins translated pieces itself.

- Counts come in as numbers, as in `discarded(count)` and `backToPage(page, count)`.
- Directions come in as values (`"top"`, `"left"`), as in `moved(pane, edge)`.
- Keys come in already printed for the platform, as in `keys.withKeys(label, keys)`, which turns "Put back" and "⌘K ⌘]" into "Put back · ⌘K ⌘]".
- A message with a bold part takes `bold` and returns its parts in order, as in `confirmDiscard.item(pane, what, bold)` and `chooser.heading(pane, bold)`.

## Pick the language

The words belong to the workspace: choose them when you call `createJali`. To change language, make the workspace again with the new words.

`src/App.tsx`

```tsx
import { createJali } from "@jali/core";
import { JaliRoot } from "@jali/react";
import { orderKind, ordersKind } from "../../reference/kinds";
import { fr } from "./french";

// Pick the words when the workspace is made: they are part of it, like its keys.
const jali = createJali({
  panes: [ordersKind, orderKind],
  layout: ordersKind(),
  messages: navigator.language.startsWith("fr") ? fr : undefined,
});

export const App = () => <JaliRoot jali={jali} />;
```

Read them back from `jali.messages`, for example to word your own toasts or menus the same way.

## What stays yours

Some words come from your app, so Jali shows them as you give them:

- Pane titles (`definePane`'s `title`) and preset labels.
- A curated page's name, view labels, `itemNoun` and `viewers` (`definePage`).
- The free workspace's name (`createJali({ name })`), when you give one.
- Your own commands and the commands a pane adds with `useCommands`.

Two things are not translated. The Mac's key symbols (⌘, ⌥, ⇧, ↵, the arrows) are symbols, not words. Errors and console warnings meant for developers stay in English.

`formatKeys` and `keyHint` print English key words unless you pass words as their third argument (`keyHint("Alt+Enter", platform, fr.keys)`). `jali.keymap.label(id)` and `jali.keymap.format(seq)` use the workspace's own words.
