import './styles/main.css';
import { createMap } from './map/mapView.js';
import { categories } from './categories/categories.js';
import { MAX_ROUND_POINTS, startGame } from './game/game.js';
import { dailyRandom, dateKey, dayNumber } from './game/daily.js';
import { buildShareText } from './game/share.js';
import { loadDaily, saveDaily } from './game/storage.js';
import { setHud } from './ui/hud.js';
import { showStartScreen, showSummary } from './ui/screens.js';

const panel = document.getElementById('panel');
let game = null;
const map = createMap(document.getElementById('map'), { onPick: (guess) => game?.handlePick(guess) });

setHud('Pin the City', 'Loading cities…');
// Built by scripts/build-cities.js; a relative URL so it also works on GitHub Pages.
const cities = await fetch('data/cities.json').then((response) => response.json());

const today = dateKey();
const dailyNumber = dayNumber(today);
const gameUrl = location.origin + location.pathname;

function showDailyResult(records) {
  game = null;
  setHud(`Challenge #${dailyNumber} done`, 'A new challenge every day at midnight.');
  showSummary(panel, records, MAX_ROUND_POINTS, {
    heading: `Today's challenge #${dailyNumber}`,
    shareText: buildShareText({
      number: dailyNumber,
      records,
      maxPoints: MAX_ROUND_POINTS * records.length,
      url: gameUrl,
    }),
    actions: [{ label: 'Practice game', onClick: playPractice }],
  });
}

function playDaily() {
  game = startGame({
    map,
    panel,
    cities,
    categories,
    label: `Daily #${dailyNumber}`,
    random: dailyRandom(today),
    onFinished: (records) => {
      saveDaily(today, records);
      showDailyResult(records);
    },
  });
}

function playPractice() {
  game = startGame({
    map,
    panel,
    cities,
    categories,
    label: 'Practice',
    onFinished: (records) => {
      game = null;
      setHud('Practice game over', 'Practice games are not shared or saved.');
      showSummary(panel, records, MAX_ROUND_POINTS, {
        heading: 'Practice score',
        actions: [
          { label: 'Play again', onClick: playPractice },
          { label: 'Back to start', onClick: home },
        ],
      });
    },
  });
}

// The daily challenge can be played once per day; after that, the start shows its result.
function home() {
  game = null;
  const todaysRecords = loadDaily(today);
  if (todaysRecords) {
    showDailyResult(todaysRecords);
    return;
  }
  setHud('Pin the City', 'A geography game in 5 rounds.');
  showStartScreen(panel, { dailyNumber, onDaily: playDaily, onPractice: playPractice });
}

home();
