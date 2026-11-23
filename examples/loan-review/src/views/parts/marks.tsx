/**
 * Small marks the views share: a status badge, the application in review, a signal's tone, payments as dots, a
 * person's initials, and a dash for nothing.
 */
import type { ReactNode } from "react";
import { CheckIcon, InfoIcon, WarningIcon, WarningOctagonIcon } from "@phosphor-icons/react";
import { useJaliState } from "jali/react";
import type { Payment } from "../../model/rows";
import { statusWords, type Status } from "../../model/statuses";
import type { Tone } from "../../model/signals";
import { paidOf } from "../../model/underwriting";
import { initials, onTime } from "../../model/words";

/** A status as a reader says it, coloured by what it asks of them, with a warning sign when its table says so. */
export function StatusMark({ status }: { status: Status }) {
  const { label, warn } = statusWords(status);
  return (
    <span className="rv-status" data-status={status}>
      {warn ? <WarningIcon size={12} aria-hidden /> : null}
      {label}
    </span>
  );
}

/** "In review" beside application `id` when it is the page's item. */
export function InReviewTag({ id }: { id: number }) {
  const current = useJaliState((s) => s.page?.item);
  return id === current ? <span className="rv-tag">In review</span> : null;
}

/** A muted dash: nothing to show in a cell. */
export const Dash = () => <span className="rv-muted">–</span>;

const TONE_ICON: Record<Tone, ReactNode> = {
  ok: <CheckIcon size={14} aria-hidden />,
  info: <InfoIcon size={14} aria-hidden />,
  warn: <WarningIcon size={14} aria-hidden />,
  risk: <WarningOctagonIcon size={14} aria-hidden />,
};
export const ToneIcon = ({ tone }: { tone: Tone }) => (
  <span className="rv-tone" data-tone={tone}>
    {TONE_ICON[tone]}
  </span>
);

/** Payments as marks, oldest first: filled on time, amber late, red ring missed. */
export function Payments({ rows }: { rows: Payment[] | undefined }) {
  if (!rows) return <span className="rv-dots is-loading" aria-hidden />;
  if (!rows.length) return <Dash />;
  const label = onTime(paidOf(rows), "payments");
  return (
    <span className="rv-dots" role="img" aria-label={label} title={label}>
      {rows.map((r, i) => (
        <i key={i} data-status={r.status} />
      ))}
    </span>
  );
}

export const Avatar = ({ name }: { name: string | undefined }) => (
  <span className="rv-avatar">{initials(name ?? "")}</span>
);
