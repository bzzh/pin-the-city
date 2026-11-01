# Pin the City

A daily geography game. Each of the 5 rounds has two steps:

1. **Choose** (500 pts) — a category such as "Most densely populated" with three cities; pick the right one.
2. **Place** (up to 1,500 pts) — place the correct city on a borderless, label-free world map; points drop with distance.

## Setup

Requires [Node.js](https://nodejs.org) (LTS).

```bash
npm install
npm run dev      # start the dev server, then open the printed URL
npm test         # run the tests
npm run build    # production build into dist/
```

On Windows PowerShell, if `npm` is blocked ("running scripts is disabled on this system"),
use `npm.cmd` instead, e.g. `npm.cmd run dev`.

## Weekly leaderboard

Players who finish the daily challenge can join a public weekly leaderboard with a nickname:
the top 10 by the sum of their daily scores, Monday to Sunday. It runs on
[Supabase](https://supabase.com) (project settings in `src/leaderboard/config.js`):

- `supabase/migrations/` — the database tables and the `weekly_leaderboard` query. Run the SQL
  once in the Supabase dashboard's SQL Editor.
- `supabase/functions/submit-score/` — the server function that registers nicknames and
  accepts scores. It never trusts the browser's score: it rebuilds that day's rounds with the
  game's own code (`src/leaderboard/verify.js`) and re-scores the player's picks and map taps.
- Deploy the function after changing it or the game rules it reuses (scoring, categories,
  round picking): `npx supabase login` once, then `npm run deploy:server`.

## Publishing

`.github/workflows/deploy.yml` builds, tests and publishes the game to GitHub Pages on every
push to `main`. One-time setup: create a GitHub repository, push this project to it, then in
the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. The game is then
at `https://<your-username>.github.io/<repository-name>/`.

## Project layout

| Path | What it is |
|---|---|
| `src/main.js` | Entry point |
| `src/map/mapView.js` | Leaflet map on a flat lat/long grid, tap to place, reveal line |
| `public/tiles/` | Physical map tiles (relief, land cover, rivers), made by `scripts/build-tiles.js` |
| `src/game/` | Game rules: flow, scoring, picking city trios, daily seed, share text |
| `src/categories/categories.js` | Category definitions (stat, highest/lowest wins, unit) |
| `src/ui/` | Choice card, HUD, start, summary, nickname and leaderboard screens |
| `src/leaderboard/` | Leaderboard client, nickname rules and score verification (shared with the server) |
| `supabase/` | Leaderboard database setup and server function |
| `public/data/cities.json` | The ~350 cities and their stats, made by `scripts/build-cities.js` |
| `scripts/` | Node scripts that build the map tiles and the city data |
| `tests/` | Vitest tests (`tests/fixtures/` holds a small fixed city set) |

## Milestones

1. Map: land shapes, zoom and pan on desktop and mobile
2. Placement round: place a city, see distance and points
3. Choice round: category card with three cities
4. Full loop: 5 rounds of choose → place, summary screen
5. Real data: ~300 cities with position and population stats
6. Daily challenge, share text, deploy to GitHub Pages
7. Climate categories, streaks, free play

## Credits

Map: [Natural Earth II](https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-2/) with shaded relief, water and drainages (public domain).

City data: [Wikidata](https://www.wikidata.org/) (CC0). To change the cities, edit
`scripts/city-list.txt` and run `node scripts/build-cities.js`.

To rebuild the tiles, download `NE2_HR_LC_SR_W_DR.zip` (311 MB), unzip it, and run
`node scripts/build-tiles.js path/to/NE2_HR_LC_SR_W_DR.tif`.
