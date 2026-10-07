import { NarrationMatch } from './public-narration-match';
import { selectedMatch, keep, drinkPile, innOrder } from './rdi2-match';
import { combinedPack } from './rdi2-content';
export function publicContestMatch() {
  const state = selectedMatch(
    combinedPack,
    ['rdi1-deirdre', 'rdi2-dimli', 'rdi2-eve', 'rdi2-gog'],
    true,
  );
  keep(state, []);
  state.publicNarrationVersion = 1;
  state.phase = 'DRINK';
  drinkPile(state, 0, ['drinking_contest']);
  innOrder(state, [
    'wine_chaser',
    'light_ale',
    'elven_wine',
    'dark_ale',
    'water',
    'dragon_breath_ale',
    'light_ale',
  ]);
  const match = new NarrationMatch(state);
  match.send('TAKE_DRINK');
  match.settle();
  return match;
}
