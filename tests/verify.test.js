import { describe, expect, it } from 'vitest';
import cities from '../public/data/cities.json';
import { categories } from '../src/categories/categories.js';
import { dailyRandom } from '../src/game/daily.js';
import { planRounds } from '../src/game/trio.js';
import { roundGuess, scoreSubmission } from '../src/leaderboard/verify.js';

const DAY = '2026-11-05';
const rounds = planRounds(cities, categories, 5, dailyRandom(DAY));
const winners = rounds.map((round) => round.winner);
const perfect = {
  cities,
  categories,
  dateKey: DAY,
  picks: winners.map((city) => city.id),
  guesses: winners.map(({ lat, lng }) => ({ lat, lng })),
};

describe('scoreSubmission', () => {
  it('gives full marks for the right cities placed exactly', () => {
    expect(scoreSubmission(perfect).total).toBe(10_000);
  });

  it('gives no choice points for a wrong pick', () => {
    const wrongFirst = rounds[0].cities.find((city) => city !== rounds[0].winner);
    const result = scoreSubmission({ ...perfect, picks: [wrongFirst.id, ...perfect.picks.slice(1)] });
    expect(result.records[0].correct).toBe(false);
    expect(result.total).toBe(9_500);
  });

  it('scores placements by distance', () => {
    const farAway = { lat: -winners[0].lat, lng: winners[0].lng > 0 ? winners[0].lng - 180 : winners[0].lng + 180 };
    const result = scoreSubmission({ ...perfect, guesses: [farAway, ...perfect.guesses.slice(1)] });
    expect(result.records[0].points).toBeLessThan(510);
  });

  it('rejects a city that was not offered', () => {
    const offered = new Set(rounds[0].cities);
    const other = cities.find((city) => !offered.has(city));
    expect(() => scoreSubmission({ ...perfect, picks: [other.id, ...perfect.picks.slice(1)] })).toThrow(/not one of the choices/);
  });

  it('rejects the wrong number of answers or bad positions', () => {
    expect(() => scoreSubmission({ ...perfect, picks: perfect.picks.slice(1) })).toThrow(/Expected 5/);
    expect(() => scoreSubmission({ ...perfect, guesses: [{ lat: 95, lng: 0 }, ...perfect.guesses.slice(1)] })).toThrow(/invalid map position/);
    expect(() => scoreSubmission({ ...perfect, guesses: null })).toThrow(/Missing/);
  });

  it('scores answers against the day they were played', () => {
    // The same answers are very unlikely to be valid choices on another day.
    expect(() => scoreSubmission({ ...perfect, dateKey: '2026-11-06' })).toThrow();
  });
});

describe('roundGuess', () => {
  it('keeps 4 decimals', () => {
    expect(roundGuess({ lat: 48.856666, lng: 2.352222 })).toEqual({ lat: 48.8567, lng: 2.3522 });
  });
});
