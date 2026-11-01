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

  it('has plausible climate averages for every city', () => {
    for (const city of cities) {
      expect(city.avgTempC, city.name).toBeGreaterThan(-20);
      expect(city.avgTempC, city.name).toBeLessThan(35);
      expect(city.rainMmYear, city.name).toBeGreaterThanOrEqual(0);
      expect(city.rainMmYear, city.name).toBeLessThan(6000);
    }
  });

  it('can make a fair trio for every category', () => {
    for (const category of categories) {
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
