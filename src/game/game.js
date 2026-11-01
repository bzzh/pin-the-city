import { planRounds } from './trio.js';
import { CHOICE_POINTS, MAX_PLACE_POINTS, choicePoints, distanceKm, placementPoints } from './scoring.js';
import { showChoiceCard } from '../ui/choiceCard.js';
import { setHud } from '../ui/hud.js';
import { showRoundResult } from '../ui/screens.js';

export const ROUNDS_PER_GAME = 5;
export const MAX_ROUND_POINTS = CHOICE_POINTS + MAX_PLACE_POINTS;

// "Kyoto, Japan" when there is no separate region; otherwise "Kansas City, Missouri, United States".
const placeName = ({ name, region, country }) => [name, region, country].filter(Boolean).join(', ');

// Runs one game: each round goes choose → reveal → place → reveal. When the last round is done,
// calls onFinished(records) with one plain, saveable record per round.
// `label` names the game in the top bar ("Daily #12", "Practice").
// Returns { handlePick } for the map to call with each tap.
export function startGame({ map, panel, cities, categories, label, random = Math.random, onFinished }) {
  const rounds = planRounds(cities, categories, ROUNDS_PER_GAME, random);
  const records = [];
  let placing = null; // set while waiting for the player to tap the map

  const status = (roundNumber) => {
    const total = records.reduce((sum, record) => sum + record.points, 0);
    return `${label} · ${roundNumber}/${rounds.length} · ${total.toLocaleString('en')} pts`;
  };

  function playRound(index) {
    const round = rounds[index];
    map.reset();
    setHud('Choose a city', 'Pick the one that fits the category.', status(index + 1));
    showChoiceCard(panel, round, (picked) => {
      const correct = picked === round.winner;
      placing = { round, correct, choicePoints: choicePoints(correct) };
      setHud(
        `Place: ${placeName(round.winner)}`,
        `${correct ? '✓ Right choice' : '✗ Wrong choice'} +${placing.choicePoints} · Tap the map where it is.`,
        status(index + 1),
      );
    });
  }

  function handlePick(guess) {
    if (!placing) return;
    const { round, correct, choicePoints: choice } = placing;
    placing = null;

    const km = distanceKm(guess, round.winner);
    const place = placementPoints(km);
    const record = {
      city: round.winner.name,
      category: round.category.label,
      correct,
      km: Math.round(km),
      choicePoints: choice,
      placePoints: place,
      points: choice + place,
    };
    records.push(record);

    map.showGuess(guess);
    map.showAnswer(guess, round.winner);
    const { name, region, country } = round.winner;
    setHud(name, [region, country].filter(Boolean).join(', '), status(records.length));

    const isLast = records.length === rounds.length;
    showRoundResult(panel, record, MAX_ROUND_POINTS, isLast ? 'See results →' : 'Next round →', () => {
      if (!isLast) {
        playRound(records.length);
        return;
      }
      map.reset();
      onFinished(records);
    });
  }

  playRound(0);
  return { handlePick };
}
