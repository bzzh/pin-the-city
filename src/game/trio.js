import { lead, statValue } from '../categories/categories.js';

// `random` returns a number in [0, 1), like Math.random. The daily mode passes a seeded one.
function shuffle(items, random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Picks a trio from `cities` for one context (a country, a reference city...) or none.
function pickTrioIn(cities, category, context, random) {
  const value = new Map();
  for (const city of cities) {
    if (category.inContext && !category.inContext(city, context)) continue;
    const v = statValue(category, city, context);
    if (Number.isFinite(v)) value.set(city, v);
  }
  const pool = shuffle([...value.keys()], random);
  const { min, max } = category.margin;

  for (const winner of pool) {
    const losers = pool.filter((city) => {
      const margin = lead(category, value.get(winner), value.get(city));
      return margin >= min && margin <= max && (!category.decoy || category.decoy(city, winner, context));
    });
    // With a trap, the first wrong answer is a trap and the second any other.
    const first = category.trap ? losers.find((city) => category.trap(city, winner, context)) : losers[0];
    const second = losers.find((city) => city !== first);
    if (first && second) {
      return { category, context, cities: shuffle([winner, first, second], random), winner };
    }
  }
  return null;
}

// Picks three cities for a category where the winner beats both others by a margin inside the
// category's band (close enough to be hard, far enough to be fair), or null if none exists.
// For a category with contexts, tries them in random order until one has a fair trio; the
// round then carries the `context` its question is about.
export function pickTrio(cities, category, random = Math.random) {
  if (!category.contexts) return pickTrioIn(cities, category, undefined, random);
  for (const context of shuffle(category.contexts(cities), random)) {
    const round = pickTrioIn(cities, category, context, random);
    if (round) return round;
  }
  return null;
}

// Daily challenges from this date pick a family first, then a category in it, so a family with
// many categories (position has five) doesn't crowd out the others. Earlier challenges gave
// every category the same chance; they keep doing so, so their rounds never change.
export const FAMILY_FIRST_START = '2026-11-25';
export const usesFamilyFirst = (dateKey) => dateKey >= FAMILY_FIRST_START;

// Picks a round from a random category that has a fair trio in this city set. With
// `familyFirst`, every family is equally likely, then every category within it.
export function pickRound(cities, categories, random = Math.random, familyFirst = false) {
  const order = familyFirst
    ? shuffle([...new Set(categories.map((category) => category.family))], random).flatMap((family) =>
        shuffle(categories.filter((category) => category.family === family), random),
      )
    : shuffle(categories, random);
  for (const category of order) {
    const round = pickTrio(cities, category, random);
    if (round) return round;
  }
  return null;
}

// Most questions a game may ask from one family of categories (e.g. two "position" questions).
export const MAX_PER_FAMILY = 2;

// Picks all the rounds of a game up front. A category is never asked twice and a family at most
// MAX_PER_FAMILY times; each round also prefers cities not seen yet in this game.
// `familyFirst` is passed on to pickRound.
export function planRounds(cities, categories, count, random = Math.random, { familyFirst = false } = {}) {
  const rounds = [];
  const usedCities = new Set();
  const usedCategories = new Set();
  const familyCounts = new Map();
  while (rounds.length < count) {
    const freshCities = cities.filter((city) => !usedCities.has(city));
    const allowed = categories.filter(
      (category) => !usedCategories.has(category) && (familyCounts.get(category.family) ?? 0) < MAX_PER_FAMILY,
    );
    const round = pickRound(freshCities, allowed, random, familyFirst) ?? pickRound(cities, allowed, random, familyFirst);
    if (!round) throw new Error('Not enough city data to plan a game.');
    round.cities.forEach((city) => usedCities.add(city));
    usedCategories.add(round.category);
    familyCounts.set(round.category.family, (familyCounts.get(round.category.family) ?? 0) + 1);
    rounds.push(round);
  }
  return rounds;
}
