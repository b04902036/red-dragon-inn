import { cardDefinitionSchema } from '../../src/content/cards';
import { actionState, cardInHand, playAction, response } from './timing-match';
/** Pending loss becomes a gain when its target plays the validated modifier. */
export function reversedPendingStat() {
  const source = actionState();
  for (const [suffix, direction] of [
    ['ignore', 'LOSS'],
    ['negate', 'GAIN'],
  ] as const) {
    const id = source.cards[cardInHand(source, 0, suffix)]!.definitionId;
    source.definitions[id] = cardDefinitionSchema.parse({
      ...source.definitions[id],
      responseKind: 'SOMETIMES',
      responseTrigger: {
        event: 'CARD',
        alternatives: [
          [
            {
              kind: 'PENDING_STAT',
              stat: 'FORTITUDE',
              direction,
              relation: 'ANY',
            },
          ],
        ],
      },
      effects: [{ op: 'DRAW_CARDS', target: 'SELF', count: 1 }],
    });
  }
  const id = source.cards[cardInHand(source, 0, 'breather')]!.definitionId;
  source.definitions[id] = cardDefinitionSchema.parse({
    ...source.definitions[id],
    type: 'SOMETIMES',
    responseKind: 'SOMETIMES',
    responseTrigger: {
      event: 'CARD',
      alternatives: [
        [
          {
            kind: 'PENDING_STAT',
            stat: 'FORTITUDE',
            direction: 'LOSS',
            relation: 'SELF',
          },
        ],
      ],
    },
    effects: [{ op: 'MODIFY_PENDING_EFFECT', effectIndex: 0, delta: 4 }],
  });
  const before = playAction(source).state;
  const after = response(before, 1, 'breather').state;
  return {
    before,
    after,
    lossCardId: cardInHand(before, 0, 'ignore'),
    gainCardId: cardInHand(before, 0, 'negate'),
  };
}
