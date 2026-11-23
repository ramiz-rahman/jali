/** A result in Explore: the place's own button (photo, name, what and where, how far, its price), and + beside it. */
import { CheckIcon, PlusIcon } from "@phosphor-icons/react";
import type { Standing } from "../../trip/plan";
import type { RowProps } from "../../ui/cursor-list";
import * as f from "../../ui/format";
import { DayMark } from "../../ui/day-mark";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/photo";
import type { Result } from "./filters";

export function ResultRow({
  result: { p, km, walkMin },
  standing,
  cursor,
  selected,
  row,
  onAdd,
}: {
  result: Result;
  /** What it is to the plan: a stop on a day, the person's hotel, or neither. */
  standing: Standing;
  cursor: boolean;
  /** It is the place selected on the map. */
  selected: boolean;
  /** The result's row in Explore's list (ui/cursor-list.ts). */
  row: RowProps;
  onAdd: () => void;
}) {
  const Icon = CATEGORY_ICON[p.category];
  const stay = p.category === "stay";
  const yours = standing.kind === "hotel";
  return (
    <li
      data-row={p.id}
      aria-current={cursor ? "true" : undefined}
      data-current={selected || undefined}
      className="result"
    >
      <button type="button" className="result-main" {...row}>
        <span className="result-photo">
          <Photo id={p.id} />
          <span className="result-cat" data-category={p.category}>
            <Icon size={11} weight="bold" aria-hidden />
          </span>
        </span>
        <span className="result-text">
          <span className="result-name">{p.name}</span>
          <span className="result-meta">
            {yours ? <b className="result-yours">Your hotel, </b> : null}
            {p.kind}, {p.area}
            {km !== null ? `, ${walkMin !== null ? `${walkMin} min walk` : f.distance(km)}` : ""}
          </span>
        </span>
        <span className="result-end">
          {standing.kind === "stop" ? <DayMark n={standing.day.n} size="sm" /> : null}
          <span className="result-price">
            <span className="num">{f.price(p.price)}</span>
            {stay ? <span className="result-per">a night</span> : null}
          </span>
        </span>
      </button>
      <button
        type="button"
        className="icon-btn result-add"
        tabIndex={-1}
        aria-label={stay ? `Stay at ${p.name}` : `Add ${p.name} to a day`}
        title={stay ? "Stay here (A)" : "Add to a day (A)"}
        onClick={onAdd}
        disabled={yours}
      >
        {yours ? (
          <CheckIcon size={16} weight="bold" aria-hidden />
        ) : (
          <PlusIcon size={16} weight="bold" aria-hidden />
        )}
      </button>
    </li>
  );
}
