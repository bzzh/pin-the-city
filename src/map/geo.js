// Small spherical-geometry helpers for drawing on the globe. Points are { lat, lng } in degrees.
const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

// The point `km` away from `from` heading along `bearing` (degrees clockwise from north).
export function destination(from, km, bearing) {
  const angle = km / EARTH_RADIUS_KM;
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const heading = toRadians(bearing);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angle) + Math.cos(lat1) * Math.sin(angle) * Math.cos(heading));
  const lng2 =
    lng1 + Math.atan2(Math.sin(heading) * Math.sin(angle) * Math.cos(lat1), Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: toDegrees(lat2), lng: toDegrees(lng2) };
}

// A ring of points `km` from `center`: a true circle on the Earth's surface.
export function circle(center, km, steps = 96) {
  return Array.from({ length: steps + 1 }, (_, i) => destination(center, km, (360 * i) / steps));
}

// Points along the shortest path between two places (a great circle), so the line between the
// pin and the city follows the globe instead of the flat map.
export function greatCircle(from, to, steps = 64) {
  const toVector = ({ lat, lng }) => {
    const [φ, λ] = [toRadians(lat), toRadians(lng)];
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
  };
  const a = toVector(from);
  const b = toVector(to);
  const angle = Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  if (angle < 1e-9) return [from, to];
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wa = Math.sin((1 - t) * angle) / Math.sin(angle);
    const wb = Math.sin(t * angle) / Math.sin(angle);
    const [x, y, z] = [0, 1, 2].map((k) => wa * a[k] + wb * b[k]);
    points.push({ lat: toDegrees(Math.atan2(z, Math.hypot(x, y))), lng: toDegrees(Math.atan2(y, x)) });
  }
  return points;
}

// Rewrites longitudes so consecutive points never jump by more than 180°, which keeps lines
// and circles that cross the date line in one piece.
export function unwrap(points) {
  let previous = null;
  return points.map(({ lat, lng }) => {
    let next = lng;
    if (previous !== null) {
      while (next - previous > 180) next -= 360;
      while (next - previous < -180) next += 360;
    }
    previous = next;
    return { lat, lng: next };
  });
}
