import { advantage, statValue } from '../categories/categories.js';

// `random` returns a number in [0, 1), like Math.random. The daily mode passes a seeded one.
function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks three cities for a category where the winner beats both others by a margin inside the
// category's band (close enough to be hard, far enough to be fair), or null if none exists.
export function pickTrio(cities, category, random = Math.random) {
  const pool = shuffle(
    cities.filter((city) => Number.isFinite(statValue(category, city))),
    random,
  );
  const { min, max } = category.margin;

  for (const winner of pool) {
    const losers = pool.filter((city) => {
      const lead = advantage(category, winner, city);
      return lead >= min && lead <= max;
    });
    if (losers.length >= 2) {
      return { category, cities: shuffle([winner, losers[0], losers[1]], random), winner };
    }
  }
  return null;
}

// Picks a round from a random category that has a fair trio in this city set.
export function pickRound(cities, categories, random = Math.random) {
  for (const category of shuffle(categories, random)) {
    const round = pickTrio(cities, category, random);
    if (round) return round;
  }
  return null;
}

// Picks all the rounds of a game up front. Each round prefers cities not seen yet in this game
// and a category not asked yet, falling back to repeats only when the data runs out.
export function planRounds(cities, categories, count, random = Math.random) {
  const rounds = [];
  const usedCities = new Set();
  const usedCategories = new Set();
  while (rounds.length < count) {
    const freshCities = cities.filter((city) => !usedCities.has(city));
    const freshCategories = categories.filter((category) => !usedCategories.has(category));
    const round =
      pickRound(freshCities, freshCategories, random) ??
      pickRound(freshCities, categories, random) ??
      pickRound(cities, categories, random);
    if (!round) throw new Error('Not enough city data to plan a game.');
    round.cities.forEach((city) => usedCities.add(city));
    usedCategories.add(round.category);
    rounds.push(round);
  }
  return rounds;
}
