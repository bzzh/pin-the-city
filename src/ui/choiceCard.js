import { formatStat } from '../categories/categories.js';
import { element } from './dom.js';

// Shows the category and three city buttons. After a pick, reveals every city's value and
// offers a button to go place the correct city; `onDone(pickedCity)` runs when it's pressed.
export function showChoiceCard(panel, round, onDone) {
  const { category, cities, winner } = round;
  const title = element('h2', 'category', category.label);
  title.tabIndex = -1;
  panel.replaceChildren(element('p', 'eyebrow', 'Which city is…'), title);

  const list = element('div', 'choices');
  const buttons = cities.map((city) => {
    const button = element('button', 'choice');
    button.type = 'button';
    button.append(element('span', 'name', city.name), element('span', 'value'));
    button.addEventListener('click', () => reveal(city));
    list.append(button);
    return button;
  });

  // Says whether the pick was right in words, not just colours (read out by screen readers).
  const verdict = element('p', 'verdict');
  verdict.setAttribute('role', 'status');
  const next = element('button', 'continue', `Place ${winner.name} on the map →`);
  next.type = 'button';
  next.hidden = true;
  panel.append(list, verdict, next);
  panel.hidden = false;
  title.focus();

  function reveal(picked) {
    buttons.forEach((button, i) => {
      const city = cities[i];
      button.disabled = true;
      button.querySelector('.value').textContent = formatStat(category, city);
      if (city === winner) {
        button.classList.add('correct');
        button.append(element('span', 'visually-hidden', ' (correct answer)'));
      } else if (city === picked) {
        button.classList.add('wrong');
        button.append(element('span', 'visually-hidden', ' (your pick)'));
      }
    });
    verdict.textContent = picked === winner ? '✓ Right!' : `✗ Not quite: it was ${winner.name}.`;
    next.hidden = false;
    next.focus(); // the pressed button is now disabled, so keep keyboard focus on what's next
    next.addEventListener('click', () => {
      panel.hidden = true;
      onDone(picked);
    });
  }
}
