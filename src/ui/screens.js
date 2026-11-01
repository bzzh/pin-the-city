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
// `sheet` makes the panel fill the screen under the top bar (the end-of-game results).
function show(panel, children, focus, { sheet = false } = {}) {
  panel.classList.toggle('sheet', sheet);
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
    '5 rounds. Pick the city that fits the category (500 pts). Then bet on how close you’ll get and place it: up to 1,000 pts by distance, multiplied up if the city lands in your circle and down if not. Only a Pinpoint hit reaches 1,500.',
};

// `confidence` says whether today's challenge uses confidence levels.
export function showStartScreen(panel, { dailyNumber, confidence, onDaily, onPractice }) {
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
  show(panel, children, title);
}

// Shown after the map reveal; `nextLabel` is "Next round" or "See results".
export function showRoundResult(panel, result, maxPoints, nextLabel, onNext) {
  const next = button(nextLabel, () => {
    panel.hidden = true;
    onNext();
  });
  // e.g. "Confident · 180 km away · ✓ inside ×1.2 +1,104", or "1,200 km away +540" without a level.
  const level = confidenceLevel(result.level);
  const placement = level
    ? `${level.label} · ${km(result.km)} away · ${result.hit ? `✓ inside ×${level.win}` : `✗ outside ×${level.lose}`} +${pts(result.placePoints)}`
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

// What each results column means, shown under the table.
const RESULT_COLUMNS = [
  ['Choice', '500 points if you picked the right city of the three, otherwise 0.'],
  ['Bet', 'How sure you said you were. Inside means the city touched your circle, so your placement was multiplied up; outside means it was multiplied down.'],
  ['Distance', 'How far your pin landed from the city.'],
  ['Placement', 'Up to 1,000 points for distance, times your bet. Only a Pinpoint hit reaches 1,500.'],
  ['Round', 'Choice plus placement, out of 2,000.'],
];

// One results row: [column, text or elements, extra class]. Rounds from before confidence
// levels have no bet.
function resultCells({ city, category, correct, km: distance, choicePoints, placePoints, points, level, hit }) {
  const bet = confidenceLevel(level);
  return [
    ['City', [element('strong', '', city), element('span', 'muted cell-sub', category)]],
    ['Choice', [element('span', correct ? 'good' : 'bad', correct ? '✓ Right' : '✗ Wrong'), element('span', 'muted cell-sub', `+${pts(choicePoints)}`)]],
    [
      'Bet',
      bet
        ? [element('span', '', bet.label), element('span', `cell-sub ${hit ? 'good' : 'bad'}`, hit ? `✓ inside ×${bet.win}` : `✗ outside ×${bet.lose}`)]
        : '—',
    ],
    ['Distance', km(distance), 'num'],
    ['Placement', `+${pts(placePoints)}`, 'num'],
    ['Round', pts(points), 'num strong'],
  ];
}

// End-of-game results: a full-width sheet with a table of the rounds and what each column
// means. `shareText` adds a preview and a share button (daily challenge only); `notice` is a
// status line (e.g. the leaderboard result); `actions` are the buttons underneath, e.g.
// [{ label: 'Practice game', onClick }].
export function showSummary(panel, records, maxRoundPoints, { heading: title, shareText, notice, actions }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const top = heading('h2', 'sheet-title', title);

  const table = element('table', 'results');
  table.append(element('caption', 'visually-hidden', `Results by round, ${pts(total)} points in total`));
  const head = element('tr');
  for (const [text, className] of [['#', 'num'], ['City', ''], ['Choice', ''], ['Bet', ''], ['Distance', 'num'], ['Placement', 'num'], ['Round', 'num']]) {
    const th = element('th', className, text);
    th.scope = 'col';
    head.append(th);
  }
  const thead = element('thead');
  thead.append(head);
  const tbody = element('tbody');
  records.forEach((record, i) => {
    const tr = element('tr');
    const number = element('th', 'num', String(i + 1));
    number.scope = 'row';
    tr.append(number);
    for (const [column, content, className = ''] of resultCells(record)) {
      const td = element('td', className);
      td.dataset.label = column; // shown before the value on phones, where rows stack
      const value = element('span', 'cell-value');
      if (Array.isArray(content)) value.append(...content);
      else value.textContent = content;
      td.append(value);
      tr.append(td);
    }
    tbody.append(tr);
  });
  const foot = element('tr');
  const totalLabel = element('th', '', 'Total');
  totalLabel.scope = 'row';
  totalLabel.colSpan = 6;
  foot.append(totalLabel, element('td', 'num strong', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`));
  const tfoot = element('tfoot');
  tfoot.append(foot);
  table.append(thead, tbody, tfoot);

  const legend = element('dl', 'results-legend');
  for (const [term, meaning] of RESULT_COLUMNS) legend.append(element('dt', '', term), element('dd', '', meaning));

  const children = [
    top,
    element('p', 'score-big', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`),
    table,
    element('h3', 'legend-title', 'How to read this'),
    legend,
  ];
  if (notice) children.push(element('p', 'notice', notice));
  if (shareText) children.push(element('pre', 'share-preview', shareText), shareButton(shareText));
  const buttons = element('div', 'sheet-actions');
  for (const { label, onClick } of actions) {
    buttons.append(button(label, onClick, shareText ? 'continue secondary' : 'continue'));
  }
  children.push(buttons);

  const inner = element('div', 'sheet-inner');
  inner.append(...children);
  show(panel, [inner], top, { sheet: true });
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

// The weekly top 10 as a full page with an accessible table. Call with `rows: null` while
// loading and `error` if it failed; `me` is the player's nickname, highlighted in the table.
export function showLeaderboard(page, { weekLabel, rows, error, me, onBack }) {
  const back = button('← Back to the game', onBack, 'page-back');
  const title = heading('h1', 'page-title', 'Weekly leaderboard');
  const status = element('p', 'muted leaderboard-status');
  status.setAttribute('role', 'status'); // read out by screen readers when it changes
  const children = [
    back,
    title,
    element('p', 'page-week', weekLabel),
    element('p', 'muted', "Each player's daily scores add up from Monday to Sunday. The board resets with Monday's challenge."),
    status,
  ];

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

  const inner = element('div', 'page-inner');
  inner.append(...children);
  // Keep keyboard focus where it is when the table arrives after loading.
  const focused = page.contains(document.activeElement) ? document.activeElement.className : null;
  show(page, [inner], focused === 'page-back' ? back : title);
}
