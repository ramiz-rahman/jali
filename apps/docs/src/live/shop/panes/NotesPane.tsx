/** Notes on a customer, by the shop's staff. */
import { NoteIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali-layout/react";
import { customerById, notes } from "../data";
import { kindIcon } from "../ui/KindIcon";

function NotesPane({ params }: PaneProps<{ customer: number }>) {
  const list = notes[params.customer] ?? [];
  return (
    // Focusable, so a keyboard can scroll the notes when they run longer than the pane.
    <div className="live-k live-notes" tabIndex={0} aria-label="Notes">
      {list.map((n, i) => (
        <article key={i}>
          <header>
            <b>{n.who}</b>
            <span>{n.when}</span>
          </header>
          <p>{n.text}</p>
        </article>
      ))}
    </div>
  );
}

export const notesKind = definePane("notes", {
  params: { customer: Number },
  title: ({ customer }) => `Notes on ${customerById(customer)?.short ?? "customer"}`,
  icon: kindIcon(NoteIcon),
  width: { min: 180, comfortable: 240, max: 400 },
  height: { min: 140 },
  Component: NotesPane,
});
