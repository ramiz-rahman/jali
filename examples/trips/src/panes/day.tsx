/**
 * One day of the trip: its stops in order, from the city's hotel and back, with the leg between each pair (the
 * city's own modes, its minutes and its fare), and the day's totals. The transfer day starts at the other city's
 * hotel, with the ride to the airport and the flight, before its stops. Reorder by dragging a stop's handle (also onto another
 * day's pane, or a day in the overview) or with Alt+↑ and Alt+↓; change a leg's mode; "Optimise order" finds the
 * quickest order and says what it saved, with Undo.
 */
import { Fragment, useEffect, useRef, type KeyboardEvent } from "react";
import {
  AirplaneTiltIcon,
  ArrowsClockwiseIcon,
  BoatIcon,
  CalendarDotsIcon,
  CheckIcon,
  DotsSixVerticalIcon,
  HouseLineIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  SparkleIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import {
  definePane,
  useCommands,
  useJali,
  useJaliModel,
  usePaneState,
  type PaneProps,
} from "@jali/react";
import { selectPlace } from "../actions";
import { addToDay, chooseDay, optimise, removeFromPlan } from "../planning";
import { usePlan, useServices } from "../services";
import { useCurrent } from "../selection";
import { CITY_NAME, mustPlace, PLACES, type Place } from "../trip/places";
import {
  canPlan,
  DEFAULT_PLAN,
  dayOf,
  dayTotals,
  dayWith,
  hotelOf,
  reorder,
  round2,
  setMode,
  type Day,
  type Plan,
} from "../trip/plan";
import { dayBudget } from "../trip/budget";
import { optimiseDay } from "../trip/optimise";
import {
  crossesRiver,
  FLIGHT,
  haversineKm,
  leg as legBetween,
  legKey,
  modeLabel,
  type Leg,
  type Mode,
} from "../trip/travel";
import { startStopDrag, useDrag } from "../ui/drag";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Empty, MODE_ICON, Stat } from "../ui/parts";
import { Photo } from "../ui/photo";
import { place } from "./place";

/** A day of this trip, 1 to 7: a link naming another (an older, shorter trip's) is not read. */
const dayNumber = (v: string | number | boolean) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= DEFAULT_PLAN.days.length ? n : undefined;
};
const dayParams = { n: dayNumber };

function DayPane(props: PaneProps<typeof dayParams>) {
  const plan = usePlan();
  const day = dayOf(plan, props.params.n);
  if (!day)
    return (
      <Empty title={`There is no Day ${props.params.n}`}>
        This trip has {plan.days.length} days.
      </Empty>
    );
  return <DayBody {...props} day={day} plan={plan} />;
}

function DayBody({
  node,
  focused,
  paused,
  select,
  peek,
  inPeek,
  day,
  plan,
}: PaneProps<typeof dayParams> & { day: Day; plan: Plan }) {
  const jali = useJali();
  const services = useServices();
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useDrag();
  const current = useCurrent();

  const stops = day.stops;
  // "Add the selected place to this day" shows in the one day pane, or the focused one when several are open.
  const alone = useJaliModel().panes.filter((p) => p.ref.kind === "day").length === 1;
  const at = cursor ? stops.indexOf(cursor) : -1;
  const totals = dayTotals(plan, day);
  const budget = dayBudget(plan, day.n);
  // Worked out on every render (a few stops): the button says whether there is anything to gain.
  const best = optimiseDay(plan, day);

  // Keep keyboard focus on the cursor's row after a reorder.
  useEffect(() => {
    if (!focused || at < 0) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-stop-index="${at}"] .stop-main`);
    if (row && listRef.current?.contains(document.activeElement)) row.focus();
  }, [at, focused, stops.join()]);

  const moveCursor = (id: string) => {
    setCursor(id);
    if (!inPeek) selectPlace(jali, id, { from: node.id });
    else select(place({ id }));
  };
  /** The cursor to a stop, if there is one there (the first or last stop has nothing past it). */
  const moveCursorTo = (id: string | undefined) => {
    if (id) moveCursor(id);
  };
  const shift = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    const p = mustPlace(stops[from]!);
    services.plan.change(`Moved ${p.name} in Day ${day.n}`, (plan) =>
      reorder(plan, day.n, from, to),
    );
  };
  const moveToDay = (id: string) =>
    chooseDay(jali, services, `Move ${mustPlace(id).name} to…`, (n) => addToDay(services, id, n), {
      except: day.n,
      city: day.city,
    });

  const onKeyDown = (e: KeyboardEvent, i: number, id: string) => {
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (e.altKey && (k === "ArrowUp" || k === "ArrowDown"))
      shift(i, k === "ArrowUp" ? i - 1 : i + 1);
    else if (e.altKey) return;
    else if (k === "ArrowDown" || k === "j") moveCursorTo(stops[i + 1]);
    else if (k === "ArrowUp" || k === "k") moveCursorTo(stops[i - 1]);
    else if (k === "Home") moveCursorTo(stops[0]);
    else if (k === "End") moveCursorTo(stops[stops.length - 1]);
    else if (k === " ") peek(place({ id }));
    else if (k === "Enter") selectPlace(jali, id, { from: node.id, open: true });
    else if (k === "m" || k === "M") moveToDay(id);
    else if (k === "Delete" || k === "Backspace") removeFromPlan(services, id);
    else return; // not ours: it goes on to the workspace
    e.preventDefault();
  };

  const cur = at >= 0 ? mustPlace(stops[at]!) : null;
  useCommands(
    inPeek
      ? []
      : [
          {
            id: "optimise",
            title: `Optimise the order of Day ${day.n}`,
            disabled: best.savedMin > 0 ? false : "It is already in its quickest order",
            run: () => optimise(services, day.n),
          },
          {
            id: "move-day",
            title: cur ? `Move ${cur.name} to another day…` : "Move a stop to another day…",
            keys: "M",
            disabled: cur ? false : "Pick a stop first",
            run: () => cur && moveToDay(cur.id),
          },
          {
            id: "up",
            title: cur ? `Move ${cur.name} earlier` : "Move the stop earlier",
            keys: keyHint("Alt+ArrowUp"),
            disabled: cur && at > 0 ? false : "Nothing to move up",
            run: () => shift(at, at - 1),
          },
          {
            id: "down",
            title: cur ? `Move ${cur.name} later` : "Move the stop later",
            keys: keyHint("Alt+ArrowDown"),
            disabled: cur && at < stops.length - 1 ? false : "Nothing to move down",
            run: () => shift(at, at + 1),
          },
          {
            id: "remove",
            title: cur ? `Remove ${cur.name} from Day ${day.n}` : "Remove a stop",
            keys: keyHint("Delete"),
            disabled: cur ? false : "Pick a stop first",
            run: () => cur && removeFromPlan(services, cur.id),
          },
        ],
  );

  const { places, first } = totals.route;
  const over = drag?.over?.day === day.n ? drag.over : null;
  const dropIndex = over ? (over.index ?? stops.length) : -1;
  const end = places[places.length - 1]!;

  return (
    <div className="pane-body day" data-day={day.n} data-paused={paused || undefined}>
      <header className="day-head">
        <DayMark n={day.n} size="lg" />
        <div className="day-head-text">
          <p className="day-date">
            {f.dayLong(day.date)},{" "}
            {day.from ? `${CITY_NAME[day.from]} to ${CITY_NAME[day.city]}` : CITY_NAME[day.city]}
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
              ? `${f.money(round2(totals.transport + totals.flight))} with the flight`
              : totals.transport
                ? `${f.money(totals.transport)} in fares`
                : "No fares"
          }
        />
        <Stat
          label={day.from ? "Check in by" : "Back by"}
          value={f.clock(totals.endsAt)}
          sub={`Out at ${f.clock(totals.arrive[0]!)}`}
        />
        <Stat
          label="Day total"
          value={f.money(budget.total)}
          sub={
            budget.over ? (
              <>
                <WarningIcon size={12} weight="bold" aria-hidden />{" "}
                {f.money(round2(budget.total - budget.allowance))} over
              </>
            ) : (
              `of a ${f.moneyRound(budget.allowance)} share`
            )
          }
          tone={budget.over ? "over" : undefined}
        />
      </dl>

      {best.savedMin > 0 ? (
        <button
          type="button"
          className="btn day-optimise"
          onClick={() => optimise(services, day.n)}
          title={`Reorders the stops for the shortest travel. Undo puts them back.`}
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
        <Endpoint
          place={places[0]!}
          label={`Leave ${places[0]!.name}`}
          time={f.clock(totals.arrive[0]!)}
        />
        {/* The transfer day's fixed start: to the airport, the flight, the arrival. */}
        {places.slice(1, first).map((p, k) => (
          <Fragment key={p.id}>
            <LegRow leg={totals.legs[k]!} plan={plan} />
            <Endpoint
              place={p}
              label={k === first - 2 ? `Land at ${p.name}` : p.name}
              time={f.clock(totals.arrive[k + 1]!)}
            />
          </Fragment>
        ))}
        {stops.length ? (
          <ol ref={listRef} className="stops" aria-label={`Stops on Day ${day.n}`}>
            {stops.map((id, i) => {
              const p = mustPlace(id);
              const Icon = CATEGORY_ICON[p.category];
              const dragged = drag?.id === id;
              return (
                <Fragment key={id}>
                  {dropIndex === i ? <li className="drop-line" aria-hidden /> : null}
                  <li
                    className="stop-item"
                    data-stop-index={i}
                    data-dragged={dragged || undefined}
                    data-current={current === id || undefined}
                  >
                    <LegRow leg={totals.legs[first - 1 + i]!} plan={plan} />
                    <div className="stop" aria-current={i === at ? "true" : undefined}>
                      <button
                        type="button"
                        className="stop-handle"
                        aria-label={`Drag ${p.name} to reorder or to another day`}
                        title="Drag to reorder, or onto another day"
                        tabIndex={-1}
                        onPointerDown={(e) =>
                          startStopDrag(
                            e,
                            { id, day: day.n, index: i, label: p.name },
                            (sid, drop) => addToDay(services, sid, drop.day, drop.index),
                            jali,
                          )
                        }
                      >
                        <DotsSixVerticalIcon size={16} weight="bold" aria-hidden />
                      </button>
                      <span className="stop-num" data-day={day.n} aria-hidden>
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        className="stop-main"
                        tabIndex={i === Math.max(0, at) ? 0 : -1}
                        onClick={() =>
                          i === at
                            ? selectPlace(jali, id, { from: node.id, open: true })
                            : moveCursor(id)
                        }
                        onFocus={() => i !== at && moveCursor(id)}
                        onKeyDown={(e) => onKeyDown(e, i, id)}
                        aria-describedby={`${node.id}-hint`}
                      >
                        <Photo id={id} className="stop-photo" />
                        <span className="stop-text">
                          <span className="stop-name">{p.name}</span>
                          <span className="stop-meta">
                            <Icon size={13} aria-hidden /> {p.kind}, {f.minutes(p.visitMin)}
                            {p.price ? `, ${f.price(p.price)}` : ""}
                          </span>
                        </span>
                        <span className="stop-time num">
                          {f.clock(totals.arrive[first + i]!)}
                          <span className="stop-until">
                            {f.clock(totals.arrive[first + i]! + p.visitMin)}
                          </span>
                        </span>
                      </button>
                    </div>
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
              No stops yet. Pick a place in {CITY_NAME[day.city]} on the map or in Explore, then add
              it to Day {day.n}.
            </p>
            {dropIndex >= 0 ? <div className="drop-line" aria-hidden /> : null}
          </div>
        )}
        <LegRow leg={totals.legs[totals.legs.length - 1]!} plan={plan} />
        <Endpoint
          place={end}
          label={`${day.from ? "Check in at" : "Back at"} ${end.name}`}
          time={f.clock(totals.endsAt)}
        />
      </div>
      {inPeek ? null : <Suggestions day={day} plan={plan} from={node.id} />}
      <p id={`${node.id}-hint`} className="sr-only">
        Up and down arrows move between stops. Alt with up or down reorders. M moves to another day.
        Space peeks.
      </p>
      {current && !stops.includes(current) && !inPeek && (focused || alone) ? (
        <AddCurrent id={current} day={day} plan={plan} />
      ) : null}
    </div>
  );
}

function Endpoint({ place: p, label, time }: { place: Place; label: string; time: string }) {
  const Icon = p.category === "airport" ? AirplaneTiltIcon : HouseLineIcon;
  return (
    <div className="endpoint" data-category={p.category}>
      <span className="endpoint-mark" aria-hidden>
        <Icon size={14} weight="bold" />
      </span>
      <span className="endpoint-label">{label}</span>
      <span className="stop-time num">{time}</span>
    </div>
  );
}

/** "12 min walk", "13 min by ferry": the leg's mode in words beside its icon. */
const legWord = (m: Mode, ferry: boolean) =>
  m === "walk"
    ? "walk"
    : m === "transit"
      ? ferry
        ? "by ferry"
        : "by train"
      : m === "taxi"
        ? "by taxi"
        : "by scooter";

/** The way between two stops: its mode (the city's choices), minutes and fare. The flight is fixed. */
function LegRow({ leg, plan }: { leg: Leg; plan: Plan }) {
  const services = useServices();
  const key = legKey(leg.from, leg.to);
  const to = mustPlace(leg.to);
  if (leg.mode === "flight")
    return (
      <div className="leg leg-flight" data-mode="flight">
        <span className="leg-line" aria-hidden />
        <span className="leg-flight-mark" aria-hidden>
          <AirplaneTiltIcon size={16} weight="bold" />
        </span>
        <span className="leg-text">
          <span className="num">{f.minutes(FLIGHT.airMin)} flight</span>
          <span className="muted">
            {f.distance(leg.km)}, {f.money(leg.cost)}, with {f.minutes(FLIGHT.airportMin)} at the
            airports
          </span>
        </span>
      </div>
    );
  const city = leg.city === "between" ? "bkk" : leg.city;
  const choose = (mode: Mode) =>
    services.plan.change(`${modeLabel(mode, city)} to ${to.name}`, (p) =>
      setMode(p, key, plan.modes[key] === mode ? null : mode),
    );
  const ferry = crossesRiver(mustPlace(leg.from), to);
  const label = (m: Mode) => (ferry && m === "transit" ? "River ferry" : modeLabel(m, city));
  return (
    <div className="leg" data-mode={leg.mode}>
      <span className="leg-line" aria-hidden />
      <div className="leg-modes" role="group" aria-label={`How to get to ${to.name}`}>
        {leg.options.map((m) => {
          const Icon = ferry && m === "transit" ? BoatIcon : MODE_ICON[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={leg.mode === m}
              title={
                leg.mode === m && leg.chosen
                  ? `${label(m)} (your choice; press again for the suggestion)`
                  : label(m)
              }
              onClick={() => choose(m)}
            >
              <Icon size={15} weight={leg.mode === m ? "bold" : "regular"} aria-hidden />
              <span className="sr-only">{label(m)}</span>
            </button>
          );
        })}
      </div>
      <span className="leg-text">
        <span className="leg-time">
          <span className="num">{f.minutes(leg.minutes)}</span> {legWord(leg.mode, ferry)}
        </span>
        <span className="muted">
          {f.distance(leg.km)}, {leg.cost ? f.money(leg.cost) : "free"}
        </span>
      </span>
      {leg.chosen ? (
        <button
          type="button"
          className="leg-reset"
          title="Go back to the suggested mode"
          onClick={() =>
            services.plan.change(`Suggested mode to ${to.name}`, (p) => setMode(p, key, null))
          }
        >
          <ArrowsClockwiseIcon size={13} aria-hidden />
          <span className="sr-only">Use the suggested mode</span>
        </button>
      ) : null}
    </div>
  );
}

/**
 * The foot of the day: what else is close to its route and not planned yet, nearest first, with a photo and the way
 * there, each one press from being on the day. "Find a place" asks for anything else in the city.
 */
function Suggestions({ day, plan, from }: { day: Day; plan: Plan; from: string }) {
  const jali = useJali();
  const services = useServices();
  const anchors = day.stops.length ? day.stops.map(mustPlace) : [hotelOf(plan, day.city)];
  const near = PLACES.filter(
    (q) =>
      q.city === day.city &&
      (q.category === "sight" || q.category === "food") &&
      !dayWith(plan, q.id),
  )
    .map((q) => {
      const by = anchors.reduce((a, b) => (haversineKm(a, q) <= haversineKm(b, q) ? a : b));
      return { q, by, way: legBetween(by, q) };
    })
    .sort((a, b) => a.way.minutes - b.way.minutes)
    .slice(0, 3);
  const find = () =>
    jali.actions.choose({
      title: `Add to Day ${day.n}…`,
      items: PLACES.filter(
        (q) => q.city === day.city && (q.category === "sight" || q.category === "food"),
      ),
      label: (q) => q.name,
      hint: (q) => {
        const on = dayWith(plan, q.id);
        return `${q.kind}, ${q.area}${on ? `, on Day ${on.n}` : ""}`;
      },
      placeholder: `A place in ${CITY_NAME[day.city]}`,
      onChoose: (q) => addToDay(services, q.id, day.n),
    });
  return (
    <section className="day-more" aria-labelledby={`${from}-more`}>
      <h4 id={`${from}-more`}>Close to this day</h4>
      {near.length ? (
        <ul>
          {near.map(({ q, by, way }) => {
            const Icon = CATEGORY_ICON[q.category];
            return (
              <li key={q.id} className="day-more-row">
                <button
                  type="button"
                  className="day-more-main"
                  onClick={() => selectPlace(jali, q.id, { from })}
                  title={`Show ${q.name}`}
                >
                  <Photo id={q.id} className="day-more-photo" />
                  <span className="day-more-text">
                    <span className="day-more-name">{q.name}</span>
                    <span className="day-more-meta">
                      <Icon size={12} aria-hidden /> {q.kind}, {f.minutes(way.minutes)}{" "}
                      {way.mode === "walk" ? "walk" : "away"} from {by.name}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="day-more-add"
                  aria-label={`Add ${q.name} to Day ${day.n}`}
                  title={`Add to Day ${day.n}`}
                  onClick={() => addToDay(services, q.id, day.n)}
                >
                  <PlusIcon size={16} weight="bold" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <button type="button" className="btn btn-quiet day-more-find" onClick={find}>
        <MagnifyingGlassIcon size={15} aria-hidden /> Find a place in {CITY_NAME[day.city]} to add
      </button>
    </section>
  );
}

/** The place selected elsewhere, offered for this day when it is in the day's city. */
function AddCurrent({ id, day, plan }: { id: string; day: Day; plan: Plan }) {
  const services = useServices();
  const p = mustPlace(id);
  if (!canPlan(plan, id, day.n)) return null;
  const on = plan.days.find((d) => d.stops.includes(id));
  return (
    <div className="add-current">
      <span>
        <b>{p.name}</b>
        {on ? (
          <span className="muted">, on Day {on.n}</span>
        ) : (
          <span className="muted">, not planned</span>
        )}
      </span>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => addToDay(services, id, day.n)}
      >
        {on ? `Move to Day ${day.n}` : `Add to Day ${day.n}`}
      </button>
    </div>
  );
}

export const day = definePane("day", {
  params: dayParams,
  title: ({ n }) => `Day ${n}`,
  icon: CalendarDotsIcon,
  width: { min: 300, comfortable: 360, max: 480 },
  height: { min: 320 },
  Component: DayPane,
});
