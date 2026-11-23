/** The selected place, over the bottom of the map, where no place pane says it already: what it is, and the next step. */
import { XIcon } from "@phosphor-icons/react";
import { useJali } from "jali/react";
import { useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import { isPlannable, type Place } from "../../trip/places";
import { dayToOffer, standingOf, type Plan, type Standing } from "../../trip/plan";
import * as f from "../../ui/format";
import { DayMark } from "../../ui/day-mark";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/photo";
import { offerLabel } from "../../workspace/choosers";
import { selectPlace } from "../../workspace/hub";

/** Where the place stands in the plan, in the card's words. */
function whereText(s: Standing, p: Place): string {
  switch (s.kind) {
    case "stop":
      return `Day ${s.day.n}, stop ${s.index + 1}`;
    case "hotel":
      return `Your hotel in ${CITY[p.city].name}`;
    case "unplanned":
      return "Not planned";
  }
}

export function PlaceCard({
  p,
  dayN,
  plan,
  from,
}: {
  p: Place;
  dayN: number;
  plan: Plan;
  from: string;
}) {
  const jali = useJali();
  const services = useServices();
  const standing = standingOf(plan, p.id);
  const on = standing.kind === "stop" ? standing.day : undefined;
  const Icon = CATEGORY_ICON[p.category];
  const target = dayToOffer(plan, p, dayN);
  return (
    <div className="map-card" aria-label={`Selected: ${p.name}`} role="region">
      <Photo id={p.id} className="map-card-photo" />
      <div className="map-card-text">
        <p className="map-card-kind">
          <Icon size={14} weight="bold" aria-hidden /> {p.kind}, {p.area}
          {p.fictional ? <span className="tag">Made up</span> : null}
        </p>
        <p className="map-card-name">{p.name}</p>
        <p className="map-card-meta">
          {on ? <DayMark n={on.n} size="sm" /> : null}
          <span className="map-card-where">{whereText(standing, p)}</span>
          <span className="num">{f.price(p.price)}</span>
        </p>
      </div>
      <button
        type="button"
        className="map-card-close icon-btn"
        aria-label="Clear the selection"
        title="Clear the selection"
        onClick={() => jali.actions.select(from, null)}
      >
        <XIcon size={16} aria-hidden />
      </button>
      <div className="map-card-actions">
        {isPlannable(p) && target && on?.n !== target.n ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => services.changes.addToDay(p.id, target.n)}
          >
            {offerLabel(standing, target.n)}
          </button>
        ) : null}
        <button
          type="button"
          className="btn"
          onClick={() => selectPlace(jali, services, p.id, { from, open: true })}
        >
          Details
        </button>
      </div>
    </div>
  );
}
