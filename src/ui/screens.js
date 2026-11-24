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

// A form of labelled inputs with one error line and a submit button. `fields` are
// [{ name, label, type, autocomplete, hint, value, hidden }] (a hidden field still tells password
// managers which nickname a password belongs to). `check(values)` returns { field, message }
// for instant feedback, or null; `onSubmit(values)` resolves to an error message, or null once
// done (the caller then shows the next screen).
let formCount = 0;
function entryForm({ fields, submitLabel, busyLabel, check, onSubmit }) {
  const id = `form${++formCount}`;
  const form = element('form', 'entry-form');
  const problem = element('p', 'error');
  problem.id = `${id}-error`;
  problem.setAttribute('role', 'alert');
  const inputs = {};
  for (const { name, label, type = 'text', autocomplete, hint, value, hidden } of fields) {
    const input = element('input');
    Object.assign(input, { id: `${id}-${name}`, name, type, required: !hidden, hidden: Boolean(hidden) });
    if (autocomplete) input.autocomplete = autocomplete;
    if (value !== undefined) input.value = value;
    if (name === 'nickname') input.maxLength = 20;
    inputs[name] = input;
    if (hidden) {
      form.append(input);
      continue;
    }
    const labelElement = element('label', '', label);
    labelElement.htmlFor = input.id;
    const described = [problem.id];
    form.append(labelElement, input);
    if (hint) {
      const hintElement = element('p', 'muted hint', hint);
      hintElement.id = `${input.id}-hint`;
      described.unshift(hintElement.id);
      form.append(hintElement);
    }
    input.setAttribute('aria-describedby', described.join(' '));
  }
  const submit = element('button', 'continue', submitLabel);
  submit.type = 'submit';
  form.append(problem, submit);

  const visible = Object.values(inputs).filter((input) => !input.hidden);
  // Shows the message and marks the field it's about; server errors (no field) mark none.
  const fail = (message, field) => {
    problem.textContent = message;
    for (const input of visible) {
      if (input === inputs[field]) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
    (inputs[field] ?? visible[0]).focus();
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(Object.entries(inputs).map(([name, input]) => [name, input.value]));
    const invalid = check?.(values);
    if (invalid) return fail(invalid.message, invalid.field);
    submit.disabled = true;
    submit.textContent = busyLabel;
    const error = await onSubmit(values);
    if (error) {
      submit.disabled = false;
      submit.textContent = submitLabel;
      fail(error);
    }
  });
  return { form, first: visible[0] };
}

// A form screen, either in the game's panel or as a page (`page: true`, with a back button to
// `onBack`). `secondary` are extra buttons under the form, e.g. [{ label: 'Not now', onClick }].
function showFormScreen(target, { page = false, onBack, title, intro, secondary = [], ...formOptions }) {
  const { form, first } = entryForm(formOptions);
  const extra = secondary.map(({ label, onClick }) => button(label, onClick, 'continue secondary'));
  const paragraphs = [intro].flat().map((text) => element('p', 'rules', text));
  if (!page) {
    show(target, [heading('h2', 'category', title), ...paragraphs, form, ...extra], first);
    return;
  }
  const inner = element('div', 'page-inner');
  inner.append(
    button('← Back to the leaderboard', onBack, 'page-back'),
    element('h1', 'page-title', title),
    ...paragraphs,
    form,
    ...extra,
  );
  show(target, [inner], first);
}

const nicknameField = { name: 'nickname', label: 'Nickname', autocomplete: 'username' };
const required = (message) => (value) => (value.trim() ? null : message);
// Runs each field's check in order. → { field, message } for the first problem, or null.
const checkFields = (checks) => (values) => {
  for (const [field, check] of Object.entries(checks)) {
    const message = check(values[field]);
    if (message) return { field, message };
  }
  return null;
};

// Asks for a new leaderboard nickname. `onJoin(name)` resolves to an error message, or null
// once the player is registered; `onSignIn` is for players who already have one elsewhere.
export function showNicknameForm(panel, { checkNickname, onJoin, onSignIn, onSkip }) {
  showFormScreen(panel, {
    title: 'Join the leaderboard',
    intro: 'Your daily scores count on the daily and weekly leaderboards. Pick a nickname to appear on them.',
    fields: [{ ...nicknameField, hint: '3–20 letters or numbers. Shown publicly on the leaderboard.' }],
    submitLabel: 'Join the leaderboard',
    busyLabel: 'Joining…',
    check: checkFields({ nickname: checkNickname }),
    onSubmit: ({ nickname }) => onJoin(nickname),
    secondary: [
      { label: 'I already have a nickname', onClick: onSignIn },
      { label: 'Not now', onClick: onSkip },
    ],
  });
}

// Signs this device in to a nickname made on another device, in the game's panel (after a
// game, with `secondary` buttons) or as a page. `onSignIn(nickname, password)` resolves to an
// error message or null.
export function showSignInForm(target, { page, onBack, onSignIn, secondary }) {
  showFormScreen(target, {
    page,
    onBack,
    title: 'Sign in with your nickname',
    intro:
      'Enter the nickname you play with on your other device, and the password you chose there with “Play on other devices”.',
    fields: [nicknameField, { name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' }],
    submitLabel: 'Sign in',
    busyLabel: 'Signing in…',
    check: checkFields({ nickname: required('Enter your nickname.'), password: required('Enter your password.') }),
    onSubmit: ({ nickname, password }) => onSignIn(nickname, password),
    secondary,
  });
}

// Sets the password that lets `me` sign in on other devices. `onSave(password)` resolves to an
// error message or null.
export function showPasswordForm(page, { me, checkPassword, onBack, onSave }) {
  showFormScreen(page, {
    page: true,
    onBack,
    title: 'Play on other devices',
    intro: [
      `Choose a password for ${me}. Then, on your other phone or computer, open the leaderboard, choose “Sign in with your nickname” and enter ${me} and this password.`,
      'A forgotten password can’t be recovered, but any device that plays as you can set a new one here. If you already chose a password, this replaces it.',
    ],
    fields: [
      { name: 'nickname', value: me, autocomplete: 'username', hidden: true },
      { name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', hint: 'At least 6 characters.' },
    ],
    submitLabel: 'Save password',
    busyLabel: 'Saving…',
    check: checkFields({ password: checkPassword }),
    onSubmit: ({ password }) => onSave(password),
  });
}

// Merges `me` (this device's nickname) into another nickname the player keeps.
// `onMerge(nickname, password)` resolves to an error message or null.
export function showMergeForm(page, { me, onBack, onMerge }) {
  showFormScreen(page, {
    page: true,
    onBack,
    title: 'Move your scores to another nickname',
    intro: [
      `Played under more than one nickname? Enter the nickname you want to keep and its password. All of ${me}’s scores move to it, ${me} is removed from the leaderboard, and this device plays as the nickname you keep.`,
      'If both nicknames played the same day, the higher score counts. This can’t be undone.',
    ],
    fields: [
      { ...nicknameField, label: 'Nickname to keep' },
      { name: 'password', label: 'Its password', type: 'password', autocomplete: 'current-password' },
    ],
    submitLabel: `Move ${me}’s scores`,
    busyLabel: 'Moving scores…',
    check: checkFields({ nickname: required('Enter the nickname to keep.'), password: required('Enter its password.') }),
    onSubmit: ({ nickname, password }) => onMerge(nickname, password),
  });
}

// The leaderboard as a full page with two tabs, today's challenge (`period: 'day'`) and the
// week so far (`'week'`), each an accessible top-10 table. Call with `rows: null` while
// loading and `error` if it failed; `me` is the player's nickname, highlighted in the table.
// `onPeriod(period)` is called when the player picks the other tab. `account` adds the
// "Your nickname" section: { notice, onSignIn } without a nickname, { notice, onSetPassword,
// onMerge } with one.
export function showLeaderboard(page, { period, dayLabel, weekLabel, rows, error, me, onBack, onPeriod, account }) {
  const daily = period === 'day';
  const back = button('← Back to the game', onBack, 'page-back');
  const title = heading('h1', 'page-title', 'Leaderboard');

  const tabs = element('div', 'period-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', 'Leaderboard period');
  for (const [key, label] of [['day', 'Today'], ['week', 'This week']]) {
    const tab = button(label, () => key !== period && onPeriod(key), 'period-tab');
    tab.dataset.period = key;
    tab.setAttribute('aria-pressed', String(key === period));
    tabs.append(tab);
  }

  const status = element('p', 'muted leaderboard-status');
  status.setAttribute('role', 'status'); // read out by screen readers when it changes
  const label = daily ? dayLabel : weekLabel;
  const children = [
    back,
    title,
    tabs,
    element('p', 'page-week', label),
    element(
      'p',
      'muted',
      daily
        ? "Scores from today's challenge. A new board starts with each day's challenge."
        : "Each player's daily scores add up from Monday to Sunday. The board resets with Monday's challenge.",
    ),
    status,
  ];
  const when = daily ? 'today' : 'this week';

  if (error) {
    status.textContent = `Could not load the leaderboard: ${error}`;
  } else if (!rows) {
    status.textContent = 'Loading…';
  } else if (rows.length === 0) {
    status.textContent = `No scores yet ${when}. Play today's challenge to be the first!`;
  } else {
    status.textContent = `Top ${rows.length} ${when}.`;
    const table = element('table', 'leaderboard');
    table.append(element('caption', 'visually-hidden', `${daily ? 'Daily' : 'Weekly'} leaderboard, ${label}`));
    const head = element('thead');
    const headRow = element('tr');
    const columns = daily
      ? [['Rank', 'num'], ['Player', ''], ['Score', 'num']]
      : [['Rank', 'num'], ['Player', ''], ['Days', 'num'], ['Score', 'num']];
    for (const [text, className] of columns) {
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
      tr.append(element('td', 'num', `#${row.rank}`), name);
      if (!daily) {
        const days = element('td', 'num', `${row.days_played}/7`);
        days.setAttribute('aria-label', `${row.days_played} of 7 days`);
        tr.append(days);
      }
      tr.append(element('td', 'num', pts(Number(row.total))));
      body.append(tr);
    }
    table.append(head, body);
    children.push(table);
  }

  if (account) children.push(accountSection(me, account));

  const inner = element('div', 'page-inner');
  inner.append(...children);
  // Keep keyboard focus where it is when the table arrives or the tab changes.
  back.dataset.keep = 'back';
  for (const tab of tabs.children) tab.dataset.keep = tab.dataset.period;
  const focused = page.contains(document.activeElement) ? document.activeElement : null;
  const keep = (focused?.dataset.keep && inner.querySelector(`[data-keep="${focused.dataset.keep}"]`)) || title;
  show(page, [inner], keep);
}

// Under the leaderboard: who this device plays as, and how to play on other devices.
function accountSection(me, { notice, onSignIn, onSetPassword, onMerge }) {
  const section = element('section', 'account');
  const title = element('h2', 'account-title', 'Your nickname');
  title.id = 'account-title';
  section.setAttribute('aria-labelledby', title.id);
  const status = element('p', 'notice account-notice', notice ?? '');
  status.setAttribute('role', 'status');
  const actions = element('div', 'account-actions');
  const action = (label, onClick, keep) => {
    const b = button(label, onClick, 'continue secondary');
    b.dataset.keep = keep;
    actions.append(b);
  };
  const intro = element('p', 'muted');
  if (me) {
    intro.append('This device plays as ', element('strong', '', me), '.');
    action('Play on other devices', onSetPassword, 'password');
    action('Move my scores to another nickname', onMerge, 'merge');
  } else {
    intro.textContent = 'Already on the leaderboard from another phone or computer? Sign in to play as the same nickname here.';
    action('Sign in with your nickname', onSignIn, 'sign-in');
  }
  section.append(title, intro, status, actions);
  return section;
}
