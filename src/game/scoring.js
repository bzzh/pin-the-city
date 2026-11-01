const EARTH_RADIUS_KM = 6371;

export const ROUNDS_PER_GAME = 5;
export const CHOICE_POINTS = 500;
export const MAX_PLACE_POINTS = 1500;
export const MAX_ROUND_POINTS = CHOICE_POINTS + MAX_PLACE_POINTS;

// Guesses this close count as perfect, so a city's sprawl doesn't cost points.
export const PERFECT_RADIUS_KM = 25;
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

// The original distance curve. Still scores daily challenges played before CONFIDENCE_START.
export function placementPoints(km) {
  if (km <= PERFECT_RADIUS_KM) return MAX_PLACE_POINTS;
  return Math.round(MAX_PLACE_POINTS * Math.exp(-(km - PERFECT_RADIUS_KM) / FALLOFF_KM));
}

// Before placing, the player says how sure they are. Each level is a circle around their tap:
// if the city (with its PERFECT_RADIUS_KM margin) touches it, they win the level's points.
// Smaller circles pay more; Pinpoint means landing within the city itself. A miss still earns
// MISS_SHARE of the distance score, the same at every level, so it always pays less than a hit.
export const CONFIDENCE_LEVELS = [
  { id: 'safe', label: 'Safe', radiusKm: 500, points: 500 },
  { id: 'confident', label: 'Confident', radiusKm: 250, points: 750 },
  { id: 'certain', label: 'Certain', radiusKm: 125, points: 1000 },
  { id: 'pinpoint', label: 'Pinpoint', radiusKm: 0, points: MAX_PLACE_POINTS },
];

// The first daily challenge played with confidence levels (practice games always use them).
export const CONFIDENCE_START = '2026-11-02';
export const usesConfidence = (dateKey) => dateKey >= CONFIDENCE_START;

export const MISS_SHARE = 0.25;

export const confidenceLevel = (id) => CONFIDENCE_LEVELS.find((level) => level.id === id);

// How far from the tap the city may be for this level to count, e.g. 275 km for Confident.
export const hitRadiusKm = (level) => level.radiusKm + PERFECT_RADIUS_KM;

export const isHit = (level, km) => km <= hitRadiusKm(level);

export function confidencePoints(level, km) {
  return isHit(level, km) ? level.points : Math.round(placementPoints(km) * MISS_SHARE);
}
