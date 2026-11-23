/**
 * The underwriting figures drawn: each ratio as a gauge against its program limit, the new payment as a stacked
 * bar with its lines, and a book of mortgages in a few numbers. Each gauge is a ratio of the assessment
 * (model/ratios.ts), toned as its signal, so a gauge, the header's figure and the line in "What to check" that
 * explains it always agree.
 */
import type { ReactNode } from "react";
import type { Ratio } from "../../model/ratios";
import type { Book, Housing } from "../../model/underwriting";
import { pct, plural, usd } from "../../model/words";

/** One ratio on a track, with the program's limit marked. */
export function Gauge({ ratio }: { ratio: Ratio }) {
  const { label, value, at, limit, limitLabel, tone, note } = ratio;
  const [min, max] = ratio.scale;
  const place = (v: number) => `${Math.max(0, Math.min(1, (v - min) / (max - min))) * 100}%`;
  return (
    <div className="rv-gauge" data-tone={tone}>
      <div className="rv-gauge-head">
        <span className="rv-gauge-label">{label}</span>
        <span className="rv-gauge-value">{value}</span>
      </div>
      <div className="rv-gauge-track" aria-hidden>
        <span className="rv-gauge-fill" style={{ width: place(at ?? min) }} />
        <span className="rv-gauge-limit" style={{ left: place(limit) }} />
      </div>
      <div className="rv-gauge-foot">
        <span>{note}</span>
        <span>{limitLabel}</span>
      </div>
    </div>
  );
}

/** The ratios an application qualifies on (model/ratios.ts), each against its limit, toned as the signals tone them. */
export const Qualifiers = ({ ratios }: { ratios: Ratio[] }) => (
  <div className="rv-gauges">
    {ratios.map((ratio) => (
      <Gauge key={ratio.id} ratio={ratio} />
    ))}
  </div>
);

const LINES: [key: keyof Omit<Housing, "total">, label: string][] = [
  ["principalInterest", "Principal & interest"],
  ["firstLien", "First mortgage"],
  ["tax", "Property tax"],
  ["insurance", "Homeowners insurance"],
  ["mortgageInsurance", "Mortgage insurance"],
  ["hoa", "HOA dues"],
];

/** The monthly housing payment: one stacked bar, then each line with its amount. */
export function PaymentBreakdown({ housing }: { housing: Housing }) {
  const lines = LINES.filter(([k]) => housing[k] > 0);
  return (
    <div className="rv-pay">
      <div className="rv-pay-bar" role="img" aria-label={`${usd(housing.total)} a month`}>
        {lines.map(([k, label]) => (
          <span
            key={k}
            data-line={k}
            style={{ flexGrow: housing[k] }}
            title={`${label}: ${usd(housing[k])}`}
          />
        ))}
      </div>
      <dl className="rv-pay-lines">
        {lines.map(([k, label]) => (
          <div key={k} data-line={k}>
            <dt>
              <i aria-hidden />
              {label}
            </dt>
            <dd>{usd(housing[k])}</dd>
          </div>
        ))}
        <div className="rv-pay-total">
          <dt>Total a month</dt>
          <dd>{usd(housing.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

/** A book of mortgages in a few numbers; delinquent in the warning colour. */
export function BookStats({ book, pipeline }: { book: Book; pipeline?: number }) {
  return (
    <dl className="rv-stats">
      {pipeline !== undefined ? (
        <Stat label="In pipeline" value={pipeline} note="applications" />
      ) : null}
      <Stat
        label="Open loans"
        value={book.open}
        note={book.borrowers !== book.open ? plural(book.borrowers, "borrower") : undefined}
      />
      <Stat label="Balance" value={usd(book.balance)} />
      <Delinquent book={book} />
    </dl>
  );
}

/** What a book has borrowed and owes now: the first two of a list's totals. */
export const BookTotals = ({ book }: { book: Book }) => (
  <>
    <Stat label="Originated" value={usd(book.originated)} note={plural(book.loans, "loan")} />
    <Stat
      label="Owed now"
      value={book.balance ? usd(book.balance) : "Nothing"}
      note={
        book.open
          ? `${plural(book.open, "open loan")} · ${usd(book.monthly)} a month`
          : "all paid off"
      }
    />
  </>
);

/** "Delinquent": how many loans, and what they put at risk. */
export const Delinquent = ({ book }: { book: Book }) => (
  <Stat
    label="Delinquent"
    value={book.delinquent ? plural(book.delinquent, "loan") : "None"}
    note={
      book.delinquent
        ? `${usd(book.delinquentBalance)} · ${pct(book.delinquent / Math.max(1, book.open))} of open`
        : undefined
    }
    warn={!!book.delinquent}
  />
);

/** One number in a stats strip (`rv-stats`), with a note under it. */
export const Stat = ({
  label,
  value,
  note,
  warn,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  warn?: boolean;
}) => (
  <div className={warn ? "is-warn" : undefined}>
    <dt>{label}</dt>
    <dd>{value}</dd>
    {note ? <dd className="rv-note">{note}</dd> : null}
  </div>
);
