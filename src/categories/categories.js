import { distanceKm } from '../game/scoring.js';

const degrees = (value, positive, negative) =>
  `${Math.abs(value).toFixed(1)}° ${value >= 0 ? positive : negative}`;

// "UTC+5:45", "UTC−3", "UTC±0".
function utcOffset(hours) {
  if (hours === 0) return 'UTC±0';
  const whole = Math.floor(Math.abs(hours));
  const minutes = Math.round((Math.abs(hours) - whole) * 60);
  return `UTC${hours > 0 ? '+' : '−'}${whole}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
}

// How close a trio must be. The winner beats the closest other city by at least `min` and at
// most `max`: a fraction for relative margins (0.1 = 10%), otherwise in the stat's own units.
const RELATIVE_10_TO_20 = { relative: true, min: 0.1, max: 0.2 };

// The countries with at least `count` cities that have this category's stat, in city-list order.
function countriesWith(cities, count, stat) {
  const counts = new Map();
  for (const city of cities) {
    if (Number.isFinite(stat(city))) counts.set(city.country, (counts.get(city.country) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= count).map(([country]) => country);
}

// Country names that read with "the" in a sentence: "Most populous in the United States".
const WITH_THE = /^(United |Netherlands$|Czech Republic$|Philippines$|Maldives$|Dominican Republic$|Democratic Republic|Republic of)/;
const inSentence = (country) => (WITH_THE.test(country) ? `the ${country}` : country);

// "Perth, Australia", or just "Singapore" when the city and country share a name.
const placeName = (city) => (city.name === city.country ? city.name : `${city.name}, ${city.country}`);

// Countries left out of the capital question because which city is the capital is disputed.
const DISPUTED_CAPITALS = new Set(['Israel']);
// A capital question needs decoys big enough to be tempting: at least this share of the
// capital's population. It keeps out "Paris, Lyon or Toulouse?" but keeps Sydney vs Canberra.
const CAPITAL_DECOY_SHARE = 0.5;

// What a first-level region's capital is called, per country ("Which city is… a state capital").
const REGION_CAPITAL_LABEL = {
  'United States': 'A state capital',
  Germany: 'A state capital',
  India: 'A state capital',
  Mexico: 'A state capital',
  Canada: 'A provincial capital',
  China: 'A provincial or regional capital',
  'United Kingdom': 'The capital of Scotland, Wales or Northern Ireland',
};
// Cities left out of the regional-capital question, where either answer could be argued.
const ARGUABLE_REGION_CAPITALS = new Set([
  'Q1353', // Delhi: a union territory, whose seat of government is New Delhi
  'Q41211', // San Juan: capital of Puerto Rico, a territory rather than a state
]);
// Choices for the regional-capital question: not national capitals (a different question), and
// not cities that are a region of their own (Hamburg, Shanghai), unless also a region's capital.
const regionCapitalChoice = (city) =>
  !city.capital && (city.regionCapital || !city.ownRegion) && !ARGUABLE_REGION_CAPITALS.has(city.id);

// Each category names the city stat it compares and whether the highest or lowest value wins.
// `family` groups similar categories; a game asks at most 2 from the same family (see trio.js).
// `stat` is a field on a city object, or a function of the city for derived values.
// `format` turns a value into text for the reveal; without it, the value is shown with `unit`.
//
// Some categories are about one country or one reference city, chosen per round: `contexts`
// lists the possible ones for a set of cities, `inContext(city, context)` says which cities may
// be the choices, and `label`, `stat` and `format` get the context as an extra argument.
// `decoy(city, winner, context)`, if given, must accept each of the two wrong answers, and
// `trap(city, winner, context)` at least one of them: a wrong answer that looks right.
// `hideRegion` shows only the country under each choice.
//
// `since` is the first daily challenge a category appears in (practice games use them all), so
// adding categories never changes a day's challenge that someone may already have played.
export const categories = [
  // Position on Earth: computed from coordinates, always exact.
  { id: 'northernmost', family: 'position', label: 'Furthest north', stat: 'lat', wins: 'highest', margin: { min: 2, max: 7 }, format: (v) => degrees(v, 'N', 'S') },
  { id: 'southernmost', family: 'position', label: 'Furthest south', stat: 'lat', wins: 'lowest', margin: { min: 2, max: 7 }, format: (v) => degrees(v, 'N', 'S') },
  { id: 'closest-equator', family: 'position', label: 'Closest to the equator', stat: (c) => Math.abs(c.lat), wins: 'lowest', margin: { min: 2, max: 7 }, format: (v) => `${v.toFixed(1)}° from the equator` },
  { id: 'easternmost', family: 'position', label: 'Furthest east (by longitude)', stat: 'lng', wins: 'highest', margin: { min: 4, max: 14 }, format: (v) => degrees(v, 'E', 'W') },

  // Population & size: from Wikidata (milestone 5).
  { id: 'most-populous', family: 'population', label: 'Most populous', stat: 'population', wins: 'highest', margin: RELATIVE_10_TO_20, unit: 'people' },
  { id: 'most-dense', family: 'population', label: 'Most densely populated', stat: (c) => c.population / c.areaKm2, wins: 'highest', margin: RELATIVE_10_TO_20, unit: 'people/km²' },
  { id: 'largest-area', family: 'size', label: 'Largest area', stat: 'areaKm2', wins: 'highest', margin: RELATIVE_10_TO_20, unit: 'km²' },
  { id: 'highest-elevation', family: 'elevation', label: 'Highest elevation', stat: 'elevationM', wins: 'highest', margin: { min: 200, max: 550 }, unit: 'm' },

  // Climate: 1970–2000 averages from WorldClim (scripts/build-climate.js).
  { id: 'hottest', family: 'climate', label: 'Hottest on average', stat: 'avgTempC', wins: 'highest', margin: { min: 1, max: 3 }, format: (v) => `${v.toFixed(1)} °C` },
  { id: 'coldest', family: 'climate', label: 'Coldest on average', stat: 'avgTempC', wins: 'lowest', margin: { min: 1, max: 3 }, format: (v) => `${v.toFixed(1)} °C` },
  { id: 'rainiest', family: 'climate', label: 'Rainiest', stat: 'rainMmYear', wins: 'highest', margin: RELATIVE_10_TO_20, unit: 'mm/year' },

  // Within one country: three cities from the same country.
  {
    id: 'country-most-populous',
    family: 'population',
    since: '2026-11-25',
    label: (country) => `Most populous in ${inSentence(country)}`,
    stat: 'population',
    wins: 'highest',
    // Wider than most-populous: a country has few cities, and the famous-but-smaller trap is the point.
    margin: { relative: true, min: 0.1, max: 1 },
    unit: 'people',
    contexts: (cities) => countriesWith(cities, 3, (c) => c.population),
    inContext: (city, country) => city.country === country,
  },
  {
    id: 'country-northernmost',
    family: 'position',
    since: '2026-11-25',
    label: (country) => `Furthest north in ${inSentence(country)}`,
    stat: 'lat',
    wins: 'highest',
    margin: { min: 1, max: 6 },
    format: (v) => degrees(v, 'N', 'S'),
    contexts: (cities) => countriesWith(cities, 3, (c) => c.lat),
    inContext: (city, country) => city.country === country,
  },
  {
    id: 'capital',
    family: 'capital',
    since: '2026-11-25',
    label: (country) => `The capital of ${inSentence(country)}`,
    // 1 for the capital, 0 for the others, so the winner always "beats" them by exactly 1.
    stat: (c) => (c.capital ? 1 : 0),
    wins: 'highest',
    margin: { min: 1, max: 1 },
    format: (v) => (v ? 'Capital' : 'Not the capital'),
    // Countries with exactly one capital among the cities (South Africa has three capitals).
    contexts: (cities) =>
      countriesWith(cities, 3, (c) => c.population).filter(
        (country) => !DISPUTED_CAPITALS.has(country) && cities.filter((c) => c.country === country && c.capital).length === 1,
      ),
    inContext: (city, country) => city.country === country,
    decoy: (city, capital) => city.population >= CAPITAL_DECOY_SHARE * capital.population,
    // "Australian Capital Territory" under Canberra would give it away.
    hideRegion: true,
  },

  {
    id: 'region-capital',
    family: 'capital',
    since: '2026-11-25',
    label: (country) => REGION_CAPITAL_LABEL[country] ?? 'A regional capital',
    stat: (c) => (c.regionCapital ? 1 : 0),
    wins: 'highest',
    margin: { min: 1, max: 1 },
    format: (v) => (v ? 'Capital' : 'Not a capital'),
    contexts: (cities) => {
      const choices = cities.filter((c) => regionCapitalChoice(c) && Number.isFinite(c.population));
      return [...new Set(choices.map((c) => c.country))].filter((country) => {
        const inCountry = choices.filter((c) => c.country === country);
        return inCountry.some((c) => c.regionCapital) && inCountry.filter((c) => !c.regionCapital).length >= 2;
      });
    },
    // Three cities from one country, so the question is which one, not which country.
    inContext: (city, country) => city.country === country && regionCapitalChoice(city),
    decoy: (city, capital) => city.population >= CAPITAL_DECOY_SHARE * capital.population,
    // Some regions are named after their capital (Novosibirsk Oblast).
    hideRegion: true,
  },

  // Distance to a reference city chosen per round.
  {
    id: 'closest-to',
    family: 'distance',
    since: '2026-11-25',
    label: (reference) => `Closest to ${placeName(reference)}`,
    stat: (c, reference) => distanceKm(c, reference),
    wins: 'lowest',
    margin: { relative: true, min: 0.15, max: 0.6 },
    format: (v, reference) => `${Math.round(v).toLocaleString('en')} km from ${reference.name}`,
    contexts: (cities) => cities.filter((c) => Number.isFinite(c.lat)),
    // Not the reference's next-door neighbours (too easy), nor so far that it's guesswork.
    inContext: (city, reference) => {
      const km = distanceKm(city, reference);
      return km >= 300 && km <= 3500;
    },
  },

  // Time zones and the sea (scripts/build-facts.js).
  {
    id: 'clock-ahead',
    family: 'time',
    since: '2026-11-25',
    label: 'Furthest ahead on the clock (standard time)',
    stat: 'utcOffset',
    wins: 'highest',
    margin: { min: 0.25, max: 3 },
    format: utcOffset,
    // Otherwise it's just "furthest east": one wrong answer is east of the winner but behind
    // it on the clock (Madrid is ahead of London, Chongqing ahead of Jakarta).
    trap: (city, winner) => city.lng >= winner.lng + 3,
  },
  { id: 'furthest-from-sea', family: 'sea', since: '2026-11-25', label: 'Furthest from the sea', stat: 'coastKm', wins: 'highest', margin: { min: 150, max: 450 }, format: (v) => `${Math.round(v).toLocaleString('en')} km from the sea` },
];

// The categories a daily challenge on this date ("2026-11-25") may ask.
export const categoriesFor = (dateKey, list = categories) =>
  list.filter((category) => !category.since || category.since <= dateKey);

export function statValue(category, city, context) {
  return typeof category.stat === 'function' ? category.stat(city, context) : city[category.stat];
}

// How much a city with value `w` beats one with value `o` in the margin's terms (negative if it loses).
export function lead(category, w, o) {
  const [better, worse] = category.wins === 'highest' ? [w, o] : [o, w];
  return category.margin.relative ? better / worse - 1 : better - worse;
}

// How much `winner` beats `other` in this category, in the margin's terms (negative if it loses).
export function advantage(category, winner, other, context) {
  return lead(category, statValue(category, winner, context), statValue(category, other, context));
}

// The question for a round, e.g. "Most populous in Brazil".
export const roundLabel = ({ category, context }) =>
  typeof category.label === 'function' ? category.label(context) : category.label;

export function formatStat(category, city, context) {
  const value = statValue(category, city, context);
  return category.format ? category.format(value, context) : `${Math.round(value).toLocaleString('en')} ${category.unit}`;
}
