import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { m12DualEffects } from '../fixtures/rdi2-m12-project';

const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
);
const ledger = JSON.parse(
  readFileSync('content-private/imports/rdi2/verification-ledger.json', 'utf8'),
);
const mechanic = source.mechanics[12];
const entry = ledger.characterMechanics[12];
const titles = {
  dimli: "Can't you see I'm talking to this pretty, bearded lass here?",
  eve: 'I cloak myself in shadow.',
  fleck: "Leave me be! I'm trying to read lore here!",
};

describe('M13 individually checked evidence and shared effects', () => {
  it.each(Object.entries(titles))(
    'retains the separately identified and hashed %s original record',
    (id, title) => {
      const evidence = entry.review.evidence.find(
        (e: { id: string }) => e.id === 'original-m13-' + id,
      );
      expect(evidence.canonicalTitle).toBe(title);
      expect(evidence.canonicalRecordSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(evidence.sourceFileSha256).toBe(
        source.sources[evidence.sourceId].sha256,
      );
      expect(entry.characterVerification[id]).toEqual({
        quantity: 'VERIFIED',
        exactSourceRecords: 'VERIFIED_ORIGINAL_JSON',
        semantics: 'VERIFIED',
      });
      const character = source.characters.find(
        (c: { id: string }) => c.id === id,
      );
      const card = character.cards.find(
        (c: { mechanicId: string }) => c.mechanicId === mechanic.id,
      );
      expect(card).toMatchObject({
        quantity: 1,
        type: 'SOMETIMES',
        canonicalCardTitle: title,
        rulesSummary: mechanic.rulesSummary,
      });
    },
  );
  it('binds Gog only to the already authorized M12 Template B and preserves unresolved original wording', () => {
    expect(mechanic.projectRulesetOverrides).toMatchObject({
      sourceId: 'project_m12_gog_override_2026_10_05',
      label: 'M12 USER OVERRIDE',
      appliesTo: 'GOG_M13_ONE_CARD',
      template: 'B',
      officialSourceVerified: false,
    });
    expect(entry.characterVerification.gog).toMatchObject({
      exactCardText: 'UNAVAILABLE',
      normalizedSemantics: 'PROJECT_RULE_OVERRIDE',
      officialSourceVerified: false,
    });
    const origin = source.sources[mechanic.projectRulesetOverrides.sourceId];
    expect(
      createHash('sha256').update(readFileSync(origin.path)).digest('hex'),
    ).toBe(origin.sha256);
    expect(entry.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
  });
  it('uses the same context-exclusive shared plan tested for initial/later ante and whole-Drink Ignore', () => {
    expect(mechanic.effects).toEqual(m12DualEffects);
    expect(mechanic.legality).toEqual(
      source.mechanics[11].projectRulesetOverrides.templates.B.legality,
    );
    expect(entry.review.effects).toEqual(mechanic.effects);
    expect(entry.review.checks).toHaveLength(7);
    expect(
      entry.review.checks.every((c: { result: string }) => c.result === 'PASS'),
    ).toBe(true);
    expect(entry.counts).toEqual({ dimli: 1, eve: 1, fleck: 1, gog: 1 });
  });
});
