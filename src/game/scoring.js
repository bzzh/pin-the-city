const EARTH_RADIUS_KM = 6371;

export const ROUNDS_PER_GAME = 5;
// A game is out of 1,000: each round is up to 50 for the choice and 150 for the placement.
export const CHOICE_POINTS = 50;
export const MAX_PLACE_POINTS = 150;
export const MAX_ROUND_POINTS = CHOICE_POINTS + MAX_PLACE_POINTS;

// Daily challenges before CONFIDENCE_START were scored 10 times bigger, with placements by
// distance only. Kept so those results and leaderboard submissions still add up.
const LEGACY_CHOICE_POINTS = 500;
export const LEGACY_MAX_PLACE_POINTS = 1500;
const LEGACY_MAX_ROUND_POINTS = LEGACY_CHOICE_POINTS + LEGACY_MAX_PLACE_POINTS;

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

// `legacy` scores a daily challenge from before CONFIDENCE_START.
export function choicePoints(isCorrect, legacy = false) {
  if (!isCorrect) return 0;
  return legacy ? LEGACY_CHOICE_POINTS : CHOICE_POINTS;
}

// Most points one round can score: 200, or 2,000 for daily challenges from before confidence levels.
export const maxRoundPoints = (confidence) => (confidence ? MAX_ROUND_POINTS : LEGACY_MAX_ROUND_POINTS);

// Share of the placement points a guess this far off earns: 1 within PERFECT_RADIUS_KM, then
// falling smoothly towards 0.
function distanceShare(km) {
  return km <= PERFECT_RADIUS_KM ? 1 : Math.exp(-(km - PERFECT_RADIUS_KM) / FALLOFF_KM);
}

// The original distance score, out of 1,500. Only for daily challenges before CONFIDENCE_START.
export function placementPoints(km) {
  return Math.round(LEGACY_MAX_PLACE_POINTS * distanceShare(km));
}

// Before placing, the player bets on how close they'll get. The placement first earns a base
// score out of BASE_PLACE_POINTS by distance. Each level is a circle around the tap: if the
// city is within `radiusKm` (exactly the distance the player is shown), the base is
// multiplied by `win`, otherwise by `lose`. Smaller circles are bigger bets, and only a
// Pinpoint hit reaches MAX_PLACE_POINTS.
export const BASE_PLACE_POINTS = 100;
//
// Each step up shrinks the circle and moves both multipliers 0.2 further from 1, which keeps
// three rules true at every distance (checked in tests): a hit always beats a miss, a miss
// costs less on a safer bet, and a hit pays more on a bolder bet.
export const CONFIDENCE_LEVELS = [
  { id: 'safe', label: 'Safe', radiusKm: 500, win: 1.1, lose: 0.9 },
  { id: 'confident', label: 'Confident', radiusKm: 150, win: 1.3, lose: 0.7 },
  { id: 'pinpoint', label: 'Pinpoint', radiusKm: PERFECT_RADIUS_KM, win: 1.5, lose: 0.5 },
];

// Bets no longer offered, still scored for leaderboard submissions sent shortly after a change.
const RETIRED_LEVELS = [{ id: 'certain', label: 'Certain', radiusKm: 75, win: 1.4, lose: 0.7 }];

// The first daily challenge played with confidence levels (practice games always use them).
export const CONFIDENCE_START = '2026-11-02';
export const usesConfidence = (dateKey) => dateKey >= CONFIDENCE_START;

export const confidenceLevel = (id) => [...CONFIDENCE_LEVELS, ...RETIRED_LEVELS].find((level) => level.id === id);

export const isHit = (level, km) => km <= level.radiusKm;

export const multiplier = (level, km) => (isHit(level, km) ? level.win : level.lose);

export function confidencePoints(level, km) {
  return Math.round(BASE_PLACE_POINTS * distanceShare(km) * multiplier(level, km));
}

// A placement split for the round recap: the accuracy score (out of BASE_PLACE_POINTS, before
// the bet) and the bet's bonus or malus. They always add up to confidencePoints.
export function placementParts(level, km) {
  const accuracy = Math.round(BASE_PLACE_POINTS * distanceShare(km));
  return { accuracy, bet: confidencePoints(level, km) - accuracy };
}
