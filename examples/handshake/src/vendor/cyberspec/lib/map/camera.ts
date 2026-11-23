import * as React from "react"
import { announce, createChange, createViewport, definePrimitive, type ChangeDetails, type Viewport, type ViewportReason } from "@ui-sdk/core"
import { usePart, usePrimitive } from "@ui-sdk/react/primitive"
import { sfx } from "#src/vendor/cyberspec/lib/sound.ts"
import { createGlobeProjection, globeVector } from "#src/vendor/cyberspec/lib/map/orthographic.ts"

type MapCoordinate = readonly [longitude: number, latitude: number]
type MapProjection = "mercator" | "globe"
type MapView = { center: MapCoordinate; zoom: number }
type MapViewChangeDetails = ChangeDetails<ViewportReason | "move-key" | "reset-view">
type MapCameraOptions = {
  projection?: MapProjection
  view?: MapView
  defaultView?: MapView
  onViewChange?: (view: MapView, details: MapViewChangeDetails) => void
  minZoom?: number
  maxZoom?: number
  fitCoordinates?: readonly MapCoordinate[]
}
type Point = { x: number; y: number }
type Size = { width: number; height: number }

const WORLD = 1024
const RADIANS = Math.PI / 180
const MAX_LAT = Math.atan(Math.sinh(Math.PI)) * 180 / Math.PI
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const wrap = (n: number, period: number) => ((n % period) + period) % period
const scaleAt = (zoom: number) => 256 * 2 ** zoom / WORLD
const zoomAt = (scale: number) => Math.log2(scale * WORLD / 256)

// World coordinates stay independent of tile and screen size. Longitude can
// extend past ±180° so a line crossing the dateline can continue in one copy.
function project([longitude, latitude]: MapCoordinate): Point {
  const radians = clamp(latitude, -MAX_LAT, MAX_LAT) * Math.PI / 180
  return {
    x: (longitude + 180) / 360 * WORLD,
    y: clamp((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * WORLD, 0, WORLD),
  }
}

function unproject({ x, y }: Point): MapCoordinate {
  return [
    wrap(x, WORLD) / WORLD * 360 - 180,
    Math.atan(Math.sinh(Math.PI * (1 - 2 * clamp(y, 0, WORLD) / WORLD))) * 180 / Math.PI,
  ]
}

function fitView(coordinates: readonly MapCoordinate[], size: Size, min: number, max: number): MapView {
  const points = coordinates.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(project)
  let x = WORLD / 2, y = WORLD / 2, spanX = WORLD, spanY = WORLD
  if (points.length) {
    // The smallest arc containing all longitudes leaves the largest gap out.
    const xs = points.map((p) => wrap(p.x, WORLD)).sort((a, b) => a - b)
    let largestGap = 0, start = xs[0]!
    let north = WORLD, south = 0
    for (let i = 0; i < points.length; i++) {
      const next = xs[i + 1] ?? xs[0]! + WORLD
      if (next - xs[i]! > largestGap) {
        largestGap = next - xs[i]!
        start = next
      }
      north = Math.min(north, points[i]!.y)
      south = Math.max(south, points[i]!.y)
    }
    spanX = WORLD - largestGap
    spanY = south - north
    x = start + spanX / 2
    y = (north + south) / 2
  }
  const padding = Math.min(40, size.width / 5, size.height / 5)
  const scale = Math.min((size.width - padding * 2) / Math.max(1, spanX), (size.height - padding * 2) / Math.max(1, spanY))
  const zoom = spanX + spanY === 0 ? 4 : zoomAt(scale)
  return { center: unproject({ x, y }), zoom: clamp(zoom, min, max) }
}

function globeHome(coordinates: readonly MapCoordinate[], minZoom: number): MapView {
  // Averaging directions keeps a network straddling the date line together.
  let x = 0, y = 0, z = 0
  let first: MapCoordinate = [0, 0]
  let count = 0
  for (const coordinate of coordinates) {
    const [lon, lat] = coordinate
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (count++ === 0) first = coordinate
    const vector = globeVector([lon, clamp(lat, -90, 90)])
    x += vector.x
    y += vector.y
    z += vector.z
  }
  // A symmetric set on opposite sides has no mean direction.
  const center: MapCoordinate = Math.hypot(x, y, z) < 1e-8 * Math.max(1, count)
    ? first
    : [Math.atan2(y, x) / RADIANS, Math.atan2(z, Math.hypot(x, y)) / RADIANS]
  return { center, zoom: minZoom }
}

function globeRadius(size: Size, zoom: number) {
  return Math.max(1, Math.min(size.width, size.height) * 0.44) * 2 ** zoom
}

function boundedView(view: MapView, min: number, max: number, projection: MapProjection): MapView {
  const [lon, lat] = view.center
  const longitude = lon >= -180 && lon < 180 ? lon : wrap(lon + 180, 360) - 180
  const pole = projection === "globe" ? 90 : MAX_LAT
  const latitude = clamp(lat, -pole, pole)
  const zoom = clamp(view.zoom, min, max)
  if (longitude === lon && latitude === lat && zoom === view.zoom) return view
  return { center: [longitude, latitude], zoom }
}

function viewportOf(view: MapView, size: Size, projection: MapProjection): Viewport {
  const { width, height } = size
  if (projection === "globe") {
    // Use longitude and latitude measured in arc length as the SDK's drag
    // plane. Its pointer capture, pinch and keyboard deltas then rotate the
    // camera by the same angular distance at any size or zoom.
    const pixelsPerDegree = globeRadius(size, view.zoom) * RADIANS
    return {
      x: width / 2 - view.center[0] * pixelsPerDegree,
      y: height / 2 + view.center[1] * pixelsPerDegree,
      zoom: scaleAt(view.zoom),
    }
  }
  const point = project(view.center)
  const scale = scaleAt(view.zoom)
  return { x: width / 2 - point.x * scale, y: height / 2 - point.y * scale, zoom: scale }
}

type SurfaceOptions = {
  projection: MapProjection
  view: MapView
  viewport: Viewport
  home: MapView
  size: Size
  minZoom: number
  maxZoom: number
  onViewChange: NonNullable<MapCameraOptions["onViewChange"]>
}

const mapSurface = definePrimitive({
  name: "map-surface",
  options: { projection: "value", view: "value", viewport: "value", home: "value", size: "value", minZoom: "number", maxZoom: "number", onViewChange: "callback" },
  state: ({ view, viewport }: SurfaceOptions) => ({ view, viewport }),
  sync: ({ view, viewport }) => ({ view, viewport }),
  controlled: ["view"],
  live: ["viewport"],
  agent: { actions: ["zoomIn", "zoomOut", "reset"] },
  api(context) {
    const change = createChange(context)
    const viewport = createViewport(context, {
      key: "viewport",
      surface: () => context.element("root"),
      minZoom: () => scaleAt(context.options().minZoom),
      maxZoom: () => scaleAt(context.options().maxZoom),
      set(next, details) {
        const { view, size, projection } = context.options()
        const dx = size.width / 2 - next.x
        const dy = size.height / 2 - next.y
        const zoom = zoomAt(next.zoom)
        let center: MapCoordinate
        if (projection === "globe") {
          const pixelsPerDegree = globeRadius(size, zoom) * RADIANS
          center = [wrap(dx / pixelsPerDegree + 180, 360) - 180, clamp(-dy / pixelsPerDegree, -90, 90)]
        } else {
          center = unproject({ x: dx / next.zoom, y: dy / next.zoom })
        }
        if (Math.abs(view.center[0] - center[0]) < 1e-10 && Math.abs(view.center[1] - center[1]) < 1e-10 && Math.abs(view.zoom - zoom) < 1e-10) return false
        const reason = details.event?.type === "keydown" && details.reason === "imperative" ? "move-key" : details.reason
        return change("view", { center, zoom }, { ...details, reason })
      },
    })
    const zoomBy = (steps: number, event?: KeyboardEvent) => {
      const options = context.options()
      const next = clamp(options.view.zoom + steps, options.minZoom, options.maxZoom)
      const moved = viewport.zoomBy(2 ** steps, undefined, { reason: event ? "zoom-key" : "imperative", event })
      if (moved) {
        sfx(steps > 0 ? "increment" : "decrement")
        const label = options.projection === "globe" ? "Globe" : "Map"
        announce(`${label} zoom level ${Number(next.toFixed(1))}.`)
      }
      return moved
    }
    const reset = (event?: Event) => change("view", context.options().home, { reason: "reset-view", event })
    return {
      viewport,
      zoomBy,
      zoomIn: () => viewport.zoomBy(2),
      zoomOut: () => viewport.zoomBy(0.5),
      reset,
    }
  },
  slots: (slot) => ({
    root: slot({
      role: "group",
      attrs: () => ({ tabindex: "0" }),
      on: {
        pointerdown(event, { api, el }) {
          if (event.button !== 0 || (event.target as Element).closest("button, a, input, select, textarea, [contenteditable]")) return
          el?.focus({ preventScroll: true })
          api.viewport.pointerdown(event)
        },
        wheel(event, { api }) {
          // A map embedded in a catalog must leave ordinary page scrolling alone.
          if (event.ctrlKey || event.metaKey) api.viewport.wheel(event)
        },
        keydown(event, { api, el }) {
          if (event.target !== el || event.ctrlKey || event.metaKey || event.altKey) return
          const step = 64
          const arrows: Record<string, Point> = {
            ArrowLeft: { x: step, y: 0 }, ArrowRight: { x: -step, y: 0 },
            ArrowUp: { x: 0, y: step }, ArrowDown: { x: 0, y: -step },
          }
          const delta = arrows[event.key]
          if (delta) api.viewport.panBy(delta.x, delta.y, { reason: "imperative", event })
          else if (event.key === "Home" || event.key === "0") api.reset(event)
          else if (event.key === "+" || event.key === "=") api.zoomBy(1, event)
          else if (event.key === "-" || event.key === "_") api.zoomBy(-1, event)
          else return
          event.preventDefault()
        },
      },
    }),
  }),
})

const noCoordinates: readonly MapCoordinate[] = []

function useMapCamera({ projection = "mercator", view: controlled, defaultView, onViewChange, minZoom = 0, maxZoom = 8, fitCoordinates = noCoordinates }: MapCameraOptions) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<Size>({ width: 0, height: 0 })
  const [userViews, setUserViews] = React.useState<Partial<Record<MapProjection, MapView>>>({})
  const initialViews = React.useRef(new Map<MapProjection, MapView | undefined>())
  if (!initialViews.current.has(projection)) initialViews.current.set(projection, defaultView)
  const initial = initialViews.current.get(projection)
  React.useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth, height = el.clientHeight
      setSize((last) => last.width === width && last.height === height ? last : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const max = clamp(maxZoom, clamp(minZoom, 0, 22), 22)
  // Keep one world across a wide surface, so each labelled marker has a
  // single visible copy. An explicit maximum still limits the camera.
  const floor = projection === "globe" ? minZoom : Math.max(minZoom, Math.log2(size.width / 256))
  const min = clamp(floor, 0, max)
  const home = React.useMemo(() => {
    if (initial) return boundedView(initial, min, max, projection)
    if (projection === "globe") return boundedView(globeHome(fitCoordinates, min), min, max, projection)
    return fitView(fitCoordinates, size, min, max)
  }, [fitCoordinates, initial, size, min, max, projection])
  const chosen = controlled ?? userViews[projection] ?? home
  const view = React.useMemo(() => boundedView(chosen, min, max, projection), [chosen.center[0], chosen.center[1], chosen.zoom, min, max, projection])
  const origin = React.useMemo(() => viewportOf(view, size, projection), [view, size, projection])
  const radius = globeRadius(size, view.zoom)
  const handle = usePrimitive(mapSurface, {
    projection, view, viewport: origin, home, size, minZoom: min, maxZoom: max,
    onViewChange(next, details) {
      if (controlled !== undefined && !onViewChange) return details.cancel()
      onViewChange?.(next, details)
      if (controlled === undefined && !details.canceled) {
        const saved = details.reason === "reset-view" ? undefined : next
        setUserViews((views) => ({ ...views, [projection]: saved }))
      }
    },
  })
  const api = handle.api
  const reveal = (coordinate: MapCoordinate) => {
    if (!size.width || !size.height) return
    if (projection === "globe") {
      const point = createGlobeProjection(view.center, size.width, size.height, radius).point(coordinate)
      if (!point.visible || point.x < 16 || point.y < 16 || point.x > size.width - 16 || point.y > size.height - 16) {
        api.viewport.setViewport(viewportOf({ center: coordinate, zoom: view.zoom }, size, projection), { reason: "focus-in" })
      }
      return
    }
    const center = project(view.center)
    const { x, y } = project(coordinate)
    const nearestX = x + Math.round((center.x - x) / WORLD) * WORLD
    api.viewport.reveal({ left: nearestX, top: y, right: nearestX, bottom: y }, { padding: 36 })
  }
  return {
    handle, viewportRef, view, origin, scale: origin.zoom, radius,
    width: size.width, height: size.height, canZoomIn: view.zoom < max, canZoomOut: view.zoom > min,
    zoomBy: api.zoomBy,
    panBy: (dx: number, dy: number) => api.viewport.panBy(-dx, -dy),
    reset: () => api.reset(), reveal,
  }
}

function MapSurface({ camera, ...props }: { camera: ReturnType<typeof useMapCamera> } & React.HTMLAttributes<HTMLDivElement>) {
  const pointers = React.useRef(new Set<number>())
  const [dragging, setDragging] = React.useState(false)
  const state = dragging ? { "data-dragging": "" } : {}
  return usePart(camera.handle, "root", {}, {
    ...props,
    ...state,
    ref: camera.viewportRef,
    onGotPointerCapture: (event) => {
      props.onGotPointerCapture?.(event)
      if (event.target !== event.currentTarget) return
      pointers.current.add(event.pointerId)
      setDragging(true)
    },
    onLostPointerCapture: (event) => {
      props.onLostPointerCapture?.(event)
      if (event.target !== event.currentTarget) return
      pointers.current.delete(event.pointerId)
      setDragging(pointers.current.size > 0)
    },
  }, "div")
}

export { MapSurface, project, unproject, useMapCamera }
export type { MapCoordinate, MapProjection, MapView, MapViewChangeDetails, MapCameraOptions }
