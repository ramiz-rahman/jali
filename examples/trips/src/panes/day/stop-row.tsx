/** A day's timeline, row by row: where it starts and ends (a hotel, an airport), and each stop between. */
import type { PointerEvent } from "react";
import { AirplaneTiltIcon, DotsSixVerticalIcon, HouseLineIcon } from "@phosphor-icons/react";
import type { Place } from "../../trip/places";
import type { Step, StepRole } from "../../trip/plan";
import type { RowProps } from "../../ui/cursor-list";
import * as f from "../../ui/format";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/molecules/photo";
import { photoOf } from "../../trip/photos";

/** What the timeline calls each place that isn't a stop. */
const ENDPOINT_LABEL: Record<Exclude<StepRole, "stop">, (p: Place) => string> = {
  start: (p) => `Leave ${p.name}`,
  airport: (p) => p.name,
  landing: (p) => `Land at ${p.name}`,
  back: (p) => `Back at ${p.name}`,
  "check-in": (p) => `Check in at ${p.name}`,
};

/** A hotel or an airport the day passes, with the time it is there. */
export function Endpoint({ step: { place: p, role, arrive } }: { step: Step }) {
  const Icon = p.category === "airport" ? AirplaneTiltIcon : HouseLineIcon;
  const label = role === "stop" ? p.name : ENDPOINT_LABEL[role](p);
  return (
    <div className="endpoint" data-category={p.category}>
      <span className="endpoint-mark" aria-hidden>
        <Icon size={14} weight="bold" />
      </span>
      <span className="endpoint-label">{label}</span>
      <span className="stop-time num">{f.clock(arrive)}</span>
    </div>
  );
}

/**
 * One stop: its drag handle, its number in the day's colour, and its own button (photo, name, what it is, and the
 * hours it takes), which is the stop's row in the day's list (`row`, ui/cursor-list.ts).
 */
export function Stop({
  step: { place: p, arrive, leave },
  n,
  index,
  cursor,
  hint,
  row,
  onPointerDown,
}: {
  step: Step;
  /** The day's number. */
  n: number;
  index: number;
  /** The cursor is on it. */
  cursor: boolean;
  /** The id of the text that says what the keys do. */
  hint: string;
  row: RowProps;
  onPointerDown: (e: PointerEvent) => void;
}) {
  const Icon = CATEGORY_ICON[p.category];
  return (
    <div className="stop" aria-current={cursor ? "true" : undefined}>
      <button
        type="button"
        className="stop-handle"
        aria-label={`Drag ${p.name} to reorder or to another day`}
        title="Drag to reorder, or onto another day"
        tabIndex={-1}
        onPointerDown={onPointerDown}
      >
        <DotsSixVerticalIcon size={16} weight="bold" aria-hidden />
      </button>
      <span className="stop-num" data-day={n} aria-hidden>
        {index + 1}
      </span>
      <button type="button" className="stop-main" aria-describedby={hint} {...row}>
        <Photo photo={photoOf(p.id)} className="stop-photo" />
        <span className="stop-text">
          <span className="stop-name">{p.name}</span>
          <span className="stop-meta">
            <Icon size={13} aria-hidden /> {p.kind}, {f.minutes(p.visitMin)}
            {p.price ? `, ${f.price(p.price)}` : ""}
          </span>
        </span>
        <span className="stop-time num">
          {f.clock(arrive)}
          <span className="stop-until">{f.clock(leave)}</span>
        </span>
      </button>
    </div>
  );
}
