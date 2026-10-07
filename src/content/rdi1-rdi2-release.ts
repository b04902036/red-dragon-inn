import { z } from 'zod';
import { verifyRdi1SourceLock } from './rdi1-audit';
import { compileRdi1Source } from './rdi1-compiler';
import { verifyRdi1Pack } from './rdi1-pack';
import {
  compileRdi2Source,
  combineRdi1Rdi2,
  type Rdi2AuditInputs,
} from './rdi2-compiler';
import { verifyRdi2Pack } from './rdi2-pack';
import { validateContentImport } from './import';
import { requiredTranslationFields } from './localization';
import type { ContentPack } from './pack';

export interface Rdi1Rdi2ReleaseInput {
  rdi1Source: unknown;
  rdi1Lock: unknown;
  rdi1Hashes: Record<string, string>;
  rdi2Source: unknown;
  rdi2Audit: Rdi2AuditInputs;
  evidenceHashes: { files: readonly string[]; records: readonly string[] };
  combined: unknown;
}
const evidence = z.looseObject({
  id: z.string(),
  canonicalRecordSha256: z.string().optional(),
  recordCanonicalSha256: z.string().optional(),
  sourceFileSha256: z.string().optional(),
  sourceSha256: z.string().optional(),
  imageSha256: z.string().optional(),
  sha256: z.string().optional(),
});
const entry = z.looseObject({
  ledgerId: z.string(),
  review: z.looseObject({ evidence: z.array(evidence) }),
});
const ledgerSchema = z.looseObject({
  characterMechanics: z.array(entry),
  drinks: z.array(entry),
});
const deckIds = [
  'deck_rdi1_deirdre',
  'deck_rdi1_fiona',
  'deck_rdi1_gerki',
  'deck_rdi1_zot',
  'deck_rdi2_dimli',
  'deck_rdi2_eve',
  'deck_rdi2_fleck',
  'deck_rdi2_gog',
  'deck_rdi1_inn',
  'deck_rdi2_inn',
];

/** Read-only release gate. Expected content is recompiled from verified locks. */
export function verifyRdi1Rdi2Release(input: Rdi1Rdi2ReleaseInput) {
  const sourceErrors = verifyRdi1SourceLock(input.rdi1Lock, input.rdi1Hashes);
  let expected: ContentPack | null = null;
  try {
    const rdi1 = compileRdi1Source(input.rdi1Source);
    const report = verifyRdi1Pack(rdi1, input.rdi1Source);
    sourceErrors.push(...report.errors);
    const rdi2 = compileRdi2Source(input.rdi2Source, input.rdi2Audit);
    expected = combineRdi1Rdi2(rdi1, rdi2);
  } catch (error) {
    sourceErrors.push(
      error instanceof Error ? error.message : 'Invalid locked source',
    );
  }
  const ledger = ledgerSchema.safeParse(input.rdi2Audit.ledger);
  if (!ledger.success) sourceErrors.push('Invalid evidence ledger');
  else {
    const files = new Set(input.evidenceHashes.files),
      records = new Set(input.evidenceHashes.records);
    for (const row of [
      ...ledger.data.characterMechanics,
      ...ledger.data.drinks,
    ])
      for (const item of row.review.evidence) {
        for (const key of [
          'canonicalRecordSha256',
          'recordCanonicalSha256',
        ] as const)
          if (item[key] !== undefined && !records.has(item[key]))
            sourceErrors.push(
              `${row.ledgerId}/${item.id}: original record hash not reproduced`,
            );
        for (const key of [
          'sourceFileSha256',
          'sourceSha256',
          'imageSha256',
          'sha256',
        ] as const)
          if (item[key] !== undefined && !files.has(item[key]))
            sourceErrors.push(
              `${row.ledgerId}/${item.id}: evidence artifact hash not reproduced`,
            );
      }
  }
  const imported = validateContentImport(JSON.stringify(input.combined));
  const pack = imported.pack;
  const errors = [...sourceErrors, ...imported.report.errors];
  if (expected !== null)
    errors.push(...verifyRdi2Pack(input.combined, expected).errors);
  const decks = Object.fromEntries(
    deckIds.map((id) => [
      id,
      pack?.deckCards
        .filter((row) => row.deckId === id)
        .reduce((n, row) => n + row.quantity, 0) ?? 0,
    ]),
  );
  const fields = pack === null ? [] : requiredTranslationFields(pack);
  const missing = (locale: 'en-US' | 'zh-TW') =>
    fields.filter(
      (field) =>
        !pack!.translations?.some(
          (row) =>
            row.locale === locale &&
            row.entityType === field.entityType &&
            row.entityId === field.entityId &&
            row.field === field.field &&
            row.text.trim(),
        ),
    ).length;
  const counts = {
    playableCharacters: pack?.characters.length ?? 0,
    characterPhysicalCards:
      pack?.deckCards
        .filter(
          (row) =>
            pack.decks.find((deck) => deck.id === row.deckId)?.type ===
            'CHARACTER',
        )
        .reduce((n, row) => n + row.quantity, 0) ?? 0,
    drinkPhysicalCards:
      pack?.deckCards
        .filter(
          (row) =>
            pack.decks.find((deck) => deck.id === row.deckId)?.type ===
            'INN_DRINK',
        )
        .reduce((n, row) => n + row.quantity, 0) ?? 0,
    uniqueDefinitions: pack?.cards.length ?? 0,
    sourceConflicts: sourceErrors.length,
    unknownMechanics: expected === null ? null : 0,
    unknownEffects: imported.report.unsupportedEffects.length,
    unsupportedCards:
      pack === null
        ? null
        : pack.cards.filter(
            (card) => card.type !== 'DRINK' && card.effects.length === 0,
          ).length,
    sometimesWithoutStructuredTrigger:
      pack?.cards.filter(
        (card) =>
          card.type === 'SOMETIMES' && card.responseTrigger === undefined,
      ).length ?? 0,
    missingEnUS: missing('en-US'),
    missingZhTW: missing('zh-TW'),
    sampleProductionRecords:
      pack === null
        ? null
        : [
            ...pack.products,
            ...pack.characters,
            ...pack.decks,
            ...pack.cards,
          ].filter(
            (row) =>
              /sample|fixture/i.test(row.id) || /\bsample\b/i.test(row.name),
          ).length +
          pack.cards.filter((card) => card.source !== 'PUBLIC_RULES_PARAPHRASE')
            .length,
  };
  if (
    counts.playableCharacters !== 8 ||
    counts.characterPhysicalCards !== 320 ||
    counts.drinkPhysicalCards !== 60 ||
    counts.uniqueDefinitions !== 226
  )
    errors.push(
      'Eight-character release totals differ from 8 / 320 / 60 / 226',
    );
  for (const [id, count] of Object.entries(decks))
    if (count !== (id.endsWith('_inn') ? 30 : 40))
      errors.push(`Wrong release deck count ${id}: ${count}`);
  return { valid: errors.length === 0 && pack !== null, counts, decks, errors };
}
