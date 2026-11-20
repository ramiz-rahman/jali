/**
 * The trip at a glance: the dates, a hotel in each city, the budget so far, and the days as a list, by city. The list drives
 * the rest: moving through it (J/K or the arrows) selects a day, and the day plan and the map that follow it show
 * that day. A stop dragged onto a day here moves to the end of that day.
 */
import { Fragment, useRef, type KeyboardEvent } from "react";
import {
  AirplaneTiltIcon,
  ArrowCounterClockwiseIcon,
  SuitcaseRollingIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "@jali/react";
import { selectPlace, showDay } from "../actions";
import { resetPlan } from "../planning";
import { usePlan, useServices } from "../services";
import { dayBudget, tripBudget } from "../trip/budget";
import { CITY_NAME } from "../trip/places";
import { DEFAULT_PLAN, daysIn, dayTotals, hotelOf } from "../trip/plan";
import { intIn } from "../stored";
import { useDropDay } from "../ui/drag";
import * as f from "../ui/format";
import { DayMark } from "../ui/parts";
import { Photo } from "../ui/photo";
import { day as dayKind } from "./day";

function TripPane({ node, focused, select, inPeek }: PaneProps) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const [kept, setCursor] = usePaneState<number>("cursor", 1, {
    parse: intIn(1, DEFAULT_PLAN.days.length),
  });
  // The cursor is on the day Jali has selected: it starts this list on the day its following day plan shows
  // (`selects`), and moves it with that pane when a layout (a preset, a link, Back) gives it another day.
  const selected = useJaliState((s) => s.selection[node.id]?.ref);
  const cursor = !inPeek && selected?.kind === "day" ? Number(selected.params.n) : kept;
  const dropDay = useDropDay();
  const listRef = useRef<HTMLDivElement>(null);
  const budget = tripBudget(plan);
  const cities = (["bkk", "hkt"] as const).map((c) => ({
    c,
    hotel: hotelOf(plan, c),
    days: daysIn(plan, c),
  }));
  const first = plan.days[0]!;
  const last = plan.days[plan.days.length - 1]!;

  const moveTo = (n: number) => {
    setCursor(n);
    select(dayKind({ n }));
  };

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
          {
            id: "open-day",
            title: `Open Day ${cursor}`,
            keys: "Enter",
            run: () => showDay(jali, cursor),
          },
          ...cities.map(({ c, hotel }) => ({
            id: `hotel-${c}`,
            title: `Show ${hotel.name}, the hotel in ${CITY_NAME[c]}`,
            run: () => selectPlace(jali, hotel.id, { open: true }),
          })),
        ],
  );

  const used = Math.min(1, budget.total / budget.budget);
  return (
    <div className="pane-body trip">
      <header className="trip-head">
        <div className="trip-covers">
          {cities.map(({ c, days }) => (
            <div key={c} className="trip-cover">
              <Photo id={`cover-${c}`} size="small" alt="" credit eager />
              <span className="trip-cover-text">
                <b>{CITY_NAME[c]}</b>
                <span>
                  {days.length} {days.length === 1 ? "night" : "nights"}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="trip-kicker">
          <SuitcaseRollingIcon size={16} aria-hidden /> {plan.days.length} days
        </p>
        <h3 className="trip-city">{plan.name}</h3>
        <p className="trip-dates">
          {f.day(first.date)} to {f.day(last.date)} 2027
        </p>
        <div className="trip-hotels">
          {cities.map(({ c, hotel }) => (
            <button
              key={c}
              type="button"
              className="trip-hotel"
              onClick={() => selectPlace(jali, hotel.id, { open: true })}
            >
              <Photo id={hotel.id} className="trip-hotel-photo" />
              <span>
                <b>{hotel.name}</b>
                <span className="muted">
                  {CITY_NAME[c]}, {f.money(hotel.price)} a night
                </span>
              </span>
            </button>
          ))}
        </div>
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
          {budget.left >= 0
            ? `${f.moneyRound(budget.left)} left`
            : `${f.moneyRound(-budget.left)} over the budget`}
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
        {plan.days.map((d, i) => {
          const t = dayTotals(plan, d);
          const b = dayBudget(plan, d.n);
          const dropping = dropDay === d.n;
          const newCity = i === 0 || plan.days[i - 1]!.city !== d.city;
          return (
            <Fragment key={d.n}>
              {newCity ? (
                <div className="trip-city-head" role="presentation">
                  {CITY_NAME[d.city]}
                </div>
              ) : null}
              <div
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
                  <DayStrip stops={d.stops} />
                  <span className="trip-day-meta">
                    {d.from ? (
                      <>
                        <AirplaneTiltIcon size={12} weight="bold" aria-label="Flight" /> The flight,
                        then {d.stops.length} stops
                      </>
                    ) : (
                      <>
                        {d.stops.length} stops, {f.minutes(t.travelMin)} travel
                      </>
                    )}
                  </span>
                </span>
                <span className="trip-day-cost num" data-over={b.over || undefined}>
                  {b.over ? (
                    <WarningIcon size={13} weight="bold" aria-label="Over the day's share" />
                  ) : null}
                  {f.moneyRound(b.total)}
                </span>
              </div>
            </Fragment>
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

/** The day at a glance: its first stops' photos in a row, and how many more. Decorative: the row names the day. */
function DayStrip({ stops }: { stops: readonly string[] }) {
  const shown = stops.slice(0, 5);
  const more = stops.length - shown.length;
  if (!shown.length) return null;
  return (
    <span className="trip-day-strip" aria-hidden>
      {shown.map((id) => (
        <Photo key={id} id={id} />
      ))}
      {more > 0 ? <span className="trip-day-more">+{more}</span> : null}
    </span>
  );
}

export const trip = definePane("trip", {
  title: "Trip",
  icon: SuitcaseRollingIcon,
  // A list of days: with no day selected, it starts on the one its following day plan shows.
  selects: "day",
  width: { min: 260, comfortable: 300, max: 360 },
  height: { min: 360 },
  Component: TripPane,
});
