/**
 * Find a place to stay, eat or see: by category, by name, near the selected place or the day's centre, and under a
 * price. The filters are the pane's own state (`usePaneState`), so they survive a fold, a tab and a reload. The
 * results show on the map while this pane is on screen.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { keyHint } from "@jali/core";
import { definePane, oneOf, optional, useCommands, useJali, useJaliState, usePaneState, type PaneProps } from "@jali/react";
import { selectPlace } from "../actions";
import { addToDay, chooseDay, stayAt } from "../planning";
import { usePlan, useServices } from "../services";
import { useCurrent } from "../selection";
import { CATEGORY_LABEL, PLACES, placeById, type Category, type Place } from "../trip/places";
import { dayWith, type Plan } from "../trip/plan";
import { haversineKm, travel, WALK_UP_TO_KM } from "../trip/travel";
import * as f from "../ui/format";
import { CATEGORY_ICON, DayMark, Empty, Segmented } from "../ui/parts";
import { place } from "./place";

type Near = "place" | "day" | "anywhere";
interface Filters {
  category: Category | "all";
  text: string;
  near: Near;
  /** km, 0 for any distance. */
  within: number;
  /** €, -1 for any price. */
  maxPrice: number;
}

const exploreParams = { category: optional(oneOf("sight", "food", "stay")) };

const WITHIN = [
  { value: 0.6, label: "600 m" },
  { value: 1.2, label: "1.2 km" },
  { value: 2.5, label: "2.5 km" },
  { value: 0, label: "Any" },
];
const PRICES = [
  { value: -1, label: "Any" },
  { value: 0, label: "Free" },
  { value: 10, label: "Up to €10" },
  { value: 25, label: "Up to €25" },
  { value: 120, label: "Up to €120" },
  { value: 150, label: "Up to €150" },
];

/** The centre of a day: the average of its stops, or the hotel for an empty day. */
function dayCentre(plan: Plan, n: number): { lat: number; lng: number } {
  const stops = (plan.days.find((d) => d.n === n)?.stops ?? []).map((id) => placeById(id)!);
  if (!stops.length) return placeById(plan.hotel)!;
  return {
    lat: stops.reduce((s, p) => s + p.lat, 0) / stops.length,
    lng: stops.reduce((s, p) => s + p.lng, 0) / stops.length,
  };
}

function ExplorePane({ params, node, paused, focused, peek, inPeek }: PaneProps<typeof exploreParams>) {
  const jali = useJali();
  const services = useServices();
  const plan = usePlan();
  const current = useCurrent();
  const [filters, setFilters] = usePaneState<Filters>("filters", {
    category: params.category ?? "all",
    text: "",
    near: params.category === "stay" ? "anywhere" : "place",
    within: params.category === "stay" ? 0 : 1.2,
    maxPrice: -1,
  });
  const [cursor, setCursor] = usePaneState<string | null>("cursor", null);
  const listRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<Filters>) => setFilters((x) => ({ ...x, ...patch }));

  // The day the map shows, for "near the day's centre".
  const mapDay = useJaliState((s) => {
    const m = s.layout.root && jali.model().panes.find((p) => p.ref.kind === "map");
    return Number(m?.ref.params.day ?? 0) || 1;
  });
  const anchor =
    filters.near === "place" && current
      ? { at: placeById(current)!, label: placeById(current)!.name }
      : filters.near === "day"
        ? { at: dayCentre(plan, mapDay), label: `the middle of Day ${mapDay}` }
        : null;

  const rows = useMemo(() => {
    const text = filters.text.trim().toLowerCase();
    return PLACES.filter((p) => filters.category === "all" || p.category === filters.category)
      .filter((p) => !text || `${p.name} ${p.area} ${p.kind}`.toLowerCase().includes(text))
      .filter((p) => filters.maxPrice < 0 || p.price <= filters.maxPrice)
      .map((p) => ({ p, km: anchor ? haversineKm(anchor.at, p) : null }))
      .filter((r) => !anchor || !filters.within || (r.km ?? 0) <= filters.within)
      .filter((r) => !(filters.near === "place" && r.p.id === current))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.p.name.localeCompare(b.p.name));
  }, [filters, anchor?.at, current]);

  // The map shows these while the pane is on screen.
  const ids = rows.map((r) => r.p.id).join();
  useEffect(() => {
    if (inPeek) return;
    if (paused) {
      services.results.set((r) => (r?.pane === node.id ? null : r));
      return;
    }
    services.results.set({ pane: node.id, ids: ids ? ids.split(",") : [] });
    return () => services.results.set((r) => (r?.pane === node.id ? null : r));
  }, [ids, paused, node.id, services, inPeek]);

  const at = rows.findIndex((r) => r.p.id === cursor);
  const cur = at >= 0 ? rows[at]!.p : null;
  const moveTo = (id: string) => {
    setCursor(id);
    selectPlace(jali, id, { from: node.id });
  };
  useEffect(() => {
    listRef.current?.querySelector(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const add = (p: Place) =>
    p.category === "stay"
      ? stayAt(services, p.id)
      : chooseDay(jali, services, `Add ${p.name} to…`, (n) => addToDay(services, p.id, n));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
    const k = e.key;
    const go = (i: number) => moveTo(rows[Math.max(0, Math.min(rows.length - 1, i))]!.p.id);
    if (k === "ArrowDown" || k === "j") go(at + 1);
    else if (k === "ArrowUp" || k === "k") go(at - 1);
    else if (k === "Home") go(0);
    else if (k === "End") go(rows.length - 1);
    else if (k === " " && cur) peek(place({ id: cur.id }));
    else if (k === "Enter" && cur) selectPlace(jali, cur.id, { from: node.id, open: true });
    else if ((k === "a" || k === "A") && cur) add(cur);
    else return;
    e.preventDefault();
  };

  useCommands(
    inPeek
      ? []
      : [
          {
            id: "add",
            title: cur ? (cur.category === "stay" ? `Stay at ${cur.name}` : `Add ${cur.name} to a day…`) : "Add to a day…",
            keys: "A",
            disabled: cur ? false : "Pick a place first",
            run: () => cur && add(cur),
          },
          { id: "peek", title: cur ? `Peek at ${cur.name}` : "Peek", keys: keyHint("Space"), disabled: cur ? false : "Pick a place first", run: () => cur && peek(place({ id: cur.id })) },
          { id: "stays", title: "Explore stays", run: () => set({ category: "stay", near: "anywhere", within: 0 }) },
          { id: "food", title: "Explore food nearby", run: () => set({ category: "food", near: "place", within: 1.2 }) },
          { id: "clear", title: "Clear the filters", run: () => set({ text: "", maxPrice: -1, within: 0, near: "anywhere", category: "all" }) },
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
              if (e.key === "ArrowDown" && rows.length) {
                e.preventDefault();
                moveTo(rows[0]!.p.id);
                listRef.current?.focus();
              }
            }}
          />
        </label>
        <Segmented
          label="Category"
          value={filters.category}
          onChange={(category) => set({ category })}
          options={[
            { value: "all", label: "All" },
            { value: "stay", label: CATEGORY_LABEL.stay },
            { value: "food", label: CATEGORY_LABEL.food },
            { value: "sight", label: CATEGORY_LABEL.sight },
          ]}
        />
        <div className="explore-row">
          <label className="select">
            <span>Near</span>
            <select value={filters.near} onChange={(e) => set({ near: e.target.value as Near })}>
              <option value="place">The selected place</option>
              <option value="day">The day's centre</option>
              <option value="anywhere">Anywhere</option>
            </select>
          </label>
          <label className="select">
            <span>Within</span>
            <select
              value={filters.within}
              disabled={filters.near === "anywhere"}
              onChange={(e) => set({ within: Number(e.target.value) })}
            >
              {WITHIN.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="select">
            <span>Price</span>
            <select value={filters.maxPrice} onChange={(e) => set({ maxPrice: Number(e.target.value) })}>
              {PRICES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="explore-count muted" aria-live="polite">
          {rows.length} {rows.length === 1 ? "place" : "places"}
          {anchor ? `, nearest ${anchor.label} first` : ""}
        </p>
      </div>
      {rows.length ? (
        <div
          ref={listRef}
          className="results"
          role="listbox"
          aria-label="Places"
          tabIndex={0}
          aria-activedescendant={cur ? `${node.id}-${cur.id}` : undefined}
          onKeyDown={onKeyDown}
        >
          {rows.map(({ p, km }) => {
            const Icon = CATEGORY_ICON[p.category];
            const on = dayWith(plan, p.id);
            const walk = km !== null && km <= WALK_UP_TO_KM * 1.5 ? travel(km, "walk").minutes : null;
            return (
              <div
                key={p.id}
                id={`${node.id}-${p.id}`}
                data-row={p.id}
                role="option"
                aria-selected={p.id === cursor}
                data-active={(p.id === cursor && focused) || undefined}
                data-current={p.id === current || undefined}
                className="result"
                onClick={() => (p.id === cursor ? selectPlace(jali, p.id, { from: node.id, open: true }) : moveTo(p.id))}
              >
                <span className="result-icon" data-category={p.category}>
                  <Icon size={16} weight="bold" aria-hidden />
                </span>
                <span className="result-text">
                  <span className="result-name">{p.name}</span>
                  <span className="result-meta">
                    {p.kind}, {p.area}
                    {km !== null ? `, ${walk !== null ? `${walk} min walk` : f.distance(km)}` : ""}
                  </span>
                </span>
                <span className="result-end">
                  {on ? <DayMark n={on.n} size="sm" /> : null}
                  {plan.hotel === p.id ? <span className="tag">Your hotel</span> : null}
                  <span className="num">
                    {f.price(p.price)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn result-add"
                    tabIndex={-1}
                    aria-label={p.category === "stay" ? `Stay at ${p.name}` : `Add ${p.name} to a day`}
                    title={p.category === "stay" ? "Stay here" : "Add to a day (A)"}
                    onClick={(e) => {
                      e.stopPropagation();
                      add(p);
                    }}
                    disabled={plan.hotel === p.id}
                  >
                    <PlusIcon size={16} weight="bold" aria-hidden />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty title="Nothing matches">Try a wider distance, any price, or another category.</Empty>
      )}
    </div>
  );
}

export const explore = definePane("explore", {
  params: exploreParams,
  title: ({ category }) => (category === "stay" ? "Find a stay" : category === "food" ? "Find food" : "Explore"),
  icon: MagnifyingGlassIcon,
  width: { min: 300, comfortable: 360, max: 480 },
  height: { min: 320 },
  holdWhileResizing: true,
  Component: ExplorePane,
});
