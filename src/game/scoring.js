const EARTH_RADIUS_KM = 6371;

export const CHOICE_POINTS = 500;
export const MAX_PLACE_POINTS = 1500;

// Guesses this close count as perfect, so a city's sprawl doesn't cost points.
const PERFECT_RADIUS_KM = 25;
// Distance at which placement points have dropped to ~37% of the maximum.
const FALLOFF_KM = 2000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance between two { lat, lng } points (haversine formula).
export function distanceKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function choicePoints(isCorrect) {
  return isCorrect ? CHOICE_POINTS : 0;
}

export function placementPoints(km) {
  if (km <= PERFECT_RADIUS_KM) return MAX_PLACE_POINTS;
  return Math.round(MAX_PLACE_POINTS * Math.exp(-(km - PERFECT_RADIUS_KM) / FALLOFF_KM));
}
