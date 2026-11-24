/**
 * One place, in detail: what it is, its hours, how long a visit takes and what it costs, where it sits in the plan,
 * and what is nearby. It follows the map (workspace/presets.ts): select a pin, a stop or a result, and it shows it.
 * Keep it (the header's Keep) to compare two hotels side by side.
 */
import { MapPinIcon, QuestionIcon } from "@phosphor-icons/react";
import type { JaliModel, NodeId, PaneCommand } from "jali-layout";
import {
  definePane,
  useCommands,
  useJali,
  useJaliModel,
  usePane,
  type PaneProps,
} from "jali-layout/react";
import { usePlan, useServices } from "../../state/services";
import { CITY } from "../../trip/cities";
import { photoOf } from "../../trip/photos";
import { CATEGORY_ONE, isPlannable, placeById, type Place } from "../../trip/places";
import { dayWith, isHotel } from "../../trip/plan";
import { Empty } from "../../ui/atoms/empty";
import { CATEGORY_ICON } from "../../ui/icons";
import { Photo } from "../../ui/molecules/photo";
import { offerPlace, offerTitle } from "../../workspace/choosers";
import { keptPlaces, selectPlace } from "../../workspace/hub";
import { KIND } from "../../workspace/refs";
import { Facts } from "./facts";
import { Nearby } from "./nearby";
import { PlanLine } from "./plan-line";
import "./place.css";

/**
 * A place's id, read from a link only if this trip has that place. A link from the old Lisbon version (or a typo)
 * names a place we don't have: Jali then treats the link as one it can't read and opens the layout instead.
 */
const placeId = (v: string | number | boolean) => (placeById(String(v)) ? String(v) : undefined);
const placeParams = { id: placeId };

function PlacePane({ params }: PaneProps<typeof placeParams>) {
  const p = placeById(params.id);
  if (!p)
    return (
      <Empty icon={<QuestionIcon size={22} aria-hidden />} title="This place isn't in the trip">
        Pick a pin on the map, or press / to find a place.
      </Empty>
    );
  return <PlaceBody p={p} />;
}

/** The hotel kept in a pane beside (Keep), in the same city, that the hotel `p` is read against; else null. */
function keptToCompare(m: JaliModel, p: Place, except?: NodeId): Place | null {
  if (p.category !== "stay") return null;
  const kept = keptPlaces(m, except).map(placeById);
  return kept.find((q) => q && q.id !== p.id && q.category === "stay" && q.city === p.city) ?? null;
}

function PlaceBody({ p }: { p: Place }) {
  const jali = useJali();
  const services = useServices();
  const { node, inPeek } = usePane();
  const plan = usePlan();
  const planned = dayWith(plan, p.id);
  const Icon = CATEGORY_ICON[p.category];
  const photo = photoOf(p.id);
  // A hotel kept in the pane beside, in the same city: this one is read against it, figure by figure.
  const kept = keptToCompare(useJaliModel(), p, inPeek ? undefined : node.id);
  const offer = () => offerPlace(jali, services, p);

  const yours = isHotel(plan, p.id);
  const commands: (PaneCommand | false)[] = [
    p.category === "stay" && {
      id: "stay",
      title: yours ? `Staying at ${p.name}` : `Stay at ${p.name}`,
      disabled: yours ? "It is your hotel already" : false,
      run: offer,
    },
    isPlannable(p) && { id: "add", title: offerTitle(plan, p), run: offer },
    {
      id: "remove",
      title: `Remove ${p.name} from the plan`,
      disabled: planned ? false : "It is not in the plan",
      run: () => services.changes.removeFromPlan(p.id),
    },
    {
      id: "map",
      title: `Show ${p.name} on the map`,
      run: () => selectPlace(jali, services, p.id),
    },
  ];
  useCommands(inPeek ? [] : commands.filter((c): c is PaneCommand => !!c));

  return (
    <article className="pane-body place" aria-label={p.name}>
      <div className="place-layout">
        <figure className="place-hero">
          <Photo photo={photoOf(p.id)} size="large" alt={photo?.alt ?? ""} credit eager />
          {photo?.standIn ? (
            <figcaption className="place-standin" title={photo.standIn}>
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
            <MapPinIcon size={14} aria-hidden /> {p.area}, {CITY[p.city].name}
          </p>
        </header>

        <PlanLine p={p} plan={plan} />

        {kept ? (
          <p className="place-compare">
            Compared with <b>{kept.name}</b>, kept beside
          </p>
        ) : null}
        <Facts p={p} plan={plan} kept={kept} />

        <p className="place-notes">{p.notes}</p>

        <Nearby p={p} />
      </div>
    </article>
  );
}

export const place = definePane(KIND.place, {
  params: placeParams,
  title: ({ id }) => placeById(id)?.name ?? "Place",
  icon: MapPinIcon,
  width: { min: 300, comfortable: 340, max: 460 },
  height: { min: 260 },
  Component: PlacePane,
});
