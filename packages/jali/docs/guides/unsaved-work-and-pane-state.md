# Unsaved work and pane state

Ask before a pane's unsaved work is lost, keep what a person expects back, and add a pane's commands to ⌘K.

A pane that holds work needs three things from Jali. It should ask before the work is lost. It should keep the draft, the sort and the scroll position when the pane folds or moves, or the page reloads. And it should list what the pane can do in ⌘K. This guide does all three for a note on a support ticket.

`src/panes/ticket-note.tsx`

```tsx
import { keyHint } from "jali";
import { definePane, useCommands, usePaneState, useUnsaved, type PaneProps } from "jali/react";
import { NotePencilIcon } from "@phosphor-icons/react";

// Your own save, for example a fetch to your API.
declare function saveNote(ticketId: number, text: string): Promise<void>;

// The params, declared first so the component can be typed from them.
const noteParams = { id: Number };

/** A note on a ticket. The draft outlives folds, tabs and reloads; closing with an unsaved edit asks first. */
function TicketNote({ params }: PaneProps<typeof noteParams>) {
  // Kept by Jali for this pane. JSON values only.
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
          e.preventDefault(); // claimed: Jali leaves this key alone
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
import { useUnsaved } from "jali/react";

function TicketNote({ edited }: { edited: boolean }) {
  useUnsaved(edited && "an unsaved note");
  return null;
}
```

It clears itself when the component unmounts.

While it has some, the pane is marked with a dot: on its tab, where the dot holds the close button's place and turns back into × on hover or focus; in its header; on its shelf chip and in the phone switcher; and in the peek sheet while it shows the same object. Screen readers hear "Unsaved changes" with the pane's name. Each of those elements carries `data-unsaved`, for your own styles.

While a pane has unsaved work, any change that would remove it or show another object in it is held, and the person is asked: "Discard unsaved changes?". The dialog names each pane and the words you gave. **Keep editing** is focused, and Esc or a click outside keeps the work. **Discard** makes the change against the layout as it is then: what changed elsewhere while the question was open stays. If the change would now lose other work too, the person is asked again. Work is forgotten only when the change is made. Back or Forward that is not made in the end puts the address back on what is on screen.

That covers every way a pane can go: closing it, closing the others, choosing a preset, Back and Forward, and showing another object in it. You don't handle any of them yourself.

An action held this way returns `{ ok: false, reason: "unsaved", settled }`. `settled` is a promise of how the question ended: `{ ok: true, pane }` once the person discards and the change is made, or `{ ok: false, reason: "kept" }` when they keep editing. Use it when your app does more after the action, but only if it happens:

```ts
import { forgetSavedLayouts } from "./saved-layouts";

const result = jali.actions.resetLayout();
if (result.ok) forgetSavedLayouts();
else void result.settled?.then((end) => end.ok && forgetSavedLayouts());
```

Some changes never ask, because the pane stays mounted and its work with it: moving it, putting it in tabs, folding it, tucking it and maximising another pane. Choosing a preset that has the same pane (the same `id`, showing the same object) doesn't ask either: the pane, its state and its unsaved work come along. See [A pane in more than one preset](layouts.md#a-pane-in-more-than-one-preset).

Two more cases:

- **A following detail with unsaved work keeps its object.** When the list's cursor moves on, the detail stays put and Jali says why. Asking on every row would be worse. Only that detail is held: the list's other followers move on, and the held one catches up once its work is saved or discarded. See [Unsaved work in the detail](../learn/following.md#unsaved-work-in-the-detail).
- **Leaving the page** with unsaved work anywhere brings up the browser's own prompt before the page goes.

## Keep the pane's own state

`usePaneState(key, initial)` works like `useState`, but Jali keeps the value for this pane:

```tsx
import { usePaneState } from "jali/react";

function Draft() {
  const [draft, setDraft] = usePaneState("draft", "");
  return <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />;
}
```

- It survives the pane being folded, tucked, tabbed or moved, and a reload. Jali saves it on this device 400ms after the last change.
- It is dropped when the pane closes for good, or shows another object. While an undo could bring a closed pane back, its state is kept too.
- Values must be JSON: strings, numbers, booleans, arrays and plain objects.

Use it for what a person expects back: a draft, a sort, a filter, a scroll position. Use React state for the rest.

In the peek sheet there is no pane, so `usePaneState` is plain React state there, gone when the sheet closes. `useUnsaved` and `useCommands` do nothing in the sheet.

## Add the pane's commands to ⌘K

`useCommands(list)` adds commands to the palette while this pane is focused. They come first, under the pane's title, and go when the component unmounts.

```tsx
import { keyHint } from "jali";
import { useCommands } from "jali/react";

function NoteCommands({ edited, save }: { edited: boolean; save: () => void }) {
  useCommands([
    { id: "save", title: "Save note", keys: keyHint("Mod+S"), disabled: edited ? false : "Nothing to save", run: save },
  ]);
  return null;
}
```

- `id` and `title` name the command. `run` runs it.
- `disabled` greys it out. Give a reason as text, and screen readers read it.
- `keys` is a label only. The key itself is yours to handle in the content, as the textarea does above with `preventDefault()`. See [Commands and keys](commands-and-keys.md).

Pass the list on every render. The palette is updated only when an id, title, label or reason changes, and `run` always calls the latest function you gave, so it never sees stale state.

## Ask your app first

Your app may know more than a pane does: a draft saved on the server, a write that is still running. Give `createJali` a `beforeClose`, and Jali asks it before any change removes panes or makes one show something else: a close, close others, a preset, `jali.setLayout`, Back and Forward, a pane showing another object.

```ts
import { createJali } from "jali";
import { drafts } from "./drafts";

const jali = createJali({
  panes,
  layout,
  beforeClose: async ({ panes }) => {
    const open = await drafts.for(panes.map((p) => p.ref));
    return open.length === 0 || confirm(`Discard ${open.length} drafts?`);
  },
});
```

- Return `true` to let the change happen, `false` to keep the panes. A promise holds the change until it answers. A yes makes it against the layout as it is then, so a resize or another pane changing meanwhile does not undo the yes. If the panes it would now remove or replace are not the ones you were asked about (one shows another object by then), you are asked again.
- The action returns `{ ok: false, reason: "kept" }`, or `reason: "pending"` with `settled`, a promise of what happened once you answer. After a yes that meets Jali's own question, it resolves with that `"unsaved"` refusal, and its `settled` says how the person answered.
- Your answer comes first. After a yes, a pane that still reports unsaved work gets Jali's own "Discard unsaved changes?".
- Nothing of the change is written while you decide. An action your guard runs meanwhile (saving a draft, pinning a pane) happens at once and returns its real result; the change is then worked out again against the layout that leaves. Work a pane reports meanwhile is asked about, and Keep editing leaves it as it was.
- If it throws or rejects, the panes stay. If it destroys the instance, the change is `"unavailable"`, and a `settled` resolves the same way.

### When your app asks instead

An app with its own "Save changes?" dialog asks from `beforeClose`. Pass `confirmDiscard: false`, and Jali's question never follows: your yes stands. Panes still report their work with `useUnsaved`, so the dot still shows; the browser's prompt on leaving the page is yours to add too.

```ts
import { createJali } from "jali";
import { askToSave } from "./save-dialog";

const jali = createJali({
  panes,
  layout,
  confirmDiscard: false,
  beforeClose: ({ panes }) => askToSave(panes),
});
```

A following detail with unsaved work still keeps its object when the list's cursor moves on: nothing asked, so nothing is lost. `jali.actions.remove` never asks either way: neither `beforeClose` nor Jali's question runs, because your app has already decided.

## Test it

The rules can be tested without rendering. What `useUnsaved` reports from a rendered pane is reported with `reportUnsaved` from `jali/testing`:

```ts
import { expect, it } from "vitest";
import { createTestJali, reportUnsaved } from "jali/testing";
import { orderKinds, presets } from "./panes";

it("asks before closing a pane with unsaved work", () => {
  const { jali } = createTestJali({ panes: orderKinds, presets });
  reportUnsaved(jali, "order", "an unsaved note");
  expect(jali.actions.close("order")).toMatchObject({ ok: false, reason: "unsaved" });
});
```

See [Test your layouts](testing.md).
