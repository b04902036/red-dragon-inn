import type { ContentPack } from '../../src/content/pack';
import {
  selectedMatch,
  definitionCard,
  keep,
  drinkPile,
  innOrder,
} from './rdi2-match';

/** Isolated, invariant-checked browser checkpoints using unchanged production definitions. */
export function verificationScenario(pack: ContentPack, scenario: string) {
  const state = selectedMatch(
    pack,
    ['rdi1-deirdre', 'rdi2-dimli', 'rdi2-eve', 'rdi2-gog'],
    true,
  );
  const ids: string[] = [];
  const hold = (prefix: string, mechanic: string) => {
    const id = definitionCard(state, `carddef_${prefix}_${mechanic}`);
    ids.push(id);
    return id;
  };
  switch (scenario) {
    case 'nested':
      hold('rdi1_deirdre', 'damage_two');
      hold('rdi2_eve', 'ignore_card_all_stats');
      hold('rdi2_dimli', 'negate_sometimes_counter');
      hold('rdi2_gog', 'negate_sometimes_counter');
      break;
    case 'anytime':
      hold('rdi1_deirdre', 'damage_two');
      hold('rdi2_gog', 'tip_wench');
      break;
    case 'grace':
      hold('rdi2_gog', 'gain_two_fortitude');
      state.players[3]!.fortitude = 18;
      break;
    case 'gambling':
      hold('rdi1_deirdre', 'gambling_start_or_control');
      hold('rdi2_eve', 'cheat_take_control');
      hold('rdi2_dimli', 'gambling_winning_hand');
      hold('rdi2_dimli', 'restart_gambling_round');
      break;
    case 'redirect':
      hold('rdi1_deirdre', 'damage_two');
      hold('rdi2_eve', 'redirect_fortitude_loss');
      hold('rdi2_gog', 'hit_back_two_after_loss');
      break;
    case 'modifier':
      hold('rdi2_dimli', 'add_two_alcohol_to_drink');
      state.phase = 'DRINK';
      state.activePlayerId = state.players[0]!.id;
      drinkPile(state, 0, ['wine']);
      break;
    case 'mead':
      state.phase = 'DRINK';
      drinkPile(state, 0, ['mead']);
      break;
    case 'contest':
      state.phase = 'DRINK';
      drinkPile(state, 0, ['drinking_contest']);
      innOrder(state, [
        'dragon_breath_ale',
        'elven_wine',
        'light_ale',
        'water',
      ]);
      break;
    case 'challenge':
      state.phase = 'DRINK';
      drinkPile(state, 0, ['the_challenge']);
      innOrder(state, ['wine', 'water']);
      break;
    case 'winner':
      hold('rdi2_gog', 'damage_all_others_one');
      state.activePlayerId = state.players[3]!.id;
      for (const p of state.players.slice(0, 3)) {
        p.fortitude = 1;
        p.alcoholContent = 0;
      }
      break;
    default:
      throw new Error('Unknown mixed-set verification scenario');
  }
  keep(state, ids);
  state.rules.handSize = 7;
  return state;
}
