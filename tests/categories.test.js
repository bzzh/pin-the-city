import { describe, expect, it } from 'vitest';
import cities from '../public/data/cities.json';
import { advantage, categories, categoriesFor, formatStat, roundLabel, statValue } from '../src/categories/categories.js';
import { dailyRandom, seededRandom } from '../src/game/daily.js';
import { distanceKm } from '../src/game/scoring.js';
import { pickTrio, planRounds, usesFamilyFirst } from '../src/game/trio.js';

const byId = (id) => categories.find((category) => category.id === id);

// Many rounds of one category from the real cities, one per seed.
const rounds = (id, count = 100) =>
  Array.from({ length: count }, (_, seed) => pickTrio(cities, byId(id), seededRandom(seed + 1)));

describe('daily categories', () => {
  it('only asks a category from its start date on', () => {
    const newIds = categories.filter((category) => category.since).map((category) => category.id);
    expect(newIds.length).toBeGreaterThan(0);
    for (const category of categoriesFor('2026-11-24')) expect(newIds).not.toContain(category.id);
    expect(categoriesFor('2026-11-25')).toEqual(categories);
  });

  it('keeps the challenges from before new categories exactly as they were', () => {
    const describe = (key) =>
      planRounds(cities, categoriesFor(key), 5, dailyRandom(key), { familyFirst: usesFamilyFirst(key) })
        .map((round) => `${round.category.id}:${round.cities.map((city) => city.id).join('/')}`)
        .join(' ');
    expect(describe('2026-11-24')).toBe(
      'closest-equator:Q36036/Q10686/Q1761 largest-area:Q81033/Q34600/Q36312 highest-elevation:Q38283/Q1773/Q1022 most-dense:Q172/Q1361/Q649 rainiest:Q16552/Q3805/Q3579',
    );
  });
});

describe('questions about one country', () => {
  it('picks three cities from the country in the question, with a fair winner', () => {
    for (const id of ['country-most-populous', 'country-northernmost', 'capital', 'region-capital']) {
      const category = byId(id);
      for (const round of rounds(id)) {
        expect(round.cities.every((city) => city.country === round.context), id).toBe(true);
        if (id !== 'region-capital') expect(roundLabel(round)).toContain(round.context);
        for (const other of round.cities.filter((city) => city !== round.winner)) {
          const lead = advantage(category, round.winner, other, round.context);
          expect(lead).toBeGreaterThanOrEqual(category.margin.min);
          expect(lead).toBeLessThanOrEqual(category.margin.max);
        }
      }
    }
  });

  it('asks for the capital with big cities as decoys', () => {
    for (const round of rounds('capital')) {
      expect(round.winner.capital).toBe(true);
      for (const other of round.cities.filter((city) => city !== round.winner)) {
        expect(other.capital).toBeUndefined();
        expect(other.population).toBeGreaterThanOrEqual(0.5 * round.winner.population);
      }
    }
  });

  it('asks for a state or provincial capital, never a national capital or a city-state', () => {
    for (const round of rounds('region-capital')) {
      expect(round.winner.regionCapital).toBe(true);
      for (const city of round.cities) expect(city.capital).toBeUndefined();
      for (const other of round.cities.filter((city) => city !== round.winner)) {
        expect(other.regionCapital).toBeUndefined();
        expect(other.ownRegion).toBeUndefined();
        expect(other.population).toBeGreaterThanOrEqual(0.5 * round.winner.population);
      }
    }
    expect(roundLabel({ category: byId('region-capital'), context: 'Canada' })).toBe('A provincial capital');
    const choices = rounds('region-capital', 300).flatMap((round) => round.cities.map((city) => city.name));
    for (const name of ['Shanghai', 'Hamburg', 'Delhi', 'San Juan', 'Saint Petersburg']) expect(choices).not.toContain(name);
  });

  it('never asks for the capital of a country with several or disputed capitals', () => {
    const countries = byId('capital').contexts(cities);
    expect(countries).toContain('Australia');
    expect(countries).not.toContain('South Africa');
    expect(countries).not.toContain('Israel');
  });

  it('says "the" before country names that need it', () => {
    expect(roundLabel({ category: byId('capital'), context: 'United States' })).toBe('The capital of the United States');
    expect(roundLabel({ category: byId('country-most-populous'), context: 'Brazil' })).toBe('Most populous in Brazil');
  });
});

describe('closest to a city', () => {
  it('names a reference city that is not a choice, at a sensible distance from all three', () => {
    for (const round of rounds('closest-to')) {
      expect(round.cities).not.toContain(round.context);
      for (const city of round.cities) {
        const km = distanceKm(city, round.context);
        expect(km).toBeGreaterThanOrEqual(300);
        expect(km).toBeLessThanOrEqual(3500);
      }
      expect(roundLabel(round)).toContain(round.context.name);
      expect(formatStat(byId('closest-to'), round.winner, round.context)).toMatch(/ km from /);
    }
  });
});

describe('clocks', () => {
  it('always includes a wrong answer east of the winner, so it is not just "furthest east"', () => {
    for (const round of rounds('clock-ahead')) {
      const others = round.cities.filter((city) => city !== round.winner);
      expect(others.some((city) => city.lng >= round.winner.lng + 3)).toBe(true);
      for (const other of others) expect(statValue(byId('clock-ahead'), other)).toBeLessThan(round.winner.utcOffset);
    }
  });

  it('shows offsets as UTC times', () => {
    const show = (utcOffset) => formatStat(byId('clock-ahead'), { utcOffset });
    expect(show(5.75)).toBe('UTC+5:45');
    expect(show(-3)).toBe('UTC−3');
    expect(show(0)).toBe('UTC±0');
    expect(show(9.5)).toBe('UTC+9:30');
  });
});
