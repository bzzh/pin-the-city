import { element } from './dom.js';

const hud = document.getElementById('hud');

// Top bar: what to do now on the left, round and score on the right.
export function setHud(prompt, detail, status = '') {
  const text = element('div', 'text');
  text.append(element('p', 'prompt', prompt), element('p', 'detail', detail));
  hud.replaceChildren(text, element('p', 'status', status));
}
