/**
 * Find a place to stay, eat or see, in Bangkok or in Phuket: by category, by name, near the selected place or the
 * day's centre, and under a price (filters.ts). Distances are only ever measured within the city shown. The filters
 * are the pane's own state (`usePaneState`), so they survive a fold, a tab and a reload. The results show on the map
 * while this pane is on screen.
 */
import { useEffect, useId, useMemo, useRef } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { oneOf, optional } from "jali";
import { definePane, useCommands, useJali, usePaneState, type PaneProps } from "jali/react";
import { usePlan, useServices, type Results } from "../../state/services";
import { idOrNull } from "../../state/saved";
import { CITIES, CITY } from "../../trip/cities";
import { dayCentre } from "../../trip/nearby";
import { CATEGORY_LABEL, placeById } from "../../trip/places";
import { dayOf, standingOf } from "../../trip/plan";
import { useCursorList } from "../../ui/cursor-list";
import { Field } from "../../ui/field";
import { Empty } from "../../ui/empty";
import { Segmented } from "../../ui/segmented";
import { offerPlace, offerTitle } from "../../workspace/choosers";
import { selectPlace } from "../../workspace/hub";
import { KIND, placeRef } from "../../workspace/refs";
import { useMapDay, useSelectedPlace } from "../../workspace/use-hub";
import {
  inCity,
  NEAR,
  otherCity,
  PRESET_FILTERS,
  PRICES,
  readFilters,
  search,
  startFilters,
  WITHIN,
  type Filters,
} from "./filters";
import { ResultRow } from "./result-row";
import "./explore.css";

const exploreParams = { category: optional(oneOf("sight", "food", "stay")) };

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "stay", label: CATEGORY_LABEL.stay },
  { value: "food", label: CATEGORY_LABEL.food },
  { value: "sight", label: CATEGORY_LABEL.sight },
] as const;

function ExplorePane({ params, node, paused, peek, inPeek }: PaneProps<typeof exploreParams>) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const current = useSelectedPlace();
  const mapDay = useMapDay();
  // Start in the city of whatever is selected, else the first.
  const startCity = (current && placeById(current)?.city) || CITIES[0]!;
  const [filters, setFilters] = usePaneState<Filters>(
    "filters",
    startFilters(startCity, params.category),
    { parse: readFilters },
  );
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null, { parse: idOrNull });
  const listRef = useRef<HTMLUListElement>(null);
  const hint = useId();
  const set = (patch: Partial<Filters>) => setFilters((x) => ({ ...x, ...patch }));

  // What the distances are measured from. The selection comes from the map (and so from a link): a place this trip
  // doesn't have is no anchor.
  const picked = filters.near === "place" && current ? placeById(current) : undefined;
  const day = filters.near === "day" ? (dayOf(plan, mapDay) ?? plan.days[0]) : undefined;
  const near = picked
    ? { at: picked, label: picked.name }
    : day
      ? { at: dayCentre(plan, day), label: `the middle of Day ${day.n}` }
      : null;
  // Never a distance across the country: an anchor in the other city is no anchor here.
  const anchor = near && near.at.city === filters.city ? near : null;

  const rows = useMemo(
    () => search(filters, anchor?.at ?? null, filters.near === "place" ? current : null),
    [filters, anchor?.at.lat, anchor?.at.lng, current],
  );

  // The map shows these while the pane is on screen.
  const ids = useMemo(() => rows.map((r) => r.p.id), [rows]);
  useEffect(() => {
    if (inPeek) return;
    const mine = (r: Results | null) => (r?.pane === node.id ? null : r);
    if (paused) {
      services.results.set(mine);
      return;
    }
    services.results.set({ pane: node.id, ids });
    return () => services.results.set(mine);
  }, [ids, paused, node.id, services, inPeek]);

  const cur = (cursor && rows.find((r) => r.p.id === cursor)?.p) || null;
  const add = () => cur && offerPlace(jali, services, cur);
  const list = useCursorList({
    items: ids,
    cursor: cur?.id ?? null,
    onMove: (id) => {
      setCursor(id);
      selectPlace(jali, services, id, { from: node.id });
    },
    onOpen: (id) => selectPlace(jali, services, id, { from: node.id, open: true }),
    keepInView: true,
    actions: [
      {
        id: "add",
        title: cur ? offerTitle(plan, cur) : "Add to a day…",
        keys: ["A"],
        disabled: cur ? false : "Pick a place first",
        run: add,
      },
      {
        id: "peek",
        title: cur ? `Peek at ${cur.name}` : "Peek",
        keys: ["Space"],
        disabled: cur ? false : "Pick a place first",
        run: () => cur && peek(placeRef(cur.id)),
      },
    ],
  });

  const other = otherCity(filters.city);
  useCommands(
    inPeek
      ? []
      : [
          ...list.commands,
          { id: "stays", title: "Explore stays", run: () => set(PRESET_FILTERS.stays()) },
          {
            id: "food",
            title: "Explore food nearby",
            run: () => set(PRESET_FILTERS.food(filters)),
          },
          {
            id: "city",
            title: `Explore ${CITY[other].name}`,
            run: () => set({ city: other }),
          },
          { id: "clear", title: "Clear the filters", run: () => set(PRESET_FILTERS.clear()) },
        ],
  );

  return (
    <div className="pane-body explore">
      <div className="explore-filters">
        <label className="search-field">
          <MagnifyingGlassIcon size={16} aria-hidden />
          <span className="sr-only">Search by name or area</span>
          <input
            type="search"
            value={filters.text}
            placeholder="Name, area or kind"
            onChange={(e) => set({ text: e.target.value })}
            onKeyDown={(e) => {
              // Down from the field to the first result (focusing it moves the cursor there).
              if (e.key !== "ArrowDown") return;
              const first = listRef.current?.querySelector<HTMLElement>(".result-main");
              if (!first) return;
              e.preventDefault();
              first.focus();
            }}
          />
        </label>
        <Segmented
          label="City"
          value={filters.city}
          onChange={(city) => set(inCity(filters, city))}
          options={CITIES.map((c) => ({ value: c, label: CITY[c].name }))}
        />
        <Segmented
          label="Category"
          value={filters.category}
          onChange={(category) => set({ category })}
          options={CATEGORIES}
        />
        <div className="explore-row">
          <Field
            label="Near"
            value={filters.near}
            onChange={(near) => set({ near })}
            options={NEAR}
          />
          <Field
            label="Within"
            value={String(filters.within)}
            disabled={filters.near === "anywhere"}
            onChange={(within) => set({ within: Number(within) })}
            options={WITHIN[filters.city].map((w) => ({ value: String(w.value), label: w.label }))}
          />
          <Field
            label="Price"
            value={String(filters.maxPrice)}
            onChange={(maxPrice) => set({ maxPrice: Number(maxPrice) })}
            options={PRICES.map((p) => ({ value: String(p.value), label: p.label }))}
          />
        </div>
        <p className="explore-count muted" aria-live="polite">
          {rows.length} {rows.length === 1 ? "place" : "places"} in {CITY[filters.city].name}
          {anchor ? `, nearest ${anchor.label} first` : ""}
          {near && !anchor
            ? `; ${near.label} is in ${CITY[near.at.city].name}, so no distances`
            : ""}
        </p>
      </div>
      {rows.length ? (
        // A list of results, each a button with the add button beside it, never inside it: one Tab stop for the
        // list (the cursor's row), the arrows and J/K between rows, and A to add (the + is for the pointer).
        <ul
          ref={listRef}
          className="results"
          aria-label="Places"
          aria-describedby={hint}
          {...list.listProps}
        >
          {rows.map((r) => (
            <ResultRow
              key={r.p.id}
              result={r}
              standing={standingOf(plan, r.p.id)}
              cursor={r.p.id === cur?.id}
              selected={r.p.id === current}
              row={list.row(r.p.id)}
              onAdd={() => offerPlace(jali, services, r.p)}
            />
          ))}
        </ul>
      ) : (
        <Empty title="Nothing matches">Try a wider distance, any price, or another category.</Empty>
      )}
      <p id={hint} className="sr-only">
        Up and down arrows move between places. A adds the place to a day, or stays there. Enter
        opens it. Space peeks.
      </p>
    </div>
  );
}

export const explore = definePane(KIND.explore, {
  params: exploreParams,
  title: ({ category }) =>
    category === "stay" ? "Find a stay" : category === "food" ? "Find food" : "Explore",
  icon: MagnifyingGlassIcon,
  width: { min: 300, comfortable: 360, max: 480 },
  height: { min: 320 },
  holdWhileResizing: true,
  Component: ExplorePane,
});
