# Data scripts

Run with Node when the data needs rebuilding; they are not part of the game itself.

- `build-cities.js` — reads `city-list.txt`, looks every city up on Wikidata, and writes
  `public/data/cities.json` (coordinates, region, population, area, elevation). It prints any
  city it could not find and any area it dropped as implausible.
- `city-list.txt` — the cities in the game, one `City | Country` per line
- `wikidata.js` — shared helper for Wikidata queries
- `build-climate.js` — adds yearly average temperature and rainfall from WorldClim to
  `public/data/cities.json`. Run it after `build-cities.js`, which rewrites the file without them.
- `build-facts.js` — adds national and regional capitals (Wikidata), standard-time UTC offsets (`geo-tz`) and
  distance to the sea (Natural Earth 10 m coastline, a file you download) to
  `public/data/cities.json`. Like the climate script, run it after `build-cities.js`.
