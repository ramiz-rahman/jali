/** One card of Overview: a section placed in the grid by its view, with a lead line and a way to the full view. */
import type { ReactNode } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";
import { altClick } from "jali-layout";
import { useJali } from "jali-layout/react";
import type { Role } from "../../nav/roles";

/** Where a card sits in Overview's grid (overview.css: `grid-template-areas`). */
export type GridArea = "qualify" | "payment" | "history" | "borrower" | "property" | "officer";

export function OverviewCard({
  title,
  view,
  area,
  lead,
  note,
  warn,
  children,
}: {
  title: string;
  /** The view "Open" shows. */
  view: Role;
  area: GridArea;
  /** The card's answer in a line ("$412,000 owed"); `warn` colours it. */
  lead?: ReactNode;
  note?: ReactNode;
  warn?: boolean;
  children: ReactNode;
}) {
  const { page } = useJali();
  return (
    <section className="ov-sec" aria-label={title} style={{ gridArea: area }}>
      <header className="ov-head">
        <h3>{title}</h3>
        <button
          className="ov-go"
          onClick={() => page?.showView(view)}
          aria-label={`Open ${title}`}
          title={`Open the full view · ${altClick()} a tab to open it beside`}
        >
          <span className="ov-go-text">Open</span>
          <CaretRightIcon size={12} weight="bold" aria-hidden />
        </button>
      </header>
      {lead ? (
        <div className="ov-lead-block">
          <p className={warn ? "ov-lead is-warn" : "ov-lead"}>{lead}</p>
          {note ? <p className="ov-note">{note}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
