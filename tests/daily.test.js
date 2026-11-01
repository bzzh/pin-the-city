import { describe, expect, it } from 'vitest';
import cities from '../public/data/cities.json';
import { categories } from '../src/categories/categories.js';
import {
  dailyRandom,
  dateKey,
  dayNumber,
  isCurrentDateKey,
  seededRandom,
  weekKeys,
  weekStartKey,
} from '../src/game/daily.js';
import { planRounds } from '../src/game/trio.js';

const describeRounds = (rounds) =>
  rounds.map((round) => `${round.category.id}:${round.cities.map((c) => c.name).join('/')}`);

describe('daily challenge', () => {
  it('formats the local date as YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
    expect(dateKey(new Date(2027, 0, 9))).toBe('2027-01-09');
  });

  it('numbers challenges from the first day', () => {
    expect(dayNumber('2026-11-01')).toBe(1);
    expect(dayNumber('2026-11-02')).toBe(2);
    expect(dayNumber('2027-11-01')).toBe(366);
  });

  it('gives everyone the same rounds on the same day', () => {
    const first = planRounds(cities, categories, 5, dailyRandom('2026-11-05'));
    const second = planRounds(cities, categories, 5, dailyRandom('2026-11-05'));
    expect(describeRounds(first)).toEqual(describeRounds(second));
  });

  it('gives different rounds on different days', () => {
    const monday = planRounds(cities, categories, 5, dailyRandom('2026-11-02'));
    const tuesday = planRounds(cities, categories, 5, dailyRandom('2026-11-03'));
    expect(describeRounds(monday)).not.toEqual(describeRounds(tuesday));
  });

  it('produces numbers between 0 and 1', () => {
    const random = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('weeks', () => {
  it('starts each week on Monday', () => {
    expect(weekStartKey('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(weekStartKey('2026-11-05')).toBe('2026-11-02');
    expect(weekStartKey('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekStartKey('2026-11-09')).toBe('2026-11-09');
    expect(weekStartKey('2026-11-01')).toBe('2026-10-26');
    expect(weekStartKey('2027-01-01')).toBe('2026-12-28'); // across the new year
  });

  it('lists the seven days of a week', () => {
    expect(weekKeys('2026-11-02')).toEqual([
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
    ]);
  });
});

describe('isCurrentDateKey', () => {
  const noonUtc = new Date(Date.UTC(2026, 10, 5, 12));

  it('accepts dates that are today somewhere on Earth', () => {
    expect(isCurrentDateKey('2026-11-04', noonUtc)).toBe(true);
    expect(isCurrentDateKey('2026-11-05', noonUtc)).toBe(true);
    expect(isCurrentDateKey('2026-11-06', noonUtc)).toBe(true);
  });

  it('rejects older and future dates', () => {
    expect(isCurrentDateKey('2026-11-03', noonUtc)).toBe(false);
    expect(isCurrentDateKey('2026-11-07', noonUtc)).toBe(false);
  });

  it('rejects malformed dates', () => {
    for (const bad of ['2026-11-5', '2026-02-30', 'yesterday', '', null, 20261105]) {
      expect(isCurrentDateKey(bad, noonUtc)).toBe(false);
    }
  });
});
