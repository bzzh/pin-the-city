import { element } from './dom.js';

const km = (value) => `${Math.round(value).toLocaleString('en')} km`;
const pts = (value) => value.toLocaleString('en');

function button(label, onClick, className = 'continue') {
  const b = element('button', className, label);
  b.addEventListener('click', onClick);
  return b;
}

function show(panel, ...children) {
  panel.replaceChildren(...children);
  panel.hidden = false;
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

export function showStartScreen(panel, { dailyNumber, onDaily, onPractice }) {
  const startWith = (play) => () => {
    panel.hidden = true;
    play();
  };
  show(
    panel,
    element('h2', 'category', 'Pin the City'),
    element('p', 'rules', '5 rounds. Pick the city that fits the category (500 pts), then place it on the map (up to 1,500 pts).'),
    button(`Play today's challenge #${dailyNumber}`, startWith(onDaily)),
    button('Practice game', startWith(onPractice), 'continue secondary'),
  );
}

// Shown after the map reveal; `nextLabel` is "Next round" or "See results".
export function showRoundResult(panel, result, maxPoints, nextLabel, onNext) {
  show(
    panel,
    element('p', 'result-line', `${result.correct ? '✓' : '✗'} Choice +${result.choicePoints} · ${km(result.km)} away +${result.placePoints}`),
    element('p', 'result-total', `Round: ${pts(result.points)} / ${pts(maxPoints)}`),
    button(nextLabel, () => {
      panel.hidden = true;
      onNext();
    }),
  );
}

// End-of-game summary. `shareText` adds a preview and a share button (daily challenge only);
// `actions` are the buttons underneath, e.g. [{ label: 'Practice game', onClick }].
export function showSummary(panel, records, maxRoundPoints, { heading, shareText, actions }) {
  const total = records.reduce((sum, record) => sum + record.points, 0);
  const list = element('ol', 'summary');
  for (const { city, category, correct, km: distance, points } of records) {
    const row = element('li');
    const what = element('span', 'what');
    what.append(element('strong', '', city), element('span', 'muted', ` · ${category}`));
    row.append(what, element('span', 'muted', `${correct ? '✓' : '✗'} ${km(distance)} · ${pts(points)}`));
    list.append(row);
  }
  const children = [
    element('p', 'eyebrow', heading),
    element('p', 'score-big', `${pts(total)} / ${pts(maxRoundPoints * records.length)}`),
    list,
  ];
  if (shareText) children.push(element('pre', 'share-preview', shareText), shareButton(shareText));
  for (const { label, onClick } of actions) {
    children.push(button(label, onClick, shareText ? 'continue secondary' : 'continue'));
  }
  show(panel, ...children);
}
