/** A day in the overview's list, and its strip of photos. */
import { AirplaneTiltIcon, WarningIcon } from "@phosphor-icons/react";
import type { DaySummary } from "../../trip/summary";
import { DayMark } from "../../ui/atoms/day-mark";
import * as f from "../../ui/format";
import { Photo } from "../../ui/molecules/photo";
import { photoOf } from "../../trip/photos";

/** A day in the list: its mark, date, title and photos, how it travels, and what it costs. A drop target too. */
export function DayRow({
  id,
  summary: { day: d, totals, budget },
  selected,
  active,
  dropping,
  onClick,
}: {
  id: string;
  summary: DaySummary;
  selected: boolean;
  active: boolean;
  dropping: boolean;
  onClick: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-active={active || undefined}
      data-drop-day={d.n}
      data-drop-end=""
      data-dropping={dropping || undefined}
      className="trip-day"
      onClick={onClick}
    >
      <DayMark n={d.n} />
      <span className="trip-day-text">
        <span className="trip-day-date">{f.day(d.date)}</span>
        <span className="trip-day-title">{d.title}</span>
        <DayStrip stops={d.stops} />
        <span className="trip-day-meta">
          {d.from ? (
            <>
              <AirplaneTiltIcon size={12} weight="bold" aria-label="Flight" /> The flight, then{" "}
              {d.stops.length} stops
            </>
          ) : (
            <>
              {d.stops.length} stops, {f.minutes(totals.travelMin)} travel
            </>
          )}
        </span>
      </span>
      <span className="trip-day-cost num" data-over={budget.over || undefined}>
        {budget.over ? (
          <WarningIcon size={13} weight="bold" aria-label="Over its allowance" />
        ) : null}
        {f.moneyRound(budget.spend)}
      </span>
    </div>
  );
}

/** The day at a glance: its first stops' photos in a row, and how many more. Decorative: the row names the day. */
function DayStrip({ stops }: { stops: readonly string[] }) {
  const shown = stops.slice(0, 5);
  const more = stops.length - shown.length;
  if (!shown.length) return null;
  return (
    <span className="trip-day-strip" aria-hidden>
      {shown.map((id) => (
        <Photo key={id} photo={photoOf(id)} />
      ))}
      {more > 0 ? <span className="trip-day-more">+{more}</span> : null}
    </span>
  );
}
