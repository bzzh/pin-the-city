// Adds capitals, time zones and distance to the sea to public/data/cities.json.
//
// 1. Download ne_10m_coastline.geojson from Natural Earth, e.g.
//    https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_coastline.geojson
// 2. Run:  node scripts/build-facts.js path/to/ne_10m_coastline.geojson
//
// Run it again after build-cities.js, which rewrites cities.json without these facts.
// Each city gets:
// - capital: true for a national capital (Wikidata: the country's best-ranked P36 capital)
// - regionCapital: true for the capital of a first-level region: a state, province... (same way)
// - ownRegion: true for a city that is itself a first-level region (Hamburg, Shanghai, Moscow)
// - utcOffset: its standard-time offset from UTC in hours, ignoring daylight saving (geo-tz)
// - coastKm: the distance to the nearest sea coast (Natural Earth coastline)
import { readFile, writeFile } from 'node:fs/promises';
import { find as findTimeZones } from 'geo-tz';
import { qid, sparql } from './wikidata.js';

const OUT = new URL('../public/data/cities.json', import.meta.url);
const EARTH_RADIUS_KM = 6371;

// Cities where geo-tz finds several zones: the one used officially.
const TIME_ZONE = {
  Q16959: 'Asia/Shanghai', // Ürümqi: Xinjiang also uses UTC+6 unofficially, but China's official time is Beijing's
};

// Natural Earth's coastline follows a few big rivers far inland. Coastline points inside these
// river channels (longitude and latitude ranges) are ignored, so the sea starts at the river's
// mouth. Smaller estuaries (the Elbe, the Thames...) are left in: they move a city by less than
// the furthest-from-the-sea question's margin. The Caspian Sea counts as a sea.
const RIVER_CHANNELS = [
  { river: "St Lawrence, above Île d'Orléans", lng: [-80, -70.9], lat: [44, 47.5] },
  { river: 'Congo, above its mouth', lng: [12.45, 14], lat: [-6.5, -4] },
  { river: 'Amazon, above its mouth', lng: [-56, -51.5], lat: [-4, 0.5] },
  { river: 'Yangtze, above its estuary', lng: [117, 120.9], lat: [31.4, 32.6] },
  { river: 'Paraná and Uruguay, above the Río de la Plata', lng: [-61, -57.9], lat: [-34.05, -30] },
];
const inRiver = ([lng, lat]) =>
  RIVER_CHANNELS.some((box) => lng >= box.lng[0] && lng <= box.lng[1] && lat >= box.lat[0] && lat <= box.lat[1]);

const [coastlineFile] = process.argv.slice(2);
if (!coastlineFile) {
  console.error('Usage: node scripts/build-facts.js <path to ne_10m_coastline.geojson>');
  process.exit(1);
}

// National capitals among our cities.
async function capitals(ids) {
  const rows = await sparql(`
    SELECT DISTINCT ?city WHERE {
      VALUES ?city { ${ids.map((id) => `wd:${id}`).join(' ')} }
      ?country p:P36 ?statement ; wdt:P31 wd:Q6256 .
      ?statement a wikibase:BestRank ; ps:P36 ?city .
    }`);
  return new Set(rows.map((row) => qid(row.city)));
}

// Capitals of first-level regions (states, provinces...) among our cities.
async function regionCapitals(ids) {
  const rows = await sparql(`
    SELECT DISTINCT ?city WHERE {
      VALUES ?city { ${ids.map((id) => `wd:${id}`).join(' ')} }
      ?region p:P36 ?statement ; wdt:P31/wdt:P279* wd:Q10864048 .
      ?statement a wikibase:BestRank ; ps:P36 ?city .
      FILTER NOT EXISTS { ?region wdt:P576 [] }
    }`);
  return new Set(rows.map((row) => qid(row.city)));
}

// Cities that are first-level regions themselves: city-states and the like.
async function ownRegions(ids) {
  const rows = await sparql(`
    SELECT DISTINCT ?city WHERE {
      VALUES ?city { ${ids.map((id) => `wd:${id}`).join(' ')} }
      ?city wdt:P31/wdt:P279* wd:Q10864048 .
    }`);
  return new Set(rows.map((row) => qid(row.city)));
}

// Offset from UTC in hours for a time zone on a given day, e.g. 5.75 for Asia/Kathmandu.
function offsetHours(timeZone, date) {
  const name = new Intl.DateTimeFormat('en', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName').value; // "GMT+05:45", or "GMT" for 0
  const match = name.match(/([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) + Number(match[3]) / 60);
}

// Standard time is the smaller of the January and July offsets, in either hemisphere.
const standardOffset = (timeZone) =>
  Math.min(offsetHours(timeZone, new Date(Date.UTC(2026, 0, 15))), offsetHours(timeZone, new Date(Date.UTC(2026, 6, 15))));

// Great-circle distance in km from a city to the nearest coastline point. The 10 m coastline's
// points are close together, so measuring to points rather than segments is off by ~1 km.
function coastDistanceKm(city, points) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat = toRadians(city.lat);
  const lng = toRadians(city.lng);
  const cosLat = Math.cos(lat);
  let best = Infinity; // smallest haversine term, turned into km at the end
  for (const [pointLng, pointLat] of points) {
    const pLat = toRadians(pointLat);
    const h = Math.sin((pLat - lat) / 2) ** 2 + cosLat * Math.cos(pLat) * Math.sin((toRadians(pointLng) - lng) / 2) ** 2;
    if (h < best) best = h;
  }
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(best));
}

const cities = JSON.parse(await readFile(OUT, 'utf8'));
const geojson = JSON.parse(await readFile(coastlineFile, 'utf8'));
const points = geojson.features.flatMap(({ geometry }) =>
  (geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]).flat(),
).filter((point) => !inRiver(point));

const ids = cities.map((city) => city.id);
const capitalIds = await capitals(ids);
const regionCapitalIds = await regionCapitals(ids);
const ownRegionIds = await ownRegions(ids);
const ambiguousZones = [];
for (const city of cities) {
  delete city.capital;
  if (capitalIds.has(city.id)) city.capital = true;
  delete city.regionCapital;
  if (regionCapitalIds.has(city.id)) city.regionCapital = true;
  delete city.ownRegion;
  if (ownRegionIds.has(city.id)) city.ownRegion = true;

  const zones = findTimeZones(city.lat, city.lng);
  const zone = TIME_ZONE[city.id] ?? zones[0];
  if (zones.length !== 1 && !TIME_ZONE[city.id]) ambiguousZones.push(`${city.name} (${zones.join(', ')})`);
  city.utcOffset = standardOffset(zone);

  city.coastKm = Math.round(coastDistanceKm(city, points));
}

await writeFile(OUT, `${JSON.stringify(cities, null, 1)}\n`);

console.log(`${cities.filter((c) => c.capital).length} capitals, time zones and coast distances for ${cities.length} cities.`);
if (ambiguousZones.length) console.log(`Several time zones, used the first (add to TIME_ZONE): ${ambiguousZones.join(', ')}`);
const byCountry = Map.groupBy(cities.filter((c) => c.capital), (c) => c.country);
const shared = [...byCountry].filter(([, list]) => list.length > 1);
if (shared.length) console.log(`Countries with several capitals: ${shared.map(([country, list]) => `${country} (${list.map((c) => c.name).join(', ')})`).join('; ')}`);
console.log(`${cities.filter((c) => c.regionCapital).length} regional capitals; cities that are regions themselves: ${cities.filter((c) => c.ownRegion).map((c) => c.name).join(', ')}`);
const inland = [...cities].sort((a, b) => b.coastKm - a.coastKm).slice(0, 10);
console.log(`Furthest from the sea: ${inland.map((c) => `${c.name} ${c.coastKm} km`).join(', ')}`);
