import { confidenceLevel, placementParts } from '../game/scoring.js';
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
  panel.classList.remove('question');
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

// The share preview and its button.
function shareBlock(text) {
  const block = element('div', 'share-block');
  block.append(element('h3', 'share-title', 'Share your result'), element('pre', 'share-preview', text), shareButton(text));
  return block;
}

const RULES = {
  distance:
    '5 rounds. Pick the city that fits the category (500 pts), then place it on the map (up to 1,500 pts). Practice games already try the new confidence levels, coming to the daily challenge tomorrow.',
  confidence:
    '5 rounds. Pick the city that fits the category. Then bet on how close you’ll get and place it!',
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

// Shown after the map reveal. `round` is e.g. { number: 2, of: 5 }; `nextLabel` is
// "Next round" or "See results".
export function showRoundResult(panel, result, round, maxPoints, nextLabel, onNext) {
  const next = button(nextLabel, () => {
    panel.hidden = true;
    onNext();
  });
  // The round's points, then its three parts, e.g. Question ✓ +50, Accuracy 180 km +96,
  // Bet Confident ✓ ×1.3 +29. Rounds from before bets show the placement as accuracy.
  const level = confidenceLevel(result.level);
  const parts = level ? placementParts(level, result.km) : { accuracy: result.placePoints, bet: null };
  const breakdown = element('dl', 'round-parts');
  const part = (label, detail, value) => {
    const row = element('div', 'round-part');
    const dt = element('dt');
    dt.append(element('span', '', label), detail);
    row.append(dt, element('dd', value < 0 ? 'minus' : '', signed(value)));
    breakdown.append(row);
  };
  part('Question', mark(result.correct, 'part-detail', 'right', 'wrong'), result.choicePoints);
  part('Accuracy', element('span', 'part-detail', `${km(result.km)} away`), parts.accuracy);
  if (level) {
    const bet = mark(result.hit, 'part-detail', 'inside', 'outside');
    bet.prepend(`${level.label} `);
    bet.append(` ×${result.hit ? level.win : level.lose}`);
    part('Bet', bet, parts.bet);
  }
  const total = element('p', 'round-points', pts(result.points));
  total.append(element('span', 'muted', ` / ${pts(maxPoints)}`));
  // "Round 2 of 5" on the left, the round's points in the top-right corner.
  const head = element('div', 'round-head');
  head.append(element('p', 'eyebrow', `Round ${round.number} of ${round.of}`), total);
  show(
    panel,
    [
      head,
      breakdown,
      next,
    ],
    next,
  );
}

// Points with their sign: "+50", "−12" or "0".
const signed = (value) => (value === 0 ? '0' : value < 0 ? `−${pts(-value)}` : `+${pts(value)}`);

// ✓ or ✗ on screen; screen readers hear the word instead (e.g. "right", "outside").
function mark(ok, className, yes, no) {
  const span = element('span', className);
  const symbol = element('span', '', ok ? '✓' : '✗');
  symbol.setAttribute('aria-hidden', 'true');
  span.append(symbol, element('span', 'visually-hidden', ok ? yes : no));
  return span;
}

// One results row, split like the round recap: [column, text or elements, extra class].
// Rounds from before confidence levels have no bet, so their placement counts as accuracy.
function resultCells({ city, category, km: distance, choicePoints, placePoints, points, level, hit }) {
  const bet = confidenceLevel(level);
  const parts = bet ? placementParts(bet, distance) : { accuracy: placePoints, bet: null };
  // The multiplier shows whether the city was inside the bet's circle (above 1) or not.
  const betCell = bet
    ? [element('span', parts.bet < 0 ? 'minus' : '', signed(parts.bet)), element('span', 'muted cell-sub', `${bet.label} ×${hit ? bet.win : bet.lose}`)]
    : '—';
  return [
    ['City', [element('strong', '', city), element('span', 'muted cell-sub', category)]],
    ['Question', signed(choicePoints), 'num'],
    ['Accuracy', [element('span', '', signed(parts.accuracy)), element('span', 'muted cell-sub', km(distance))], 'num'],
    ['Bet', betCell, 'num'],
    ['Round', pts(points), 'num strong'],
  ];
}

// End-of-game results: a full-width sheet with the score, sharing and buttons first, then a
// table of the rounds. `shareText` adds the share block (daily challenge only); `notice` is a status line (e.g. the leaderboard result); `actions` are buttons, e.g.
// [{ label: 'Practice game', onClick }].
export function showSummary(panel, records, maxRoundPoints, { heading: title, shareText, notice, actions }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const top = heading('h2', 'sheet-title', title);

  const table = element('table', 'results');
  table.append(element('caption', 'visually-hidden', `Results by round, ${pts(total)} points in total`));
  const head = element('tr');
  for (const [text, className] of [['#', 'num'], ['City', ''], ['Question', 'num'], ['Accuracy', 'num'], ['Bet', 'num'], ['Round', 'num']]) {
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
  totalLabel.colSpan = 5;
  foot.append(totalLabel, element('td', 'num strong', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`));
  const tfoot = element('tfoot');
  tfoot.append(foot);
  table.append(thead, tbody, tfoot);

  const children = [top, element('p', 'score-big', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`)];
  if (notice) children.push(element('p', 'notice', notice));
  if (shareText) children.push(shareBlock(shareText));
  const buttons = element('div', 'sheet-actions');
  for (const { label, onClick } of actions) {
    buttons.append(button(label, onClick, shareText ? 'continue secondary' : 'continue'));
  }
  children.push(buttons, element('h3', 'legend-title', 'Round by round'), table);

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
