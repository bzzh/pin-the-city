// The daily challenge: everyone who plays on the same (local) date gets the same five rounds,
// because the rounds are picked with a random generator seeded from the date.

const FIRST_DAY = Date.UTC(2026, 10, 1); // challenge #1 = 1 November 2026
const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-01" for the player's local calendar date.
export function dateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Challenge number shown in the share text: #1 on the first day, #2 the next...
export function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - FIRST_DAY) / DAY_MS) + 1;
}

// A small, fast seeded random generator (mulberry32): same seed, same sequence, on every device.
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Turns a date key into a seed (FNV-1a string hash).
export function seedFromKey(key) {
  let hash = 0x811c9dc5;
  for (const char of key) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const dailyRandom = (key) => seededRandom(seedFromKey(key));
