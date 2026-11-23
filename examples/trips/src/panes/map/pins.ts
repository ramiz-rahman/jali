/**
 * The pins and the city badges as DOM markers on the map: each a real button with a name, a whole target of at least
 * 24px, painted from its role (one table, `ROLE`), and laid out on screen so nothing covers anything else
 * (pin-layout.ts). The selected pin wears its place's photo above it.
 */
import { Marker, type Map as MapLibre } from "maplibre-gl";
import { CITY, type CityId } from "../../trip/cities";
import { photoOf } from "../../trip/photos";
import { photoSrc } from "../../ui/molecules/photo";
import type { Badge, Pin, PinRole } from "./features";
import {
  layoutPins,
  overlaps,
  pileMark,
  type PileStop,
  type PinBox,
  type Rect,
} from "./pin-layout";

/**
 * What each role of pin is: `rank`, which goes first when pins would overlap (lower first, after the selected
 * place); `size`, its target as map.css draws it; `z`, what it sits above; `tabbable`, whether it is in the Tab
 * order (the day's stops and the hotel; other pins are reached by pointer or by the lists); and its name.
 */
const ROLE: Record<
  PinRole,
  { rank: number; size: number; z: number; tabbable: boolean; label: (pin: Pin) => string }
> = {
  stop: {
    rank: 1,
    size: 30,
    z: 3,
    tabbable: true,
    label: ({ p, day, order }) => `Day ${day}, stop ${order}: ${p.name}`,
  },
  hotel: {
    rank: 2,
    size: 32,
    z: 4,
    tabbable: true,
    label: ({ p }) => `Your hotel in ${CITY[p.city].name}: ${p.name}`,
  },
  airport: { rank: 3, size: 26, z: 1, tabbable: false, label: ({ p }) => p.name },
  candidate: {
    rank: 4,
    size: 24,
    z: 1,
    tabbable: false,
    label: ({ p }) => `${p.name}, not planned`,
  },
  "other-day": {
    rank: 5,
    size: 24,
    z: 1,
    tabbable: false,
    label: ({ p, day }) => `${p.name}, on Day ${day}`,
  },
};

/** The selected pin's z: above every other. */
const SELECTED_Z = 5;

/** A pin on the map: MapLibre's marker, the button in it, and what it shows. */
export interface PinMarker {
  marker: Marker;
  el: HTMLButtonElement;
  pin: Pin;
}

/** A marker holding a button: MapLibre moves the marker's own element with `transform`; the button is free to grow. */
function buttonMarker(map: MapLibre, wrapClass: string, buttonClass: string, at: [number, number]) {
  const wrap = document.createElement("div");
  wrap.className = wrapClass;
  const el = document.createElement("button");
  el.type = "button";
  el.className = buttonClass;
  wrap.append(el);
  const marker = new Marker({ element: wrap, anchor: "center" }).setLngLat(at).addTo(map);
  return { marker, el };
}

export function createPin(map: MapLibre, pin: Pin, onClick: (id: string) => void): PinMarker {
  const { marker, el } = buttonMarker(map, "pin-wrap", "pin", [pin.p.lng, pin.p.lat]);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (el.dataset.id) onClick(el.dataset.id);
  });
  return { marker, el, pin };
}

/** A pin's look and name, from its role and whether it is selected. */
export function paintPin({ el, pin }: PinMarker, selected: boolean) {
  const { p, role, day, order } = pin;
  const r = ROLE[role];
  el.dataset.id = p.id;
  el.dataset.role = role;
  el.dataset.category = p.category;
  if (day) el.dataset.day = String(day);
  else delete el.dataset.day;
  el.toggleAttribute("data-selected", selected);
  el.tabIndex = r.tabbable ? 0 : -1;
  const text = role === "stop" ? String(order) : "";
  if (el.textContent !== text) el.textContent = text;
  // Its own name; the layout adds the pins it stands for (placePins).
  el.dataset.label = r.label(pin);
  el.setAttribute("aria-label", el.dataset.label);
  el.title = p.name;
  el.parentElement!.style.zIndex = String(selected ? SELECTED_Z : r.z);
  paintBubble(el.parentElement!, selected ? p.id : null, day);
}

/**
 * The selected pin's photo, in a round frame above it, so the place is easy to find on the map. Decorative: the
 * pin has the name, and the card below says the rest.
 */
function paintBubble(wrap: HTMLElement, id: string | null, day?: number) {
  let bubble = wrap.querySelector<HTMLElement>(".pin-photo");
  const photo = id ? photoOf(id) : undefined;
  const url = photo ? photoSrc(photo) : undefined;
  if (!id || !url) {
    bubble?.remove();
    return;
  }
  if (!bubble) {
    bubble = document.createElement("span");
    bubble.className = "pin-photo";
    bubble.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    bubble.append(img);
    wrap.prepend(bubble);
  }
  if (day) bubble.dataset.day = String(day);
  else delete bubble.dataset.day;
  const img = bubble.querySelector("img")!;
  if (img.getAttribute("src") !== url) img.src = url;
  bubble.style.setProperty("--tone", photo?.tone ?? "transparent");
}

export function createBadge(map: MapLibre, badge: Badge, onClick: () => void): Marker {
  const { marker, el } = buttonMarker(map, "city-badge-wrap", "city-badge", [badge.lng, badge.lat]);
  el.addEventListener("click", onClick);
  return marker;
}

/** A badge's place and words: the city's name, its days and stops. */
export function paintBadge(marker: Marker, badge: Badge) {
  marker.setLngLat([badge.lng, badge.lat]);
  const el = marker.getElement().firstElementChild as HTMLButtonElement;
  const name = document.createElement("b");
  name.textContent = badge.name;
  const sub = document.createElement("span");
  sub.textContent = badge.sub;
  // The space keeps the two lines apart in the text a screen reader matches the name against; the name says all the
  // badge shows, then what it does (WCAG 2.5.3).
  el.replaceChildren(name, " ", sub);
  el.setAttribute("aria-label", `${badge.name}, ${badge.sub}. Show it on the map.`);
}

/** The selected pin's photo stands above it (map.css): 64px round, 34px up, with a point toward the pin. */
const photoBox = (x: number, y: number): Rect => ({
  left: x - 35,
  right: x + 35,
  top: y - 34 - 67,
  bottom: y - 34 + 10,
});

/** A pin as a pile's badge reads it: the day and number of one of the days' stops shown, nothing for the rest. */
const pileStop = (pin: Pin): PileStop =>
  pin.role === "stop" ? { day: pin.day, order: pin.order } : {};

/** A city badge's id in the layout, beside the places'. */
const badgeId = (city: CityId) => `city:${city}`;

/**
 * What floats over the map (the days and the summary on top, the route key, the card, MapLibre's buttons and its
 * attribution), as rectangles in the map's own coordinates.
 */
function floating(el: HTMLElement): Rect[] {
  const origin = el.getBoundingClientRect();
  const root = el.parentElement ?? el;
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      ".map-top > *, .map-legend, .map-card, .map-failed, .maplibregl-ctrl",
    ),
  )
    .map((f) => f.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    }));
}

/**
 * Places the pins and the city badges (pin-layout.ts) and shows the result: a pin off the open map or in a pile is
 * hidden, and a pin that stands for others says "+N" (or their stop numbers) and names them. A badge moves to the
 * clear spot nearest its city, or hides if there is none. The selected pin's photo shows only where it covers
 * nothing. Returns the piles: each pin shown, with the pins it stands for too.
 */
export function placePins(
  map: MapLibre,
  el: HTMLElement,
  all: readonly PinMarker[],
  badges: ReadonlyMap<CityId, Marker>,
  selected: string | null,
): Map<string, string[]> {
  const view = { left: 0, top: 0, right: el.clientWidth, bottom: el.clientHeight };
  const blocked = floating(el);
  const byId = new Map(all.map((m) => [m.pin.p.id, m]));
  const at = new Map<string, { x: number; y: number }>();
  const boxes: PinBox[] = all.map(({ pin }) => {
    const { x, y } = map.project([pin.p.lng, pin.p.lat]);
    at.set(pin.p.id, { x, y });
    const isSelected = pin.p.id === selected;
    const { size, rank } = ROLE[pin.role];
    return {
      id: pin.p.id,
      x,
      y,
      // A selected stop, hotel or airport grows by 1.22 (map.css).
      size: isSelected && size > 24 ? size * 1.22 : size,
      rank: isSelected ? 0 : rank + (pin.order ?? 0) / 100,
    };
  });
  for (const [city, marker] of badges) {
    const { x, y } = map.project(marker.getLngLat());
    const button = marker.getElement().firstElementChild as HTMLElement;
    // Room for it to grow on hover (by 1.04) and still cover nothing.
    boxes.push({
      id: badgeId(city),
      x,
      y,
      size: 0,
      width: Math.ceil(button.offsetWidth * 1.04),
      height: Math.ceil(button.offsetHeight * 1.04),
      rank: 0,
      moves: true,
    });
  }
  const { shown, moved } = layoutPins(boxes, view, blocked);
  for (const [city, marker] of badges) {
    const id = badgeId(city);
    marker.getElement().toggleAttribute("data-hidden", !shown.has(id));
    const { dx, dy } = moved.get(id) ?? { dx: 0, dy: 0 };
    const offset = marker.getOffset();
    if (offset.x !== dx || offset.y !== dy) marker.setOffset([dx, dy]);
  }
  const label = (id: string) => byId.get(id)?.el.dataset.label ?? "";
  for (const { pin, el: button, marker } of all) {
    const id = pin.p.id;
    const pile = shown.get(id);
    const wrap = marker.getElement();
    wrap.toggleAttribute("data-hidden", !pile);
    if (pile?.length) {
      // A pile of the day's own stops says which ("4–5"); any other pile says how many it holds.
      button.dataset.more = pileMark(
        pileStop(pin),
        pile.map((other) => {
          const p = byId.get(other)?.pin;
          return p ? pileStop(p) : {};
        }),
      );
      button.setAttribute(
        "aria-label",
        `${label(id)}. Also here: ${pile.map(label).join("; ")}. Press to zoom in to them.`,
      );
    } else {
      delete button.dataset.more;
      button.setAttribute("aria-label", label(id));
    }
    // The photo is decoration: it gives way to any pin, control or edge it would cover.
    if (pile && id === selected) {
      const { x, y } = at.get(id)!;
      const photo = photoBox(x, y);
      const clear =
        photo.top >= 0 &&
        photo.left >= 0 &&
        photo.right <= view.right &&
        !blocked.some((b) => overlaps(photo, b)) &&
        boxes.every(
          (b) =>
            b.id === id ||
            !shown.has(b.id) ||
            !overlaps(photo, {
              left: b.x - b.size / 2,
              right: b.x + b.size / 2,
              top: b.y - b.size / 2,
              bottom: b.y + b.size / 2,
            }),
        );
      wrap.toggleAttribute("data-photo-off", !clear);
    } else wrap.removeAttribute("data-photo-off");
  }
  return shown;
}
