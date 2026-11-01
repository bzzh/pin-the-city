import { confidenceLevel } from '../game/scoring.js';
import { element } from './dom.js';

const km = (value) => `${Math.round(value).toLocaleString('en')} km`;
const pts = (value) => value.toLocaleString('en');

function button(label, onClick, className = 'continue') {
  const b = element('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

// Replaces the panel's content. `focus` (an element inside it) receives keyboard focus, so
// keyboard and screen-reader users land on the new screen instead of a button that vanished.
function show(panel, children, focus) {
  panel.replaceChildren(...children);
  panel.hidden = false;
  focus?.focus();
}

// A heading that can take focus without joining the Tab order.
function heading(tag, className, text) {
  const h = element(tag, className, text);
  h.tabIndex = -1;
  return h;
}

// On phones, opens the system share sheet; elsewhere, copies the text to the clipboard.
function shareButton(text) {
  const b = button('Share result', async () => {
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      b.textContent = 'Copied! Paste it to your friends';
    } catch (error) {
      if (error.name !== 'AbortError') b.textContent = 'Could not copy, select the text above';
    }
  });
  return b;
}

const RULES = {
  distance:
    '5 rounds. Pick the city that fits the category (500 pts), then place it on the map (up to 1,500 pts). Practice games already try the new confidence levels, coming to the daily challenge tomorrow.',
  confidence:
    '5 rounds. Pick the city that fits the category (500 pts). Then say how sure you are and place it: the smaller your circle, the more it pays (250 to 1,500 pts), but a miss scores 0.',
};

// `onLeaderboard` is omitted when the leaderboard is turned off. `confidence` says whether
// today's challenge uses confidence levels.
export function showStartScreen(panel, { dailyNumber, confidence, onDaily, onPractice, onLeaderboard }) {
  const startWith = (play) => () => {
    panel.hidden = true;
    play();
  };
  const title = heading('h2', 'category', 'Pin the City');
  const children = [
    title,
    element('p', 'rules', RULES[confidence ? 'confidence' : 'distance']),
    button(`Play today's challenge #${dailyNumber}`, startWith(onDaily)),
    button('Practice game', startWith(onPractice), 'continue secondary'),
  ];
  if (onLeaderboard) children.push(button('Weekly leaderboard', onLeaderboard, 'continue secondary'));
  show(panel, children, title);
}

// Shown after the map reveal; `nextLabel` is "Next round" or "See results".
export function showRoundResult(panel, result, maxPoints, nextLabel, onNext) {
  const next = button(nextLabel, () => {
    panel.hidden = true;
    onNext();
  });
  // e.g. "Confident · 180 km away · ✓ inside +750", or "1,200 km away +540" without a level.
  const level = confidenceLevel(result.level);
  const placement = level
    ? `${level.label} · ${km(result.km)} away · ${result.hit ? '✓ inside' : '✗ outside'} +${result.placePoints}`
    : `${km(result.km)} away +${result.placePoints}`;
  show(
    panel,
    [
      element('p', 'result-line', `${result.correct ? '✓' : '✗'} Choice +${result.choicePoints}`),
      element('p', 'result-line', placement),
      element('p', 'result-total', `Round: ${pts(result.points)} / ${pts(maxPoints)}`),
      next,
    ],
    next,
  );
}

// End-of-game summary. `shareText` adds a preview and a share button (daily challenge only);
// `notice` is a status line (e.g. the leaderboard result); `actions` are the buttons
// underneath, e.g. [{ label: 'Practice game', onClick }].
export function showSummary(panel, records, maxRoundPoints, { heading: title, shareText, notice, actions }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const list = element('ol', 'summary');
  for (const { city, category, correct, km: distance, points, level, hit } of records) {
    const row = element('li');
    const what = element('span', 'what');
    what.append(element('strong', '', city), element('span', 'muted', ` · ${category}`));
    const bet = level ? ` · ${confidenceLevel(level).label} ${hit ? '✓' : '✗'}` : '';
    row.append(what, element('span', 'muted', `${correct ? '✓' : '✗'}${bet} · ${km(distance)} · ${pts(points)}`));
    list.append(row);
  }
  const top = heading('h2', 'eyebrow', title);
  const children = [top, element('p', 'score-big', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`), list];
  if (notice) children.push(element('p', 'notice', notice));
  if (shareText) children.push(element('pre', 'share-preview', shareText), shareButton(shareText));
  for (const { label, onClick } of actions) {
    children.push(button(label, onClick, shareText ? 'continue secondary' : 'continue'));
  }
  show(panel, children, top);
}

// Asks for a leaderboard nickname. `check(name)` returns a problem message or null (instant
// feedback); `onJoin(name)` resolves to an error message, or null once the player is registered.
export function showNicknameForm(panel, { check, onJoin, onSkip }) {
  const form = element('form', 'nickname-form');
  const label = element('label', '', 'Nickname');
  label.htmlFor = 'nickname';
  const input = element('input');
  Object.assign(input, { id: 'nickname', name: 'nickname', maxLength: 20, autocomplete: 'nickname', required: true });
  input.setAttribute('aria-describedby', 'nickname-hint nickname-error');
  const hint = element('p', 'muted hint', '3–20 letters or numbers. Shown publicly on the leaderboard.');
  hint.id = 'nickname-hint';
  const problem = element('p', 'error');
  problem.id = 'nickname-error';
  problem.setAttribute('role', 'alert');
  const join = element('button', 'continue', 'Join the leaderboard');
  join.type = 'submit';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = check(input.value);
    if (message) {
      problem.textContent = message;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }
    join.disabled = true;
    join.textContent = 'Joining…';
    const error = await onJoin(input.value);
    if (error) {
      problem.textContent = error;
      input.setAttribute('aria-invalid', 'true');
      join.disabled = false;
      join.textContent = 'Join the leaderboard';
      input.focus();
    }
  });
  form.append(label, input, hint, problem, join);

  show(
    panel,
    [
      heading('h2', 'category', 'Join the weekly leaderboard'),
      element('p', 'rules', 'Your daily scores add up from Monday to Sunday. Pick a nickname to appear on it.'),
      form,
      button('Not now', onSkip, 'continue secondary'),
    ],
    input,
  );
}

// The weekly top 10 as an accessible table. Call with `rows: null` while loading and
// `error` if it failed; `me` is the player's nickname, highlighted in the table.
export function showLeaderboard(panel, { weekLabel, rows, error, me, onBack }) {
  const title = heading('h2', 'category', 'Weekly leaderboard');
  const status = element('p', 'muted leaderboard-status');
  status.setAttribute('role', 'status'); // read out by screen readers when it changes
  const children = [title, element('p', 'muted', `${weekLabel} · daily scores added up`), status];

  if (error) {
    status.textContent = `Could not load the leaderboard: ${error}`;
  } else if (!rows) {
    status.textContent = 'Loading…';
  } else if (rows.length === 0) {
    status.textContent = "No scores yet this week. Play today's challenge to be the first!";
  } else {
    status.textContent = `Top ${rows.length} this week.`;
    const table = element('table', 'leaderboard');
    table.append(element('caption', 'visually-hidden', `Weekly leaderboard, ${weekLabel}`));
    const head = element('thead');
    const headRow = element('tr');
    for (const [text, className] of [['Rank', 'num'], ['Player', ''], ['Days', 'num'], ['Score', 'num']]) {
      const th = element('th', className, text);
      th.scope = 'col';
      headRow.append(th);
    }
    head.append(headRow);

    const body = element('tbody');
    for (const row of rows) {
      const tr = element('tr', row.nickname === me ? 'me' : '');
      const name = element('th', '', row.nickname);
      name.scope = 'row';
      if (row.nickname === me) name.append(element('span', 'you', ' (you)'));
      const days = element('td', 'num', `${row.days_played}/7`);
      days.setAttribute('aria-label', `${row.days_played} of 7 days`);
      tr.append(element('td', 'num', `#${row.rank}`), name, days, element('td', 'num', pts(Number(row.total))));
      body.append(tr);
    }
    table.append(head, body);
    children.push(table);
  }

  children.push(button('Back', onBack, 'continue secondary'));
  show(panel, children, title);
}
