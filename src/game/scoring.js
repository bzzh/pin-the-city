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

// Share of the placement points a guess this far off earns: 1 within PERFECT_RADIUS_KM, then
// falling smoothly towards 0.
function distanceShare(km) {
  return km <= PERFECT_RADIUS_KM ? 1 : Math.exp(-(km - PERFECT_RADIUS_KM) / FALLOFF_KM);
}

// The original distance score. Still used for daily challenges played before CONFIDENCE_START.
export function placementPoints(km) {
  return Math.round(MAX_PLACE_POINTS * distanceShare(km));
}

// Before placing, the player bets on how close they'll get. The placement first earns a base
// score out of BASE_PLACE_POINTS by distance. Each level is a circle around the tap: if the
// city (with its PERFECT_RADIUS_KM margin) touches it, the base is multiplied by `win`,
// otherwise by `lose`. Smaller circles are bigger bets, and only a Pinpoint hit reaches
// MAX_PLACE_POINTS.
export const BASE_PLACE_POINTS = 1000;
export const CONFIDENCE_LEVELS = [
  { id: 'safe', label: 'Safe', radiusKm: 500, win: 1.1, lose: 0.9 },
  { id: 'confident', label: 'Confident', radiusKm: 250, win: 1.2, lose: 0.8 },
  { id: 'certain', label: 'Certain', radiusKm: 75, win: 1.3, lose: 0.7 },
  { id: 'pinpoint', label: 'Pinpoint', radiusKm: 0, win: 1.5, lose: 0.5 },
];

// The first daily challenge played with confidence levels (practice games always use them).
export const CONFIDENCE_START = '2026-11-02';
export const usesConfidence = (dateKey) => dateKey >= CONFIDENCE_START;

export const confidenceLevel = (id) => CONFIDENCE_LEVELS.find((level) => level.id === id);

// How far from the tap the city may be for this level to count, e.g. 275 km for Confident.
export const hitRadiusKm = (level) => level.radiusKm + PERFECT_RADIUS_KM;

export const isHit = (level, km) => km <= hitRadiusKm(level);

export const multiplier = (level, km) => (isHit(level, km) ? level.win : level.lose);

export function confidencePoints(level, km) {
  return Math.round(BASE_PLACE_POINTS * distanceShare(km) * multiplier(level, km));
}
