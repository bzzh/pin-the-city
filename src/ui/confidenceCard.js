import { CONFIDENCE_LEVELS } from '../game/scoring.js';
import { element } from './dom.js';

const pts = (value) => value.toLocaleString('en');

// "within 500 km": a bet counts when the city is at most this far from the tap.
export function levelRange(level) {
  return `within ${pts(level.radiusKm)} km`;
}

// Asks how sure the player is of placing `city`, before they tap the map.
// `onChoose(level)` runs with one of CONFIDENCE_LEVELS.
export function showConfidenceCard(panel, city, onChoose) {
  const title = element('h2', 'category', `How sure are you of placing ${city.name}?`);
  title.tabIndex = -1;
  const list = element('div', 'choices confidence');
  for (const level of CONFIDENCE_LEVELS) {
    const button = element('button', 'choice');
    button.type = 'button';
    const label = element('span', 'label');
    label.append(element('span', 'name', level.label), element('span', 'visually-hidden', ', '), element('span', 'place', levelRange(level)));
    const odds = element('span', 'value', `×${level.win} / ×${level.lose}`);
    odds.setAttribute('aria-label', `times ${level.win} if inside, times ${level.lose} if not`);
    button.append(label, odds);
    button.addEventListener('click', () => {
      panel.hidden = true;
      onChoose(level);
    });
    list.append(button);
  }
  panel.classList.add('question'); // larger and centred while the map behind is blurred
  panel.replaceChildren(
    element('p', 'eyebrow', 'Confidence'),
    title,
    element('p', 'rules', 'Your placement scores up to 100 points by distance. Your tap is the centre of a circle: if the city is inside it, those points are multiplied up; if not, they shrink. Only a Pinpoint hit reaches 150.'),
    list,
  );
  panel.hidden = false;
  title.focus();
}
