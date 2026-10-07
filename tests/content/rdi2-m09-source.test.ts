import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { m09SourceExamples } from '../fixtures/rdi2-m09-source';

interface M09Spec {
  legality: {
    mode: string;
    trigger: {
      systemEvent: string;
      actor: string;
      covers: string[];
      pending: boolean;
      timing: string;
      excludeIfAny: string[];
    };
    allowsOwnCardPayment: boolean;
    respectSourceSpecificPaymentRules: boolean;
  };
  effects: {
    op: string;
    amount: string;
    source: string;
    destination: string;
    payerStashLoss: number;
    scope: string;
    satisfiesAnte: boolean;
    payerReceivesGold: boolean;
    innToInn: string;
  }[];
  verification: {
    status: string;
    characterVerification: {
      gog: {
        exactCardText: string;
        normalizedSemantics: string;
        officialSourceVerified: boolean;
      };
    };
  };
}
const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
) as { mechanics: (M09Spec & { id: string })[] };
const spec = source.mechanics.find(
  (m) => m.id === 'substitute_payment_from_inn',
)!;

describe('M09 source acceptance examples (not runtime implementation)', () => {
  it.each(m09SourceExamples)(
    'retains the verified source constraints for $name',
    ({ pending, expected }) => {
      const { trigger } = spec.legality;
      expect(spec.legality.mode).toBe('SYSTEM_RESPONSE');
      expect(trigger.systemEvent).toBe('GOLD_LOSS_REQUIRED');
      expect(trigger.actor).toBe('SELF');
      expect(trigger.pending).toBe(true);
      expect(trigger.timing).toBe(
        'BEFORE_CURRENT_GOLD_TRANSFER_OR_ANTE_RESOLVES',
      );
      if (pending === null) {
        expect(expected.legal).toBe(false);
        return;
      }
      expect(trigger.covers).toContain(pending.kind);
      if (pending.forbidden) {
        expect(trigger.excludeIfAny).toContain(pending.forbidden);
        expect(spec.legality.respectSourceSpecificPaymentRules).toBe(true);
        expect(expected.legal).toBe(false);
        return;
      }
      expect(expected.legal).toBe(true);
      expect(spec.effects).toHaveLength(1);
      const effect = spec.effects[0]!;
      expect(effect.op).toBe('SUBSTITUTE_CURRENT_GOLD_LOSS_FROM_INN');
      expect(effect.source).toBe('INN');
      expect(effect.amount).toBe('ENTIRE_CURRENT_GOLD_LOSS_INSTANCE');
      expect(effect).not.toHaveProperty('fixedAmount');
      expect(expected.innSupplies).toBe(pending.amount);
      expect(effect.payerStashLoss).toBe(expected.payerStashLoss);
      expect(effect.destination).toBe('ORIGINAL_DESTINATION');
      expect(expected.destination).toBe(pending.destination);
      expect(effect.payerReceivesGold).toBe(false);
      if (pending.causedByOwnCard)
        expect(spec.legality.allowsOwnCardPayment).toBe(true);
      if (pending.destination === 'INN') {
        expect(effect.innToInn).toBe('NO_NET_TRANSFER');
        expect(expected.innNetChange).toBe(0);
      }
      if (pending.kind === 'ANTE_TO_POT')
        expect(effect.satisfiesAnte).toBe(expected.anteSatisfied);
      if (expected.untouchedFutureContexts) {
        expect(effect.scope).toBe('CURRENT_PAYMENT_OR_GOLD_LOSS_CONTEXT');
        expect(expected.contextId).toBe(pending.id);
        expect(expected.untouchedFutureContexts).toEqual([
          'payment_2',
          'payment_3',
          'payment_4',
        ]);
        expect(expected.innSupplies).toBe(1);
      }
    },
  );
  it.each([
    'GOLD_LOSS_UNAVOIDABLE',
    'PAYMENT_NON_SUBSTITUTABLE',
    'INN_PAYMENT_FORBIDDEN',
    'GOLD_LOSS_UNMITIGABLE',
  ])('preserves the explicit source exclusion %s', (flag) => {
    expect(spec.legality.trigger.excludeIfAny).toContain(flag);
    expect(spec.legality.respectSourceSpecificPaymentRules).toBe(true);
  });
  it('keeps Gog semantics as a project override while exact wording remains unavailable', () => {
    expect(spec.verification.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
    expect(spec.verification.characterVerification.gog).toMatchObject({
      exactCardText: 'UNAVAILABLE',
      normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
      officialSourceVerified: false,
    });
  });
  it('records all four original identities, declared types and hashes without attributing an original record to Gog', () => {
    const ledger = JSON.parse(
      readFileSync(
        'content-private/imports/rdi2/verification-ledger.json',
        'utf8',
      ),
    ) as {
      characterMechanics: {
        ledgerId: string;
        review: {
          evidence: {
            id: string;
            character?: string;
            canonicalTitle?: string;
            declaredCardType?: string;
            sourceFileSha256?: string;
            recordCanonicalSha256?: string;
          }[];
        };
      }[];
    };
    const crosscheck = JSON.parse(
      readFileSync('reference/rdi2/the-inn-crosscheck.json', 'utf8'),
    ) as {
      characters: Record<string, { sha256: string }>;
    };
    const records = ledger.characterMechanics
      .find((m) => m.ledgerId === 'M09')!
      .review.evidence.filter((e) => e.id.startsWith('original-m09-'));
    expect(records).toHaveLength(4);
    expect(records.map((r) => r.canonicalTitle)).toEqual([
      'Dwarves always have money.',
      'Lemme check the money belt...',
      'Appreciative listeners! How nice!',
      'I got this from playing in the Town Square.',
    ]);
    for (const record of records) {
      expect(['dimli', 'fleck']).toContain(record.character);
      expect(record.declaredCardType).toBe('Sometimes');
      expect(record.sourceFileSha256).toBe(
        crosscheck.characters[record.character!]!.sha256,
      );
      expect(record.recordCanonicalSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
