"use client"

import * as React from "react"
import { project, unproject, type MapCoordinate } from "#src/vendor/cyberspec/lib/map/camera.ts"
import { arc, type MapAnnotation, type MapMarker, type MapRoute } from "#src/vendor/cyberspec/lib/map/chart.ts"
import { mapBordersPath, mapLandPath } from "#src/vendor/cyberspec/lib/map/geography.ts"
import { globeVector, type GlobeProjection, type GlobeVector } from "#src/vendor/cyberspec/lib/map/orthographic.ts"

const tau = 2 * Math.PI
const degrees = 180 / Math.PI
const wrap = (value: number, period: number) => ((value % period) + period) % period
type Line = GlobeVector[]

// The bundled basemap encodes each survey line as an absolute move followed
// by relative points. Decode it once, when the first globe is drawn.
function surveyLines(path: string) {
  return path.split("M").slice(1).map((part) => {
    const numbers = part.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const coordinates: MapCoordinate[] = []
    let x = 0, y = 0
    for (let i = 0; i < numbers.length; i += 2) {
      x += numbers[i] ?? 0
      y += numbers[i + 1] ?? 0
      const longitude = (x / 1024) * 360 - 180
      // Restore the pole at the two ends of Antarctica's cut meridian.
      const pole = y > 1023.99 && Math.abs(longitude) > 179.999
      const latitude = pole ? -90 : Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 1024))) * degrees
      coordinates.push([longitude, latitude])
    }
    return coordinates
  })
}

function geography() {
  const land: Line[] = []
  const coasts: Line[] = []
  const equatorCrossings: number[] = []
  for (const ring of surveyLines(mapLandPath)) {
    const points = ring.map(globeVector)
    land.push(points)
    let coast: Line = []
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length
      const a = points[i]!, b = points[j]!
      // The cut edges on the flat map are interior to the land on a globe.
      if (Math.abs(ring[i]![0]) > 179.999 && Math.abs(ring[j]![0]) > 179.999) {
        if (coast.length) coasts.push(coast)
        coast = []
      } else {
        if (!coast.length) coast.push(a)
        coast.push(b)
      }
      if ((a.z > 0) !== (b.z > 0)) {
        const hit = horizon(a, b)
        equatorCrossings.push(Math.atan2(hit.y, hit.x) * degrees)
      }
    }
    if (coast.length) coasts.push(coast)
  }
  const grid: Line[] = []
  for (let longitude = -180; longitude < 180; longitude += 15) {
    grid.push(Array.from({ length: 91 }, (_, i) => globeVector([longitude, -90 + i * 2])))
  }
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    grid.push(Array.from({ length: 181 }, (_, i) => globeVector([-180 + i * 2, latitude])))
  }
  return { land, coasts, borders: surveyLines(mapBordersPath).map((line) => line.map(globeVector)), grid, equatorCrossings }
}

let world: ReturnType<typeof geography> | undefined

// The intersection of a great-circle segment and the horizon lies in the
// plane of the segment and the Earth's center. Normalize the chord's cut.
function horizon(a: GlobeVector, b: GlobeVector): GlobeVector {
  const t = a.z / (a.z - b.z)
  const x = a.x + (b.x - a.x) * t
  const y = a.y + (b.y - a.y) * t
  const length = Math.hypot(x, y)
  return { x: x / length, y: y / length, z: 0 }
}

function frontSegments(line: Line, projection: GlobeProjection, ring = false) {
  const points = line.map(projection.rotate)
  const start = ring ? points.findIndex((point) => point.z < 0) : 0
  if (start === -1) return { closed: true, segments: [points] }
  const segments: Line[] = []
  let last = points[start]!
  let front: Line = last.z >= 0 ? [last] : []
  for (let offset = 1; offset < points.length + Number(ring); offset++) {
    const next = points[(start + offset) % points.length]!
    if ((next.z >= 0) !== (last.z >= 0)) {
      front.push(horizon(last, next))
      if (next.z < 0) {
        segments.push(front)
        front = []
      }
    }
    if (next.z >= 0) front.push(next)
    last = next
  }
  if (front.length > 1) segments.push(front)
  return { closed: false, segments }
}

const xy = (point: GlobeVector) => `${Number(point.x.toFixed(5))},${Number(point.y.toFixed(5))}`
const linePath = (points: Line) => "M" + points.map(xy).join("L")

function linework(lines: Line[], projection: GlobeProjection) {
  return lines.flatMap((line) => frontSegments(line, projection).segments.map(linePath)).join("")
}

// Each visible coastline is closed along the circular limb. Even-odd fill
// combines these caps, including holes and disconnected strips. At the
// eastern limb the Earth is on the equator, 90° east of the center. Its
// surveyed land/ocean parity tells us whether to include the disk itself.
function landPath(data: ReturnType<typeof geography>, projection: GlobeProjection) {
  const east = wrap(projection.center[0] + 90 + 180, 360) - 180
  // Use the opposite end of the equator if the reference touches a coast.
  const reference = data.equatorCrossings.some((lon) => Math.abs(lon - east) < 1e-7) ? Math.PI : 0
  const longitude = reference === 0 ? east : wrap(east, 360) - 180
  let includeDisk = data.equatorCrossings.filter((lon) => lon < longitude).length % 2 === 1
  const paths: string[] = []
  for (const ring of data.land) {
    const { closed, segments } = frontSegments(ring, projection, true)
    for (const front of segments) {
      let path = linePath(front)
      if (!closed) {
        const first = front[0]!, last = front[front.length - 1]!
        const end = Math.atan2(last.y, last.x)
        const sweep = wrap(Math.atan2(first.y, first.x) - end, tau)
        path += `A1,1 0 ${sweep > Math.PI ? 1 : 0} 1 ${xy(first)}`
        if (wrap(reference - end, tau) < sweep) includeDisk = !includeDisk
      }
      paths.push(path + "Z")
    }
  }
  if (includeDisk) paths.push("M1,0A1,1 0 1 1 -1,0A1,1 0 1 1 1,0Z")
  return paths.join("")
}

function routeLine(from: MapCoordinate, to: MapCoordinate, via?: readonly MapCoordinate[]) {
  if (!via) return arc(from, to).map(globeVector)
  // Surveyed paths on the sheet are straight in Mercator space. Sample those
  // same segments before rotating them onto the sphere.
  const points = [from, ...via, to].map(project)
  const line: Line = [globeVector(from)]
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]!
    const difference = points[i]!.x - start.x
    const dx = difference + Math.round(-difference / 1024) * 1024
    const dy = points[i]!.y - start.y
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 5))
    for (let step = 1; step <= steps; step++) {
      line.push(globeVector(unproject({ x: start.x + dx * step / steps, y: start.y + dy * step / steps })))
    }
  }
  return line
}

function GlobeChart({ projection, routes, markers, selectedId, annotations }: {
  projection: GlobeProjection
  routes: readonly MapRoute[]
  markers: readonly MapMarker[]
  selectedId?: string
  annotations: readonly MapAnnotation[]
}) {
  const id = React.useId()
  const { cx, cy, radius } = projection
  const surface = React.useMemo(() => {
    const data = world ??= geography()
    return {
      land: landPath(data, projection), coasts: linework(data.coasts, projection),
      borders: linework(data.borders, projection), grid: linework(data.grid, projection),
    }
    // Unit-sphere geometry depends on orientation alone.
  }, [projection.center[0], projection.center[1]])
  const links = React.useMemo(() => {
    const positions = new Map(markers.map((marker) => [marker.id, marker.coordinate]))
    return routes.flatMap((route) => {
      const from = positions.get(route.from), to = positions.get(route.to)
      return from && to ? [{ ...route, line: routeLine(from, to, route.via) }] : []
    })
  }, [routes, markers])
  const transform = `translate(${cx} ${cy}) scale(${radius})`
  return (
    <svg data-kit="map-chart" aria-hidden focusable="false">
      <defs>
        <radialGradient id={`${id}-light`} cx="34%" cy="30%" r="76%">
          <stop offset="0" stopColor="var(--cy-signal)" stopOpacity=".08" />
          <stop offset=".62" stopColor="var(--cy-void)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--cy-void)" stopOpacity=".48" />
        </radialGradient>
        <clipPath id={`${id}-hemisphere`}><circle cx={cx} cy={cy} r={radius} /></clipPath>
      </defs>
      <circle data-kit="map-globe-ocean" cx={cx} cy={cy} r={radius} />
      <g clipPath={`url(#${id}-hemisphere)`}>
        <g transform={transform}>
          <path data-kit="map-globe-land" d={surface.land} fillRule="evenodd" />
          <path data-kit="map-globe-coast" d={surface.coasts} />
          <path data-kit="map-border" d={surface.borders} />
          <path data-kit="map-grid" d={surface.grid} />
        </g>
        <circle cx={cx} cy={cy} r={radius} fill={`url(#${id}-light)`} />
        <g transform={transform}>
          {links.map(({ id, from, to, line }) => (
            <path key={id} data-kit="map-route" d={linework([line], projection)}
              data-active={!selectedId || from === selectedId || to === selectedId ? "" : undefined} />
          ))}
        </g>
        {annotations.map(({ label, coordinate }) => {
          const position = projection.point(coordinate)
          // The map's tracked 11px mono labels measure about 8px per glyph.
          // Hide a label once either end leaves the visible hemisphere.
          const edgeX = Math.abs(position.x - cx) + label.length * 4.1
          const edgeY = Math.max(Math.abs(position.y - cy - 10), Math.abs(position.y - cy + 2))
          if (!position.visible || Math.hypot(edgeX, edgeY) > radius - 2) return null
          return <text key={label} data-kit="map-annotation" x={position.x} y={position.y}>{label}</text>
        })}
      </g>
      <circle data-kit="map-globe-rim" cx={cx} cy={cy} r={radius} fill="none" />
    </svg>
  )
}

export { GlobeChart }
