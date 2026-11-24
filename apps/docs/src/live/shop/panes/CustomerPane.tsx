/** A customer: who they are to the shop, what they have spent, and their notes one click away. */
import { useEffect } from "react";
import { CaretRightIcon, EnvelopeSimpleIcon, NoteIcon, UserIcon } from "@phosphor-icons/react";
import { definePane, type PaneProps } from "jali/react";
import { customerById, money, notes, ordersOf, totalOf } from "../data";
import { Avatar } from "../ui/Avatar";
import { kindIcon } from "../ui/KindIcon";
import { notesKind } from "./NotesPane";

function CustomerPane({ params, openBeside, select }: PaneProps<{ id: number }>) {
  const c = customerById(params.id);
  // The customer's notes are this pane's selection, so notes following it move with the customer. (The chain order →
  // customer → notes is what the hero's layout tree shows; a kind's `follow` would skip a link of it.)
  useEffect(() => {
    if (c) select(notesKind({ customer: c.id }));
  }, [c?.id]);
  if (!c) return <p className="live-k-empty">No customer {params.id}</p>;
  const mine = ordersOf(c.id);
  // The header already names them: the content opens on their face and who they are to the shop.
  return (
    <div className="live-k live-customer">
      <div className="live-k-profile">
        <Avatar customer={c} size={48} />
        <div className="live-k-profile-text">
          <span className="live-k-row-title">{c.plan} customer</span>
          <span className="live-k-sub">
            {c.area} · since {c.since}
          </span>
        </div>
      </div>
      <dl className="live-k-stats">
        <div>
          <dt>Spent</dt>
          <dd>{money(mine.reduce((t, o) => t + totalOf(o), 0))}</dd>
        </div>
        <div>
          <dt>Orders</dt>
          <dd>{mine.length}</dd>
        </div>
      </dl>
      <div className="live-k-fact">
        <EnvelopeSimpleIcon size={16} aria-hidden />
        <span>{c.email}</span>
      </div>
      <button
        type="button"
        className="live-k-row"
        onClick={() => openBeside(notesKind({ customer: c.id }))}
      >
        <NoteIcon size={18} aria-hidden className="live-k-row-icon" />
        <span className="live-k-row-text">
          <span className="live-k-row-title">Notes</span>
        </span>
        <span className="live-k-count">{(notes[c.id] ?? []).length}</span>
        <CaretRightIcon size={16} aria-hidden className="live-k-row-caret" />
      </button>
    </div>
  );
}

export const customerKind = definePane("customer", {
  params: { id: Number },
  title: ({ id }) => customerById(id)?.name ?? `Customer ${id}`,
  icon: kindIcon(UserIcon),
  width: { min: 170, comfortable: 240, max: 560 },
  Component: CustomerPane,
});
