/**
 * The trip at a glance: the dates, a hotel in each city, the budget so far, and the days as a list, by city. The
 * list drives the rest: moving through it (J/K or the arrows) selects a day, and the day plan and the map that follow
 * it show that day. A stop dragged onto a day here moves to the end of that day.
 */
import { Fragment } from "react";
import { ArrowCounterClockwiseIcon, SuitcaseRollingIcon } from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliState,
  usePaneState,
  type PaneProps,
} from "jali/react";
import { useServices, useSummary } from "../../state/services";
import { CITIES, CITY } from "../../trip/cities";
import { dayNumber, daysIn, hotelOf } from "../../trip/plan";
import { useCursorList } from "../../ui/cursor-list";
import { useDropDay } from "../../ui/drag";
import * as f from "../../ui/format";
import { Photo } from "../../ui/molecules/photo";
import { photoOf } from "../../trip/photos";
import { selectPlace, showDay } from "../../workspace/hub";
import { dayNumberOf, dayRef, KIND } from "../../workspace/refs";
import { BudgetSummary } from "./budget-summary";
import { DayRow } from "./day-row";
import "./trip.css";

function TripPane({ node, focused, select, inPeek }: PaneProps) {
  const jali = useJali();
  const services = useServices();
  const summary = useSummary();
  const { plan } = summary;
  const [kept, setCursor] = usePaneState<number>("cursor", 1, { parse: dayNumber });
  // The cursor is on the day Jali has selected: it starts this list on the day its following day plan shows
  // (`selects`), and moves it with that pane when a layout (a preset, a link, Back) gives it another day.
  const selected = useJaliState((s) => dayNumberOf(s.selection[node.id]?.ref));
  const cursor = (!inPeek && selected) || kept;
  const dropDay = useDropDay();
  const cities = CITIES.map((c) => ({ c, hotel: hotelOf(plan, c), days: daysIn(plan, c) }));
  const first = plan.days[0]!;
  const last = plan.days[plan.days.length - 1]!;
  const open = (n: number) => showDay(jali, n);
  const moveTo = (n: number) => {
    setCursor(n);
    select(dayRef(n));
  };

  const list = useCursorList({
    items: plan.days.map((d) => d.n),
    cursor,
    onMove: moveTo,
    onOpen: open,
    actions: [
      { id: "open-day", title: `Open Day ${cursor}`, keys: ["Enter"], run: () => open(cursor) },
      // A day's number goes straight to it.
      ...plan.days.map((d) => ({
        id: `day-${d.n}`,
        keys: [String(d.n)],
        run: () => moveTo(d.n),
      })),
    ],
  });

  useCommands(
    inPeek
      ? []
      : [
          ...list.commands,
          ...cities.map(({ c, hotel }) => ({
            id: `hotel-${c}`,
            title: `Show ${hotel.name}, the hotel in ${CITY[c].name}`,
            run: () => selectPlace(jali, services, hotel.id, { open: true }),
          })),
        ],
  );

  return (
    <div className="pane-body trip">
      <header className="trip-head">
        <div className="trip-covers">
          {cities.map(({ c, days }) => (
            <div key={c} className="trip-cover">
              <Photo photo={photoOf(`cover-${c}`)} size="small" alt="" credit eager />
              <span className="trip-cover-text">
                <b>{CITY[c].name}</b>
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
          {f.day(first.date)} to {f.day(last.date)} {last.date.slice(0, 4)}
        </p>
        <div className="trip-hotels">
          {cities.map(({ c, hotel }) => (
            <button
              key={c}
              type="button"
              className="trip-hotel"
              onClick={() => selectPlace(jali, services, hotel.id, { open: true })}
            >
              <Photo photo={photoOf(hotel.id)} className="trip-hotel-photo" />
              <span>
                <b>{hotel.name}</b>
                <span className="muted">
                  {CITY[c].name}, {f.money(hotel.price)} a night
                </span>
              </span>
            </button>
          ))}
        </div>
      </header>

      <BudgetSummary budget={summary.budget} />

      <div
        className="trip-days"
        role="listbox"
        aria-label="Days"
        tabIndex={0}
        aria-activedescendant={`${node.id}-day-${cursor}`}
        onKeyDown={list.onKeyDown}
      >
        {summary.days.map((s, i) => (
          <Fragment key={s.day.n}>
            {i === 0 || summary.days[i - 1]!.day.city !== s.day.city ? (
              <div className="trip-city-head" role="presentation">
                {CITY[s.day.city].name}
              </div>
            ) : null}
            <DayRow
              id={`${node.id}-day-${s.day.n}`}
              summary={s}
              selected={s.day.n === cursor}
              active={s.day.n === cursor && focused}
              dropping={dropDay === s.day.n}
              onClick={() => list.press(s.day.n)}
            />
          </Fragment>
        ))}
      </div>

      <footer className="trip-foot">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => services.changes.resetPlan()}
        >
          <ArrowCounterClockwiseIcon size={14} aria-hidden /> Reset the trip
        </button>
      </footer>
    </div>
  );
}

export const trip = definePane(KIND.trip, {
  title: "Trip",
  icon: SuitcaseRollingIcon,
  // A list of days: with no day selected, it starts on the one its following day plan shows.
  selects: KIND.day,
  width: { min: 260, comfortable: 300, max: 360 },
  height: { min: 360 },
  Component: TripPane,
});
