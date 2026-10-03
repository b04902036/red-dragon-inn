import { sampleContentPack } from './sample';
import { presentationSchema } from '../protocol/presentation';
import { hasChosenTarget } from '../engine/card-effects-validation';

// Original player-facing guidance. Published engine definitions remain immutable.
const guidance: Record<string, string> = {
  carddef_sample_shove:
    'Choose another player. They lose 2 Fortitude when this Action resolves.',
  carddef_sample_ignore:
    'Respond to an effect affecting you. Ignore that effect for yourself; it can still affect other players.',
  carddef_sample_negate:
    'Respond to the current card or Drink effect. Negate its pending effects for everyone.',
  carddef_sample_breather:
    'Gain 1 Fortitude when this resolves. Play between actions or when you have response priority.',
  carddef_sample_gamble:
    'As your Action, start gambling: each eligible player antes 1 Gold. During gambling, play this to take control if Gambling cards are allowed. The last controller wins the pot after everyone else passes or leaves.',
  carddef_sample_cheat:
    'During gambling, take control when you have priority. The next player must use a Cheating card to take control.',
  carddef_sample_fizz: 'Gain 2 Alcohol when this Drink resolves.',
  carddef_sample_tea:
    'Gain 1 Alcohol and 1 Fortitude. Chaser: reveal another card from your Drink Me! pile as part of this Drink chain, if available.',
  carddef_sample_toast:
    'A quiet toast with no additional effect. This Drink Event resolves separately from a Drink chain.',
  carddef_sample_token:
    'Sample side-deck content: add 1 token to your resource when its registered effect resolves.',
};
export const samplePresentation = presentationSchema.parse({
  schemaVersion: 1,
  characters: sampleContentPack.characters.map(({ id, name }) => ({
    id,
    name,
  })),
  cards: sampleContentPack.cards.map((card) => ({
    id: card.id,
    name: card.name,
    rulesText: `${guidance[card.id]} Original fictional sample card.`,
    type: card.type,
    ...('responseKind' in card ? { responseKind: card.responseKind } : {}),
    requiresTarget: hasChosenTarget(card.effects),
    affectsSelf: card.effects.some(
      (effect) => 'target' in effect && effect.target === 'SELF',
    ),
  })),
});
