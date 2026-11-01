import { describe, expect, it } from 'vitest';
import { advantage, categories, statValue } from '../src/categories/categories.js';
import { sampleCities } from './fixtures/sampleCities.js';
import { pickRound, pickTrio, planRounds } from '../src/game/trio.js';

const byId = (id) => categories.find((category) => category.id === id);

// Small seeded generator so every test run picks the same trios.
function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const city = (name, lat) => ({ name, lat, lng: 0 });

describe('pickTrio', () => {
  it('returns three different cities whose winner has the best stat', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const id of ['northernmost', 'southernmost', 'closest-equator', 'easternmost']) {
        const category = byId(id);
        const round = pickTrio(sampleCities, category, seededRandom(seed));
        expect(new Set(round.cities).size).toBe(3);
        expect(round.cities).toContain(round.winner);

        const values = round.cities.map((c) => statValue(category, c));
        const best = category.wins === 'highest' ? Math.max(...values) : Math.min(...values);
        expect(statValue(category, round.winner)).toBe(best);

        for (const other of round.cities.filter((c) => c !== round.winner)) {
          const lead = advantage(category, round.winner, other);
          expect(lead).toBeGreaterThanOrEqual(category.margin.min);
          expect(lead).toBeLessThanOrEqual(category.margin.max);
        }
      }
    }
  });

  it('rejects trios that are too close to call', () => {
    const tooClose = [city('A', 10), city('B', 10.5), city('C', 10.2)];
    expect(pickTrio(tooClose, byId('northernmost'), seededRandom(1))).toBeNull();
  });

  it('rejects trios where the winner is too obvious', () => {
    const tooEasy = [city('A', 10), city('B', 30), city('C', 50)];
    expect(pickTrio(tooEasy, byId('northernmost'), seededRandom(1))).toBeNull();
  });

  it('rejects trios where only one other city is close', () => {
    const oneFarOff = [city('A', 10), city('B', 13), city('C', -20)];
    expect(pickTrio(oneFarOff, byId('northernmost'), seededRandom(1))).toBeNull();
  });

  it('accepts trios where both other cities are inside the band', () => {
    const cities = [city('A', 10), city('B', 13), city('C', 9)];
    const round = pickTrio(cities, byId('northernmost'), seededRandom(1));
    expect(round.winner.name).toBe('B');
  });

  it('measures population-style margins as percentages', () => {
    const mostPopulous = byId('most-populous');
    const withPopulation = (name, population) => ({ name, population });
    const tenPercent = [withPopulation('A', 1_100_000), withPopulation('B', 1_000_000), withPopulation('C', 980_000)];
    expect(pickTrio(tenPercent, mostPopulous, seededRandom(1)).winner.name).toBe('A');

    const twoPercent = [withPopulation('A', 1_020_000), withPopulation('B', 1_000_000), withPopulation('C', 980_000)];
    expect(pickTrio(twoPercent, mostPopulous, seededRandom(1))).toBeNull();
  });

  it('skips categories the cities have no data for', () => {
    expect(pickTrio(sampleCities, byId('most-populous'), seededRandom(1))).toBeNull();
  });
});

describe('pickRound', () => {
  it('falls back to a category that has data', () => {
    const round = pickRound(sampleCities, categories, seededRandom(7));
    expect(['northernmost', 'southernmost', 'closest-equator', 'easternmost']).toContain(round.category.id);
  });
});

describe('planRounds', () => {
  it('plans five rounds without reusing a city', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rounds = planRounds(sampleCities, categories, 5, seededRandom(seed));
      expect(rounds).toHaveLength(5);
      const allCities = rounds.flatMap((round) => round.cities);
      expect(new Set(allCities).size).toBe(15);
    }
  });

  it('asks every playable category before repeating one', () => {
    // Evenly spread cities, so every position category has plenty of fair trios.
    const grid = Array.from({ length: 60 }, (_, i) => ({ name: `C${i}`, lat: -59 + i * 2, lng: -177 + i * 4 }));
    const rounds = planRounds(grid, categories, 5, seededRandom(3));
    const firstFour = rounds.slice(0, 4).map((round) => round.category.id);
    expect(new Set(firstFour).size).toBe(4);
  });

  it('fails clearly when no category has data', () => {
    const noCoordinates = [{ name: 'A' }, { name: 'B' }, { name: 'C' }];
    expect(() => planRounds(noCoordinates, categories, 5, seededRandom(1))).toThrow();
  });
});
