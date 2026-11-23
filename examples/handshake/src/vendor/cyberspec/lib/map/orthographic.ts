import type { MapCoordinate } from "#src/vendor/cyberspec/lib/map/camera.ts"

const radians = Math.PI / 180
type GlobeVector = { x: number; y: number; z: number }

function globeVector([longitude, latitude]: MapCoordinate): GlobeVector {
  const lon = longitude * radians
  const lat = latitude * radians
  const horizontal = Math.cos(lat)
  return { x: horizontal * Math.cos(lon), y: horizontal * Math.sin(lon), z: Math.sin(lat) }
}

// Rotate a unit Earth into the camera's axes: east, screen-down and depth
// toward the viewer. The horizon is the plane z = 0.
function createGlobeProjection(center: MapCoordinate, width: number, height: number, radius: number) {
  const [longitude = 0, latitude = 0] = center.map((angle) => angle * radians)
  const cosLon = Math.cos(longitude), sinLon = Math.sin(longitude)
  const cosLat = Math.cos(latitude), sinLat = Math.sin(latitude)
  const cx = width / 2, cy = height / 2
  function rotate(point: GlobeVector): GlobeVector {
    const horizontal = cosLon * point.x + sinLon * point.y
    return {
      x: cosLon * point.y - sinLon * point.x,
      y: sinLat * horizontal - cosLat * point.z,
      z: cosLat * horizontal + sinLat * point.z,
    }
  }
  function point(coordinate: MapCoordinate) {
    const { x, y, z } = rotate(globeVector(coordinate))
    return { x: cx + x * radius, y: cy + y * radius, visible: z >= 0 }
  }
  return { cx, cy, radius, center, rotate, point }
}

type GlobeProjection = ReturnType<typeof createGlobeProjection>
export { createGlobeProjection, globeVector }
export type { GlobeProjection, GlobeVector }
