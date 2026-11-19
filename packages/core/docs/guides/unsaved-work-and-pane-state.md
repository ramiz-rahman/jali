# Unsaved work and pane state

Ask before a pane's unsaved work is lost, keep what a person expects back, and add a pane's commands to ⌘K.

A pane that holds work needs three things from the workspace. It should ask before the work is lost. It should keep the draft, the sort and the scroll position when the pane folds or moves, or the page reloads. And it should list what the pane can do in ⌘K. This guide does all three for a note on a support ticket.

`src/panes/ticket-note.tsx`

```tsx
import { keyHint } from "@jali/core";
import { definePane, useCommands, usePaneState, useUnsaved, type PaneProps } from "@jali/react";
import { NotePencilIcon } from "@phosphor-icons/react";

// Your own save, for example a fetch to your API.
declare function saveNote(ticketId: number, text: string): Promise<void>;

// The params, declared first so the component can be typed from them.
const noteParams = { id: Number };

/** A note on a ticket. The draft outlives folds, tabs and reloads; closing with an unsaved edit asks first. */
function TicketNote({ params }: PaneProps<typeof noteParams>) {
  // Kept by the workspace for this pane. JSON values only.
  const [draft, setDraft] = usePaneState("draft", "");
  const [saved, setSaved] = usePaneState("saved", "");
  const edited = draft !== saved;

  const save = async () => {
    await saveNote(params.id, draft);
    setSaved(draft);
  };

  // Unsaved work while the draft differs from what was saved. It clears itself when the pane goes.
  useUnsaved(edited && "an unsaved note");

  // Commands for ⌘K while this pane is focused. Each run calls the latest `save`.
  useCommands([
    {
      id: "save",
      title: "Save note",
      keys: keyHint("Mod+S"), // a label only: the textarea below handles the key itself
      disabled: edited ? false : "Nothing to save",
      run: () => void save(),
    },
  ]);

  return (
    <textarea
      aria-label={`Note on ticket ${params.id}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault(); // claimed: the workspace leaves this key alone
          void save();
        }
      }}
    />
  );
}

export const ticketNote = definePane("ticket-note", {
  params: noteParams,
  title: ({ id }) => `Note on ticket ${id}`,
  icon: NotePencilIcon,
  width: { min: 320 },
  height: { min: 200 },
  Component: TicketNote,
});
```

## Report unsaved work

Call `useUnsaved` with a few words about the work while there is some, and anything falsy once it is saved or gone:

```tsx
useUnsaved(edited && "an unsaved note");
```

It clears itself when the component unmounts.

While it has some, the pane is marked with a dot: on its tab, where the dot holds the close button's place and turns back into × on hover or focus; in its header; on its shelf chip and in Single view's switcher; and in the peek sheet while it shows the same object. Screen readers hear "Unsaved changes" with the pane's name. Each of those elements carries `data-unsaved`, for your own styles.

While a pane has unsaved work, any change that would remove it or show another object in it is held, and the person is asked: "Discard unsaved changes?". The dialog names each pane and the words you gave. **Keep editing** is focused, and Esc or a click outside keeps the work. **Discard** makes the held change exactly as it was asked for.

That covers every way a pane can go: closing it, closing the others, choosing a preset, Back and Forward, and showing another object in it. You don't handle any of them yourself.

Some changes never ask, because the pane stays mounted and its work with it: moving it, putting it in tabs, folding it, tucking it and maximising another pane. Choosing a preset that has the same pane (the same `id`, showing the same object) doesn't ask either: the pane, its state and its unsaved work come along. See [A pane in more than one preset](presets.md#a-pane-in-more-than-one-preset).

Two more cases:

- **A following detail with unsaved work keeps its object.** When the list's cursor moves on, the detail stays put and the workspace says why. Asking on every row would be worse.
- **Leaving the page** with unsaved work anywhere brings up the browser's own prompt before the page goes.

## Keep the pane's own state

`usePaneState(key, initial)` works like `useState`, but the workspace keeps the value for this pane:

```tsx
const [draft, setDraft] = usePaneState("draft", "");
```

- It survives the pane being folded, tucked, tabbed or moved, and a reload. The workspace saves it on this device 400ms after the last change.
- It is dropped when the pane closes for good, or shows another object. While an undo could bring a closed pane back, its state is kept too.
- Values must be JSON: strings, numbers, booleans, arrays and plain objects.

Use it for what a person expects back: a draft, a sort, a filter, a scroll position. Use React state for the rest.

In the peek sheet there is no pane, so `usePaneState` is plain React state there, gone when the sheet closes. `useUnsaved` and `useCommands` do nothing in the sheet.

## Add the pane's commands to ⌘K

`useCommands(list)` adds commands to the palette while this pane is focused. They come first, under the pane's title, and go when the component unmounts.

```tsx
useCommands([
  { id: "save", title: "Save note", keys: keyHint("Mod+S"), disabled: edited ? false : "Nothing to save", run: save },
]);
```

- `id` and `title` name the command. `run` runs it.
- `disabled` greys it out. Give a reason as text, and screen readers read it.
- `keys` is a label only. The key itself is yours to handle in the content, as the textarea does above with `preventDefault()`. See [Commands and keys](commands-and-keys.md).

Pass the list on every render. The palette is updated only when an id, title, label or reason changes, and `run` always calls the latest function you gave, so it never sees stale state.

## Ask your app first

Your app may know more than a pane does: a draft saved on the server, a write that is still running. Give the workspace `beforeClose`, and it asks before any change removes panes or makes one show something else: a close, close others, a preset, `jali.setLayout`, Back and Forward, a pane showing another object.

```ts
const jali = createJali({
  panes,
  layout,
  beforeClose: async ({ panes }) => {
    const drafts = await api.draftsFor(panes.map((p) => p.ref));
    return drafts.length === 0 || confirm(`Discard ${drafts.length} drafts?`);
  },
});
```

- Return `true` to let the change happen, `false` to keep the panes. A promise holds the change until it answers. If the layout changed in the meantime, the held change is dropped.
- The action returns `{ ok: false, reason: "kept" }`, or `reason: "pending"` with `settled`, a promise of the final result.
- Your answer comes first. After a yes, a pane that still reports unsaved work gets Jali's own "Discard unsaved changes?".
- If it throws or rejects, the panes stay.

### When your app asks instead

An app with its own "Save changes?" dialog asks from `beforeClose`. Pass `confirmDiscard: false`, and Jali's question never follows: your yes stands. Panes still report their work with `useUnsaved`, so the dot still shows; the browser's prompt on leaving the page is yours to add too.

```ts
const jali = createJali({
  panes,
  confirmDiscard: false,
  beforeClose: ({ panes }) => askToSave(panes),
});
```

A following detail with unsaved work still keeps its object when the list's cursor moves on: nothing asked, so nothing is lost. `jali.actions.remove` never asks either way: neither `beforeClose` nor Jali's question runs, because your app has already decided.

## Test it

The rules can be tested without rendering. What `useUnsaved` reports from a rendered pane can be reported through the engine's own steps (`storeOf` from `@jali/core/adapter`):

```ts
storeOf(jali).actions.setUnsaved("note", "an unsaved note");
expect(jali.actions.close("note")).toEqual({ ok: false, reason: "unsaved" });
```

See [Test a workspace](testing.md).
