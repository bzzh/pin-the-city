import { LEGACY_MAX_PLACE_POINTS, MAX_PLACE_POINTS } from './scoring.js';

const pts = (value) => value.toLocaleString('en');

// A round's placement points out of MAX_PLACE_POINTS (150). Rounds from before confidence
// levels were out of 1,500, so they are scaled down to match.
function placementScore(record) {
  if (record.level) return record.placePoints;
  return Math.round((record.placePoints / LEGACY_MAX_PLACE_POINTS) * MAX_PLACE_POINTS);
}

// e.g. "📍 Pin the City #12 · 721 / 1,000", then "✅ 132 · ❌ 86 · …" (the choice, then the
// placement out of 150 for each round), then the game's address. Never names the city or the
// question, so friends who haven't played aren't spoiled. `records` are the per-round results
// the game saves (see game.js).
export function buildShareText({ number, records, maxPoints, url }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const rounds = records.map((record) => `${record.correct ? '✅' : '❌'} ${placementScore(record)}`).join(' · ');
  return [`📍 Pin the City #${number} · ${pts(total)} / ${pts(maxPoints)}`, rounds, url].filter(Boolean).join('\n');
}
