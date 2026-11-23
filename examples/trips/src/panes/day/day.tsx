/**
 * One day of the trip: its stops in order, from the city's hotel and back, with the leg between each pair (the
 * city's own modes, its minutes and its fare), and the day's totals. The transfer day starts at the other city's
 * hotel, with the ride to the airport and the flight, before its stops. Reorder by dragging a stop's handle (also
 * onto another day's pane, or a day in the overview) or with Alt+↑ and Alt+↓; change a leg's mode; "Optimise order"
 * finds the quickest order and says what it saved, with Undo.
 */
import { Fragment, useId } from "react";
import { CalendarDotsIcon, CheckIcon, SparkleIcon, WarningIcon } from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliModel,
  usePaneState,
  type PaneProps,
} from "jali/react";
import { useServices, useSummary } from "../../state/services";
import { idOrNull } from "../../state/saved";
import { CITY } from "../../trip/cities";
import { cents } from "../../trip/money";
import { mustPlace } from "../../trip/places";
import { dayNumber } from "../../trip/plan";
import type { DaySummary } from "../../trip/summary";
import { useCursorList } from "../../ui/cursor-list";
import { startStopDrag, useDraggedFrom, useDropIndex } from "../../ui/drag";
import * as f from "../../ui/format";
import { DayMark } from "../../ui/day-mark";
import { Empty } from "../../ui/empty";
import { Stat } from "../../ui/stat";
import { offerPlace } from "../../workspace/choosers";
import { onlyDayPane, selectPlace } from "../../workspace/hub";
import { KIND, placeRef } from "../../workspace/refs";
import { useSelectedPlace } from "../../workspace/use-hub";
import { AddCurrent } from "./add-current";
import { LegRow } from "./leg-row";
import { Endpoint, Stop } from "./stop-row";
import { Suggestions } from "./suggestions";
import "./day.css";

const dayParams = { n: dayNumber };

function DayPane(props: PaneProps<typeof dayParams>) {
  const summary = useSummary();
  const day = summary.day(props.params.n);
  if (!day)
    return (
      <Empty title={`There is no Day ${props.params.n}`}>
        This trip has {summary.plan.days.length} days.
      </Empty>
    );
  return <DayBody {...props} summary={day} />;
}

function DayBody({
  node,
  focused,
  paused,
  select,
  peek,
  inPeek,
  summary: { day, totals, budget, best },
}: PaneProps<typeof dayParams> & { summary: DaySummary }) {
  const jali = useJali();
  const services = useServices();
  const { changes } = services;
  const [stored, setCursor] = usePaneState<string | null>("cursor", null, { parse: idOrNull });
  const draggedId = useDraggedFrom(day.n);
  const dropIndex = useDropIndex(day.n, day.stops.length);
  const current = useSelectedPlace();
  // "Add the selected place to this day" shows in the one day pane, or the focused one when several are open.
  const alone = onlyDayPane(useJaliModel());
  const hint = useId();

  const stops = day.stops;
  const cursor = stored !== null && stops.includes(stored) ? stored : null;
  const at = cursor ? stops.indexOf(cursor) : -1;
  const cur = cursor ? mustPlace(cursor) : null;
  const shift = (by: number) => at >= 0 && changes.moveWithinDay(day.n, at, at + by);
  const moveToDay = () => cur && offerPlace(jali, services, cur);
  const remove = () => cursor && changes.removeFromPlan(cursor);

  const list = useCursorList({
    items: stops,
    cursor,
    onMove: (id) => {
      setCursor(id);
      if (!inPeek) selectPlace(jali, services, id, { from: node.id });
      else select(placeRef(id));
    },
    onOpen: (id) => selectPlace(jali, services, id, { from: node.id, open: true }),
    actions: [
      { id: "peek", keys: ["Space"], run: () => cursor && peek(placeRef(cursor)) },
      {
        id: "move-day",
        title: cur ? `Move ${cur.name} to another day…` : "Move a stop to another day…",
        keys: ["M"],
        disabled: cur ? false : "Pick a stop first",
        run: moveToDay,
      },
      {
        id: "up",
        title: cur ? `Move ${cur.name} earlier` : "Move the stop earlier",
        keys: ["Alt+ArrowUp"],
        disabled: cur && at > 0 ? false : "Nothing to move up",
        run: () => shift(-1),
      },
      {
        id: "down",
        title: cur ? `Move ${cur.name} later` : "Move the stop later",
        keys: ["Alt+ArrowDown"],
        disabled: cur && at < stops.length - 1 ? false : "Nothing to move down",
        run: () => shift(1),
      },
      {
        id: "remove",
        title: cur ? `Remove ${cur.name} from Day ${day.n}` : "Remove a stop",
        keys: ["Delete", "Backspace"],
        disabled: cur ? false : "Pick a stop first",
        run: remove,
      },
    ],
  });

  useCommands(
    inPeek
      ? []
      : [
          {
            id: "optimise",
            title: `Optimise the order of Day ${day.n}`,
            disabled: best.savedMin > 0 ? false : "It is already in its quickest order",
            run: () => changes.optimise(day.n),
          },
          ...list.commands,
        ],
  );

  const steps = totals.steps;
  const start = steps[0]!;
  const end = steps[steps.length - 1]!;
  const transfer = steps.filter((s) => s.role === "airport" || s.role === "landing");
  const visits = steps.filter((s) => s.role === "stop");
  const city = CITY[day.city].name;

  return (
    <div className="pane-body day" data-day={day.n} data-paused={paused || undefined}>
      <header className="day-head">
        <DayMark n={day.n} size="lg" />
        <div className="day-head-text">
          <p className="day-date">
            {f.dayLong(day.date)}, {day.from ? `${CITY[day.from].name} to ${city}` : city}
          </p>
          <h3 className="day-title">{day.title}</h3>
        </div>
      </header>

      <dl className="stats day-stats">
        <Stat
          label="Travel"
          value={f.minutes(totals.travelMin)}
          sub={
            totals.flight
              ? `${f.money(cents(totals.transport + totals.flight))} with the flight`
              : totals.transport
                ? `${f.money(totals.transport)} in fares`
                : "No fares"
          }
        />
        <Stat
          label={end.role === "check-in" ? "Check in by" : "Back by"}
          value={f.clock(totals.endsAt)}
          sub={`Out at ${f.clock(start.leave)}`}
        />
        <Stat
          label="To spend"
          value={f.money(budget.spend)}
          sub={
            budget.over ? (
              <>
                <WarningIcon size={12} weight="bold" aria-hidden /> {f.money(budget.overBy)} over
              </>
            ) : (
              `of ${f.moneyRound(budget.allowance)} a day`
            )
          }
          tone={budget.over ? "over" : undefined}
        />
      </dl>

      {best.savedMin > 0 ? (
        <button
          type="button"
          className="btn day-optimise"
          onClick={() => changes.optimise(day.n)}
          title="Reorders the stops for the shortest travel. Undo puts them back."
        >
          <SparkleIcon size={15} weight="fill" aria-hidden />
          <span>
            Optimise the order{" "}
            <span className="day-optimise-gain">to save {f.minutes(best.savedMin)}</span>
          </span>
        </button>
      ) : (
        <p className="day-optimised">
          <CheckIcon size={14} weight="bold" aria-hidden /> In its quickest order
        </p>
      )}

      <div className="timeline" data-drop-day={day.n}>
        <Endpoint step={start} />
        {/* The transfer day's fixed start: to the airport, the flight, the arrival. */}
        {transfer.map((s) => (
          <Fragment key={s.place.id}>
            <LegRow leg={s.legIn!} />
            <Endpoint step={s} />
          </Fragment>
        ))}
        {visits.length ? (
          <ol className="stops" aria-label={`Stops on Day ${day.n}`} {...list.listProps}>
            {visits.map((s, i) => {
              const id = s.place.id;
              return (
                <Fragment key={id}>
                  {dropIndex === i ? <li className="drop-line" aria-hidden /> : null}
                  <li
                    className="stop-item"
                    data-stop-index={i}
                    data-dragged={draggedId === id || undefined}
                    data-current={current === id || undefined}
                  >
                    <LegRow leg={s.legIn!} />
                    <Stop
                      step={s}
                      n={day.n}
                      index={i}
                      cursor={id === cursor}
                      hint={hint}
                      row={list.row(id)}
                      onPointerDown={(e) =>
                        startStopDrag(
                          e,
                          { id, day: day.n, index: i, label: s.place.name },
                          (sid, drop) => changes.addToDay(sid, drop.day, drop.index),
                          jali,
                        )
                      }
                    />
                  </li>
                </Fragment>
              );
            })}
            {dropIndex === stops.length ? <li className="drop-line" aria-hidden /> : null}
          </ol>
        ) : (
          <div className="day-empty" data-stop-index-none="">
            <CalendarDotsIcon size={22} aria-hidden />
            <p>
              No stops yet. Pick a place in {city} on the map or in Explore, then add it to Day{" "}
              {day.n}.
            </p>
            {dropIndex >= 0 ? <div className="drop-line" aria-hidden /> : null}
          </div>
        )}
        <LegRow leg={end.legIn!} />
        <Endpoint step={end} />
      </div>
      {inPeek ? null : <Suggestions day={day} />}
      <p id={hint} className="sr-only">
        Up and down arrows move between stops. Alt with up or down reorders. M moves to another day.
        Space peeks.
      </p>
      {current && !stops.includes(current) && !inPeek && (focused || alone) ? (
        <AddCurrent id={current} day={day} />
      ) : null}
    </div>
  );
}

export const day = definePane(KIND.day, {
  params: dayParams,
  title: ({ n }) => `Day ${n}`,
  icon: CalendarDotsIcon,
  width: { min: 300, comfortable: 360, max: 480 },
  height: { min: 320 },
  Component: DayPane,
});
