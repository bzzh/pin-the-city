const degrees = (value, positive, negative) =>
  `${Math.abs(value).toFixed(1)}° ${value >= 0 ? positive : negative}`;

// How close a trio must be. The winner beats the closest other city by at least `min` and at
// most `max`: a fraction for relative margins (0.05 = 5%), otherwise in the stat's own units.
const RELATIVE_5_TO_15 = { relative: true, min: 0.05, max: 0.15 };

// Each category names the city stat it compares and whether the highest or lowest value wins.
// `family` groups similar categories; a game asks at most 2 from the same family (see trio.js).
// `stat` is a field on a city object, or a function of the city for derived values.
// `format` turns a value into text for the reveal; without it, the value is shown with `unit`.
export const categories = [
  // Position on Earth: computed from coordinates, always exact.
  { id: 'northernmost', family: 'position', label: 'Furthest north', stat: 'lat', wins: 'highest', margin: { min: 1, max: 5 }, format: (v) => degrees(v, 'N', 'S') },
  { id: 'southernmost', family: 'position', label: 'Furthest south', stat: 'lat', wins: 'lowest', margin: { min: 1, max: 5 }, format: (v) => degrees(v, 'N', 'S') },
  { id: 'closest-equator', family: 'position', label: 'Closest to the equator', stat: (c) => Math.abs(c.lat), wins: 'lowest', margin: { min: 1, max: 5 }, format: (v) => `${v.toFixed(1)}° from the equator` },
  { id: 'easternmost', family: 'position', label: 'Furthest east (by longitude)', stat: 'lng', wins: 'highest', margin: { min: 2, max: 10 }, format: (v) => degrees(v, 'E', 'W') },

  // Population & size: from Wikidata (milestone 5).
  { id: 'most-populous', family: 'population', label: 'Most populous', stat: 'population', wins: 'highest', margin: RELATIVE_5_TO_15, unit: 'people' },
  { id: 'most-dense', family: 'population', label: 'Most densely populated', stat: (c) => c.population / c.areaKm2, wins: 'highest', margin: RELATIVE_5_TO_15, unit: 'people/km²' },
  { id: 'largest-area', family: 'size', label: 'Largest area', stat: 'areaKm2', wins: 'highest', margin: RELATIVE_5_TO_15, unit: 'km²' },
  { id: 'highest-elevation', family: 'elevation', label: 'Highest elevation', stat: 'elevationM', wins: 'highest', margin: { min: 100, max: 400 }, unit: 'm' },

  // Climate: from Open-Meteo (milestone 7).
  { id: 'hottest', family: 'climate', label: 'Hottest on average', stat: 'avgTempC', wins: 'highest', margin: { min: 0.5, max: 2 }, format: (v) => `${v.toFixed(1)} °C` },
  { id: 'coldest', family: 'climate', label: 'Coldest on average', stat: 'avgTempC', wins: 'lowest', margin: { min: 0.5, max: 2 }, format: (v) => `${v.toFixed(1)} °C` },
  { id: 'rainiest', family: 'climate', label: 'Rainiest', stat: 'rainMmYear', wins: 'highest', margin: RELATIVE_5_TO_15, unit: 'mm/year' },
  { id: 'sunniest', family: 'climate', label: 'Most sunshine', stat: 'sunHoursYear', wins: 'highest', margin: RELATIVE_5_TO_15, unit: 'h/year' },
];

export function statValue(category, city) {
  return typeof category.stat === 'function' ? category.stat(city) : city[category.stat];
}

// How much `winner` beats `other` in this category, in the margin's terms (negative if it loses).
export function advantage(category, winner, other) {
  const w = statValue(category, winner);
  const o = statValue(category, other);
  const [better, worse] = category.wins === 'highest' ? [w, o] : [o, w];
  return category.margin.relative ? better / worse - 1 : better - worse;
}

export function formatStat(category, city) {
  const value = statValue(category, city);
  return category.format ? category.format(value) : `${Math.round(value).toLocaleString('en')} ${category.unit}`;
}
