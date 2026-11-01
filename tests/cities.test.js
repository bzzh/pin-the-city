import { describe, expect, it } from 'vitest';
import cities from '../public/data/cities.json';
import { categories } from '../src/categories/categories.js';
import { pickTrio, planRounds } from '../src/game/trio.js';

// Checks the built dataset (public/data/cities.json) rather than the game logic.
describe('cities.json', () => {
  it('has a name, country and coordinates for every city', () => {
    for (const city of cities) {
      expect(city.name).toBeTruthy();
      expect(city.country).toBeTruthy();
      expect(Math.abs(city.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(city.lng)).toBeLessThanOrEqual(180);
    }
  });

  it('can make a fair trio for every category it has data for', () => {
    const climate = ['hottest', 'coldest', 'rainiest', 'sunniest']; // milestone 7
    for (const category of categories.filter((c) => !climate.includes(c.id))) {
      expect(pickTrio(cities, category), category.id).not.toBeNull();
    }
  });

  it('plans full games without reusing a city', () => {
    for (let game = 0; game < 50; game++) {
      const rounds = planRounds(cities, categories, 5);
      expect(new Set(rounds.flatMap((round) => round.cities)).size).toBe(15);
    }
  });
});
