/**
 * The map pane: MapLibre GL on OpenFreeMap's free vector tiles (controller.ts), with the day's stops numbered in
 * order, the route drawn between them, the hotel, and candidates: what Explore shows, or else what is near the
 * selected place. Over it: the days to pick from, the day's summary, the route key, and a card for the selected place.
 *
 * What it shows with Jali:
 *  - It wants room: `width.min` 360, `comfortable` 640, and it resizes with its box (ResizeObserver, `map.resize()`),
 *    as dividers move and panes fold.
 *  - While Jali says it is `paused` (behind a tab, folded, tucked, behind a maximised pane) it does nothing.
 *  - It is a list, and the hub (workspace/hub.ts): a pin selects its place (`select`), and the place pane follows it.
 *    A place selected anywhere else is handed to the map's selection, and the map flies to it.
 *  - It follows the overview: `follow` turns a selected day into `{ day }`.
 *  - Arrow keys pan it (MapLibre claims them with preventDefault, which Jali respects); ⌘K, F6 and Esc still reach
 *    the workspace.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MapTrifoldIcon, WarningCircleIcon } from "@phosphor-icons/react";
import {
  definePane,
  useCommands,
  useJali,
  useJaliModel,
  useJaliTheme,
  type PaneProps,
} from "jali/react";
import { useServices, useSummary } from "../../state/services";
import { useStore } from "../../state/store";
import { CITY } from "../../trip/cities";
import { wordsFor } from "../../trip/modes";
import { candidatesNear } from "../../trip/nearby";
import { placeById } from "../../trip/places";
import { dayNumber } from "../../trip/plan";
import type { DaySummary } from "../../trip/summary";
import * as f from "../../ui/format";
import { Segmented } from "../../ui/atoms/segmented";
import { isShown, placeShownBeside, selectPlace } from "../../workspace/hub";
import { dayNumberOf, KIND, mapRef, WHOLE_TRIP } from "../../workspace/refs";
import { useSelectedPlace } from "../../workspace/use-hub";
import { TripMap, type Scene } from "./controller";
import { badgesFor, cardFor, framePoints, keyModes, pinsFor, routesFor } from "./features";
import { PlaceCard } from "./place-card";
import "./map.css";

/** A day of the trip, or the whole trip (0). */
const mapParams = {
  day: (v: string | number | boolean) => (Number(v) === WHOLE_TRIP ? WHOLE_TRIP : dayNumber(v)),
};

function MapPane({ params, paused, node, inPeek }: PaneProps<typeof mapParams>) {
  const jali = useJali();
  const services = useServices();
  const summary = useSummary();
  const { plan } = summary;
  const theme = useJaliTheme();
  const selected = useSelectedPlace();
  const model = useJaliModel();
  const results = useStore(services.results, (r) => r);
  const reveal = useStore(services.reveal, (r) => r);
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  // Explore's results count only while its pane is on screen; else, what is near the selected place.
  const explored = results && isShown(model, results.pane) ? results.ids : null;
  const candidates = useMemo(() => {
    if (explored) return explored;
    const at = selected ? placeById(selected) : undefined;
    return at ? candidatesNear(plan, at) : [];
  }, [explored, selected, plan]);
  const scene = useScene({ day: params.day, theme, paused, candidates, selected, reveal });
  const tm = useTripMap(box, scene, inPeek, {
    pick: (id) => selectPlace(jali, services, id, { from: node.id }),
    failed: setFailed,
  });

  const showDay = (n: number) => jali.actions.openHere(node.id, mapRef(n));
  useCommands(
    inPeek
      ? []
      : [
          { id: "frame", title: "Frame the day on the map", run: () => tm.current?.frame() },
          {
            id: "all",
            title: params.day ? "Show every day on the map" : "Showing every day",
            disabled: params.day ? false : "Showing every day already",
            run: () => showDay(WHOLE_TRIP),
          },
        ],
  );

  if (inPeek) return <div className="pane-body map-peek">Open the map in a pane to see it.</div>;

  const day = summary.day(params.day);
  const card = cardFor(selected, day, placeShownBeside(model, node.id));
  return (
    <div className="pane-body map" data-paused={paused || undefined}>
      <div ref={box} className="map-canvas" />
      <div className="map-top">
        <Segmented
          className="map-days"
          label="Days on the map"
          value={params.day}
          onChange={showDay}
          options={[
            { value: WHOLE_TRIP, label: "All", title: "Every day" },
            ...plan.days.map((d) => ({
              value: d.n,
              label: (
                <span data-day={d.n} className="map-day-opt">
                  {d.n}
                </span>
              ),
              title: `Day ${d.n}: ${d.title}`,
            })),
          ]}
        />
        {day ? <DaySummaryLine summary={day} /> : null}
      </div>
      <RouteKey day={day} />
      {card ? <PlaceCard p={card} dayN={params.day} plan={plan} from={node.id} /> : null}
      {failed ? (
        <div className="map-failed" role="status">
          <WarningCircleIcon size={22} aria-hidden />
          <p>
            <b>The map tiles didn't load.</b> Your plan, the lists and the budget all work without
            them. Check the connection and reload to try again.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** The scene for the map of `day`: each part worked out again only when what it is made from changes. */
function useScene({
  day,
  theme,
  paused,
  candidates,
  selected,
  reveal,
}: Pick<Scene, "day" | "theme" | "paused" | "selected" | "reveal"> & {
  candidates: readonly string[];
}): Scene {
  const summary = useSummary();
  const { plan } = summary;
  const pins = useMemo(
    () => pinsFor(plan, day, candidates, selected),
    [plan, day, candidates, selected],
  );
  const routes = useMemo(() => routesFor(summary, day, theme), [summary, day, theme]);
  const badges = useMemo(() => badgesFor(plan), [plan]);
  const framing = useMemo(() => framePoints(summary, day), [summary, day]);
  return { theme, paused, day, routes, pins, selected, badges, framing, reveal };
}

/**
 * The map in the pane's box: made once, when the pane is not a peek, and given the scene after every render (after
 * the pane's own: the card and the summary over the map are in the page by then). Returns it, for the commands.
 */
function useTripMap(
  box: RefObject<HTMLDivElement | null>,
  scene: Scene,
  inPeek: boolean,
  events: { pick: (id: string) => void; failed: (failed: boolean) => void },
) {
  const tm = useRef<TripMap | null>(null);
  const latest = useRef(events);
  latest.current = events;
  useEffect(() => {
    if (!box.current || inPeek) return;
    const map = new TripMap(
      box.current,
      { theme: scene.theme, paused: scene.paused },
      { pick: (id) => latest.current.pick(id), failed: (f) => latest.current.failed(f) },
    );
    tm.current = map;
    return () => {
      map.destroy();
      tm.current = null;
    };
    // Made once per mount: the scene reaches it through `sync`, below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPeek]);
  useEffect(() => tm.current?.sync(scene));
  return tm;
}

function DaySummaryLine({ summary: { day, totals } }: { summary: DaySummary }) {
  return (
    <p className="map-summary">
      <b>{day.title}</b>
      <span>
        {CITY[day.city].name}, {day.stops.length} stops, {f.minutes(totals.travelMin)} travelling
      </span>
    </p>
  );
}

/** The route key: the modes this map's routes can take (a day in one city, its own; the trip or the transfer day, all). */
function RouteKey({ day }: { day: DaySummary | undefined }) {
  return (
    <ul className="map-legend" aria-label="Route key">
      {keyModes(day?.day).map((mode) => (
        <li key={mode} data-mode={mode}>
          {wordsFor({ mode }).key}
        </li>
      ))}
    </ul>
  );
}

export const map = definePane(KIND.map, {
  params: mapParams,
  // A list of places: with none selected, it starts on the one its following place pane shows.
  selects: KIND.place,
  // The overview selects a day; the map that follows it shows that day.
  follow: (selected) => {
    const n = dayNumberOf(selected);
    return n === null ? undefined : { day: n };
  },
  title: ({ day }) => (day ? `Map of Day ${day}` : "Trip map"),
  icon: MapTrifoldIcon,
  width: { min: 360, comfortable: 640 },
  height: { min: 300 },
  // Stacked on a phone, the map goes on top: the place, or the day, reads below it.
  phone: { place: "top" },
  Component: MapPane,
});
