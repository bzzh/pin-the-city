// Builds public/data/cities.json from scripts/city-list.txt using Wikidata.
//
//   node scripts/build-cities.js
//
// For each "City | Country" line it finds the Wikidata item with that English name in that
// country (the most famous one if several match), then fetches coordinates, region,
// population, area and elevation. Prints anything it could not find, plus outliers to check.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { qid, sparql } from './wikidata.js';

const LIST = new URL('./city-list.txt', import.meta.url);
const OUT = new URL('../public/data/cities.json', import.meta.url);
const BATCH = 60;
const STATS_BATCH = 20; // some cities have hundreds of yearly population figures

// Other English names Wikidata may use for a country in city-list.txt.
const WIKIDATA_COUNTRY = {
  China: "People's Republic of China",
  Netherlands: 'Kingdom of the Netherlands',
  Denmark: 'Kingdom of Denmark',
};

// Wikidata sometimes pairs a metro population with a city-centre area (or the reverse), or
// describes a whole municipality or province. Areas outside these limits are dropped, so the
// city just sits out area and density questions rather than giving a misleading answer.
const MAX_AREA_KM2 = 5000;
const MIN_DENSITY = 200;
const MAX_DENSITY = 50_000;

// Cities whose Wikidata elevation is wrong (e.g. the highest point of the municipality
// instead of the city itself). They sit out elevation questions.
const BAD_ELEVATION = new Set([
  'Q23482', // Marseille: 648 m listed, but the city is near sea level
]);

const chunks = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const literal = (text) => `${JSON.stringify(text)}@en`;
const entities = (ids) => ids.map((id) => `wd:${id}`).join(' ');

async function readList() {
  const text = await readFile(LIST, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [name, country, id] = line.split('|').map((part) => part.trim());
      return { name, country, id };
    });
}

// Finds the Wikidata item for each listed city.
async function resolve(cities) {
  const candidates = new Map(); // name -> Map(id -> { sitelinks, countries, isCountry })
  for (const batch of chunks(cities.filter((c) => !c.id), BATCH)) {
    const rows = await sparql(`
      SELECT ?name ?city ?sitelinks ?countryLabel ?iso WHERE {
        VALUES ?name { ${batch.map((c) => literal(c.name)).join(' ')} }
        ?city rdfs:label ?name ; wdt:P625 [] ; wdt:P1082 [] ; wikibase:sitelinks ?sitelinks .
        OPTIONAL { ?city wdt:P17 ?country . ?country rdfs:label ?countryLabel . FILTER(LANG(?countryLabel) = "en") }
        OPTIONAL { ?city wdt:P297 ?iso }
      }`);
    for (const row of rows) {
      const byId = candidates.get(row.name) ?? new Map();
      const id = qid(row.city);
      const entry = byId.get(id) ?? { id, sitelinks: Number(row.sitelinks), countries: new Set(), isCountry: Boolean(row.iso) };
      if (row.countryLabel) entry.countries.add(row.countryLabel);
      byId.set(id, entry);
      candidates.set(row.name, byId);
    }
  }

  const problems = [];
  const resolved = [];
  for (const city of cities) {
    if (city.id) {
      resolved.push(city); // pinned in city-list.txt
      continue;
    }
    const wanted = [city.country, WIKIDATA_COUNTRY[city.country]];
    const options = [...(candidates.get(city.name)?.values() ?? [])];
    const matches = options
      .filter((option) => wanted.some((name) => option.countries.has(name)))
      // Prefer the city over a country of the same name (Luxembourg, Djibouti), then fame.
      .sort((a, b) => a.isCountry - b.isCountry || b.sitelinks - a.sitelinks);
    if (matches.length === 0) {
      const seen = options.map((o) => [...o.countries].join('/') || '?').join(', ');
      problems.push(`${city.name} | ${city.country}: not found${seen ? ` (found in: ${seen})` : ''}`);
      continue;
    }
    resolved.push({ ...city, id: matches[0].id });
  }
  return { resolved, problems };
}

// The best value per city for a property: among its best-ranked statements (preferred if any),
// the one with the most recent date.
async function statementValues(ids, property) {
  const best = new Map();
  for (const batch of chunks(ids, STATS_BATCH)) {
    // psn: gives values normalised to SI units (m² for area, metres for elevation).
    const valuePath = property === 'P1082' ? `ps:${property}` : `psn:${property}/wikibase:quantityAmount`;
    const rows = await sparql(`
      SELECT ?city ?value ?date WHERE {
        VALUES ?city { ${entities(batch)} }
        ?city p:${property} ?statement .
        ?statement a wikibase:BestRank ; ${valuePath} ?value .
        OPTIONAL { ?statement pq:P585 ?date }
      }`);
    for (const row of rows) {
      const id = qid(row.city);
      const date = row.date ?? '';
      if (!best.has(id) || date > best.get(id).date) best.set(id, { value: Number(row.value), date });
    }
  }
  return new Map([...best].map(([id, { value }]) => [id, value]));
}

async function coordinates(ids) {
  const result = new Map();
  for (const batch of chunks(ids, BATCH)) {
    const rows = await sparql(`
      SELECT ?city ?coord WHERE { VALUES ?city { ${entities(batch)} } ?city wdt:P625 ?coord }`);
    for (const row of rows) {
      const id = qid(row.city);
      if (result.has(id)) continue;
      const [lng, lat] = row.coord.replace(/^Point\(|\)$/g, '').split(' ').map(Number);
      result.set(id, { lat, lng });
    }
  }
  return result;
}

// The first-level region (state, province, region...) each city lies in.
async function regions(ids) {
  const result = new Map();
  for (const batch of chunks(ids, BATCH)) {
    const rows = await sparql(`
      SELECT ?city ?regionLabel WHERE {
        VALUES ?city { ${entities(batch)} }
        ?city wdt:P131+ ?region .
        ?region wdt:P31/wdt:P279* wd:Q10864048 .
        FILTER NOT EXISTS { ?region wdt:P576 [] }
        ?region rdfs:label ?regionLabel . FILTER(LANG(?regionLabel) = "en")
      }`);
    for (const row of rows) {
      const id = qid(row.city);
      if (!result.has(id)) result.set(id, row.regionLabel);
    }
  }
  return result;
}

const round1 = (value) => Math.round(value * 10) / 10;

function printOutliers(cities) {
  const top = (label, key, value, format, count = 5) => {
    const sorted = cities.filter((c) => Number.isFinite(value(c))).sort((a, b) => value(b) - value(a));
    const show = (list) => list.map((c) => `${c.name} ${format(value(c))}`).join(', ');
    console.log(`${label}\n  highest: ${show(sorted.slice(0, count))}\n  lowest:  ${show(sorted.slice(-count).reverse())}`);
  };
  top('Population', 'population', (c) => c.population, (v) => v.toLocaleString('en'));
  top('Area (km²)', 'areaKm2', (c) => c.areaKm2, (v) => v.toLocaleString('en'));
  top('Density (people/km²)', 'density', (c) => c.population / c.areaKm2, (v) => Math.round(v).toLocaleString('en'));
  top('Elevation (m)', 'elevationM', (c) => c.elevationM, (v) => v);
}

const list = await readList();
const { resolved, problems } = await resolve(list);
const ids = resolved.map((city) => city.id);
// One query at a time, to stay friendly with the shared Wikidata service.
const coords = await coordinates(ids);
const region = await regions(ids);
const population = await statementValues(ids, 'P1082');
const area = await statementValues(ids, 'P2046');
const elevation = await statementValues(ids, 'P2044');

const droppedAreas = [];
const cities = resolved.map(({ id, name, country }) => {
  const city = { id, name, country, ...coords.get(id) };
  const regionName = region.get(id);
  if (regionName && regionName !== name && regionName !== country) city.region = regionName;
  if (population.has(id)) city.population = Math.round(population.get(id));
  if (area.has(id)) {
    const areaKm2 = round1(area.get(id) / 1e6);
    const density = city.population / areaKm2;
    if (areaKm2 <= MAX_AREA_KM2 && density >= MIN_DENSITY && density <= MAX_DENSITY) {
      city.areaKm2 = areaKm2;
    } else {
      droppedAreas.push(`${name} (${areaKm2.toLocaleString('en')} km², ${Math.round(density).toLocaleString('en')}/km²)`);
    }
  }
  if (elevation.has(id) && !BAD_ELEVATION.has(id)) city.elevationM = Math.round(elevation.get(id));
  return city;
});

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(cities, null, 1)}\n`);

const missing = (key) => cities.filter((c) => c[key] === undefined).map((c) => c.name);
console.log(`Wrote ${cities.length} of ${list.length} cities to public/data/cities.json`);
for (const problem of problems) console.log(`  ! ${problem}`);
if (droppedAreas.length) console.log(`Dropped implausible areas (${droppedAreas.length}): ${droppedAreas.join(', ')}`);
for (const key of ['region', 'population', 'areaKm2', 'elevationM']) {
  const names = missing(key);
  if (names.length) console.log(`Missing ${key} (${names.length}): ${names.join(', ')}`);
}
printOutliers(cities);
