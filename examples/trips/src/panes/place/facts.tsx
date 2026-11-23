/**
 * A place's figures: its hours, a visit's length, its price (a night, for a hotel, and the nights in its city), how
 * central a hotel is to the plan, and how far a sight or a meal is from the hotel. A hotel kept beside (Keep) is read
 * against this one, figure by figure.
 */
import type { ReactNode } from "react";
import { CITY } from "../../trip/cities";
import { wordsFor } from "../../trip/modes";
import { minutesToStops } from "../../trip/nearby";
import { isPlannable, type Category, type Place } from "../../trip/places";
import { daysIn, hotelOf, type Plan } from "../../trip/plan";
import { leg } from "../../trip/travel";
import * as f from "../../ui/format";

/** What a place's price buys. An airport has none. */
const PRICE_LABEL: Partial<Record<Category, string>> = {
  stay: "A night",
  food: "A meal, each",
  sight: "Ticket",
};

export function Facts({ p, plan, kept }: { p: Place; plan: Plan; kept: Place | null }) {
  const nights = daysIn(plan, p.city).length;
  const priceLabel = PRICE_LABEL[p.category];
  const stay = p.category === "stay";
  const toStops = stay ? minutesToStops(plan, p) : null;
  // From the hotel in the place's own city, by the mode a leg there would get.
  const fromHotel = isPlannable(p) ? leg(hotelOf(plan, p.city), p) : null;
  return (
    <dl className="facts">
      <Fact label={stay ? "Check in" : "Hours"} words>
        {p.hours}
      </Fact>
      {isPlannable(p) ? <Fact label="Typical visit">{f.minutes(p.visitMin)}</Fact> : null}
      {priceLabel ? (
        <Fact label={priceLabel}>
          {kept ? <Delta by={p.price - kept.price} unit="money" /> : null}
          {f.price(p.price)}
        </Fact>
      ) : null}
      {stay ? (
        <Fact label={`${nights} nights`}>
          {kept ? <Delta by={(p.price - kept.price) * nights} unit="money" /> : null}
          {f.money(p.price * nights)}
        </Fact>
      ) : null}
      {toStops !== null ? (
        <Fact
          label="To your stops"
          title={`The average trip from here to each of your ${CITY[p.city].name} stops`}
        >
          {kept ? <Delta by={toStops - (minutesToStops(plan, kept) ?? 0)} unit="min" /> : null}
          {f.minutes(toStops)} on average
        </Fact>
      ) : null}
      {fromHotel ? (
        <Fact label="From your hotel">
          {f.minutes(fromHotel.minutes)} {wordsFor(fromHotel).by}
        </Fact>
      ) : null}
    </dl>
  );
}

/** One figure, in the numeric face unless it is `words` (the hours). */
function Fact({
  label,
  title,
  words = false,
  children,
}: {
  label: string;
  title?: string;
  words?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <dt title={title}>{label}</dt>
      <dd className={words ? undefined : "num"}>{children}</dd>
    </div>
  );
}

/** "+$20" or "−6 min" against the kept place: dearer and further read as worse, cheaper and nearer as better. */
function Delta({ by, unit }: { by: number; unit: "money" | "min" }) {
  if (Math.round(by) === 0)
    return (
      <span className="delta" data-tone="same">
        same
      </span>
    );
  const abs = Math.abs(by);
  const text = unit === "money" ? f.money(abs) : f.minutes(Math.round(abs));
  return (
    <span className="delta" data-tone={by > 0 ? "worse" : "better"}>
      {by > 0 ? "+" : "−"}
      {text}
    </span>
  );
}
