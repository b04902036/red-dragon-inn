import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { m19OrderEffects, m19OrderMetadata } from '../fixtures/rdi2-m19-source';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const source = read('content-private/imports/rdi2/source-candidate.json');
const ledger = read('content-private/imports/rdi2/verification-ledger.json');
const mechanic = source.mechanics[18],
  entry = ledger.characterMechanics[18];
it.each([1, 2])(
  'retains independently verified original Fleck physical record %i',
  (copy) => {
    const evidence = entry.review.evidence.find(
      (r: { id: string }) => r.id === `original-m19-fleck-${copy}`,
    );
    expect(evidence).toMatchObject({
      physicalCopy: copy,
      sourceId: 'the_inn_m19_original_fleck',
    });
    expect(evidence.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.sourceFileSha256).toBe(
      source.sources.the_inn_m19_original_fleck.sha256,
    );
    expect(source.sources.the_inn_m19_original_fleck.sha256).toBe(
      read('reference/rdi2/the-inn-crosscheck.json').characters.fleck.sha256,
    );
  },
);
it('keeps original unofficial provenance separate from current publisher rules and Gog overrides', () => {
  expect(source.sources.the_inn_m19_original_fleck).toMatchObject({
    kind: 'ORIGINAL_UNOFFICIAL_JSON',
    authority: 'SECONDARY',
  });
  expect(mechanic.projectRulesetOverrides).toBeUndefined();
  expect(entry.status).toBe('VERIFIED');
  expect(entry.characterVerification).toEqual(
    mechanic.verification.characterVerification,
  );
  expect(
    entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
  ).toBe(true);
});
it('preserves two free other-player orders OR only the current self refill fee waiver', () => {
  expect(mechanic.effects[0]).toMatchObject({
    op: 'CONTEXT_BRANCH',
    branches: [
      {
        when: 'ORDER_TWO_EXTRA_FREE',
        effects: [
          {
            op: 'ORDER_EXTRA_DRINKS',
            count: 2,
            targets: 'OTHER_PLAYERS',
            faceDown: true,
            payment: 0,
          },
        ],
      },
      {
        when: 'WAIVE_SELF_REFILL_PAYMENT',
        effects: [
          {
            op: 'WAIVE_CURRENT_REFILL_PAYMENT',
            target: 'SELF',
            amount: 1,
            recipient: 'INN',
            scope: 'CURRENT_REFILL_PAYMENT',
          },
        ],
      },
    ],
  });
  expect(entry.review.legality).toEqual(mechanic.legality);
  expect(entry.review.effects).toEqual(mechanic.effects);
  expect(mechanic.engineAudit.orderBranch.mandatoryGoldCost).toBeUndefined();
  expect(mechanic.engineAudit.orderBranch).toEqual({
    status: 'SUPPORTED_SHARED_ENGINE',
    phaseOpportunity: m19OrderMetadata.phaseOpportunity,
    responseTrigger: m19OrderMetadata.trigger,
    effects: m19OrderEffects,
  });
  expect(mechanic.engineAudit.refillBranch.status).toBe(
    'REQUIRES_STEP_24B_SHARED_CAPABILITY',
  );
  expect(mechanic.engineRequirements).toContain('drink.refill-payment-waiver');
});
it('keeps each deck at forty and both physical Fleck copies, with no other owner', () => {
  for (const c of source.characters) {
    expect(
      c.cards.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(40);
    const rows = c.cards.filter(
      (r: { mechanicId: string }) => r.mechanicId === mechanic.id,
    );
    expect(
      rows.reduce((n: number, r: { quantity: number }) => n + r.quantity, 0),
    ).toBe(c.id === 'fleck' ? 2 : 0);
    if (c.id === 'fleck') expect(rows[0].canonicalCardTitles).toHaveLength(2);
  }
  const matrixRow = readFileSync(
    'reference/rdi2/rdi2-mechanics-matrix.csv',
    'utf8',
  )
    .split(/\r?\n/)
    .find((r) => r.startsWith(mechanic.id + ','))!;
  expect(matrixRow.split(',').slice(4, 8).map(Number)).toEqual([0, 0, 2, 0]);
});
