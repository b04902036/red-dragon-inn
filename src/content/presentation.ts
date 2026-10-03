import { presentationSchema } from '../protocol/presentation';
import { hasChosenTarget } from '../engine/timing';
import type { ContentPack } from './pack';
import {
  localizedField,
  verifyContentTranslations,
  TranslationUnavailable,
} from './localization';
import type { Locale } from '../shared/locales';
import { formatMessage } from '../shared/ui-messages';

/** Definition-only whitelist. No physical card IDs, deck quantities, RNG or pending effects. */
export function contentPresentation(
  pack: ContentPack,
  fixture = false,
  locale: Locale = 'en-US',
) {
  if (
    locale === 'zh-TW' &&
    !fixture &&
    !verifyContentTranslations(pack).complete
  )
    throw new TranslationUnavailable(
      'Required content translations are incomplete.',
    );
  const field = (
    type: Parameters<typeof localizedField>[2],
    id: string,
    key: Parameters<typeof localizedField>[4],
    canonical: string,
  ) => localizedField(pack, locale, type, id, key, canonical, !fixture);
  return presentationSchema.parse({
    schemaVersion: 1,
    locale,
    contentVersionId: pack.version.id,
    products: pack.products.map((row) => ({
      id: row.id,
      name: field('PRODUCT', row.id, 'name', row.name).text,
      canonicalName: row.name,
    })),
    ruleModules: pack.ruleModules.map((row) => ({
      id: row.id,
      summary: field('RULE_MODULE', row.id, 'summary', row.summary).text,
      canonicalSummary: row.summary,
    })),
    mechanics: [
      ...new Set(
        pack.characters.flatMap((row) => Object.keys(row.rules.resources)),
      ),
    ].map((key) => ({
      id: key,
      name: field('MECHANIC', key, 'label', key).text,
    })),
    choiceOptions: pack.cards.flatMap((card) =>
      card.effects.flatMap((effect) =>
        effect.op === 'OPEN_OPTION'
          ? effect.options.map((option) => ({
              cardDefinitionId: card.id,
              optionId: option.id,
              label: field(
                'CHOICE_OPTION',
                `${card.id}/${option.id}`,
                'label',
                option.label,
              ).text,
            }))
          : [],
      ),
    ),
    characters: pack.characters.map(({ id, name }) => {
      const translated = field('CHARACTER', id, 'name', name);
      return {
        id,
        name: translated.text,
        canonicalName: name,
        translationStatus: translated.translationStatus,
        translationSource: translated.translationSource,
      };
    }),
    cards: pack.cards.map((card) => ({
      id: card.id,
      name: field('CARD', card.id, 'name', card.name).text,
      canonicalName: card.name,
      canonicalRulesText: card.rulesText,
      rulesText: fixture
        ? [
            hasChosenTarget(card.effects)
              ? formatMessage(locale, 'target.another')
              : '',
            ...card.effects.flatMap((effect) =>
              effect.op === 'CHANGE_STAT'
                ? [
                    `${formatMessage(locale, effect.stat === 'FORTITUDE' ? 'player.fortitude' : effect.stat === 'ALCOHOL' ? 'player.alcohol' : 'player.gold')} ${effect.delta >= 0 ? '+' : ''}${effect.delta}.`,
                  ]
                : [],
            ),
            field('CARD', card.id, 'rulesText', card.rulesText).text,
          ]
            .filter(Boolean)
            .join(' ')
        : field('CARD', card.id, 'rulesText', card.rulesText).text,
      type: card.type,
      ...('responseKind' in card ? { responseKind: card.responseKind } : {}),
      requiresTarget: hasChosenTarget(card.effects),
      affectsSelf: card.effects.some(
        (effect) => 'target' in effect && effect.target === 'SELF',
      ),
    })),
  });
}
