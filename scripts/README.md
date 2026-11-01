# Data scripts

Run with Node when the data needs rebuilding; they are not part of the game itself.

- `build-cities.js` — reads `city-list.txt`, looks every city up on Wikidata, and writes
  `public/data/cities.json` (coordinates, region, population, area, elevation). It prints any
  city it could not find and any area it dropped as implausible.
- `city-list.txt` — the cities in the game, one `City | Country` per line
- `wikidata.js` — shared helper for Wikidata queries

Milestone 7: `fetch-climate.js` will add temperature, rainfall and sunshine from Open-Meteo.
