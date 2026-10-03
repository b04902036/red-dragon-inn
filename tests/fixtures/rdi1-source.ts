import { rdi1SourceSchema } from '../../src/content/rdi1-source';
import type { Rdi1Source } from '../../src/content/rdi1-source';
import type { Rdi1LegalityFixtures } from '../../src/content/rdi1-audit';
import { cardInstanceIdSchema } from '../../src/shared/ids';
export function rdi1SourceFixture(): Rdi1Source {
  const display = {
    'en-US': 'Original audit fixture',
    'zh-TW': '原創稽核測試',
  };
  const common = {
    display,
    rulesSummary: display,
    responseKind: null,
    notes: [],
    verification: {
      status: 'MECHANICALLY_VERIFIED',
      confidence: 'HIGH',
      basis: ['fixture'],
    },
  };
  const mechanics = [
    {
      ...common,
      id: 'audit_damage',
      type: 'ACTION',
      legality: { mode: 'ACTION_PHASE', target: 'OTHER_PLAYER' },
      effects: [
        {
          op: 'CHANGE_STAT',
          target: 'CHOSEN_PLAYER',
          stat: 'FORTITUDE',
          delta: -1,
        },
      ],
      engineRequirements: [],
    },
    {
      ...common,
      id: 'audit_ignore',
      type: 'SOMETIMES',
      responseKind: 'IGNORE',
      legality: {
        mode: 'RESPONSE',
        trigger: { event: 'DRINK', affects: 'SELF' },
      },
      effects: [{ op: 'IGNORE_CURRENT_DRINK' }],
      engineRequirements: ['drink.ignore'],
    },
  ];
  return rdi1SourceSchema.parse({
    schemaVersion: 'rdi1-mechanics-normalized-v1',
    status: 'READY_FOR_ENGINE_COMPILATION',
    copyrightStrategy: {
      cardNames: 'Original fixtures',
      rulesText: 'Original fixtures',
      publicDistributionNote: 'Test only',
    },
    sourceRefs: {
      fixture: { url: 'https://example.com/fixture', role: 'Test evidence' },
    },
    product: {
      id: 'rdi1',
      canonicalName: 'Fixture product',
      display,
      characterCount: 4,
      characterPhysicalCards: 160,
      drinkPhysicalCards: 30,
    },
    characters: ['deirdre', 'fiona', 'gerki', 'zot'].map((id) => ({
      id,
      canonicalName: `Fixture ${id}`,
      display,
      role: display,
      primaryDeckPhysicalCount: 40,
      cards: mechanics.map((m) => ({
        cardKey: `${id}.${m.id}`,
        mechanicId: m.id,
        quantity: 20,
        display,
        rulesSummary: display,
        type: m.type,
      })),
    })),
    mechanics,
    drinkDeck: {
      physicalCount: 30,
      cards: [
        {
          drinkKey: 'audit_water',
          quantity: 30,
          type: 'DRINK',
          display,
          rulesSummary: display,
          alcoholContent: 0,
          fortitudeChange: 0,
          chaser: false,
          specialMechanics: [],
        },
      ],
    },
    verification: {
      deckTotals: { deirdre: 40, fiona: 40, gerki: 40, zot: 40 },
      characterPhysicalTotal: 160,
      drinkPhysicalTotal: 30,
      expected: { deirdre: 40, fiona: 40, gerki: 40, zot: 40, drink: 30 },
    },
  });
}
export const fixtureCapabilities = { requiredCapabilities: ['drink.ignore'] };
export function rdi1MatrixFixture(source = rdi1SourceFixture()) {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return (
    'mechanic_id,type,en-US,zh-TW,deirdre,fiona,gerki,zot,summary_en,summary_zh\n' +
    source.mechanics
      .map((m) =>
        [
          m.id,
          m.type,
          m.display['en-US'],
          m.display['zh-TW'],
          ...source.characters.map((c) =>
            String(
              c.cards
                .filter((card) => card.mechanicId === m.id)
                .reduce((sum, card) => sum + card.quantity, 0),
            ),
          ),
          m.rulesSummary['en-US'],
          m.rulesSummary['zh-TW'],
        ]
          .map(quote)
          .join(','),
      )
      .join('\n')
  );
}
export function rdi1CardMatrixFixture(source = rdi1SourceFixture()) {
  return source.mechanics
    .map(
      (m) =>
        `| ${m.display['en-US']} / ${m.display['zh-TW']} | ${m.type} | ${source.characters.map((c) => c.cards.filter((card) => card.mechanicId === m.id).reduce((sum, card) => sum + card.quantity, 0)).join(' | ')} |`,
    )
    .join('\n');
}
export const legalityFixture: Rdi1LegalityFixtures = [
  {
    mechanicId: 'audit_ignore',
    positive: {
      context: { event: 'DRINK', affected: 'SELF' },
      relation: 'SELF is the affected drinker',
      reason: 'This Drink affects the responder',
      expectedLegalPlays: [
        {
          cardId: cardInstanceIdSchema.parse('card_audit_audit_ignore'),
          commandType: 'PLAY_RESPONSE',
          requiresTarget: false,
          legalTargetPlayerIds: [],
        },
      ],
    },
    negative: {
      context: { event: 'DRINK', affected: 'OTHER' },
      relation: 'OTHER is the affected drinker',
      reason: 'This Drink does not affect the responder',
      expectedLegalPlays: [],
    },
  },
];
