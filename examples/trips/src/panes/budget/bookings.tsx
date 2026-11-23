/**
 * What is booked ahead: each city's hotel for its nights, and the flight between them, in the order the trip meets
 * them. A hotel opens in the place pane, where a cheaper one can be chosen (Stay); the flight is fixed.
 */
import { useJali } from "jali/react";
import { useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import type { Booking, TripBudget } from "../../trip/budget";
import * as f from "../../ui/format";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/molecules/photo";
import { photoOf } from "../../trip/photos";
import { selectPlace } from "../../workspace/hub";

export function Bookings({ budget, disabled }: { budget: TripBudget; disabled?: boolean }) {
  return (
    <section className="budget-booked" aria-labelledby="budget-booked-heading">
      <h3 id="budget-booked-heading" className="budget-heading">
        Booked <span className="muted num">{f.money(budget.booked)}</span>
      </h3>
      <ul className="budget-bookings">
        {budget.bookings.map((b) => (
          <li key={b.kind === "stay" ? b.city : "flight"}>
            <BookingRow booking={b} disabled={disabled} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookingRow({ booking: b, disabled }: { booking: Booking; disabled?: boolean }) {
  const jali = useJali();
  const services = useServices();
  if (b.kind === "flight") {
    const Icon = CATEGORY_ICON.airport;
    return (
      <div className="budget-booking">
        <span className="budget-booking-mark" aria-hidden>
          <Icon size={18} weight="bold" />
        </span>
        <span className="budget-booking-text">
          <b>Flight to {CITY[b.to].name}</b>
          <span className="muted">
            From {CITY[b.from].name}, on Day {b.day}
          </span>
        </span>
        <span className="num">{f.money(b.cost)}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="budget-booking"
      disabled={disabled}
      onClick={() => selectPlace(jali, services, b.place.id, { open: true })}
    >
      <Photo photo={photoOf(b.place.id)} className="budget-booking-mark" />
      <span className="budget-booking-text">
        <b>{b.place.name}</b>
        <span className="muted">
          {CITY[b.city].name}, {b.nights} {b.nights === 1 ? "night" : "nights"} at{" "}
          {f.money(b.place.price)}
        </span>
      </span>
      <span className="num">{f.money(b.cost)}</span>
    </button>
  );
}
