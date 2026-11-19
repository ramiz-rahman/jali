/**
 * One place, in detail: what it is, its hours, how long a visit takes and what it costs, where it sits in the plan,
 * and what is nearby on foot. It follows the map (presets.ts): select a pin, a stop or a result, and it shows it.
 * Keep it (the header's Keep) to compare two places side by side.
 */
import { useMemo, type KeyboardEvent } from "react";
import { CheckIcon, MapPinIcon, PlusIcon, QuestionIcon } from "@phosphor-icons/react";
import { definePane, useCommands, useJali, type PaneProps } from "@jali/react";
import { selectPlace } from "../actions";
import { addToDay, chooseDay, removeFromPlan, stayAt } from "../planning";
import { usePlan, useServices } from "../services";
import { CATEGORY_ONE, PLACES, placeById, type Place } from "../trip/places";
import { dayWith } from "../trip/plan";
import { haversineKm, travel, WALK_UP_TO_KM } from "../trip/travel";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Empty } from "../ui/parts";

const placeParams = { id: String };

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
  const hotel = placeById(plan.hotel)!;
  const isHotel = plan.hotel === p.id;
  const fromHotel = travel(haversineKm(hotel, p), haversineKm(hotel, p) <= WALK_UP_TO_KM ? "walk" : "transit");
  const Icon = CATEGORY_ICON[p.category];

  const add = () => chooseDay(jali, services, `Add ${p.name} to…`, (n) => addToDay(services, p.id, n));

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
          <MapPinIcon size={14} aria-hidden /> {p.area}, {plan.city}
        </p>
      </header>

      <div className="place-plan" data-day={planned?.n}>
        {p.category === "stay" ? (
          isHotel ? (
            <p className="place-plan-line">
              <CheckIcon size={16} weight="bold" aria-hidden /> Your hotel for all {plan.days.length} nights
            </p>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => stayAt(services, p.id)}>
              Stay here
            </button>
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
              <button type="button" className="btn btn-quiet" onClick={() => removeFromPlan(services, p.id)}>
                Remove
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="place-plan-line muted">Not in the plan yet. Add it to a day:</p>
            <div className="day-buttons" role="group" aria-label={`Add ${p.name} to a day`}>
              {plan.days.map((d) => (
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

      <dl className="facts">
        <div>
          <dt>Hours</dt>
          <dd>{p.hours}</dd>
        </div>
        {p.category !== "stay" ? (
          <div>
            <dt>Typical visit</dt>
            <dd className="num">{f.minutes(p.visitMin)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{p.category === "stay" ? "A night" : p.category === "food" ? "A meal, each" : "Ticket"}</dt>
          <dd className="num">{f.price(p.price)}</dd>
        </div>
        {p.category === "stay" ? (
          <div>
            <dt>{plan.days.length} nights</dt>
            <dd className="num">{f.money(p.price * plan.days.length)}</dd>
          </div>
        ) : null}
        {!isHotel ? (
          <div>
            <dt>From your hotel</dt>
            <dd className="num">
              {f.minutes(fromHotel.minutes)} {fromHotel.mode === "walk" ? "on foot" : "by transit"}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="place-notes">{p.notes}</p>

      <Nearby p={p} from={from} peek={peek} inPeek={inPeek} />
    </article>
  );
}

/** Within walking distance: stays, food and sights, nearest first. */
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
    const all = PLACES.filter((q) => q.id !== p.id)
      .map((q) => ({ q, km: haversineKm(p, q) }))
      .filter((x) => x.km <= WALK_UP_TO_KM)
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
      <h4 id={`nearby-${p.id}`}>Nearby on foot</h4>
      {near.map(({ c, rows }) => (
        <div key={c} className="nearby-group">
          <h5>{c === "stay" ? "Stays" : c === "food" ? "Food" : "Sights"}</h5>
          <ul>
            {rows.map(({ q, km }) => {
              const on = dayWith(plan, q.id);
              const Icon = CATEGORY_ICON[q.category];
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className="nearby-row"
                    onClick={() => selectPlace(jali, q.id, { from })}
                    onKeyDown={(e) => onKeyDown(e, q.id)}
                    title={inPeek ? undefined : "Show it. Space to peek."}
                  >
                    <Icon size={15} aria-hidden className="nearby-icon" />
                    <span className="nearby-name">{q.name}</span>
                    {on ? <DayMark n={on.n} size="sm" /> : null}
                    {plan.hotel === q.id ? <span className="tag">Your hotel</span> : null}
                    <span className="nearby-dist num">{f.minutes(travel(km, "walk").minutes)} walk</span>
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

export const place = definePane("place", {
  params: placeParams,
  title: ({ id }) => placeById(id)?.name ?? "Place",
  icon: MapPinIcon,
  width: { min: 300, comfortable: 340, max: 460 },
  height: { min: 260 },
  Component: PlacePane,
});

