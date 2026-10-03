import { describe, it, expect } from 'vitest';
import { localizedFixturePack } from '../../src/content/fixture-localized';
import { sampleContentPack } from '../../src/content/sample';
import { contentPresentation } from '../../src/content/presentation';
import { contentPackSchema } from '../../src/content/pack';
import {
  requiredTranslationFields,
  localizedField,
  verifyContentTranslations,
  verifyUiTranslations,
  terminologyIssues,
  translatedEdition,
  TranslationUnavailable,
  translationWorksheet,
} from '../../src/content/localization';
import {
  englishMessages,
  traditionalChineseMessages,
  formatMessage,
} from '../../src/shared/ui-messages';
import { productionFixture } from '../fixtures/production-pack';
import { setupInput, accepted } from '../fixtures/core-match';
import { createMatch } from '../../src/engine/setup';
import {
  replayFromBeginning,
  replayEntrySchema,
  replayManifestSchema,
} from '../../src/engine/replay';

describe('locale independent definitions and verified presentation', () => {
  it('validates every UI key, parameter, glossary term and reviewed original fixture translation', () => {
    expect(verifyUiTranslations()).toEqual([]);
    expect(verifyContentTranslations(localizedFixturePack)).toMatchObject({
      complete: true,
      requiredFields: 27,
      translatedFields: 27,
      missing: [],
      issues: [],
    });
    expect(
      terminologyIssues('Sometimes（特定時機） Anytime（任何時機）'),
    ).toEqual([]);
  });
  it.each(['红龙酒馆', '金币', '毅力', '耐力', '酒精含量', '追酒'])(
    'rejects inconsistent or Simplified wording %s',
    (text) => expect(terminologyIssues(text)).not.toEqual([]),
  );
  it('reports missing, extra, untranslated, parameter and glossary errors', () => {
    const chinese: Record<string, string> = { ...traditionalChineseMessages };
    delete chinese['app.title'];
    chinese['table.winner'] = 'Wins';
    chinese['player.gold'] = '金币';
    chinese.extra = '多餘';
    chinese['health.service'] = englishMessages['health.service'];
    const issues = verifyUiTranslations(englishMessages, chinese);
    expect(issues.join('\n')).toMatch(/Missing UI key/);
    expect(issues.join('\n')).toMatch(/Parameter mismatch/);
    expect(issues.join('\n')).toMatch(/Untranslated UI key/);
    expect(issues.join('\n')).toMatch(/Unknown UI key/);
    expect(issues.join('\n')).toMatch(/Glossary mismatch/);
  });
  it('returns Chinese safe metadata with canonical English, truthfully marked character names and no game internals', () => {
    const copy = structuredClone(localizedFixturePack);
    const en = contentPresentation(copy, true, 'en-US'),
      zh = contentPresentation(copy, true, 'zh-TW');
    expect(zh.characters[0]).toMatchObject({
      name: '示範林地守護者 (Sample Grovekeeper)',
      canonicalName: 'Sample Grovekeeper',
      translationStatus: 'MANUAL_REVIEWED',
      translationSource: 'MANUAL',
    });
    expect(zh.cards[0]!.name).toBe('示範友善推擠');
    expect(zh.cards[0]!.rulesText).toContain('耐力值');
    expect(zh.mechanics).toEqual([{ id: 'tokens', name: '資源標記' }]);
    expect(zh.products![0]!.name).toBe('原創虛構示範牌組');
    expect(zh.ruleModules![0]!.summary).toContain('測試規則');
    expect(
      zh.cards.map((card) => [
        card.id,
        card.type,
        card.responseKind,
        card.requiresTarget,
      ]),
    ).toEqual(
      en.cards.map((card) => [
        card.id,
        card.type,
        card.responseKind,
        card.requiresTarget,
      ]),
    );
    expect(copy).toEqual(localizedFixturePack);
    expect(JSON.stringify(zh)).not.toMatch(
      /"(?:effects|deckCards|seed|rng|physicalId)":/,
    );
    expect(
      contentPresentation(sampleContentPack, true, 'zh-TW').cards[0]!.name,
    ).toBe(sampleContentPack.cards[0]!.name);
    expect(() =>
      localizedField(
        sampleContentPack,
        'zh-TW',
        'CARD',
        sampleContentPack.cards[0]!.id,
        'name',
        'Canonical',
        true,
      ),
    ).toThrow(TranslationUnavailable);
  });
  it('catches invalid graphs, duplicates, missing fields, drafts, English fallback and production placeholders', () => {
    expect(verifyContentTranslations({}).complete).toBe(false);
    const absent = structuredClone(localizedFixturePack);
    delete absent.translations;
    expect(verifyContentTranslations(absent).missing).toHaveLength(27);
    const bad = structuredClone(localizedFixturePack);
    bad.translations![0]!.text = 'English sample';
    bad.translations![0]!.status = 'MACHINE_DRAFT';
    bad.cards[0]!.source = 'USER_OWNED';
    expect(verifyContentTranslations(bad).issues.join('\n')).toMatch(
      /Unreviewed[\s\S]*English fallback[\s\S]*Placeholder/,
    );
    bad.translations!.push(bad.translations![0]!);
    expect(verifyContentTranslations(bad).issues).toContain(
      'Duplicate translation',
    );
    expect(() =>
      contentPresentation(productionFixture(), false, 'zh-TW'),
    ).toThrow(TranslationUnavailable);
    const reviewed = structuredClone(localizedFixturePack);
    reviewed.translations![1]!.status = 'VERIFIED';
    expect(
      localizedField(
        reviewed,
        'zh-TW',
        'CHARACTER',
        reviewed.characters[0]!.id,
        'name',
        reviewed.characters[0]!.name,
      ).text,
    ).toBe('示範林地守護者');
  });
  it('localizes choice labels independently of authoritative options and rejects unknown mechanic or choice references', () => {
    const pack = structuredClone(localizedFixturePack);
    const card = pack.cards[0]!;
    card.effects = [
      {
        op: 'OPEN_OPTION',
        target: 'SELF',
        options: [{ id: 'keep', label: 'Keep going' }],
      },
    ];
    const translation = {
      ...pack.translations![0]!,
      entityType: 'CHOICE_OPTION' as const,
      entityId: `${card.id}/keep`,
      field: 'label' as const,
      text: '繼續進行',
    };
    pack.translations!.push(translation);
    expect(requiredTranslationFields(pack).at(-3)?.entityType).toBeDefined();
    expect(contentPresentation(pack, true, 'zh-TW').choiceOptions).toEqual([
      { cardDefinitionId: card.id, optionId: 'keep', label: '繼續進行' },
    ]);
    translation.entityId = 'unknown';
    expect(contentPackSchema.safeParse(pack).success).toBe(false);
    translation.entityType = 'MECHANIC' as typeof translation.entityType;
    expect(contentPackSchema.safeParse(pack).success).toBe(false);
  });
  it('merges translations into a new immutable edition and rejects duplicate input or reused version', () => {
    const row = localizedFixturePack.translations![0]!;
    const next = translatedEdition(
      localizedFixturePack,
      [{ ...row, text: '新的原創牌組' }],
      {
        ...localizedFixturePack.version,
        id: 'content_new' as typeof localizedFixturePack.version.id,
      },
    );
    expect(next.cards).toEqual(localizedFixturePack.cards);
    expect(next.translations![0]!.text).toBe('新的原創牌組');
    expect(() =>
      translatedEdition(sampleContentPack, [row, row], next.version),
    ).toThrow('Duplicate');
    expect(() =>
      translatedEdition(sampleContentPack, [], sampleContentPack.version),
    ).toThrow('new immutable');
  });
  it('preserves accepted events, RNG, and replay inputs across presentation requests', () => {
    const setup = setupInput(17, 7, [0, 1]);
    setup.content = localizedFixturePack;
    const a = createMatch(setup),
      b = createMatch(setup);
    contentPresentation(contentPackSchema.parse(setup.content), true, 'zh-TW');
    contentPresentation(contentPackSchema.parse(setup.content), true, 'en-US');
    const first = accepted(a, 'START_MATCH'),
      second = accepted(b, 'START_MATCH');
    expect(first).toEqual(second);
    const draw = accepted(first.state, 'DISCARD', { cardIds: [] }),
      repeat = accepted(second.state, 'DISCARD', { cardIds: [] });
    expect(draw).toEqual(repeat);
    let sequence = 0;
    const entries = [first, draw].map((result, index) => {
      const entry = replayEntrySchema.parse({
        actorId: setup.hostPlayerId,
        command:
          result.events[0]!.commandId === first.events[0]!.commandId
            ? {
                type: 'START_MATCH',
                commandId: first.events[0]!.commandId,
                roomId: a.roomId,
                expectedStateVersion: a.version,
              }
            : {
                type: 'DISCARD',
                cardIds: [],
                commandId: draw.events[0]!.commandId,
                roomId: a.roomId,
                expectedStateVersion: first.state.version,
              },
        firstSequence: sequence + 1,
        lastSequence: sequence + result.events.length,
        events: result.events,
        acceptedAt: `2026-10-03T00:00:0${index}.000Z`,
      });
      sequence = entry.lastSequence;
      return entry;
    });
    expect(
      replayFromBeginning(
        replayManifestSchema.parse({ schemaVersion: 1, setup }),
        entries,
      ).state,
    ).toEqual(draw.state);
  });
  it('serves fully reviewed production translations while rejecting manual drafts', () => {
    const pack = productionFixture();
    pack.translations = requiredTranslationFields(pack).map((row) => ({
      entityType: row.entityType,
      entityId: row.entityId,
      field: row.field,
      locale: 'zh-TW',
      text: row.field === 'name' ? '原創名稱' : '原創內容說明',
      sourceKind: 'MANUAL',
      sourceRef: null,
      status: 'MANUAL_REVIEWED',
    }));
    expect(contentPresentation(pack, false, 'zh-TW').cards[0]!.name).toBe(
      '原創名稱',
    );
    pack.translations[0]!.status = 'MANUAL_DRAFT';
    expect(verifyContentTranslations(pack).issues).toContain(
      `Unreviewed translation: PRODUCT/${pack.products[0]!.id}/name/zh-TW`,
    );
  });
  it('uses only glossary-verified core names and leaves unknown names as explicit manual drafts', () => {
    const pack = productionFixture();
    pack.characters[0]!.name = 'Deirdre the Priestess';
    pack.products[0]!.name = 'The Red Dragon Inn';
    const rows = translationWorksheet(pack);
    expect(
      rows.find(
        (row) =>
          row.entityType === 'CHARACTER' &&
          row.entityId === pack.characters[0]!.id,
      ),
    ).toMatchObject({
      text: '迪爾德麗',
      status: 'VERIFIED',
      sourceKind: 'AUTHORIZED',
      sourceRef: 'reference/zh-TW-glossary.md',
    });
    expect(rows[0]!.text).toBe('紅龍酒館');
    expect(
      rows.find(
        (row) =>
          row.entityType === 'CHARACTER' &&
          row.entityId === pack.characters[1]!.id,
      ),
    ).toMatchObject({ text: pack.characters[1]!.name, status: 'MANUAL_DRAFT' });
    expect(
      translationWorksheet(localizedFixturePack).every(
        (row) => row.status === 'MANUAL_DRAFT',
      ),
    ).toBe(true);
  });
  it.each(['en-US', 'zh-TW'] as const)(
    'interpolates winner, response, reconnection and stat log text in %s',
    (locale) => {
      expect(formatMessage(locale, 'table.winner', { name: 'Alex' })).toContain(
        'Alex',
      );
      expect(
        formatMessage(locale, 'table.waitResponse', { name: 'Alex' }),
      ).toContain('Alex');
      expect(formatMessage(locale, 'status.reconnecting')).not.toContain('{');
      expect(
        formatMessage(locale, 'log.stat', {
          name: 'Alex',
          stat: 'player.gold',
          before: 10,
          after: 9,
        }),
      ).toContain(formatMessage(locale, 'player.gold'));
    },
  );
});
