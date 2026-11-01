// Re-scores a daily challenge from the player's raw answers. Runs in the game and in the
// leaderboard server function (supabase/functions/submit-score), so a submitted score is
// always recalculated from the picks, confidence levels and map taps rather than trusted
// from the browser.
import { dailyRandom } from '../game/daily.js';
import {
  ROUNDS_PER_GAME,
  choicePoints,
  confidenceLevel,
  confidencePoints,
  distanceKm,
  placementPoints,
  usesConfidence,
} from '../game/scoring.js';
import { planRounds } from '../game/trio.js';

const round4 = (value) => Math.round(value * 10_000) / 10_000;

// Map taps are stored to 4 decimals (~11 m), plenty for scoring and compact to send.
export const roundGuess = ({ lat, lng }) => ({ lat: round4(lat), lng: round4(lng) });

const isGuess = (guess) =>
  guess !== null &&
  typeof guess === 'object' &&
  Number.isFinite(guess.lat) &&
  Number.isFinite(guess.lng) &&
  Math.abs(guess.lat) <= 90 &&
  Math.abs(guess.lng) <= 180;

// `picks` are the ids of the cities chosen in each round, `guesses` the { lat, lng } map taps
// and `levels` the confidence level ids (only for challenges from CONFIDENCE_START on).
// Throws an Error with a readable message if the answers don't fit that day's challenge.
export function scoreSubmission({ cities, categories, dateKey, picks, guesses, levels }) {
  if (!Array.isArray(picks) || !Array.isArray(guesses)) throw new Error('Missing picks or guesses.');
  if (picks.length !== ROUNDS_PER_GAME || guesses.length !== ROUNDS_PER_GAME) {
    throw new Error(`Expected ${ROUNDS_PER_GAME} picks and ${ROUNDS_PER_GAME} guesses.`);
  }
  const confidence = usesConfidence(dateKey);
  if (confidence && (!Array.isArray(levels) || levels.length !== ROUNDS_PER_GAME)) {
    throw new Error(`Expected ${ROUNDS_PER_GAME} confidence levels.`);
  }

  const rounds = planRounds(cities, categories, ROUNDS_PER_GAME, dailyRandom(dateKey));
  const records = rounds.map((round, i) => {
    const picked = round.cities.find((city) => city.id === picks[i]);
    if (!picked) throw new Error(`Round ${i + 1}: that city was not one of the choices.`);
    if (!isGuess(guesses[i])) throw new Error(`Round ${i + 1}: invalid map position.`);
    const level = confidence ? confidenceLevel(levels[i]) : null;
    if (confidence && !level) throw new Error(`Round ${i + 1}: unknown confidence level.`);

    const correct = picked === round.winner;
    const km = distanceKm(roundGuess(guesses[i]), round.winner);
    const place = level ? confidencePoints(level, km) : placementPoints(km);
    return { correct, km, points: choicePoints(correct, !confidence) + place };
  });

  return { total: records.reduce((sum, record) => sum + record.points, 0), records };
}
