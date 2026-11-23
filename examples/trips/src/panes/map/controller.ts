/**
 * The trip's map: one MapLibre map and everything drawn on it, behind one method. The pane (map.tsx) hands it the
 * scene after every render (`sync`): the theme, the routes, the pins, the badges, the day and what to frame, and the
 * last place the person asked to see. The map works out what changed and does only that: a new day frames itself, a
 * new request brings its place into view. It keeps the rest to itself: its markers, the piles from the last layout,
 * a camera move waiting while it is hidden, and whether it still shows the day as framed.
 *
 * While it is paused (behind a tab, folded, tucked, behind a maximised pane) it does nothing: no resize, no camera
 * moves. The last move asked for waits and happens when it is shown again.
 */
import {
  GeoJSONSource,
  Map as MapLibre,
  NavigationControl,
  setWorkerUrl,
  type Marker,
} from "maplibre-gl";
// MapLibre runs its tile work in a Web Worker, a file of its own. Bundled, it can't find it beside itself, so the
// bundler copies the file and gives its URL.
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { Reveal } from "../../state/services";
import type { CityId } from "../../trip/cities";
import { placeById, type Place } from "../../trip/places";
import * as camera from "./camera";
import type { Badge, Pin, Theme, routesFor } from "./features";
import { addTripLayers, ROUTES, STYLE } from "./layers";
import { repairStyle } from "./map-style";
import { createBadge, createPin, paintBadge, paintPin, placePins, type PinMarker } from "./pins";

setWorkerUrl(mapWorkerUrl);

/** Thailand, with both cities in view, until the first day is framed. */
const COUNTRY = { center: [99.55, 10.9] as [number, number], zoom: 5 };

type Routes = ReturnType<typeof routesFor>;

/** Everything the map shows, as the pane worked it out. */
export interface Scene {
  theme: Theme;
  /** Out of sight (behind a tab, folded, tucked, behind a maximised pane): nothing moves. */
  paused: boolean;
  /** The day shown, or the whole trip: a new one is framed. */
  day: number;
  routes: Routes;
  pins: readonly Pin[];
  selected: string | null;
  badges: readonly Badge[];
  /** The places a frame takes in: the day's, as the plan is now. */
  framing: readonly Place[];
  /** The place last asked to be shown: a new request brings it into view. */
  reveal: Reveal | null;
}

export interface TripMapEvents {
  /** A pin was pressed (one that stands for no others, or with the map as close as it goes). */
  pick(id: string): void;
  /** The base map couldn't load (true), or has loaded after all (false). */
  failed(failed: boolean): void;
}

export class TripMap {
  readonly map: MapLibre;
  private readonly el: HTMLElement;
  private readonly events: TripMapEvents;
  private theme: Theme;
  private paused: boolean;
  /** A camera move asked for while hidden, made when shown. */
  private pending: (() => void) | null = null;
  /** The map shows the day as framed (not moved by the person since). */
  private framed = true;
  /** What `frame` frames: the day's places. */
  private framing: readonly Place[] = [];
  private routes: Routes | null = null;
  private selected: string | null = null;
  /** The scene from the last `sync`, to tell what changed. */
  private last: Scene | null = null;
  private readonly markers = new Map<string, PinMarker>();
  private readonly badges = new Map<CityId, { marker: Marker; badge: Badge }>();
  /** The pins each pin that shows stands for too, from the last layout. */
  private piles = new Map<string, string[]>();
  private readonly resizes: ResizeObserver;
  private resizeFrame = 0;

  constructor(
    el: HTMLElement,
    { theme, paused }: { theme: Theme; paused: boolean },
    events: TripMapEvents,
  ) {
    this.el = el;
    this.events = events;
    this.theme = theme;
    this.paused = paused;
    const map = new MapLibre({
      container: el,
      style: STYLE[theme],
      // Mends what in the base styles would log a warning; theme switches use it too.
      transformStyle: repairStyle,
      center: COUNTRY.center,
      zoom: COUNTRY.zoom,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: { compact: false },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      // Ctrl + scroll or two fingers would be the cooperative alternative; a map-first app keeps plain scroll.
      cooperativeGestures: false,
    });
    this.map = map;
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("style.load", () => {
      events.failed(false);
      addTripLayers(map, this.theme);
      this.drawRoutes();
    });
    map.on("error", (e) => {
      // A style or tile that can't be fetched. The plan doesn't need the map: say so, and keep the pins.
      const status = (e.error as { status?: number } | undefined)?.status;
      if (!map.isStyleLoaded() || status === undefined || status >= 400)
        events.failed(!map.isStyleLoaded());
    });
    this.makeAccessible();

    // The pins are laid out again whenever the map moves or changes size: what overlaps changes with the zoom, and
    // what is under the floating controls with the pan.
    map.on("move", () => this.relayout());
    map.on("resize", () => this.relayout());

    // A pan or zoom by the person ends the framing; the map stays where they put it.
    const moved = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) this.framed = false;
    };
    map.on("dragstart", moved);
    map.on("zoomstart", moved);
    map.on("rotatestart", moved);

    // It resizes with its box, unless it is out of sight (then it catches up when shown).
    this.resizes = new ResizeObserver(() => {
      if (this.paused || this.resizeFrame) return;
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = 0;
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          map.resize();
          // Until the person moves the map, it keeps the day framed as its box changes (a fold, a preset).
          if (this.framed) this.frameNow(false);
        }
      });
    });
    this.resizes.observe(el);
    this.relayout();
  }

  /**
   * The keyboard's way in is the box that holds the canvas and the pins, not the canvas MapLibre picks: focus then
   * sits round everything on the map, and a pin over the canvas's middle is inside it, not over it. MapLibre listens
   * for its keys on that box, so the arrows still pan. Named, so a screen reader says what the keys do, and busy
   * while tiles load, until everything in view is drawn (or failed to load: the map says so).
   */
  private makeAccessible() {
    const canvas = this.map.getCanvas();
    for (const a of ["tabindex", "role", "aria-label"]) canvas.removeAttribute(a);
    const surface = this.map.getCanvasContainer();
    surface.tabIndex = 0;
    surface.setAttribute("role", "region");
    surface.setAttribute("aria-label", "Map. Arrow keys pan, plus and minus zoom.");
    surface.setAttribute("aria-busy", "true");
    this.map.on("dataloading", () => surface.setAttribute("aria-busy", "true"));
    this.map.on("idle", () => surface.removeAttribute("aria-busy"));
    this.map.on("error", () => surface.removeAttribute("aria-busy"));
  }

  /**
   * Show `scene`, doing only what changed since the last: on the first, everything but a reveal (the map frames its
   * day instead, and the request may be for the other city). After every render, so the pins keep clear of what
   * floats over the map as it comes and goes.
   */
  sync(scene: Scene) {
    const last = this.last;
    this.last = scene;
    if (scene.paused !== last?.paused) this.setPaused(scene.paused);
    this.setTheme(scene.theme);
    if (scene.routes !== last?.routes) this.setRoutes(scene.routes);
    if (scene.pins !== last?.pins || scene.selected !== last?.selected)
      this.setPins(scene.pins, scene.selected);
    if (scene.badges !== last?.badges) this.setBadges(scene.badges);
    this.framing = scene.framing;
    if (scene.day !== last?.day) this.frame();
    const p = scene.reveal && placeById(scene.reveal.id);
    if (last && scene.reveal !== last.reveal && p) this.reveal(p);
    this.relayout();
  }

  /** Run a camera move now, or when the map is next shown. */
  private whenShown(move: () => void) {
    if (this.paused) this.pending = move;
    else move();
  }

  /** Paused: stop any camera move. Shown again: fit the box it now has, and make the move that waited. */
  private setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) {
      this.map.stop();
      return;
    }
    this.map.resize();
    const move = this.pending;
    this.pending = null;
    move?.();
  }

  /** Light and dark: swap the base style; the trip's layers come back on "style.load". */
  private setTheme(theme: Theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.map.setStyle(STYLE[theme], { diff: false });
  }

  private setRoutes(routes: Routes) {
    this.routes = routes;
    this.drawRoutes();
  }

  private drawRoutes() {
    const src = this.map.getSource(ROUTES) as GeoJSONSource | undefined;
    if (src && this.routes) src.setData(this.routes);
  }

  /** The pins, and the place selected among them. */
  private setPins(pins: readonly Pin[], selected: string | null) {
    this.selected = selected;
    const seen = new Set<string>();
    for (const pin of pins) {
      seen.add(pin.p.id);
      let m = this.markers.get(pin.p.id);
      if (!m) {
        m = createPin(this.map, pin, (id) => this.press(id));
        this.markers.set(pin.p.id, m);
      }
      m.pin = pin;
      paintPin(m, pin.p.id === selected);
    }
    for (const [id, m] of this.markers)
      if (!seen.has(id)) {
        m.marker.remove();
        this.markers.delete(id);
      }
    this.relayout();
  }

  /**
   * A pin pressed. One that stands for others too opens the pile first: the map zooms in until they part. Pressed
   * when the map is as close as it goes, it picks its own place, like any pin.
   */
  private press(id: string) {
    const pile = this.piles.get(id);
    const points = pile?.length ? [id, ...pile].flatMap((p) => placeById(p) ?? []) : [];
    if (points.length && camera.openPile(this.map, points)) this.framed = false;
    else this.events.pick(id);
  }

  /** A badge for each city, shown when the whole country is in view. A click frames the city as it is now. */
  private setBadges(badges: readonly Badge[]) {
    for (const badge of badges) {
      let b = this.badges.get(badge.city);
      if (!b) {
        const marker = createBadge(this.map, badge, () =>
          camera.frame(this.map, this.badges.get(badge.city)!.badge.points, 900),
        );
        b = { marker, badge };
        this.badges.set(badge.city, b);
      }
      b.badge = badge;
      paintBadge(b.marker, badge);
    }
    // Their text may have changed their size, and they move to stay clear.
    this.relayout();
  }

  /** Frame the day (now, or when the map is next shown). */
  frame(animate = true) {
    this.whenShown(() => this.frameNow(animate));
  }

  private frameNow(animate: boolean) {
    if (!this.framing.length) return;
    camera.frame(this.map, this.framing, animate ? 700 : 0);
    this.framed = true;
  }

  /** Bring a place into view, unless it is already well inside (now, or when the map is next shown). */
  private reveal(p: Place) {
    this.whenShown(() => {
      if (camera.reveal(this.map, p)) this.framed = false;
    });
  }

  /** Lays out what the zoom shows: zoomed out to the whole country, a badge per city; else the pins. */
  private relayout() {
    const far = this.map.getZoom() < camera.CITY_ZOOM;
    this.el.toggleAttribute("data-far", far);
    if (!this.el.clientWidth || !this.el.clientHeight) return;
    const badges = new Map(Array.from(this.badges, ([c, b]) => [c, b.marker]));
    this.piles = placePins(
      this.map,
      this.el,
      far ? [] : Array.from(this.markers.values()),
      far ? badges : new Map(),
      this.selected,
    );
  }

  destroy() {
    this.resizes.disconnect();
    cancelAnimationFrame(this.resizeFrame);
    for (const m of this.markers.values()) m.marker.remove();
    this.markers.clear();
    for (const b of this.badges.values()) b.marker.remove();
    this.badges.clear();
    this.map.remove();
  }
}
