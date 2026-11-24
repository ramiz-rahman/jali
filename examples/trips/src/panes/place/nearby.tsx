/** A place's neighbours in its own city (trip/nearby.ts): stays, food and sights, the three nearest of each. */
import { useMemo, type KeyboardEvent } from "react";
import { useJali, usePane } from "jali-layout/react";
import { usePlan, useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import { wordsFor } from "../../trip/modes";
import { neighbours } from "../../trip/nearby";
import { CATEGORY_LABEL, type Place } from "../../trip/places";
import { standingOf } from "../../trip/plan";
import * as f from "../../ui/format";
import { DayMark } from "../../ui/atoms/day-mark";
import { Photo } from "../../ui/molecules/photo";
import { photoOf } from "../../trip/photos";
import { selectPlace } from "../../workspace/hub";
import { placeRef } from "../../workspace/refs";

const GROUPS = ["stay", "food", "sight"] as const;

export function Nearby({ p }: { p: Place }) {
  const jali = useJali();
  const services = useServices();
  const { node, peek, inPeek } = usePane();
  const from = inPeek ? undefined : node.id;
  const plan = usePlan();
  const groups = useMemo(() => {
    const all = neighbours(p);
    return GROUPS.map((c) => ({
      c,
      rows: all.filter((x) => x.q.category === c).slice(0, 3),
    })).filter((g) => g.rows.length);
  }, [p]);

  const onKeyDown = (e: KeyboardEvent, id: string) => {
    if (e.key === " " && !inPeek) {
      e.preventDefault();
      peek(placeRef(id));
    }
  };

  if (!groups.length) return null;
  return (
    <section className="nearby" aria-labelledby={`nearby-${p.id}`}>
      <h4 id={`nearby-${p.id}`}>{CITY[p.city].nearbyTitle}</h4>
      {groups.map(({ c, rows }) => (
        <div key={c} className="nearby-group">
          <h5>{CATEGORY_LABEL[c]}</h5>
          <ul>
            {rows.map(({ q, way }) => {
              const standing = standingOf(plan, q.id);
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className="nearby-row"
                    onClick={() => selectPlace(jali, services, q.id, { from })}
                    onKeyDown={(e) => onKeyDown(e, q.id)}
                    title={inPeek ? undefined : "Show it. Space to peek."}
                  >
                    <Photo photo={photoOf(q.id)} className="nearby-photo" />
                    <span className="nearby-name">{q.name}</span>
                    {standing.kind === "stop" ? <DayMark n={standing.day.n} size="sm" /> : null}
                    {standing.kind === "hotel" ? <span className="tag">Your hotel</span> : null}
                    <span className="nearby-dist num">
                      {f.minutes(way.minutes)} {wordsFor(way).leg}
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
