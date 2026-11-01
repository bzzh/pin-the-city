import { MAX_PLACE_POINTS } from './scoring.js';

// One coloured square per placement, by share of the maximum placement points.
const SQUARES = [
  [0.8, '🟩'], // within ~450 km
  [0.5, '🟨'], // within ~1,400 km
  [0.2, '🟧'], // within ~3,250 km
  [0, '🟥'],
];

export function placementSquare(placePoints) {
  const share = placePoints / MAX_PLACE_POINTS;
  return SQUARES.find(([min]) => share >= min)[1];
}

// e.g. "Pin the City #12 · 7,850 / 10,000\n✅🟩 ❌🟨 ✅🟩 ✅🟥 ❌🟩\nhttps://…"
// `records` are the per-round results the game saves (see game.js).
export function buildShareText({ number, records, maxPoints, url }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const rounds = records.map((record) => `${record.correct ? '✅' : '❌'}${placementSquare(record.placePoints)}`);
  return [
    `Pin the City #${number} · ${total.toLocaleString('en')} / ${maxPoints.toLocaleString('en')}`,
    rounds.join(' '),
    url,
  ]
    .filter(Boolean)
    .join('\n');
}
