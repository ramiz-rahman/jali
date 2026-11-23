/**
 * The foot of a day: what else is close to its route and not planned yet, nearest first, with a photo and the way
 * there, each one press from being on the day (trip/nearby.ts). "Find a place" asks for anything else in the city.
 */
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { useJali, usePane } from "jali/react";
import { usePlan, useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import { wordsFor } from "../../trip/modes";
import { closeToDay } from "../../trip/nearby";
import { isPlannable } from "../../trip/places";
import type { Day } from "../../trip/plan";
import * as f from "../../ui/format";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/photo";
import { choosePlace } from "../../workspace/choosers";
import { selectPlace } from "../../workspace/hub";

export function Suggestions({ day }: { day: Day }) {
  const jali = useJali();
  const services = useServices();
  const from = usePane().node.id;
  const near = closeToDay(usePlan(), day);
  const city = CITY[day.city].name;
  const add = (id: string) => services.changes.addToDay(id, day.n);
  const find = () =>
    choosePlace(jali, services, `Add to Day ${day.n}…`, (q) => add(q.id), {
      only: (q) => q.city === day.city && isPlannable(q),
      placeholder: `A place in ${city}`,
      hint: (q) => `${q.kind}, ${q.area}`,
    });
  return (
    // Not a landmark: every day has this part, under the same heading. The heading is how a screen reader finds it.
    <section className="day-more">
      <h4>Close to this day</h4>
      {near.length ? (
        <ul>
          {near.map(({ q, by, way }) => {
            const Icon = CATEGORY_ICON[q.category];
            return (
              <li key={q.id} className="day-more-row">
                <button
                  type="button"
                  className="day-more-main"
                  onClick={() => selectPlace(jali, services, q.id, { from })}
                  title={`Show ${q.name}`}
                >
                  <Photo id={q.id} className="day-more-photo" />
                  <span className="day-more-text">
                    <span className="day-more-name">{q.name}</span>
                    <span className="day-more-meta">
                      <Icon size={12} aria-hidden /> {q.kind}, {f.minutes(way.minutes)}{" "}
                      {wordsFor(way).leg} from {by.name}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="day-more-add"
                  aria-label={`Add ${q.name} to Day ${day.n}`}
                  title={`Add to Day ${day.n}`}
                  onClick={() => add(q.id)}
                >
                  <PlusIcon size={16} weight="bold" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <button type="button" className="btn btn-quiet day-more-find" onClick={find}>
        <MagnifyingGlassIcon size={15} aria-hidden /> Find a place in {city} to add
      </button>
    </section>
  );
}
