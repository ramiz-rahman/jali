import * as React from "react"
import { Radio, RadioGroup, type RadioGroupOptions } from "@ui-sdk/react/radio"
import { ArrowUp, Globe, MapPin, Maximize, Minus, Plus } from "lucide-react"
import { MapSurface, project, unproject, useMapCamera, type MapCoordinate, type MapProjection, type MapView, type MapViewChangeDetails } from "#src/vendor/cyberspec/lib/map/camera.ts"
import { globeScaleBar, graticule, routePaths, scaleBar, type MapAnnotation, type MapMarker, type MapRoute } from "#src/vendor/cyberspec/lib/map/chart.ts"
import { GlobeChart } from "#src/vendor/cyberspec/lib/map/globe.tsx"
import { createGlobeProjection } from "#src/vendor/cyberspec/lib/map/orthographic.ts"
import { mapBordersPath, mapLandPath } from "#src/vendor/cyberspec/lib/map/geography.ts"
import { Button } from "#src/vendor/cyberspec/components/ui/button.tsx"
import { Toggle } from "#src/vendor/cyberspec/components/ui/toggle.tsx"
import "#src/vendor/cyberspec/components/ui/cyber/map.css"

type MapTiles = {
  /** A Web Mercator raster tile URL containing {z}, {x} and {y}. */
  url: string
  attribution: React.ReactNode
  /** Highest zoom supplied by the source. Tiles scale up beyond this level. */
  maxZoom: number
}

type MapProps = Pick<RadioGroupOptions, "value" | "defaultValue" | "onValueChange" | "name" | "form" | "controller"> &
  Pick<React.ComponentProps<"section">, "id" | "className" | "style"> & {
    label: string
    projection?: MapProjection
    markers?: readonly MapMarker[]
    routes?: readonly MapRoute[]
    annotations?: readonly MapAnnotation[]
    /** Optional raster basemap for the flat projection. The globe uses bundled vector geography. */
    tiles?: MapTiles
    view?: MapView
    defaultView?: MapView
    onViewChange?: (view: MapView, details: MapViewChangeDetails) => void
    minZoom?: number
    maxZoom?: number
  }

type Camera = ReturnType<typeof useMapCamera>
const grid = graticule()
const empty: readonly never[] = []

function screenPoint(coordinate: MapCoordinate, camera: Camera) {
  const point = project(coordinate)
  const worldWidth = 1024 * camera.scale
  const x = camera.origin.x + point.x * camera.scale
  const copy = Math.round((camera.width / 2 - x) / worldWidth)
  return { x: x + copy * worldWidth, y: camera.origin.y + point.y * camera.scale }
}

function formatCoordinate([longitude, latitude]: MapCoordinate) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude < 0 ? "S" : "N"} · ${Math.abs(longitude).toFixed(2)}°${longitude < 0 ? "W" : "E"}`
}

function RasterTiles({ source, camera }: { source: MapTiles; camera: Camera }) {
  const z = Math.max(0, Math.floor(Math.min(camera.view.zoom, source.maxZoom)))
  const count = 2 ** z
  const side = 1024 * camera.scale / count
  const firstX = Math.floor(-camera.origin.x / side)
  const firstY = Math.max(0, Math.floor(-camera.origin.y / side))
  const endX = Math.ceil((camera.width - camera.origin.x) / side)
  const endY = Math.min(count, Math.ceil((camera.height - camera.origin.y) / side))
  const tiles = []
  for (let y = firstY; y < endY; y++) {
    for (let x = firstX; x < endX; x++) {
      const column = (x % count + count) % count
      const url = source.url.replaceAll("{z}", String(z)).replaceAll("{x}", String(column)).replaceAll("{y}", String(y))
      tiles.push(<image key={`${z}/${x}/${y}`} href={url} x={camera.origin.x + x * side} y={camera.origin.y + y * side} width={side} height={side} />)
    }
  }
  return <g>{tiles}</g>
}

// Geometry stays in the world coordinate system. Labels and pins stay in
// screen pixels, so their type and hit areas keep their size while zooming.
function FlatChart({ camera, paths, selectedId, annotations, tiles }: {
  camera: Camera
  paths: ReturnType<typeof routePaths>
  selectedId?: string
  annotations: readonly MapAnnotation[]
  tiles?: MapTiles
}) {
  const id = React.useId()
  const worldWidth = 1024 * camera.scale
  const copies: number[] = []
  for (let i = Math.floor(-camera.origin.x / worldWidth); i <= Math.floor((camera.width - camera.origin.x) / worldWidth); i++) copies.push(i)
  // A link can enter this sheet from either side of the date line.
  const routeCopies = [(copies[0] ?? 0) - 1, ...copies, (copies[copies.length - 1] ?? 0) + 1]
  const transform = (i: number) => `translate(${camera.origin.x + i * worldWidth} ${camera.origin.y}) scale(${camera.scale})`
  return (
    <svg data-kit="map-chart" aria-hidden focusable="false">
      <defs>
        <path id={`${id}-land`} d={mapLandPath} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
        <pattern id={`${id}-hatch`} patternUnits="userSpaceOnUse" width="4" height="4" patternTransform={`scale(${1 / camera.scale})`}>
          <path data-kit="map-land-pattern" d="M-1 1l2-2M0 4l4-4M3 5l2-2" />
        </pattern>
      </defs>
      {copies.map((i) => (
        <g key={i} transform={transform(i)}>
          <use href={`#${id}-land`} data-kit="map-land" />
          <use href={`#${id}-land`} fill={`url(#${id}-hatch)`} />
          <path data-kit="map-border" d={mapBordersPath} />
          <path data-kit="map-grid" d={grid} />
        </g>
      ))}
      {tiles && <RasterTiles source={tiles} camera={camera} />}
      {routeCopies.map((i) => (
        <g key={i} transform={transform(i)}>
          {paths.map(({ id, from, to, path }) => (
            <path key={id} data-kit="map-route" d={path} data-active={!selectedId || from === selectedId || to === selectedId ? "" : undefined} />
          ))}
        </g>
      ))}
      {annotations.map(({ label, coordinate }) => {
        const { x, y } = screenPoint(coordinate, camera)
        return <text key={label} data-kit="map-annotation" x={x} y={y}>{label}</text>
      })}
    </svg>
  )
}

// Supply longitude/latitude pairs in degrees. Routes join marker IDs along
// a great circle; pass via points to draw a surveyed or street-level path.
// The SDK radio group owns selection, keyboard navigation and form behavior.
function Map({
  label, projection = "mercator", markers = empty, routes = empty, annotations = empty, tiles,
  value, defaultValue, onValueChange, name, form, controller,
  view, defaultView, onViewChange, minZoom, maxZoom = tiles && projection === "mercator" ? 19 : 6, ...props
}: MapProps) {
  const titleId = React.useId()
  const helpId = React.useId()
  const [picked, setPicked] = React.useState(defaultValue ?? null)
  const [showRoutes, setShowRoutes] = React.useState(true)
  const selectedId = value === undefined ? picked : value
  const selected = markers.find((marker) => marker.id === selectedId)
  const coordinates = React.useMemo(() => markers.map((marker) => marker.coordinate), [markers])
  const camera = useMapCamera({ projection, view, defaultView, onViewChange, minZoom, maxZoom, fitCoordinates: coordinates })
  const globe = React.useMemo(() => projection === "globe"
    ? createGlobeProjection(camera.view.center, camera.width, camera.height, camera.radius)
    : undefined, [projection, camera.view.center, camera.width, camera.height, camera.radius])
  // Controllers can select a station without moving keyboard focus. Reveal
  // it on a committed selection change; free rotation keeps its own center.
  const previousSelection = React.useRef(selected?.id)
  React.useLayoutEffect(() => {
    if (!camera.width || previousSelection.current === selected?.id) return
    previousSelection.current = selected?.id
    if (globe && selected) camera.reveal(selected.coordinate)
  })
  const paths = React.useMemo(() => routePaths(routes, markers), [routes, markers])
  // A Mercator ruler has a different scale at every latitude. Sample the
  // latitude under the ruler itself, close to the bottom of the frame.
  const [, scaleLatitude] = unproject({ x: 512, y: (camera.height - 12 - camera.origin.y) / camera.scale })
  const rulerWidth = camera.width < 260 ? 40 : 80
  const ruler = globe ? globeScaleBar(globe.radius, rulerWidth) : scaleBar(1024 * camera.scale, scaleLatitude, rulerWidth)
  return (
    <section data-kit="map" data-projection={projection} data-frame="tr bl" aria-labelledby={titleId} {...props}>
      <div data-kit="map-head">
        <span data-kit="map-title" id={titleId}><Globe aria-hidden />{label}</span>
        {paths.length > 0 && <Toggle size="sm" pressed={showRoutes} onPressedChange={setShowRoutes}>Routes</Toggle>}
      </div>
      <p id={helpId} data-sr-only>
        Drag or use the arrow keys to {globe ? "rotate the globe" : "pan"}. Use plus and minus to zoom and Home to reset.
        {markers.length > 0 && " Tab to the markers, then use the arrow keys to select one."}
      </p>
      <div data-kit="map-field">
        <MapSurface camera={camera} data-kit="map-viewport" role="group" aria-label={`${label} viewport`} aria-describedby={helpId}>
          {camera.width > 0 && (globe ? (
            <GlobeChart projection={globe} routes={showRoutes ? routes : empty} markers={markers} selectedId={selected?.id} annotations={annotations} />
          ) : (
            <FlatChart camera={camera} paths={showRoutes ? paths : []} selectedId={selected?.id} annotations={annotations} tiles={tiles} />
          ))}
          {markers.length > 0 && (
            <RadioGroup
              data-kit="map-markers" aria-label={`${label} markers`}
              value={selected?.id ?? null} defaultValue={defaultValue} name={name} form={form} controller={controller}
              onValueChange={(next, details) => {
                onValueChange?.(next, details)
                if (value === undefined && !details.canceled) setPicked(next)
              }}
            >
              {markers.map((marker) => {
                const point = globe?.point(marker.coordinate)
                const { x, y } = point ?? screenPoint(marker.coordinate, camera)
                return (
                  <Radio
                    key={marker.id} data-kit="map-pin" value={marker.id}
                    data-occluded={point && !point.visible ? "" : undefined}
                    data-compact={globe && globe.radius < 190 ? "" : undefined}
                    aria-label={marker.code ? `${marker.label} (${marker.code})` : marker.label}
                    title={marker.label}
                    style={{ "--map-x": `${x}px`, "--map-y": `${y}px` } as React.CSSProperties}
                    onFocus={() => camera.reveal(marker.coordinate)}
                  >
                    <span data-kit="map-glyph" aria-hidden />
                    {marker.code && <span data-kit="map-code" aria-hidden>{marker.code}</span>}
                  </Radio>
                )
              })}
            </RadioGroup>
          )}
        </MapSurface>
        <div data-kit="map-tools" role="group" aria-label={`${label} controls`}>
          <Button size="sm" icon aria-label="Zoom in" title="Zoom in" disabled={!camera.canZoomIn} data-sfx="none" onClick={() => camera.zoomBy(1)}><Plus aria-hidden /></Button>
          <Button size="sm" icon aria-label="Zoom out" title="Zoom out" disabled={!camera.canZoomOut} data-sfx="none" onClick={() => camera.zoomBy(-1)}><Minus aria-hidden /></Button>
          <Button size="sm" icon aria-label="Reset map view" title="Reset map view" onClick={() => camera.reset()}><Maximize aria-hidden /></Button>
        </div>
        <span data-kit="map-scale" title={globe ? "Scale at globe center" : "Map scale"} style={{ "--map-distance": `${ruler.pixels}px` } as React.CSSProperties}>
          <span><span data-sr-only>{globe ? "Scale at globe center" : "Map scale"}, </span>{ruler.label}</span>
        </span>
        <span data-kit="map-north" aria-hidden><ArrowUp />N</span>
      </div>
      <div data-kit="map-detail">
        <MapPin aria-hidden />
        <div data-kit="map-record">
          <span data-kit="map-caption">{selected ? "Selected marker" : "Map view"}</span>
          <strong data-kit="map-name">{selected?.label ?? `${markers.length} ${markers.length === 1 ? "marker" : "markers"}`}</strong>
        </div>
        <div data-kit="map-position">
          <span data-kit="map-caption">{selected ? "Coordinates" : "Map center"}</span>
          <span data-kit="map-coordinates">{formatCoordinate(selected?.coordinate ?? camera.view.center)}</span>
        </div>
      </div>
      {tiles && !globe && <div data-kit="map-attribution">{tiles.attribution}</div>}
    </section>
  )
}

export { Map }
export type { MapAnnotation, MapCoordinate, MapMarker, MapProjection, MapProps, MapRoute, MapTiles, MapView, MapViewChangeDetails }
