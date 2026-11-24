/**
 * The application's header: who is asking, for what and on which home, then the five numbers an underwriter reads
 * first: the amount, the payment, and the headline ratios (LTV, DTI, credit score) as the assessment says them
 * (model/ratios.ts), each against its limit and toned as its signal, so the header and Overview never disagree.
 *
 * Collapsed (chrome.ts), it is one line: who, the program, the same five figures small, and the status, so the views
 * get the height and nothing an underwriter reads first goes out of sight. It is the same markup either way
 * (`data-compact`); header.css lays it out as a card or as the line.
 */
import { useAssessment } from "../data";
import { RoleSwitch } from "../role";
import { APPLICATION_STATUS } from "../model/statuses";
import {
  amountLabel,
  amountShort,
  cityLine,
  day,
  household,
  product,
  rate,
  rateKind,
  term,
  usd,
} from "../model/words";
import { useChrome } from "./chrome";
import { CollapseToggle } from "./collapse-toggle";
import { QueueSheet } from "./queue/sheet";

/** One figure in the row: said in full on the card (with what it is read against), shortly on the line. */
interface Figure {
  id: string;
  label: string;
  short: string;
  value: string;
  against?: string;
  tone?: string;
}

export function ApplicationHeader({ item }: { item: number }) {
  const { app, borrower, property, assessment } = useAssessment(item);
  const collapsed = useChrome().header;
  const name = borrower ? household(borrower.name, borrower.co_borrower) : "…";
  const figures: Figure[] = [
    ...(app
      ? [
          {
            id: "amount",
            label: amountLabel(app),
            short: amountShort(app),
            value: usd(app.amount_cents),
            against: app.purchase_price_cents
              ? `on a ${usd(app.purchase_price_cents)} purchase`
              : `${term(app.term_months)} term`,
          },
          {
            id: "payment",
            label: "Monthly payment",
            short: "Payment",
            value: assessment?.qualifying ? usd(assessment.qualifying.housing.total) : "…",
            against: `${rate(app.note_rate)} ${rateKind(app)}`,
          },
        ]
      : []),
    ...(assessment?.ratios.filter((ratio) => ratio.headline) ?? []).map((ratio) => ({
      id: ratio.id,
      label: ratio.label,
      short: ratio.short,
      value: ratio.value,
      against: ratio.limitLabel,
      tone: ratio.tone,
    })),
  ];

  return (
    <section
      className="item-head"
      data-compact={collapsed ? "" : undefined}
      aria-label={`Application ${item}`}
    >
      <div className="item-id">
        <div className="item-name" key={item}>
          <div className="item-kicker">
            <span className="pk-mono">#{item}</span>
            {app ? (
              <>
                <span className="item-purpose"> · {app.purpose}</span> · {product(app)}
              </>
            ) : null}
          </div>
          <h1>{name}</h1>
          <div className="item-where">
            {property ? (
              <>
                {property.address}, {cityLine(property)}
                <span className="item-dot" aria-hidden>
                  ·
                </span>
                {property.property_type}
                {app && app.occupancy !== "Primary residence" ? ` · ${app.occupancy}` : ""}
              </>
            ) : (
              " "
            )}
          </div>
        </div>
        <QueueSheet item={item} />
        {app ? (
          <div className="item-state">
            <span className="item-status" data-status={app.status}>
              {APPLICATION_STATUS[app.status].label}
            </span>
            <span className="item-submitted">Submitted {day(app.submitted_at)}</span>
            <RoleSwitch />
          </div>
        ) : null}
        <CollapseToggle part="header" collapsed={collapsed} className="item-toggle" />
      </div>
      <dl className="item-facts" key={item}>
        {figures.map((figure) => (
          <div key={figure.id} data-tone={figure.tone}>
            <dt>{collapsed ? figure.short : figure.label}</dt>
            <dd>{figure.value}</dd>
            {collapsed ? null : <dd className="pk-meta">{figure.against}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}
