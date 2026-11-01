import { formatStat } from '../categories/categories.js';
import { element } from './dom.js';

// Shows the category and three city buttons. After a pick, reveals every city's value and
// offers a button to go place the correct city; `onDone(pickedCity)` runs when it's pressed.
export function showChoiceCard(panel, round, onDone) {
  const { category, cities, winner } = round;
  panel.replaceChildren(
    element('p', 'eyebrow', 'Which city is…'),
    element('h2', 'category', category.label),
  );

  const list = element('div', 'choices');
  const buttons = cities.map((city) => {
    const button = element('button', 'choice');
    button.append(element('span', 'name', city.name), element('span', 'value'));
    button.addEventListener('click', () => reveal(city));
    list.append(button);
    return button;
  });

  const next = element('button', 'continue', `Place ${winner.name} on the map →`);
  next.hidden = true;
  panel.append(list, next);
  panel.hidden = false;

  function reveal(picked) {
    buttons.forEach((button, i) => {
      const city = cities[i];
      button.disabled = true;
      button.querySelector('.value').textContent = formatStat(category, city);
      if (city === winner) button.classList.add('correct');
      else if (city === picked) button.classList.add('wrong');
    });
    next.hidden = false;
    next.addEventListener('click', () => {
      panel.hidden = true;
      onDone(picked);
    });
  }
}
