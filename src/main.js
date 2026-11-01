import './styles/main.css';
import { createMap } from './map/mapView.js';
import { categories } from './categories/categories.js';
import { MAX_ROUND_POINTS, startGame } from './game/game.js';
import { dailyRandom, dateKey, dayNumber, weekKeys, weekStartKey } from './game/daily.js';
import { buildShareText } from './game/share.js';
import { loadDaily, saveDaily } from './game/storage.js';
import { fetchWeekly, leaderboardEnabled, register, submitDaily } from './leaderboard/api.js';
import { loadPlayer, savePlayer } from './leaderboard/identity.js';
import { checkNickname } from './leaderboard/nickname.js';
import { setHud } from './ui/hud.js';
import { showLeaderboard, showNicknameForm, showStartScreen, showSummary } from './ui/screens.js';

const panel = document.getElementById('panel');
let game = null;
const map = createMap(document.getElementById('map'), { onPick: (guess) => game?.handlePick(guess) });

setHud('Pin the City', 'Loading cities…');
// Built by scripts/build-cities.js; a relative URL so it also works on GitHub Pages.
const cities = await fetch('data/cities.json').then((response) => response.json());

const today = dateKey();
const dailyNumber = dayNumber(today);
const gameUrl = location.origin + location.pathname;

// "2–8 November" for the week containing today.
function weekLabel() {
  const days = weekKeys(weekStartKey(today)).map((key) => new Date(`${key}T12:00:00Z`));
  const format = (date, options) => date.toLocaleDateString('en-GB', { timeZone: 'UTC', ...options });
  const [first, last] = [days[0], days[6]];
  return first.getUTCMonth() === last.getUTCMonth()
    ? `${format(first, { day: 'numeric' })}–${format(last, { day: 'numeric', month: 'long' })}`
    : `${format(first, { day: 'numeric', month: 'short' })} – ${format(last, { day: 'numeric', month: 'short' })}`;
}

// Results saved before the leaderboard existed lack the raw answers the server needs.
const canSubmit = (records) => records.every((record) => record.pick && record.guess);

// Sends today's result to the leaderboard and returns a line describing what happened.
async function submitToday(daily) {
  const player = loadPlayer();
  try {
    const { points } = await submitDaily(player, today, daily.records);
    saveDaily(today, { ...daily, submitted: true });
    return `Added ${points.toLocaleString('en')} points to ${player.nickname}'s week on the leaderboard.`;
  } catch (error) {
    if (error.data?.alreadySubmitted) {
      saveDaily(today, { ...daily, submitted: true });
      return "Today's score is on the leaderboard.";
    }
    const reason = error.message.replace(/\.$/, '');
    return `Couldn't reach the leaderboard (${reason}). We'll try again next time you open the game.`;
  }
}

function openLeaderboard(onBack) {
  game = null;
  setHud('Weekly leaderboard', 'Top 10 players, Monday to Sunday.');
  const view = { weekLabel: weekLabel(), me: loadPlayer()?.nickname, onBack };
  showLeaderboard(panel, { ...view, rows: null });
  fetchWeekly(weekStartKey(today))
    .then((rows) => showLeaderboard(panel, { ...view, rows }))
    .catch((error) => showLeaderboard(panel, { ...view, error: error.message }));
}

function askNickname(daily) {
  setHud('Join the leaderboard', 'Pick a nickname to count your daily scores.');
  showNicknameForm(panel, {
    check: checkNickname,
    onJoin: async (nickname) => {
      try {
        savePlayer(await register(nickname));
      } catch (error) {
        return error.message;
      }
      showDailyResult(daily, await submitToday(daily));
      return null;
    },
    onSkip: () => showDailyResult(daily),
  });
}

function showDailyResult(daily, notice) {
  game = null;
  const { records } = daily;
  setHud(`Challenge #${dailyNumber} done`, 'A new challenge every day at midnight.');
  const actions = [];
  if (leaderboardEnabled) {
    actions.push({ label: 'Weekly leaderboard', onClick: () => openLeaderboard(() => showDailyResult(loadDaily(today))) });
    if (!loadPlayer() && canSubmit(records)) {
      actions.push({ label: 'Join the leaderboard', onClick: () => askNickname(loadDaily(today) ?? daily) });
    }
  }
  actions.push({ label: 'Practice game', onClick: playPractice });
  showSummary(panel, records, MAX_ROUND_POINTS, {
    heading: `Today's challenge #${dailyNumber}`,
    shareText: buildShareText({
      number: dailyNumber,
      records,
      maxPoints: MAX_ROUND_POINTS * records.length,
      url: gameUrl,
    }),
    notice,
    actions,
  });
}

async function finishDaily(records) {
  const daily = { records, submitted: false };
  saveDaily(today, daily);
  if (!leaderboardEnabled) return showDailyResult(daily);
  if (!loadPlayer()) return askNickname(daily);
  showDailyResult(daily, 'Sending your score to the leaderboard…');
  showDailyResult(daily, await submitToday(daily));
}

function playDaily() {
  game = startGame({
    map,
    panel,
    cities,
    categories,
    label: `Daily #${dailyNumber}`,
    random: dailyRandom(today),
    onFinished: finishDaily,
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
async function home() {
  game = null;
  const daily = loadDaily(today);
  if (daily) {
    const retry = leaderboardEnabled && !daily.submitted && loadPlayer() && canSubmit(daily.records);
    showDailyResult(daily, retry ? 'Sending your score to the leaderboard…' : undefined);
    if (retry) showDailyResult(daily, await submitToday(daily));
    return;
  }
  setHud('Pin the City', 'A geography game in 5 rounds.');
  showStartScreen(panel, {
    dailyNumber,
    onDaily: playDaily,
    onPractice: playPractice,
    onLeaderboard: leaderboardEnabled ? () => openLeaderboard(home) : undefined,
  });
}

home();
