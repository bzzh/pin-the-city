# Pin the City

A daily geography game out of 1,000 points. Each of the 5 rounds (up to 200 pts) has three steps:

1. **Choose** (50 pts) — a category such as "Most densely populated" with three cities; pick the right one.
2. **Bet** — say how close you'll get to the correct city. Each level is a circle around your
   tap with a multiplier for landing inside it or missing: Safe (500 km, ×1.1 / ×0.9),
   Confident (150 km, ×1.3 / ×0.7) or Pinpoint (25 km, ×1.5 / ×0.5).
3. **Place** — tap the map, which has no borders or labels. The placement scores up to 100
   pts by distance, then the multiplier applies: inside if the city is within your circle's
   distance. Only a Pinpoint hit reaches 150.

Daily challenges before 2 November 2026 were out of 10,000: 500 pts for the choice and up to
1,500 for a placement scored by distance only.

After the daily challenge, players can share their result: the total, then ✅ or ❌ for each
round's choice with its placement points out of 150 (never the city or the question).

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
  game's own code (`src/leaderboard/verify.js`) and re-scores the player's picks, confidence levels and map taps.
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
| `src/map/` | Satellite globe ([MapLibre GL](https://maplibre.org/)), press-and-hold placing, bet circles and the line to the answer |
| `src/game/` | Game rules: flow, scoring, picking city trios, daily seed, share text |
| `src/categories/categories.js` | Category definitions (stat, highest/lowest wins, unit) |
| `src/ui/` | Choice card, HUD, start, summary, nickname and leaderboard screens |
| `src/leaderboard/` | Leaderboard client, nickname rules and score verification (shared with the server) |
| `supabase/` | Leaderboard database setup and server function |
| `public/data/cities.json` | The ~350 cities and their stats, made by `scripts/build-cities.js` |
| `scripts/` | Node scripts that build the city data |
| `tests/` | Vitest tests (`tests/fixtures/` holds a small fixed city set) |

## Milestones

1. Map: land shapes, zoom and pan on desktop and mobile
2. Placement round: place a city, see distance and points
3. Choice round: category card with three cities
4. Full loop: 5 rounds of choose → place, summary screen
5. Real data: ~300 cities with position and population stats
6. Daily challenge, share text, deploy to GitHub Pages
7. Climate categories (done), streaks, free play

## Credits

Map: [EOxCloudless](https://cloudless.eox.at) by EOX IT Services GmbH (Contains modified
Copernicus Sentinel data 2024), loaded from EOX's tile service and shown on a
[MapLibre GL](https://maplibre.org/) globe so northern regions keep their true size. It is licensed
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/): free for non-commercial
use with the credit shown on the map; commercial use needs a licence from EOX.

City data: [Wikidata](https://www.wikidata.org/) (CC0). To change the cities, edit
`scripts/city-list.txt` and run `node scripts/build-cities.js`, then `node scripts/build-climate.js`
(see that file for the WorldClim files it needs).

Climate: [WorldClim 2.1](https://www.worldclim.org/data/worldclim21.html) 1970–2000 averages
(Fick, S.E. and R.J. Hijmans, 2017. WorldClim 2: new 1km spatial resolution climate surfaces for
global land areas. International Journal of Climatology 37: 4302–4315).
