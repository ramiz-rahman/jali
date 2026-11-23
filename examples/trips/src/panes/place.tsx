/**
 * One place, in detail: what it is, its hours, how long a visit takes and what it costs, where it sits in the plan,
 * and what is nearby on foot. It follows the map (presets.ts): select a pin, a stop or a result, and it shows it.
 * Keep it (the header's Keep) to compare two places side by side.
 */
import { useMemo, type KeyboardEvent } from "react";
import {
  AirplaneTiltIcon,
  CheckIcon,
  MapPinIcon,
  PlusIcon,
  QuestionIcon,
} from "@phosphor-icons/react";
import { definePane, useCommands, useJali, useJaliModel, type PaneProps } from "jali/react";
import { selectPlace } from "../actions";
import { addToDay, chooseDay, removeFromPlan, stayAt } from "../planning";
import { usePlan, useServices } from "../services";
import { CATEGORY_ONE, CITY_NAME, mustPlace, PLACES, placeById, type Place } from "../trip/places";
import { daysIn, dayWith, hotelOf, isHotel as isHotelOf } from "../trip/plan";
import { crossesRiver, haversineKm, leg, NEARBY_KM, type Leg, type Mode } from "../trip/travel";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Empty } from "../ui/parts";
import { Photo } from "../ui/photo";
import { photoOf } from "../trip/photos";

/**
 * A place's id, read from a link only if this trip has that place. A link from the old Lisbon version (or a typo)
 * names a place we don't have: Jali then treats the link as one it can't read and opens the layout instead.
 */
const placeId = (v: string | number | boolean) => (placeById(String(v)) ? String(v) : undefined);
const placeParams = { id: placeId };

/** "12 min by taxi". */
const BY: Record<Mode, string> = {
  walk: "on foot",
  transit: "by train or boat",
  taxi: "by taxi",
  scooter: "by scooter",
  flight: "by air",
};
/** How a leg goes, in words: the river ferry by its name. */
const by = (l: Leg) =>
  l.mode === "transit" && crossesRiver(mustPlace(l.from), mustPlace(l.to))
    ? "by ferry"
    : BY[l.mode];

function PlacePane({ params, node, inPeek, peek }: PaneProps<typeof placeParams>) {
  const p = placeById(params.id);
  if (!p)
    return (
      <Empty icon={<QuestionIcon size={22} aria-hidden />} title="This place isn't in the trip">
        Pick a pin on the map, or press / to find a place.
      </Empty>
    );
  return <PlaceBody p={p} from={inPeek ? undefined : node.id} peek={peek} inPeek={inPeek} />;
}

function PlaceBody({
  p,
  from,
  peek,
  inPeek,
}: {
  p: Place;
  from?: string;
  peek: PaneProps["peek"];
  inPeek: boolean;
}) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const planned = dayWith(plan, p.id);
  const index = planned ? planned.stops.indexOf(p.id) : -1;
  const hotel = hotelOf(plan, p.city);
  const isHotel = plan.hotels[p.city] === p.id;
  // From the hotel in the place's own city, by the mode a leg there would get.
  const fromHotel = p.category === "airport" || p.category === "stay" ? null : leg(hotel, p);
  const Icon = CATEGORY_ICON[p.category];

  const cityDays = daysIn(plan, p.city);
  const nights = cityDays.length;
  // A hotel kept in the pane beside: this one is read against it, figure by figure.
  const model = useJaliModel();
  const keptId = model.panes
    .filter((n) => n.id !== from && n.kept && n.ref.kind === "place" && n.where === "shown")
    .map((n) => String(n.ref.params.id))
    .find(
      (id) => id !== p.id && placeById(id)?.category === "stay" && placeById(id)?.city === p.city,
    );
  const kept = p.category === "stay" && keptId ? mustPlace(keptId) : null;
  const toStops = p.category === "stay" ? meanToStops(plan, p) : null;
  const add = () =>
    chooseDay(
      jali,
      services,
      planned ? `Move ${p.name} to…` : `Add ${p.name} to…`,
      (n) => addToDay(services, p.id, n),
      {
        city: p.city,
        except: planned?.n,
      },
    );

  useCommands(
    inPeek
      ? []
      : [
          p.category === "stay"
            ? {
                id: "stay",
                title: isHotel ? `Staying at ${p.name}` : `Stay at ${p.name}`,
                disabled: isHotel ? "It is your hotel already" : false,
                run: () => stayAt(services, p.id),
              }
            : {
                id: "add",
                title: planned ? `Move ${p.name} to another day…` : `Add ${p.name} to a day…`,
                run: add,
              },
          {
            id: "remove",
            title: `Remove ${p.name} from the plan`,
            disabled: planned ? false : "It is not in the plan",
            run: () => removeFromPlan(services, p.id),
          },
          {
            id: "map",
            title: `Show ${p.name} on the map`,
            run: () => selectPlace(jali, p.id),
          },
        ],
  );

  return (
    <article className="pane-body place" aria-label={p.name}>
      <div className="place-layout">
        <figure className="place-hero">
          <Photo id={p.id} size="large" alt={photoOf(p.id)?.alt ?? ""} credit eager />
          {photoOf(p.id)?.standIn ? (
            <figcaption className="place-standin" title={photoOf(p.id)?.standIn}>
              Stand-in photo
            </figcaption>
          ) : null}
        </figure>
        <header className="place-head">
          <p className="place-kind">
            <Icon size={16} weight="bold" aria-hidden />
            <span>
              {CATEGORY_ONE[p.category]}, {p.kind.toLowerCase()}
            </span>
            {p.fictional ? (
              <span className="tag" title="This business is made up for the example">
                Made up
              </span>
            ) : null}
          </p>
          <h3 className="place-name">{p.name}</h3>
          <p className="place-area">
            <MapPinIcon size={14} aria-hidden /> {p.area}, {CITY_NAME[p.city]}
          </p>
        </header>

        <div className="place-plan" data-day={planned?.n}>
          {p.category === "airport" ? (
            <p className="place-plan-line">
              <AirplaneTiltIcon size={16} weight="bold" aria-hidden /> The flight between Bangkok
              and Phuket is on Day {plan.days.find((d) => d.from)?.n}
            </p>
          ) : p.category === "stay" ? (
            isHotel ? (
              <p className="place-plan-line">
                <CheckIcon size={16} weight="bold" aria-hidden /> Your hotel in {CITY_NAME[p.city]}{" "}
                for {nights} nights
              </p>
            ) : (
              <>
                <p className="place-plan-line muted">
                  You are staying at {hotel.name} in {CITY_NAME[p.city]}.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => stayAt(services, p.id)}
                >
                  Stay here instead, {nights} nights
                </button>
              </>
            )
          ) : planned ? (
            <>
              <p className="place-plan-line">
                <DayMark n={planned.n} size="sm" />
                <span>
                  Day {planned.n}, stop {index + 1} of {planned.stops.length}
                  <span className="muted">, {f.day(planned.date)}</span>
                </span>
              </p>
              <div className="place-actions">
                <button type="button" className="btn" onClick={add}>
                  Move to another day
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  onClick={() => removeFromPlan(services, p.id)}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="place-plan-line muted">
                Not in the plan yet. Add it to a day in {CITY_NAME[p.city]}:
              </p>
              <div className="day-buttons" role="group" aria-label={`Add ${p.name} to a day`}>
                {cityDays.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    data-day={d.n}
                    title={`Add to Day ${d.n}: ${d.title}`}
                    onClick={() => addToDay(services, p.id, d.n)}
                  >
                    <PlusIcon size={12} weight="bold" aria-hidden />
                    <span className="sr-only">Add to Day </span>
                    {d.n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {kept ? (
          <p className="place-compare">
            Compared with <b>{kept.name}</b>, kept beside
          </p>
        ) : null}
        <dl className="facts">
          <div>
            <dt>{p.category === "stay" ? "Check in" : "Hours"}</dt>
            <dd>{p.category === "stay" ? p.hours.replace(/^check in /i, "") : p.hours}</dd>
          </div>
          {p.category !== "stay" && p.category !== "airport" ? (
            <div>
              <dt>Typical visit</dt>
              <dd className="num">{f.minutes(p.visitMin)}</dd>
            </div>
          ) : null}
          {p.category !== "airport" ? (
            <div>
              <dt>
                {p.category === "stay"
                  ? "A night"
                  : p.category === "food"
                    ? "A meal, each"
                    : "Ticket"}
              </dt>
              <dd className="num">
                {kept ? <Delta by={p.price - kept.price} unit="money" /> : null}
                {f.price(p.price)}
              </dd>
            </div>
          ) : null}
          {p.category === "stay" ? (
            <div>
              <dt>{nights} nights</dt>
              <dd className="num">
                {kept ? <Delta by={(p.price - kept.price) * nights} unit="money" /> : null}
                {f.money(p.price * nights)}
              </dd>
            </div>
          ) : null}
          {toStops !== null ? (
            <div>
              <dt title={`The average trip from here to each of your ${CITY_NAME[p.city]} stops`}>
                To your stops
              </dt>
              <dd className="num">
                {kept ? <Delta by={toStops - meanToStops(plan, kept)!} unit="min" /> : null}
                {f.minutes(toStops)} on average
              </dd>
            </div>
          ) : null}
          {fromHotel ? (
            <div>
              <dt>From your hotel</dt>
              <dd className="num">
                {f.minutes(fromHotel.minutes)} {by(fromHotel)}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="place-notes">{p.notes}</p>

        <Nearby p={p} from={from} peek={peek} inPeek={inPeek} />
      </div>
    </article>
  );
}

/** Nearby in the same city: on foot in Bangkok, a short ride in Phuket. Stays, food and sights, nearest first. */
function Nearby({
  p,
  from,
  peek,
  inPeek,
}: {
  p: Place;
  from?: string;
  peek: PaneProps["peek"];
  inPeek: boolean;
}) {
  const jali = useJali();
  const plan = usePlan();
  const near = useMemo(() => {
    const all = PLACES.filter((q) => q.id !== p.id && q.city === p.city && q.category !== "airport")
      .map((q) => ({ q, km: haversineKm(p, q), way: leg(p, q) }))
      .filter((x) => x.km <= NEARBY_KM[p.city])
      .sort((a, b) => a.km - b.km);
    return (["stay", "food", "sight"] as const)
      .map((c) => ({ c, rows: all.filter((x) => x.q.category === c).slice(0, 3) }))
      .filter((g) => g.rows.length);
  }, [p]);

  const onKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === " " && !inPeek) {
      e.preventDefault();
      peek(placeRef(id));
    }
  };

  if (!near.length) return null;
  return (
    <section className="nearby" aria-labelledby={`nearby-${p.id}`}>
      <h4 id={`nearby-${p.id}`}>{p.city === "bkk" ? "Nearby" : "Nearby by road"}</h4>
      {near.map(({ c, rows }) => (
        <div key={c} className="nearby-group">
          <h5>{c === "stay" ? "Stays" : c === "food" ? "Food" : "Sights"}</h5>
          <ul>
            {rows.map(({ q, way }) => {
              const on = dayWith(plan, q.id);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className="nearby-row"
                    onClick={() => selectPlace(jali, q.id, { from })}
                    onKeyDown={(e) => onKeyDown(e, q.id)}
                    title={inPeek ? undefined : "Show it. Space to peek."}
                  >
                    <Photo id={q.id} className="nearby-photo" />
                    <span className="nearby-name">{q.name}</span>
                    {on ? <DayMark n={on.n} size="sm" /> : null}
                    {isHotelOf(plan, q.id) ? <span className="tag">Your hotel</span> : null}
                    <span className="nearby-dist num">
                      {f.minutes(way.minutes)} {way.mode === "walk" ? "walk" : by(way)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

const placeRef = (id: string) => place({ id });

/** The average trip, in minutes, from a hotel to each stop planned in its city: how central it is to this plan. */
function meanToStops(plan: ReturnType<typeof usePlan>, hotel: Place): number | null {
  const stops = daysIn(plan, hotel.city).flatMap((d) => d.stops.map(mustPlace));
  if (!stops.length) return null;
  return Math.round(stops.reduce((s, q) => s + leg(hotel, q).minutes, 0) / stops.length);
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

export const place = definePane("place", {
  params: placeParams,
  title: ({ id }) => placeById(id)?.name ?? "Place",
  icon: MapPinIcon,
  width: { min: 300, comfortable: 340, max: 460 },
  height: { min: 260 },
  Component: PlacePane,
});
