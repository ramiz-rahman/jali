/**
 * Where a place sits in the plan, and the next step for it, by what it is: an airport is the flight's, a hotel is
 * where a city's days start and end (or could be), and a sight or a meal is on a day (or could be).
 */
import type { ComponentType } from "react";
import { AirplaneTiltIcon, CheckIcon, PlusIcon } from "@phosphor-icons/react";
import { useJali } from "jali/react";
import { useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import type { Category, Place } from "../../trip/places";
import { daysIn, dayWith, hotelOf, standingOf, transferDay, type Plan } from "../../trip/plan";
import * as f from "../../ui/format";
import { DayMark } from "../../ui/day-mark";
import { offerPlace } from "../../workspace/choosers";

interface LineProps {
  p: Place;
  plan: Plan;
}

export function PlanLine(props: LineProps) {
  const Line = LINES[props.p.category];
  return (
    <div className="place-plan" data-day={dayWith(props.plan, props.p.id)?.n}>
      <Line {...props} />
    </div>
  );
}

function FlightLine({ plan }: LineProps) {
  const day = transferDay(plan);
  if (!day?.from) return null;
  return (
    <p className="place-plan-line">
      <AirplaneTiltIcon size={16} weight="bold" aria-hidden /> The flight between{" "}
      {CITY[day.from].name} and {CITY[day.city].name} is on Day {day.n}
    </p>
  );
}

function HotelLine({ p, plan }: LineProps) {
  const { changes } = useServices();
  const nights = daysIn(plan, p.city).length;
  const city = CITY[p.city].name;
  const hotel = hotelOf(plan, p.city);
  if (hotel.id === p.id)
    return (
      <p className="place-plan-line">
        <CheckIcon size={16} weight="bold" aria-hidden /> Your hotel in {city} for {nights} nights
      </p>
    );
  return (
    <>
      <p className="place-plan-line muted">
        You are staying at {hotel.name} in {city}.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => changes.stayAt(p.id)}>
        Stay here instead, {nights} nights
      </button>
    </>
  );
}

function StopLine({ p, plan }: LineProps) {
  const jali = useJali();
  const services = useServices();
  const { changes } = services;
  const standing = standingOf(plan, p.id);
  if (standing.kind === "stop") {
    const { day, index } = standing;
    return (
      <>
        <p className="place-plan-line">
          <DayMark n={day.n} size="sm" />
          <span>
            Day {day.n}, stop {index + 1} of {day.stops.length}
            <span className="muted">, {f.day(day.date)}</span>
          </span>
        </p>
        <div className="place-actions">
          <button type="button" className="btn" onClick={() => offerPlace(jali, services, p)}>
            Move to another day
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => changes.removeFromPlan(p.id)}
          >
            Remove
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <p className="place-plan-line muted">
        Not in the plan yet. Add it to a day in {CITY[p.city].name}:
      </p>
      <div className="day-buttons" role="group" aria-label={`Add ${p.name} to a day`}>
        {daysIn(plan, p.city).map((d) => (
          <button
            key={d.n}
            type="button"
            data-day={d.n}
            title={`Add to Day ${d.n}: ${d.title}`}
            onClick={() => changes.addToDay(p.id, d.n)}
          >
            <PlusIcon size={12} weight="bold" aria-hidden />
            <span className="sr-only">Add to Day </span>
            {d.n}
          </button>
        ))}
      </div>
    </>
  );
}

const LINES: Record<Category, ComponentType<LineProps>> = {
  airport: FlightLine,
  stay: HotelLine,
  sight: StopLine,
  food: StopLine,
};
