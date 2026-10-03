import { contentPackSchema } from './pack';
import type { ContentPack } from './pack';
import {
  englishMessages,
  traditionalChineseMessages,
} from '../shared/ui-messages';
import type { Locale } from '../shared/locales';

export type Translation = NonNullable<ContentPack['translations']>[number];
const verifiedCoreNames: Record<string, string> = {
  Deirdre: '迪爾德麗',
  'Deirdre the Priestess': '迪爾德麗',
  Fiona: '菲奧娜',
  'Fiona the Volatile': '菲奧娜',
  Gerki: '戈爾基',
  'Gerki the Sneak': '戈爾基',
  Zot: '佐特',
  'Zot the Wizard and Pooky': '佐特',
};
/** Only the core names explicitly verified by the supplied glossary authority. */
export function translationWorksheet(pack: ContentPack): Translation[] {
  return requiredTranslationFields(pack).map(({ canonical, ...row }) => {
    const known =
      row.entityType === 'CHARACTER'
        ? verifiedCoreNames[canonical]
        : row.entityType === 'PRODUCT' && canonical === 'The Red Dragon Inn'
          ? '紅龍酒館'
          : undefined;
    return {
      ...row,
      locale: 'zh-TW',
      text: known ?? canonical,
      sourceKind: known ? 'AUTHORIZED' : 'MANUAL',
      sourceRef: known ? 'reference/zh-TW-glossary.md' : null,
      status: known ? 'VERIFIED' : 'MANUAL_DRAFT',
    };
  });
}
export interface TranslationField {
  entityType: Translation['entityType'];
  entityId: string;
  field: Translation['field'];
  canonical: string;
}
export const translationKey = (
  row: Pick<Translation, 'entityType' | 'entityId' | 'field' | 'locale'>,
) => `${row.entityType}/${row.entityId}/${row.field}/${row.locale}`;

/** All public definition fields. This never enumerates physical cards or hidden state. */
export function requiredTranslationFields(
  pack: ContentPack,
): TranslationField[] {
  return [
    ...pack.products.map((row) => ({
      entityType: 'PRODUCT' as const,
      entityId: row.id,
      field: 'name' as const,
      canonical: row.name,
    })),
    ...pack.characters.map((row) => ({
      entityType: 'CHARACTER' as const,
      entityId: row.id,
      field: 'name' as const,
      canonical: row.name,
    })),
    ...pack.cards.flatMap((row) => [
      {
        entityType: 'CARD' as const,
        entityId: row.id,
        field: 'name' as const,
        canonical: row.name,
      },
      {
        entityType: 'CARD' as const,
        entityId: row.id,
        field: 'rulesText' as const,
        canonical: row.rulesText,
      },
      ...row.effects.flatMap((effect) =>
        effect.op === 'OPEN_OPTION'
          ? effect.options.map((option) => ({
              entityType: 'CHOICE_OPTION' as const,
              entityId: `${row.id}/${option.id}`,
              field: 'label' as const,
              canonical: option.label,
            }))
          : [],
      ),
    ]),
    ...pack.ruleModules.map((row) => ({
      entityType: 'RULE_MODULE' as const,
      entityId: row.id,
      field: 'summary' as const,
      canonical: row.summary,
    })),
    ...[
      ...new Set(
        pack.characters.flatMap((character) =>
          Object.keys(character.rules.resources),
        ),
      ),
    ].map((key) => ({
      entityType: 'MECHANIC' as const,
      entityId: key,
      field: 'label' as const,
      canonical: key,
    })),
  ];
}

/** Selected terminology in reference/zh-TW-glossary.md. Printed timing keywords stay English. */
export const glossary = {
  'app.title': '紅龍酒館',
  'player.fortitude': '耐力值',
  'player.alcohol': '酒精值',
  'player.gold': '金幣',
  'term.hand': '手牌',
  'term.deck': '牌庫',
  'term.discard': '棄牌堆',
  'term.characterDeck': '角色牌庫',
  'term.drinkDeck': '飲料牌庫',
  'term.drinkPile': '暢飲區',
  'phase.DISCARD_DRAW': '棄牌抽牌階段',
  'phase.ACTION': '出牌行動階段',
  'phase.ORDER_DRINK': '請客階段',
  'phase.DRINK': '喝酒階段',
  'term.gambling': '賭博',
  'term.cheating': '作弊',
  'term.skip': '跳過',
  'term.control': '主導權',
  'term.chaser': '續杯',
  'term.drinkEvent': '酒卡事件',
  'term.passOut': '醉倒',
  'term.eliminated': '淘汰',
  'term.response': '回應時機',
} as const;
const forbiddenTerms =
  /红|龙|馆|币|弃|饮|畅|赌|骗|过|导|权|续|阶|时|应|选择|确认|连接|玩家们|(?:毅力|耐力(?!值)|酒精含量|酒精濃度|追酒|追飲)/u;
export function terminologyIssues(text: string): string[] {
  const match = text.match(forbiddenTerms);
  return match
    ? [`Forbidden or inconsistent zh-TW terminology: ${match[0]}`]
    : [];
}
export function verifyUiTranslations(
  english: Record<string, string> = englishMessages,
  chinese: Record<string, string> = traditionalChineseMessages,
) {
  const issues: string[] = [];
  for (const [key, value] of Object.entries(english)) {
    const translated = chinese[key];
    if (!translated) {
      issues.push(`Missing UI key: ${key}`);
      continue;
    }
    const parameters = (text: string) =>
      [...text.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1])
        .sort()
        .join(',');
    if (parameters(value) !== parameters(translated))
      issues.push(`Parameter mismatch: ${key}`);
    if (
      value === translated &&
      /[a-z]{3}/i.test(value) &&
      !['card.SOMETIMES', 'card.ANYTIME'].includes(key)
    )
      issues.push(`Untranslated UI key: ${key}`);
    issues.push(
      ...terminologyIssues(translated).map((issue) => `${key}: ${issue}`),
    );
  }
  for (const key of Object.keys(chinese))
    if (!(key in english)) issues.push(`Unknown UI key: ${key}`);
  for (const [key, value] of Object.entries(glossary))
    if (chinese[key] !== value)
      issues.push(`Glossary mismatch: ${key}; expected ${value}`);
  return issues;
}

export function verifyContentTranslations(input: unknown) {
  const parsed = contentPackSchema.safeParse(input);
  const issues: string[] = [];
  if (!parsed.success)
    return {
      complete: false,
      requiredFields: 0,
      translatedFields: 0,
      missing: [] as string[],
      issues: parsed.error.issues.map((issue) => issue.message),
    };
  const pack = parsed.data;
  const required = requiredTranslationFields(pack);
  const translations = new Map(
    (pack.translations ?? [])
      .filter((row) => row.locale === 'zh-TW')
      .map((row) => [translationKey(row), row]),
  );
  const missing: string[] = [];
  for (const field of required) {
    const key = translationKey({ ...field, locale: 'zh-TW' });
    const row = translations.get(key);
    if (!row) {
      missing.push(key);
      continue;
    }
    issues.push(
      ...terminologyIssues(row.text).map((issue) => `${key}: ${issue}`),
    );
    if (row.status === 'MACHINE_DRAFT' || row.status === 'MANUAL_DRAFT')
      issues.push(`Unreviewed translation: ${key}`);
    if (!/[\p{Script=Han}]/u.test(row.text))
      issues.push(`English fallback or untranslated required field: ${key}`);
    if (
      pack.cards.some(
        (card) => card.source === 'USER_OWNED' || card.source === 'LICENSED',
      ) &&
      /\bsample\b|示範|測試卡|placeholder/i.test(row.text)
    )
      issues.push(`Placeholder in production translation: ${key}`);
  }
  return {
    complete: missing.length === 0 && issues.length === 0,
    requiredFields: required.length,
    translatedFields: required.length - missing.length,
    missing,
    issues,
  };
}

export class TranslationUnavailable extends Error {}
export function localizedField(
  pack: ContentPack,
  locale: Locale,
  entityType: Translation['entityType'],
  entityId: string,
  field: Translation['field'],
  canonical: string,
  strict = false,
) {
  if (locale === 'en-US') return { text: canonical, canonicalText: canonical };
  const row = pack.translations?.find(
    (row) =>
      row.locale === locale &&
      row.entityType === entityType &&
      row.entityId === entityId &&
      row.field === field,
  );
  if (!row) {
    if (strict)
      throw new TranslationUnavailable(
        'Required content translation is unavailable.',
      );
    return { text: canonical, canonicalText: canonical };
  }
  return {
    text:
      entityType === 'CHARACTER' && row.status !== 'VERIFIED'
        ? `${row.text} (${canonical})`
        : row.text,
    canonicalText: canonical,
    translationStatus: row.status,
    translationSource: row.sourceKind,
  };
}

/** Merge reviewed data into a NEW edition; canonical definitions remain byte-for-byte unchanged. */
export function translatedEdition(
  input: ContentPack,
  translations: Translation[],
  version: ContentPack['version'],
) {
  const merged = new Map(
    (input.translations ?? []).map((row) => [translationKey(row), row]),
  );
  const incoming = new Set<string>();
  for (const row of translations) {
    const key = translationKey(row);
    if (incoming.has(key))
      throw new RangeError(`Duplicate translation: ${key}`);
    incoming.add(key);
    merged.set(key, row);
  }
  if (version.id === input.version.id)
    throw new RangeError(
      'Translations require a new immutable content version.',
    );
  return contentPackSchema.parse({
    ...input,
    version,
    translations: [...merged.values()],
  });
}
