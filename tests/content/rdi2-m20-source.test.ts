import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { m20SupportedEffects } from '../fixtures/rdi2-m20-source';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json'),
  ledger = read('content-private/imports/rdi2/verification-ledger.json');
const mechanic = source.mechanics[19],
  entry = ledger.characterMechanics[19];
it('retains the individually inspected physical Fleck Action and original reference hash', () => {
  const record = entry.review.evidence.find(
    (r: { id: string }) => r.id === 'original-m20-fleck-1',
  );
  expect(record).toMatchObject({
    physicalCopy: 1,
    canonicalTitle: 'A toast! To my friends!',
    sourceId: 'the_inn_m20_original_fleck',
  });
  expect(record.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(record.sourceFileSha256).toBe(
    read('reference/rdi2/the-inn-crosscheck.json').characters.fleck.sha256,
  );
  expect(source.sources.the_inn_m20_original_fleck).toMatchObject({
    kind: 'ORIGINAL_UNOFFICIAL_JSON',
    authority: 'SECONDARY',
    sha256: record.sourceFileSha256,
  });
  expect(mechanic.projectRulesetOverrides).toBeUndefined();
});
it('preserves separate all-player Inn Drinks, leading-Event search, current Chasers and simultaneous settlement', () => {
  expect(mechanic.drinkSemantics).toMatchObject({
    recipients: 'ALL_LIVING_PLAYERS_INCLUDING_SELF',
    source: 'INN_DRINK_DECK',
    drawMode: 'SEPARATE_DRINK_PER_PLAYER',
    skipLeadingDrinkEvents: true,
    chasers: 'STANDARD_SAME_SOURCE_COMPLETE_BEFORE_RESPONSES',
    responses: 'INDEPENDENT_PER_DRINK',
    settlement: 'SIMULTANEOUS_AFTER_ALL_RESPONSES',
    contest: false,
    copiesSingleDrink: false,
  });
  expect(entry.review.drinkSemantics).toEqual(mechanic.drinkSemantics);
  expect(entry.review.effects).toEqual(mechanic.effects);
  expect(
    entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});
it('records the leading-Event skip gap without claiming the whole card is engine-implemented', () => {
  expect(mechanic.engineAudit.status).toBe('PARTIAL_SHARED_ENGINE_SUPPORT');
  expect(mechanic.engineAudit.supportedBinding.effects).toEqual(
    m20SupportedEffects,
  );
  expect(mechanic.engineAudit.missingCapabilities).toEqual([
    'drink.simultaneous-from-inn-leading-event-skip',
  ]);
  expect(mechanic.engineRequirements).toContain(
    'drink.simultaneous-from-inn-leading-event-skip',
  );
  expect(entry.review.engineAudit).toEqual(mechanic.engineAudit);
});
it('preserves the single physical copy and checks each absent owner without changing totals', () => {
  for (const c of source.characters) {
    const rows = c.cards.filter(
      (r: { mechanicId: string }) => r.mechanicId === mechanic.id,
    );
    expect(
      rows.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(c.id === 'fleck' ? 1 : 0);
    expect(
      c.cards.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(40);
  }
  const row = readFileSync('reference/rdi2/rdi2-mechanics-matrix.csv', 'utf8')
    .split(/\r?\n/)
    .find((r) => r.startsWith(mechanic.id + ','))!;
  expect(row.split(',').slice(4, 8).map(Number)).toEqual([0, 0, 1, 0]);
});
