/**
 * The trip at a glance: the city, the dates, the hotel, the budget so far, and the days as a list. The list drives
 * the rest: moving through it (J/K or the arrows) selects a day, and the day plan and the map that follow it show
 * that day. A stop dragged onto a day here moves to the end of that day.
 */
import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowCounterClockwiseIcon, BedIcon, SuitcaseRollingIcon, WarningIcon } from "@phosphor-icons/react";
import { definePane, useCommands, useJali, useJaliModel, usePaneState, type PaneProps } from "@jali/react";
import { selectPlace, showDay } from "../actions";
import { resetPlan } from "../planning";
import { usePlan, useServices } from "../services";
import { dayBudget, tripBudget } from "../trip/budget";
import { mustPlace } from "../trip/places";
import { dayTotals } from "../trip/plan";
import { useDrag } from "../ui/drag";
import * as f from "../ui/format";
import { DayMark } from "../ui/parts";
import { day as dayKind } from "./day";

function TripPane({ node, focused, select, inPeek }: PaneProps) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const [cursor, setCursor] = usePaneState<number>("cursor", 1);
  const drag = useDrag();
  const listRef = useRef<HTMLDivElement>(null);
  const budget = tripBudget(plan);
  const hotel = mustPlace(plan.hotel);
  const first = plan.days[0]!;
  const last = plan.days[plan.days.length - 1]!;

  const moveTo = (n: number) => {
    setCursor(n);
    select(dayKind({ n }));
  };

  // Start on the day the panes that follow this list show, and stay with them when a layout (a preset, a link,
  // Back) gives them another day: Jali keeps this list's selection across a preset switch, while the new preset's
  // followers arrive showing their own day (FINDINGS.md).
  const model = useJaliModel();
  const followers = model.panes.filter((p) => p.linkedTo === node.id && p.follows);
  const lead = followers.find((p) => p.ref.kind === "day") ?? followers.find((p) => p.ref.kind === "map");
  const shown = lead ? Number(lead.ref.kind === "day" ? lead.ref.params.n : lead.ref.params.day) : 0;
  useEffect(() => {
    if (inPeek) return;
    moveTo(shown > 0 ? shown : cursor);
    // When what the followers show changes, not on every move of the cursor (they catch up a moment later).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const i = plan.days.findIndex((d) => d.n === cursor);
    const k = e.key;
    if ((k === "ArrowDown" || k === "j") && plan.days[i + 1]) moveTo(plan.days[i + 1]!.n);
    else if ((k === "ArrowUp" || k === "k") && plan.days[i - 1]) moveTo(plan.days[i - 1]!.n);
    else if (k === "Home") moveTo(first.n);
    else if (k === "End") moveTo(last.n);
    else if (k === "Enter") showDay(jali, cursor);
    else if (/^[1-9]$/.test(k) && plan.days.some((d) => d.n === Number(k))) moveTo(Number(k));
    else return;
    e.preventDefault();
  };

  useCommands(
    inPeek
      ? []
      : [
          { id: "open-day", title: `Open Day ${cursor}`, keys: "Enter", run: () => showDay(jali, cursor) },
          { id: "hotel", title: `Show ${hotel.name}`, run: () => selectPlace(jali, hotel.id, { open: true }) },
        ],
  );

  const used = Math.min(1, budget.total / budget.budget);
  return (
    <div className="pane-body trip">
      <header className="trip-head">
        <p className="trip-kicker">
          <SuitcaseRollingIcon size={16} aria-hidden /> {plan.days.length} days
        </p>
        <h3 className="trip-city">{plan.city}</h3>
        <p className="trip-dates">
          {f.day(first.date)} to {f.day(last.date)} 2027
        </p>
        <button type="button" className="trip-hotel" onClick={() => selectPlace(jali, hotel.id, { open: true })}>
          <BedIcon size={16} aria-hidden />
          <span>
            <b>{hotel.name}</b>
            <span className="muted">
              {hotel.area}, {f.money(hotel.price)} a night
            </span>
          </span>
        </button>
      </header>

      <section className="trip-budget" aria-label="Budget">
        <p>
          <span className="num big">{f.moneyRound(budget.total)}</span>
          <span className="muted"> planned of {f.moneyRound(budget.budget)}</span>
        </p>
        <div
          className="meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={budget.budget}
          aria-valuenow={Math.round(budget.total)}
          aria-label="Planned spend against the budget"
          data-over={budget.left < 0 || undefined}
        >
          <span style={{ width: `${used * 100}%` }} />
        </div>
        <p className="muted small">
          {budget.left >= 0 ? `${f.moneyRound(budget.left)} left` : `${f.moneyRound(-budget.left)} over the budget`}
          {budget.overDays.length
            ? `. ${budget.overDays.length === 1 ? `Day ${budget.overDays[0]} is` : `${budget.overDays.length} days are`} over the day's share.`
            : "."}
        </p>
      </section>

      <div
        ref={listRef}
        className="trip-days"
        role="listbox"
        aria-label="Days"
        tabIndex={0}
        aria-activedescendant={`${node.id}-day-${cursor}`}
        onKeyDown={onKeyDown}
      >
        {plan.days.map((d) => {
          const t = dayTotals(plan, d.stops);
          const b = dayBudget(plan, d.n);
          const dropping = drag?.over?.day === d.n && drag.fromDay !== d.n;
          return (
            <div
              key={d.n}
              id={`${node.id}-day-${d.n}`}
              role="option"
              aria-selected={d.n === cursor}
              data-active={(d.n === cursor && focused) || undefined}
              data-drop-day={d.n}
              data-drop-end=""
              data-dropping={dropping || undefined}
              className="trip-day"
              onClick={() => (d.n === cursor ? showDay(jali, d.n) : moveTo(d.n))}
            >
              <DayMark n={d.n} />
              <span className="trip-day-text">
                <span className="trip-day-date">{f.day(d.date)}</span>
                <span className="trip-day-title">{d.title}</span>
                <span className="trip-day-meta">
                  {d.stops.length} stops, {f.minutes(t.travelMin)} travel
                </span>
              </span>
              <span className="trip-day-cost num" data-over={b.over || undefined}>
                {b.over ? <WarningIcon size={13} weight="bold" aria-label="Over the day's share" /> : null}
                {f.moneyRound(b.total)}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="trip-foot">
        <button type="button" className="btn btn-quiet" onClick={() => resetPlan(services)}>
          <ArrowCounterClockwiseIcon size={14} aria-hidden /> Reset the trip
        </button>
      </footer>
    </div>
  );
}

export const trip = definePane("trip", {
  title: "Trip",
  icon: SuitcaseRollingIcon,
  width: { min: 260, comfortable: 300, max: 360 },
  height: { min: 360 },
  Component: TripPane,
});
