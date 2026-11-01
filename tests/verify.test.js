import { describe, expect, it } from 'vitest';
import cities from '../public/data/cities.json';
import { categories } from '../src/categories/categories.js';
import { dailyRandom } from '../src/game/daily.js';
import { planRounds } from '../src/game/trio.js';
import { roundGuess, scoreSubmission } from '../src/leaderboard/verify.js';

// Answers that would win every round of a day: right cities, placed exactly, all Pinpoint.
function perfectAnswers(dateKey) {
  const rounds = planRounds(cities, categories, 5, dailyRandom(dateKey));
  const winners = rounds.map((round) => round.winner);
  return {
    rounds,
    winners,
    answers: {
      cities,
      categories,
      dateKey,
      picks: winners.map((city) => city.id),
      guesses: winners.map(({ lat, lng }) => ({ lat, lng })),
      levels: winners.map(() => 'pinpoint'),
    },
  };
}

const replaceFirst = (list, value) => [value, ...list.slice(1)];
const antipode = ({ lat, lng }) => ({ lat: -lat, lng: lng > 0 ? lng - 180 : lng + 180 });

describe('scoreSubmission', () => {
  const { rounds, winners, answers: perfect } = perfectAnswers('2026-11-05');

  it('gives full marks for the right cities pinpointed exactly', () => {
    expect(scoreSubmission(perfect).total).toBe(1_000);
  });

  it('gives no choice points for a wrong pick', () => {
    const wrongFirst = rounds[0].cities.find((city) => city !== rounds[0].winner);
    const result = scoreSubmission({ ...perfect, picks: replaceFirst(perfect.picks, wrongFirst.id) });
    expect(result.records[0].correct).toBe(false);
    expect(result.total).toBe(950);
  });

  it('multiplies the placement up inside the bet circle and down outside it', () => {
    const base = (km) => 100 * Math.exp(-(km - 25) / 2000);
    // About 100 km north of the city: inside Confident (150 km), outside Pinpoint (25 km).
    const nearby = { lat: winners[0].lat + 0.9, lng: winners[0].lng };
    const confident = scoreSubmission({ ...perfect, guesses: replaceFirst(perfect.guesses, nearby), levels: replaceFirst(perfect.levels, 'confident') });
    expect(confident.records[0].points).toBe(50 + Math.round(base(confident.records[0].km) * 1.3));
    const pinpoint = scoreSubmission({ ...perfect, guesses: replaceFirst(perfect.guesses, nearby), levels: replaceFirst(perfect.levels, 'pinpoint') });
    expect(pinpoint.records[0].points).toBe(50 + Math.round(base(pinpoint.records[0].km) * 0.5));
  });

  it('still accepts the retired Certain bet from games started before it was removed', () => {
    const result = scoreSubmission({ ...perfect, levels: replaceFirst(perfect.levels, 'certain') });
    expect(result.records[0].points).toBe(50 + 140);
  });

  it('scores nothing for a far-off placement', () => {
    const result = scoreSubmission({ ...perfect, guesses: replaceFirst(perfect.guesses, antipode(winners[0])), levels: replaceFirst(perfect.levels, 'safe') });
    expect(result.records[0].points).toBe(50);
  });

  it('rejects a city that was not offered', () => {
    const offered = new Set(rounds[0].cities);
    const other = cities.find((city) => !offered.has(city));
    expect(() => scoreSubmission({ ...perfect, picks: replaceFirst(perfect.picks, other.id) })).toThrow(/not one of the choices/);
  });

  it('rejects the wrong number of answers, bad positions or unknown levels', () => {
    expect(() => scoreSubmission({ ...perfect, picks: perfect.picks.slice(1) })).toThrow(/Expected 5/);
    expect(() => scoreSubmission({ ...perfect, guesses: replaceFirst(perfect.guesses, { lat: 95, lng: 0 }) })).toThrow(/invalid map position/);
    expect(() => scoreSubmission({ ...perfect, guesses: null })).toThrow(/Missing/);
    expect(() => scoreSubmission({ ...perfect, levels: undefined })).toThrow(/confidence levels/);
    expect(() => scoreSubmission({ ...perfect, levels: replaceFirst(perfect.levels, 'sure') })).toThrow(/unknown confidence level/);
  });

  it('scores answers against the day they were played', () => {
    // The same answers are very unlikely to be valid choices on another day.
    expect(() => scoreSubmission({ ...perfect, dateKey: '2026-11-06' })).toThrow();
  });
});

describe('scoreSubmission before confidence levels', () => {
  const { winners, answers } = perfectAnswers('2026-11-01');
  const { levels, ...perfect } = answers;

  it('scores placements by distance and needs no levels', () => {
    expect(scoreSubmission(perfect).total).toBe(10_000);
    // About 200 km off still earns most of the 1,500 placement points on the distance curve.
    const nearby = { lat: winners[0].lat + 1.8, lng: winners[0].lng };
    const result = scoreSubmission({ ...perfect, guesses: replaceFirst(perfect.guesses, nearby) });
    expect(result.records[0].points).toBeGreaterThan(500 + 1300);
    expect(result.records[0].points).toBeLessThan(500 + 1450);
  });
});

describe('roundGuess', () => {
  it('keeps 4 decimals', () => {
    expect(roundGuess({ lat: 48.856666, lng: 2.352222 })).toEqual({ lat: 48.8567, lng: 2.3522 });
  });
});
