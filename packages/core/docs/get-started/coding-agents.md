# Using Jali with coding agents

The rules a coding agent, or a person, should follow when adding Jali to an app.

Jali does a lot for a pane: it places it, folds it, keeps its state and asks before it loses work. It can only do that if the pane's content follows a few rules. This page lists them, with the reason for each. Give it to your agent along with the task.

> **Tip: The docs come with the package.** Every page of these docs is in `@jali/core` as Markdown, for the version you installed: `node_modules/@jali/core/docs/README.md` lists them, and this page is `docs/get-started/coding-agents.md`. An agent that reads them there works from docs that match its code. Each page here is also Markdown from the buttons under its title.

To give an agent the workflow as well, add Jali's skill, `skills/jali` in Jali's repository. It tells the agent to read these rules and the installed docs first, and to check its work against them.

## The rules

### 1. A kind is data plus a component

Define each kind of pane with `definePane("kind", { params, title, width, height, Component })` in its own module, and pass the app's kinds to `createJali({ panes })`. Nothing about a kind is global, so two workspaces on one page never share kinds. Name objects with the kind itself, `ticket({ id: 101 })`, never with a hand-written `{ kind, params }`.

Set `width.min` to the narrowest width the content still works at once it adapts, not the width it looks best at. Jali folds a pane into a tab rather than squeeze it below its minimum, so a minimum that is too large folds panes early. Use `width.comfortable` and `width.max` for the rest ([How a layout fits](../learn/fitting.md)).

### 2. Declare params, and read them typed

What a pane shows arrives as `params`, read with the kind's `params` types: `params: { id: Number }` gives `params.id` as a number, so never cast it. Declare every param: one a pane may leave out is `optional(String)`, a flag is `Boolean`, a fixed choice is `oneOf("open", "closed")`. A component written apart from its kind takes `PaneProps<typeof ticketParams>`, with the params declared first, never the type written out again. Keep params small: ids, never the data itself, because they go in the address.

### 3. Claim your keys, let the rest bubble

Keys reach the pane's content first. Handle the keys your content uses and call `event.preventDefault()` on each one. The workspace leaves a claimed key alone. Let every other key bubble, so ⌘K, F6 and the workspace's commands keep working inside your pane.

- Never stop propagation of every key in a container. It cuts off ⌘K and F6.
- Letter keys (J, K) must only act while your content has focus.
- Content that needs every key, such as a code editor, marks its element `data-pane-keys="content"`. The workspace then takes only F6 and Shift+F6 there, so focus can always leave.

`ticket-list.tsx`

```tsx
import { useState, type KeyboardEvent } from "react";
import { definePane, type PaneProps } from "@jali/react";
import { tickets } from "./data";
import { ticket } from "./ticket";

function TicketList({ select, peek, openBeside }: PaneProps) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? undefined : tickets[index];

  // Move the cursor and tell the workspace what is selected. A following detail shows it once it rests.
  const selectAt = (i: number) => {
    const next = Math.max(0, Math.min(tickets.length - 1, i));
    setIndex(next);
    select(ticket({ id: tickets[next]!.id }));
  };
  // Select first, then open: the detail that opens is linked to the selection, so it follows the list.
  const openAt = (i: number) => {
    if (i !== index) selectAt(i);
    openBeside(ticket({ id: tickets[i]!.id }));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) return; // ⌘K and the workspace's keys bubble on
    if ((e.key === "j" || e.key === "ArrowDown") && !e.altKey) selectAt((index ?? -1) + 1);
    else if ((e.key === "k" || e.key === "ArrowUp") && !e.altKey) selectAt((index ?? 1) - 1);
    else if (e.key === " " && current) peek(ticket({ id: current.id }));
    else if (e.key === "Enter" && e.altKey && index !== null) openAt(index);
    else return; // not ours: let it bubble
    e.preventDefault(); // claimed: the workspace leaves this key alone
  };

  return (
    <ul role="listbox" aria-label="Tickets" tabIndex={0} onKeyDown={onKeyDown}>
      {tickets.map((t, i) => (
        <li
          key={t.id}
          role="option"
          aria-selected={i === index}
          onClick={() => selectAt(i)}
          onDoubleClick={() => openAt(i)}
        >
          #{t.id} {t.subject}
        </li>
      ))}
    </ul>
  );
}

export const ticketList = definePane("tickets", {
  title: "Tickets",
  width: { min: 320 },
  height: { min: 200 },
  Component: TicketList,
});
```

### 4. Select before you open

A list reports its selected item with `select(ref)` as the cursor moves (J/K, arrows, a click). To open a row, select it first, then call `openBeside(ref)`. The workspace then knows the pane came from the selection, so it becomes a [following detail](key-concepts.md#selection) that follows the list.

If the list's filter no longer shows the selected item, say so with `select(ref, { inResults: false })`. A following detail keeps the item, with a note.

The usual row keys are J/K or the arrows to select, Space to `peek(ref)`, and ⌥↵ (Alt+Enter) to `openBeside(ref)`.

### 5. Report unsaved work

If closing the pane would lose something the person typed, report it with `useUnsaved(dirty && "a short description")`; it clears when the work is saved or the pane goes. While it is set, closing the pane, closing others, a preset, Back and Forward, or showing another object in the pane asks the person first. Leaving the page triggers the browser's own prompt.

Don't build your own "are you sure" for these. Moving, tabbing, folding and tucking never ask, because the content stays mounted.

### 6. Use `usePaneState` for what the person expects back

A draft, a sort, a scroll position: keep these with `usePaneState(key, initial)` instead of `useState`. The workspace keeps the value through folds, tabs, tucks and reloads, and drops it when the pane closes for good or shows another object. Values must be JSON. Use React state for everything else.

`note-editor.tsx`

```tsx
import { useState } from "react";
import { keyHint } from "@jali/core";
import { definePane, useCommands, usePaneState, useUnsaved, type PaneProps } from "@jali/react";
import { noteBody, saveNote } from "./data";

const noteParams = { id: Number };

function NoteEditor({ params }: PaneProps<typeof noteParams>) {
  const [saved, setSaved] = useState(() => noteBody(params.id));
  // The draft is pane state: it survives a fold, a tab switch, a tuck and a reload, and goes when the pane closes.
  const [draft, setDraft] = usePaneState("draft", saved);
  const save = () => {
    saveNote(params.id, draft);
    setSaved(draft);
  };
  const dirty = draft !== saved;

  // Work the person would lose: closing the pane, or showing another note in it, asks first.
  useUnsaved(dirty && "an unsaved edit to this note");

  // What this pane adds to ⌘K while it is focused. `keys` is a label: the content handles the key itself.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: keyHint("Mod+Enter"),
      disabled: dirty ? false : "Nothing to save",
      run: save,
    },
  ]);

  return (
    <textarea
      aria-label="Note"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); // claimed
          save();
        }
      }}
    />
  );
}

export const noteEditor = definePane("note", {
  params: noteParams,
  title: ({ id }) => `Note ${id}`,
  width: { min: 280 },
  Component: NoteEditor,
});
```

### 7. Add commands with `useCommands`

List what the pane can do in ⌘K with `useCommands([...])`, on every render. It updates the palette only when a command's id, title, label or reason changes, runs the latest `run`, and removes the commands on unmount. `keys` on a command is a label only; the content still handles the key itself.

### 8. Pause while hidden

A pane gets `paused: true` while it is out of sight: behind a tab, tucked, folded or behind a maximised pane. Stop polling, timers and live subscriptions while paused, and keep the pane's state. The pane stays mounted, so nothing needs to reload when it comes back.

`clock.tsx`

```tsx
import { useEffect, useState } from "react";
import { definePane, type PaneProps } from "@jali/react";

// A live clock that stops while its pane is out of sight (behind a tab, tucked, folded or covered by a maximised pane).
function Clock({ paused }: PaneProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [paused]);
  return <time>{now.toLocaleTimeString()}</time>;
}

export const clock = definePane("clock", {
  title: "Clock",
  width: { min: 200 },
  height: { min: 120 },
  Component: Clock,
});
```

### 9. Read data through the app's shared cache

Many panes can show the same object at once: a ticket in a list, in a detail and in a peek. Read data through the app's one shared cache (TanStack Query, SWR, your own store), keyed by the object's id, so every pane showing it updates together after an edit. Don't fetch in a pane around that cache.

With TanStack Query, pass `enabled: !paused` (or `subscribed: !paused`) so hidden panes stop fetching.

### 10. Theme Jali with its tokens, not with Tailwind inside it

Jali has no Tailwind in it. Its styles are plain CSS on `--jali-*` tokens, in the `jali` cascade layer, so it works the same in apps with and without Tailwind. Don't add Tailwind classes to Jali's parts, don't copy its parts to restyle them, and don't use `!important`. To change how Jali looks, set its tokens, or import the Tailwind bridge (below). The content inside your panes is yours: style it the way your app styles everything else.

## Retheming

Declare the layer order once, at the top of your CSS, so your styles win over Jali's:

```css
@layer theme, base, jali, components, utilities;
```

Then pick one way in:

- **From a Tailwind theme:** also import `@jali/react/tailwind.css`. It points Jali's tokens at your theme's (`--color-primary`, `--color-card`, `--color-border`, `--radius-card` and others).
- **By hand:** set `--jali-*` tokens on `:root` or on any subtree. Setting `--jali-accent` is enough to change the accent; its tints follow.

```css
:root { --jali-accent: #0f766e; }
```

Dark mode follows `prefers-color-scheme`, a `.dark` class or `[data-theme="dark"]`. Jali's parts carry their state as attributes (`data-pane`, `data-focused`, `aria-selected`, `data-drop-zone`) and every class starts with `jali-`, so a host rule can target them without fighting specificity.

## A checklist for a review

- Every kind is defined with `definePane` and listed in `createJali({ panes })`.
- Every `width.min` is the narrowest the content works at.
- Refs are made with the kind (`ticket({ id })`), and params are declared, not cast.
- Refs hold ids, not data.
- Content calls `preventDefault()` on the keys it handles and nothing else.
- Lists call `select` before `openBeside`.
- Editable panes call `useUnsaved`.
- State the person expects back uses `usePaneState`.
- Live work stops while `paused`.
- Data comes from the app's shared cache.
- Jali is themed through `--jali-*` tokens, with the layer line in place.
