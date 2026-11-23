import { project, type MapCoordinate } from "#src/vendor/cyberspec/lib/map/camera.ts"

type MapMarker = { id: string; label: string; coordinate: MapCoordinate; code?: string }
type MapRoute = { id: string; from: string; to: string; via?: readonly MapCoordinate[] }
type MapAnnotation = { label: string; coordinate: MapCoordinate }

const radians = Math.PI / 180

// Interpolate on the sphere before projecting, so a long link bends toward
// the pole. Equally valid arcs join exact antipodes; use the meridian there.
function arc(from: MapCoordinate, to: MapCoordinate): MapCoordinate[] {
  const [lon = 0, lat = 0] = from.map((angle) => angle * radians)
  const [endLon = 0, endLat = 0] = to.map((angle) => angle * radians)
  const delta = endLon - lon
  const east = Math.sin(delta) * Math.cos(endLat)
  const north = Math.cos(lat) * Math.sin(endLat) - Math.sin(lat) * Math.cos(endLat) * Math.cos(delta)
  const dot = Math.sin(lat) * Math.sin(endLat) + Math.cos(lat) * Math.cos(endLat) * Math.cos(delta)
  const length = Math.atan2(Math.hypot(east, north), dot)
  const bearing = Math.hypot(east, north) < 1e-12 ? 0 : Math.atan2(east, north)
  const steps = Math.ceil(length / (2 * radians))
  const points: MapCoordinate[] = [from]
  for (let i = 1; i < steps; i++) {
    const angle = (length * i) / steps
    const sinLat = Math.sin(lat) * Math.cos(angle) + Math.cos(lat) * Math.sin(angle) * Math.cos(bearing)
    const alongLon = Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(lat), Math.cos(angle) - Math.sin(lat) * sinLat)
    points.push([(lon + alongLon) / radians, Math.asin(Math.max(-1, Math.min(1, sinLat))) / radians])
  }
  points.push(to)
  return points
}

function routePaths(routes: readonly MapRoute[], markers: readonly MapMarker[]) {
  const byId = new Map(markers.map((marker) => [marker.id, marker.coordinate]))
  return routes.flatMap((route) => {
    const from = byId.get(route.from)
    const to = byId.get(route.to)
    if (!from || !to) return []
    const coordinates = route.via ? [from, ...route.via, to] : arc(from, to)
    let previous = project(from).x
    const path = coordinates.map((coordinate, i) => {
      const { x, y } = project(coordinate)
      // Cross the date line into the adjacent copy of the map.
      previous = x + Math.round((previous - x) / 1024) * 1024
      return `${i === 0 ? "M" : "L"}${previous.toFixed(3)} ${y.toFixed(3)}`
    }).join("")
    return [{ ...route, path }]
  })
}

function graticule() {
  let path = ""
  for (let lon = -180; lon < 180; lon += 15) path += `M${project([lon, 0]).x} 0v1024`
  for (let lat = -75; lat <= 75; lat += 15) path += `M0 ${project([0, lat]).y}h1024`
  return path
}

function rulerDistance(target: number) {
  const power = 10 ** Math.floor(Math.log10(target))
  const step = [5, 2, 1].find((step) => step * power <= target) ?? 1
  const metres = step * power
  return { metres, label: metres >= 1000 ? `${metres / 1000} km` : `${metres} m` }
}

function scaleBar(worldWidth: number, latitude: number, maxPixels: number) {
  const metresPerPixel = 40075016.686 * Math.cos(latitude * radians) / worldWidth
  const { metres, label } = rulerDistance(maxPixels * metresPerPixel)
  return { pixels: metres / metresPerPixel, label }
}

// A centered great-circle arc of angle θ projects to a chord 2r sin(θ/2).
function globeScaleBar(radius: number, maxPixels: number) {
  const earthRadius = 6371008.8
  const angle = 2 * Math.asin(Math.min(1, maxPixels / (2 * radius)))
  const { metres, label } = rulerDistance(angle * earthRadius)
  return { pixels: 2 * radius * Math.sin(metres / (2 * earthRadius)), label }
}

export { arc, globeScaleBar, graticule, routePaths, scaleBar }
export type { MapAnnotation, MapMarker, MapRoute }
