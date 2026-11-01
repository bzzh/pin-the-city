import { CONFIDENCE_LEVELS, hitRadiusKm } from '../game/scoring.js';
import { element } from './dom.js';

const pts = (value) => value.toLocaleString('en');

// "within 1,000 km" for a circle, "within the city (25 km)" for Pinpoint. The circles also
// allow for the city's own size, so the hit radius is 25 km more than shown.
export function levelRange(level) {
  return level.radiusKm ? `within ${pts(level.radiusKm)} km` : `within the city (${pts(hitRadiusKm(level))} km)`;
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
  panel.replaceChildren(
    element('p', 'eyebrow', 'Confidence'),
    title,
    element('p', 'rules', 'Your placement scores up to 100 points by distance. Your tap is the centre of a circle: if the city touches it, those points are multiplied up; if not, they shrink. Only a Pinpoint hit reaches 150.'),
    list,
  );
  panel.hidden = false;
  title.focus();
}
