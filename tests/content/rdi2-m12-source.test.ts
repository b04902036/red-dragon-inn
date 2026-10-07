import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  m12AnteEffects,
  m12AnteTrigger,
  m12DualEffects,
  m12DualTrigger,
} from '../fixtures/rdi2-m12-project';

const source = JSON.parse(
  readFileSync('content-private/imports/rdi2/source-candidate.json', 'utf8'),
) as {
  sources: Record<
    string,
    {
      kind: string;
      path: string;
      sha256: string;
      label: string;
      officialSourceVerified: boolean;
    }
  >;
  mechanics: {
    id: string;
    legality: Record<string, unknown>;
    effects: unknown[];
    verification: { status: string };
    projectRulesetOverrides: {
      sourceId: string;
      label: string;
      officialSourceVerified: boolean;
      templates: Record<
        'A' | 'B',
        {
          mechanicId: string;
          quantity: number;
          effects: unknown[];
          responseTrigger: unknown;
        }
      >;
    };
  }[];
};
const m = source.mechanics.find((m) => m.id === 'avoid_ante_leave')!;

describe('M12 accepted source is the behavior tested by synthetic engine fixtures', () => {
  it('Template A retains the actual self ante and participation trigger without an initial-only filter', () => {
    expect(m.projectRulesetOverrides.templates.A.responseTrigger).toEqual(
      m12AnteTrigger,
    );
    expect(m.projectRulesetOverrides.templates.A.effects).toEqual(
      m12AnteEffects,
    );
    expect(m.effects).toEqual(m12AnteEffects);
    expect(m.legality).toMatchObject({
      trigger: {
        systemEvent: 'ANTE_REQUIRED',
        actor: 'SELF',
        pending: true,
        selfStillParticipating: true,
        anteOrigin: 'ANY_ACTUAL_ANTE',
      },
    });
  });
  it('Template B retains mutually exclusive ante/whole-Drink contexts and shared effects', () => {
    expect(m.projectRulesetOverrides.templates.B.responseTrigger).toEqual(
      m12DualTrigger,
    );
    expect(m.projectRulesetOverrides.templates.B.effects).toEqual(
      m12DualEffects,
    );
    expect(m.projectRulesetOverrides.templates.B.mechanicId).toBe(
      'avoid_ante_leave_or_ignore_drink',
    );
    expect(m.projectRulesetOverrides.templates.A.quantity).toBe(2);
    expect(m.projectRulesetOverrides.templates.B.quantity).toBe(1);
  });
  it('preserves the independently hashed M12 user instruction and never claims publisher wording', () => {
    expect(m.verification.status).toBe('VERIFIED_FOR_PROJECT_RULESET');
    expect(m.projectRulesetOverrides.label).toBe('M12 USER OVERRIDE');
    expect(m.projectRulesetOverrides.officialSourceVerified).toBe(false);
    const evidence = source.sources[m.projectRulesetOverrides.sourceId]!;
    expect(evidence.kind).toBe('PROJECT_RULE_OVERRIDE');
    expect(evidence.label).toBe('M12 USER OVERRIDE');
    expect(evidence.officialSourceVerified).toBe(false);
    expect(
      createHash('sha256').update(readFileSync(evidence.path)).digest('hex'),
    ).toBe(evidence.sha256);
    expect(m.projectRulesetOverrides.sourceId).not.toContain('m09');
  });
});
