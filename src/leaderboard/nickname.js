// Nickname rules, shared by the game (instant feedback) and the leaderboard server (enforcement).

export const MIN_LENGTH = 3;
export const MAX_LENGTH = 20;

// Letters (any alphabet), digits, spaces and . _ -
const ALLOWED = /^[\p{L}\p{N} ._-]+$/u;
const HAS_LETTER = /\p{L}/u;

// Common offensive words in English and French; extend as needed (lowercase, no accents).
// Strong words are blocked anywhere in the name ("xXfuckXx"); short ones only as a whole word,
// so innocent names that contain them ("Habite", "Constance") still work.
const BLOCKED_ANYWHERE = ['fuck', 'shit', 'cunt', 'nazi', 'hitler', 'putain', 'salope', 'connard', 'encule', 'nique', 'bitch', 'whore', 'pedo'];
const BLOCKED_WORDS = ['ass', 'dick', 'cock', 'porn', 'sex', 'con', 'conne', 'pute', 'bite', 'merde', 'chier', 'couille', 'pd', 'fdp', 'ntm'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
const stripAccents = (text) => text.normalize('NFD').replace(/\p{M}/gu, '');

// Trims and collapses spaces: "  Bz   zh " → "Bz zh".
export const cleanNickname = (raw) => String(raw ?? '').trim().replace(/\s+/g, ' ');

// Two nicknames with the same key count as the same name ("Hélène", "helene", "Hel-ene").
export const nicknameKey = (raw) =>
  stripAccents(cleanNickname(raw)).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function isOffensive(name) {
  const plain = stripAccents(name.toLowerCase()).replace(/[013457@$]/g, (char) => LEET[char]);
  const collapsed = plain.replace(/[^\p{L}]/gu, '');
  const words = plain.split(/[^\p{L}]+/u).filter(Boolean);
  return (
    BLOCKED_ANYWHERE.some((word) => collapsed.includes(word)) ||
    words.some((word) => BLOCKED_WORDS.includes(word))
  );
}

// Returns a message explaining what's wrong, or null if the nickname is acceptable.
export function checkNickname(raw) {
  const name = cleanNickname(raw);
  if (name.length < MIN_LENGTH || name.length > MAX_LENGTH) {
    return `Use ${MIN_LENGTH} to ${MAX_LENGTH} characters.`;
  }
  if (!ALLOWED.test(name)) return 'Use only letters, numbers, spaces, dots, dashes and underscores.';
  if (!HAS_LETTER.test(name)) return 'Include at least one letter.';
  if (isOffensive(name)) return 'Please choose a different nickname.';
  return null;
}
