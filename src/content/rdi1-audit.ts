import { z } from 'zod';
import type { Rdi1Source } from './rdi1-source';
import {
  RDI1_ENGINE_CAPABILITIES,
  type Rdi1Capability,
} from './rdi1-capabilities';
import { cardInstanceIdSchema } from '../shared/ids';

const fixtureCase = z.strictObject({
  context: z.record(
    z.string().min(1).max(64),
    z.union([z.string().min(1).max(256), z.number().int().safe(), z.boolean()]),
  ),
  relation: z.string().min(1).max(256),
  reason: z.string().min(1).max(1000),
  expectedLegalPlays: z
    .array(
      z.strictObject({
        cardId: cardInstanceIdSchema,
        commandType: z.enum(['PLAY_CARD', 'PLAY_RESPONSE']),
        requiresTarget: z.boolean(),
        legalTargetPlayerIds: z
          .array(z.string().regex(/^player_[a-z0-9_]+$/))
          .max(4),
      }),
    )
    .max(1),
});
export const rdi1LegalityFixturesSchema = z
  .array(
    z.strictObject({
      mechanicId: z.string().regex(/^[a-z][a-z0-9_]+$/),
      positive: fixtureCase,
      negative: fixtureCase,
    }),
  )
  .min(1)
  .max(256);
export type Rdi1LegalityFixtures = z.infer<typeof rdi1LegalityFixturesSchema>;
export function verifyRdi1LegalityFixtures(source: Rdi1Source, input: unknown) {
  const result = rdi1LegalityFixturesSchema.safeParse(input);
  if (!result.success) return ['Invalid Sometimes legality fixture schema'];
  const fixtures = result.data,
    errors: string[] = [];
  const sometimes = source.mechanics.filter((m) => m.type === 'SOMETIMES');
  if (new Set(fixtures.map((f) => f.mechanicId)).size !== fixtures.length)
    errors.push('Duplicate legality fixture');
  for (const m of sometimes)
    if (!fixtures.some((f) => f.mechanicId === m.id))
      errors.push(`Missing legality fixtures ${m.id}`);
  for (const f of fixtures) {
    if (!sometimes.some((m) => m.id === f.mechanicId))
      errors.push(`Unknown Sometimes fixture ${f.mechanicId}`);
    if (
      f.positive.expectedLegalPlays.length !== 1 ||
      f.negative.expectedLegalPlays.length !== 0 ||
      Object.keys(f.positive.context).length === 0 ||
      Object.keys(f.negative.context).length === 0 ||
      JSON.stringify(f.positive.context) ===
        JSON.stringify(f.negative.context) ||
      f.positive.expectedLegalPlays[0]?.cardId !== `card_audit_${f.mechanicId}`
    )
      errors.push(`Invalid positive/negative expectations ${f.mechanicId}`);
  }
  return errors;
}
export const rdi1SourceLockSchema = z.strictObject({
  schemaVersion: z.literal(1),
  engineBaseline: z.literal('step-20'),
  sha256: z.record(z.string().min(1), z.string().regex(/^[a-f0-9]{64}$/)),
});
export function verifyRdi1SourceLock(
  lock: unknown,
  sha256: Record<string, string>,
) {
  const parsed = rdi1SourceLockSchema.safeParse(lock);
  if (!parsed.success) return ['Invalid source lock schema'];
  if (
    JSON.stringify(Object.entries(parsed.data.sha256).sort()) !==
    JSON.stringify(Object.entries(sha256).sort())
  )
    return ['Source/reference bytes differ from the reviewed source lock'];
  return [];
}
const additionalFindings = [
  [
    'Anytime during gambling',
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'card-play-legality.ts requires no gambling for root Anytime; a real command and private projection reproduce the gap.',
  ],
  [
    'Original-source provenance after redirection',
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'Current actorId survives ordinary nesting, but redirection and ORIGINAL_SOURCE_PLAYER resolution are absent.',
  ],
  [
    'Gold transfer direction',
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'TRANSFER_GOLD pays from the actor to targets. Source collection/healing-payment/theft summaries require the reverse direction. Compilation must not silently reverse the rules summary or reuse the wrong operation.',
  ],
  [
    'Self-targeting living-player cards',
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'Queue and legal-target validation universally exclude the actor. ANY_LIVING_PLAYER includes SELF in the supplied source.',
  ],
  [
    'Mandatory costs and current-player funds',
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'PAY_INN caps rather than rejecting an unpaid full cost; affordability must become shared legality for costed mechanics.',
  ],
  [
    'Generic character traits',
    'SUPPORTED_WITH_SCHEMA_EXTENSION',
    'ORC/TROLL Drink replacement plans need validated trait facts and effect selection. No character-name branches are acceptable.',
  ],
  [
    'Current Drink versus Event',
    'ALREADY_SUPPORTED',
    'MODIFY_DRINK rejects Events unless explicitly permitted and mutates the combined Chaser frame. Preserve these boundaries.',
  ],
  [
    'Protected and capability-based counters',
    'SUPPORTED_WITH_SCHEMA_EXTENSION',
    'Generic NEGATE alone is broader than these mechanics. Family equality and exclusions must be evaluated by the shared server predicate; an unqualified NEGATE is not an equivalent compilation.',
  ],
] as const;
/** Only IDs, generic plans and audit facts are emitted; private display text is never copied. */
export function renderRdi1EngineGap(
  source: Rdi1Source,
  capabilities: string[],
  fixtures: Rdi1LegalityFixtures,
  sha256: Record<string, string>,
) {
  const lines = [
    '# RDI1 source lock and Step-20 engine gap',
    '',
    'Generated by `npm run content:verify:rdi1-source`. Step 21A validates the supplied normalized mechanics; it neither compiles/publishes decks nor implements these gaps. Classifications are a reviewed code assessment, not a runtime support registry.',
    '',
    '## Locked inputs',
    '',
    ...Object.entries(sha256)
      .sort()
      .map(([path, hash]) => `- \`${path}\`: \`${hash}\``),
    '',
    'Source quantities: Deirdre 40, Fiona 40, Gerki 40, Zot 40; character total 160; Drink total 30. Matrix quantities, all bilingual fields, every referenced mechanic, Sometimes legality, effect plans and declared capabilities are validated. The supplied source is retained under ignored private content. Its paraphrase/provenance claims are recorded in [source evidence](../reference/rdi1/source-evidence.md); source validation is not a distribution license or an independent web-source certification.',
    '',
    '## Required capabilities',
    '',
    'ALREADY_SUPPORTED means the relevant current primitive works. SUPPORTED_WITH_SCHEMA_EXTENSION means the existing response workflow can be reused after validated metadata/facts and the shared evaluator are extended. NEEDS_GENERIC_ENGINE_FEATURE means a new generic operation, context or continuation is required. Partial primitives do not establish full mechanic support.',
    '',
    '| Capability | Classification | Step-20 evidence and required work |',
    '| --- | --- | --- |',
  ];
  for (const id of [...capabilities].sort()) {
    const [status, file, reason] =
      RDI1_ENGINE_CAPABILITIES[id as Rdi1Capability];
    const folder = ['effects.ts', 'reaction-triggers.ts'].includes(file)
      ? 'content'
      : 'engine';
    lines.push(
      `| \`${id}\` | ${status} | [${file}](../src/${folder}/${file}): ${reason} |`,
    );
  }
  lines.push(
    '',
    '## Additional source/engine mismatches',
    '',
    '| Concern | Classification | Evidence |',
    '| --- | --- | --- |',
    ...additionalFindings.map(
      ([name, status, reason]) => `| ${name} | ${status} | ${reason} |`,
    ),
    '',
    '## Sometimes legality specifications',
    '',
    'Each row has an explicit positive and negative fixture in [sometimes-legality-fixtures.json](../reference/rdi1/sometimes-legality-fixtures.json). Expected legalPlays describe the normalized-source contract for a local living priority holder, not a claim that Step 20 can already execute the mechanic. Unsupported timing/effects are deliberately reported; no invented fallback or no-op is compiled. Step 21B must make those positive expectations executable, and Step 21D must verify every compiled card.',
    '',
    '| Mechanic | Source opportunity | Positive context and relation | Negative context and relation | Expected legalPlays | Effect plan |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const m of source.mechanics.filter((m) => m.type === 'SOMETIMES')) {
    const f = fixtures.find((f) => f.mechanicId === m.id)!;
    const model =
      'mode' in m.legality ? m.legality.mode : m.legality.modes.join(', ');
    lines.push(
      `| \`${m.id}\` | ${model} | ${JSON.stringify(f.positive.context)}; ${f.positive.relation}; ${f.positive.reason} | ${JSON.stringify(f.negative.context)}; ${f.negative.relation}; ${f.negative.reason} | positive: \`${JSON.stringify(f.positive.expectedLegalPlays)}\`; negative: \`[]\` | ${m.effects.map((e) => e.op).join(', ')} |`,
    );
  }
  lines.push(
    '',
    '## Current-engine behavior probes',
    '',
    '`tests/engine/rdi1-source-audit.test.ts` executes current server projections/commands against original test cards: ordinary direct-stat Ignore predicates, Drink/Event modifiers, anti-cheat immediate-win rejection, Anytime during gambling, reverse Gold flow, self-target exclusion, phase-scoped Sometimes rejection, and pending-versus-resolved retaliation timing. These checks expose Step-20 boundaries and prevent an accidental claim of completed RDI1 support. The 23 positive/negative specifications cover every Sometimes mechanic; they are not substituted for future effect-resolution tests.',
    '',
    '## Next-step boundary',
    '',
    'Step 21A only. No new gameplay operation, client permission, timer policy, production provenance value, content import, D1 publication or character-specific rule is introduced. Step 21B may begin only after the source validator and all Step 21A checks pass. Compile/publish remains Step 21C; formal per-card verification remains Step 21D; Step 22 is the RDI1-only release audit.',
    '',
  );
  return lines.join('\n');
}
