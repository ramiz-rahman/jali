/**
 * One day of the trip: its stops in order, from the hotel and back, with the leg between each pair (walk, transit
 * or taxi, its minutes and its fare), and the day's totals. Reorder by dragging a stop's handle (also onto another
 * day's pane, or a day in the overview) or with Alt+↑ and Alt+↓; change a leg's mode; "Optimise order" finds the
 * quickest order and says what it saved, with Undo.
 */
import { Fragment, useEffect, useRef, type KeyboardEvent } from "react";
import {
  ArrowsClockwiseIcon,
  CalendarDotsIcon,
  DotsSixVerticalIcon,
  HouseLineIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import { definePane, useCommands, useJali, usePaneState, type PaneProps } from "@jali/react";
import { selectPlace } from "../actions";
import { addToDay, chooseDay, optimise, removeFromPlan } from "../planning";
import { usePlan, useServices } from "../services";
import { useCurrent } from "../selection";
import { mustPlace } from "../trip/places";
import { dayOf, dayTotals, reorder, setMode, type Plan } from "../trip/plan";
import { dayBudget } from "../trip/budget";
import { optimiseDay } from "../trip/optimise";
import { MODES, MODE_LABEL, legKey, type Leg, type Mode } from "../trip/travel";
import { startStopDrag, useDrag } from "../ui/drag";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Empty, MODE_ICON, Stat } from "../ui/parts";
import { place } from "./place";

const dayParams = { n: Number };

function DayPane({ params, node, focused, paused, select, peek, inPeek }: PaneProps<typeof dayParams>) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const day = dayOf(plan, params.n);
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useDrag();
  const current = useCurrent();

  const stops = day?.stops ?? [];
  const at = cursor ? stops.indexOf(cursor) : -1;
  const totals = dayTotals(plan, stops);
  const budget = dayBudget(plan, params.n);
  // Worked out on every render (a few stops): the button says whether there is anything to gain.
  const best = optimiseDay(plan, stops);

  // Keep keyboard focus on the cursor's row after a reorder.
  useEffect(() => {
    if (!focused || at < 0) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-stop-index="${at}"] .stop-main`);
    if (row && listRef.current?.contains(document.activeElement)) row.focus();
  }, [at, focused, stops.join()]);

  if (!day) return <Empty title={`There is no Day ${params.n}`}>This trip has {plan.days.length} days.</Empty>;

  const moveCursor = (id: string) => {
    setCursor(id);
    if (!inPeek) selectPlace(jali, id, { from: node.id });
    else select(place({ id }));
  };
  const shift = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    const p = mustPlace(stops[from]!);
    services.plan.change(`Moved ${p.name} in Day ${day.n}`, (plan) => reorder(plan, day.n, from, to));
  };
  const moveToDay = (id: string) =>
    chooseDay(jali, services, `Move ${mustPlace(id).name} to…`, (n) => addToDay(services, id, n), {
      except: day.n,
    });

  const onKeyDown = (e: KeyboardEvent, i: number, id: string) => {
    if (e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (e.altKey && (k === "ArrowUp" || k === "ArrowDown")) shift(i, k === "ArrowUp" ? i - 1 : i + 1);
    else if (e.altKey) return;
    else if (k === "ArrowDown" || k === "j") stops[i + 1] && moveCursor(stops[i + 1]!);
    else if (k === "ArrowUp" || k === "k") stops[i - 1] && moveCursor(stops[i - 1]!);
    else if (k === "Home") stops[0] && moveCursor(stops[0]);
    else if (k === "End") stops.length && moveCursor(stops[stops.length - 1]!);
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

  const hotel = mustPlace(plan.hotel);
  const over = drag?.over?.day === day.n ? drag.over : null;
  const dropIndex = over ? (over.index ?? stops.length) : -1;
  // Arrival time at each stop: from 09:00, adding legs and visits as they come.
  let clock = 9 * 60;
  const arrive: number[] = [];
  stops.forEach((id, i) => {
    clock += totals.legs[i]!.minutes;
    arrive.push(clock);
    clock += mustPlace(id).visitMin;
  });

  return (
    <div className="pane-body day" data-day={day.n} data-paused={paused || undefined}>
      <header className="day-head">
        <DayMark n={day.n} size="lg" />
        <div className="day-head-text">
          <p className="day-date">{f.dayLong(day.date)}</p>
          <h3 className="day-title">{day.title}</h3>
        </div>
      </header>

      <dl className="stats">
        <Stat label="Travel" value={f.minutes(totals.travelMin)} />
        <Stat label="Transport" value={f.price(totals.transport)} />
        <Stat label="Spend" value={f.money(totals.spend)} />
        <Stat
          label={budget.over ? "Over the day's share" : "Day total"}
          value={budget.over ? f.money(budget.total - budget.allowance) : f.money(budget.total)}
          tone={budget.over ? "over" : undefined}
        />
      </dl>

      <div className="day-actions">
        <button
          type="button"
          className="btn"
          onClick={() => optimise(services, day.n)}
          disabled={best.savedMin <= 0}
          title={best.savedMin > 0 ? `Saves ${f.minutes(best.savedMin)} of travel` : undefined}
        >
          <SparkleIcon size={15} aria-hidden />
          {best.savedMin > 0 ? `Optimise order, save ${f.minutes(best.savedMin)}` : "In its quickest order"}
        </button>
        <span className="day-back muted">Back by {f.clock(totals.endsAt)}</span>
      </div>

      <div className="timeline" data-drop-day={day.n}>
        <Endpoint label={`Leave ${hotel.name}`} time="09:00" />
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
                    <LegRow leg={totals.legs[i]!} plan={plan} />
                    <div className="stop" aria-current={i === at ? "true" : undefined}>
                      <button
                        type="button"
                        className="stop-handle"
                        aria-label={`Drag ${p.name} to reorder or to another day`}
                        tabIndex={-1}
                        onPointerDown={(e) =>
                          startStopDrag(e, { id, day: day.n, index: i, label: p.name }, (sid, drop) =>
                            addToDay(services, sid, drop.day, drop.index),
                          )
                        }
                      >
                        <DotsSixVerticalIcon size={18} weight="bold" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="stop-main"
                        tabIndex={i === Math.max(0, at) ? 0 : -1}
                        onClick={() => (i === at ? selectPlace(jali, id, { from: node.id, open: true }) : moveCursor(id))}
                        onFocus={() => i !== at && moveCursor(id)}
                        onKeyDown={(e) => onKeyDown(e, i, id)}
                        aria-describedby={`${node.id}-hint`}
                      >
                        <span className="stop-num" data-day={day.n} aria-hidden>
                          {i + 1}
                        </span>
                        <span className="stop-text">
                          <span className="stop-name">{p.name}</span>
                          <span className="stop-meta">
                            <Icon size={13} aria-hidden /> {p.kind}, {f.minutes(p.visitMin)}
                            {p.price ? `, ${f.price(p.price)}` : ""}
                          </span>
                        </span>
                        <span className="stop-time num">{f.clock(arrive[i]!)}</span>
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
            <p>No stops yet. Pick a place on the map or in Explore, then add it to Day {day.n}.</p>
            {dropIndex >= 0 ? <div className="drop-line" aria-hidden /> : null}
          </div>
        )}
        {stops.length ? <LegRow leg={totals.legs[stops.length]!} plan={plan} /> : null}
        <Endpoint label={`Back at ${hotel.name}`} time={f.clock(totals.endsAt)} />
      </div>
      <p id={`${node.id}-hint`} className="sr-only">
        Up and down arrows move between stops. Alt with up or down reorders. M moves to another day. Space peeks.
      </p>
      {current && !stops.includes(current) && !inPeek ? (
        <AddCurrent id={current} n={day.n} plan={plan} />
      ) : null}
    </div>
  );
}

function Endpoint({ label, time }: { label: string; time: string }) {
  return (
    <div className="endpoint">
      <span className="endpoint-mark" aria-hidden>
        <HouseLineIcon size={14} weight="bold" />
      </span>
      <span className="endpoint-label">{label}</span>
      <span className="stop-time num">{time}</span>
    </div>
  );
}

/** The way between two stops: its mode (a choice of three), minutes and fare. */
function LegRow({ leg, plan }: { leg: Leg; plan: Plan }) {
  const services = useServices();
  const key = legKey(leg.from, leg.to);
  const to = mustPlace(leg.to);
  const choose = (mode: Mode) =>
    services.plan.change(`${MODE_LABEL[mode]} to ${to.name}`, (p) =>
      setMode(p, key, plan.modes[key] === mode ? null : mode),
    );
  return (
    <div className="leg" data-mode={leg.mode}>
      <span className="leg-line" aria-hidden />
      <div className="leg-modes" role="group" aria-label={`How to get to ${to.name}`}>
        {MODES.map((m) => {
          const Icon = MODE_ICON[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={leg.mode === m}
              title={leg.mode === m && leg.chosen ? `${MODE_LABEL[m]} (your choice; press again for the suggestion)` : MODE_LABEL[m]}
              onClick={() => choose(m)}
            >
              <Icon size={15} weight={leg.mode === m ? "bold" : "regular"} aria-hidden />
              <span className="sr-only">{MODE_LABEL[m]}</span>
            </button>
          );
        })}
      </div>
      <span className="leg-text">
        <span className="num">{f.minutes(leg.minutes)}</span>
        <span className="muted">
          {f.distance(leg.km)}, {leg.cost ? f.money(leg.cost) : "free"}
        </span>
      </span>
      {leg.chosen ? (
        <button
          type="button"
          className="leg-reset"
          title="Go back to the suggested mode"
          onClick={() => services.plan.change(`Suggested mode to ${to.name}`, (p) => setMode(p, key, null))}
        >
          <ArrowsClockwiseIcon size={13} aria-hidden />
          <span className="sr-only">Use the suggested mode</span>
        </button>
      ) : null}
    </div>
  );
}

/** The place selected elsewhere, offered for this day. */
function AddCurrent({ id, n, plan }: { id: string; n: number; plan: Plan }) {
  const services = useServices();
  const p = mustPlace(id);
  if (p.category === "stay" || plan.hotel === id) return null;
  const on = plan.days.find((d) => d.stops.includes(id));
  return (
    <div className="add-current">
      <span>
        <b>{p.name}</b>
        {on ? <span className="muted">, on Day {on.n}</span> : <span className="muted">, not planned</span>}
      </span>
      <button type="button" className="btn btn-primary" onClick={() => addToDay(services, id, n)}>
        {on ? `Move to Day ${n}` : `Add to Day ${n}`}
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

