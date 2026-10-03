import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  rdi1SourceSchema,
  verifyRdi1Source,
} from '../../src/content/rdi1-source';
import {
  parseRdi1Matrix,
  validateRdi1Matrix,
} from '../../src/content/rdi1-matrix';
import {
  renderRdi1EngineGap,
  rdi1LegalityFixturesSchema,
  verifyRdi1LegalityFixtures,
  verifyRdi1SourceLock,
} from '../../src/content/rdi1-audit';
import { RDI1_ENGINE_CAPABILITIES } from '../../src/content/rdi1-capabilities';
import {
  rdi1SourceFixture,
  rdi1MatrixFixture,
  rdi1CardMatrixFixture,
  fixtureCapabilities,
  legalityFixture,
} from '../fixtures/rdi1-source';
import type { Rdi1Source } from '../../src/content/rdi1-source';
const verify = (s: unknown, capabilities: unknown = fixtureCapabilities) =>
  verifyRdi1Source(s, capabilities);
describe('RDI1 normalized source validation', () => {
  it('rejects prototype names as undeclared engine requirements and missing evidence', () => {
    const source = rdi1SourceFixture();
    source.mechanics[1]!.engineRequirements = ['constructor'];
    expect(
      verify(source, { requiredCapabilities: ['constructor'] }),
    ).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Unknown engine requirement constructor',
      ]),
    });
    const missingEvidence = rdi1SourceFixture();
    missingEvidence.mechanics[0]!.verification.basis = ['constructor'];
    expect(verify(missingEvidence)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Missing evidence reference constructor',
      ]),
    });
  });
  it('proves physical counts without importing data and keeps zero-valued Water a valid explicit numeric Drink', () => {
    const source = rdi1SourceFixture(),
      before = JSON.stringify(source);
    expect(verify(source)).toMatchObject({
      valid: true,
      errors: [],
      counts: {
        characters: { deirdre: 40, fiona: 40, gerki: 40, zot: 40 },
        characterPhysical: 160,
        drinkPhysical: 30,
        mechanics: 2,
        characterRecords: 8,
        drinkRecords: 1,
        sometimes: 1,
      },
    });
    expect(JSON.stringify(source)).toBe(before);
  });
  it.each([
    [
      'wrong deck total',
      (s: Rdi1Source) => {
        s.characters[0]!.cards[0]!.quantity--;
      },
      'physical deck',
    ],
    [
      'wrong declared deck total',
      (s: Rdi1Source) => {
        s.characters[1]!.primaryDeckPhysicalCount = 39;
      },
      'physical deck',
    ],
    [
      'wrong verification total',
      (s: Rdi1Source) => {
        s.verification.deckTotals.gerki = 39;
      },
      'physical deck',
    ],
    [
      'wrong expected total',
      (s: Rdi1Source) => {
        s.verification.expected.zot = 39;
      },
      'physical deck',
    ],
    [
      'missing character',
      (s: Rdi1Source) => {
        s.characters.pop();
      },
      '160',
    ],
    [
      'wrong physical Drink total',
      (s: Rdi1Source) => {
        s.drinkDeck.cards[0]!.quantity--;
      },
      'Drink physical',
    ],
    [
      'wrong declared Drink total',
      (s: Rdi1Source) => {
        s.product.drinkPhysicalCards = 29;
      },
      'Drink physical',
    ],
    [
      'wrong product total',
      (s: Rdi1Source) => {
        s.product.characterPhysicalCards = 159;
      },
      '160',
    ],
    [
      'missing mechanic',
      (s: Rdi1Source) => {
        s.characters[0]!.cards[0]!.mechanicId = 'missing_mechanic';
      },
      'Missing mechanic',
    ],
    [
      'duplicate mechanic',
      (s: Rdi1Source) => {
        s.mechanics.push(structuredClone(s.mechanics[0]!));
      },
      'Duplicate mechanic',
    ],
    [
      'duplicate card',
      (s: Rdi1Source) => {
        s.characters[0]!.cards[1]!.cardKey = s.characters[0]!.cards[0]!.cardKey;
      },
      'Duplicate card',
    ],
    [
      'duplicate Drink',
      (s: Rdi1Source) => {
        s.drinkDeck.cards.push(structuredClone(s.drinkDeck.cards[0]!));
      },
      'Duplicate Drink',
    ],
    [
      'duplicate character',
      (s: Rdi1Source) => {
        s.characters[3] = structuredClone(s.characters[0]!);
      },
      'Duplicate character',
    ],
    [
      'wrong card owner',
      (s: Rdi1Source) => {
        s.characters[0]!.cards[0]!.cardKey = 'fiona.audit_other';
      },
      'Wrong owner',
    ],
    [
      'wrong card type',
      (s: Rdi1Source) => {
        s.characters[0]!.cards[0]!.type = 'ANYTIME';
      },
      'Type mismatch',
    ],
    [
      'unreferenced mechanic',
      (s: Rdi1Source) => {
        s.mechanics.push({
          ...structuredClone(s.mechanics[0]!),
          id: 'audit_unreferenced',
        });
      },
      'Unreferenced mechanic',
    ],
    [
      'missing source evidence',
      (s: Rdi1Source) => {
        s.mechanics[0]!.verification.basis = ['missing'];
      },
      'Missing evidence',
    ],
    [
      'unknown requirement',
      (s: Rdi1Source) => {
        s.mechanics[0]!.engineRequirements = ['engine.unknown-capability'];
      },
      'Unknown engine requirement',
    ],
    [
      'undeclared requirement',
      (s: Rdi1Source) => {
        s.mechanics[0]!.engineRequirements = ['drink.pass'];
      },
      'Undeclared engine requirement',
    ],
    [
      'forbidden marker',
      (s: Rdi1Source) => {
        s.mechanics[0]!.notes = ['TODO'];
      },
      'Forbidden',
    ],
  ] as const)('rejects %s', (_name, mutate, message) => {
    const source = rdi1SourceFixture();
    mutate(source);
    expect(verify(source)).toMatchObject({ valid: false });
    expect(verify(source).errors.join(' ')).toContain(message);
  });
  it.each(['en-US', 'zh-TW'] as const)(
    'rejects a missing %s mechanic translation',
    (locale) => {
      const source = rdi1SourceFixture();
      delete (
        source.mechanics[0]!.display as Partial<
          (typeof source.mechanics)[0]['display']
        >
      )[locale];
      expect(verify(source).valid).toBe(false);
    },
  );
  it('rejects Sometimes without a trigger, empty trigger, blanket Anytime model and missing effect plan', () => {
    const source = rdi1SourceFixture();
    for (const legality of [
      undefined,
      { mode: 'RESPONSE', trigger: {} },
      { mode: 'ANYTIME' },
      { mode: 'SYSTEM_RESPONSE', trigger: { event: 'CARD' } },
      { mode: 'RESPONSE', trigger: { systemEvent: 'ANTE_REQUIRED' } },
    ])
      expect(
        verify({
          ...source,
          mechanics: [
            source.mechanics[0],
            { ...source.mechanics[1], legality },
          ],
        }).valid,
      ).toBe(false);
    expect(
      verify({
        ...source,
        mechanics: [
          { ...source.mechanics[0], effects: [] },
          source.mechanics[1],
        ],
      }).valid,
    ).toBe(false);
  });
  it.each(['UNKNOWN', 'TODO', 'NO_OP', 'EXECUTE_JAVASCRIPT'])(
    'rejects an unregistered %s effect plan',
    (op) => {
      const source = rdi1SourceFixture();
      expect(
        verify({
          ...source,
          mechanics: [
            { ...source.mechanics[0], effects: [{ op }] },
            source.mechanics[1],
          ],
        }).valid,
      ).toBe(false);
    },
  );
  it('rejects invalid, duplicate, unknown and unused capability declarations', () => {
    const source = rdi1SourceFixture();
    expect(verify(source, {}).valid).toBe(false);
    expect(
      verify(source, { requiredCapabilities: ['drink.ignore', 'drink.ignore'] })
        .errors,
    ).toContain('Duplicate capability key');
    expect(
      verify(source, { requiredCapabilities: ['engine.missing'] }).errors.join(
        ' ',
      ),
    ).toContain('Unknown engine requirement');
    expect(
      verify(source, { requiredCapabilities: ['drink.ignore', 'drink.pass'] })
        .errors,
    ).toContain('Unused required capability drink.pass');
    expect(verify(null).source).toBeNull();
  });
  it('requires explicit Event effects, accepts system/phase/multi-trigger models and rejects contradictory event facts', () => {
    const source = rdi1SourceFixture();
    const event = {
      ...source.drinkDeck.cards[0],
      type: 'DRINK_EVENT',
      effectPlan: [{ op: 'DRINKING_CONTEST' }],
      engineRequirements: [],
    };
    expect(
      verify({ ...source, drinkDeck: { ...source.drinkDeck, cards: [event] } })
        .valid,
    ).toBe(true);
    expect(
      verify({
        ...source,
        drinkDeck: {
          ...source.drinkDeck,
          cards: [{ ...event, effectPlan: undefined }],
        },
      }).valid,
    ).toBe(false);
    for (const legality of [
      {
        mode: 'SYSTEM_RESPONSE',
        trigger: {
          systemEvent: ['ANTE_REQUIRED', 'PAYMENT_REQUIRED'],
          actor: 'SELF',
        },
      },
      { mode: 'PHASE_OPPORTUNITY', phase: 'ORDER_DRINK', actor: 'SELF' },
      {
        mode: 'GAMBLING_CHECKPOINT',
        requires: { gamblingActive: true, potMin: 1 },
      },
      {
        mode: 'MULTI_TRIGGER',
        triggers: [
          { event: 'DRINK', affects: 'SELF' },
          { systemEvent: 'ANTE_REQUIRED', actor: 'SELF' },
        ],
      },
    ])
      expect(
        verify({
          ...source,
          mechanics: [
            source.mechanics[0],
            { ...source.mechanics[1], legality },
          ],
        }).valid,
      ).toBe(true);
    expect(
      verify({
        ...source,
        mechanics: [
          source.mechanics[0],
          {
            ...source.mechanics[1],
            legality: {
              mode: 'RESPONSE',
              trigger: { event: 'DRINK', systemEvent: 'ANTE_REQUIRED' },
            },
          },
        ],
      }).valid,
    ).toBe(false);
  });
});
describe('independent matrices and immutable source revision', () => {
  it('compares all mechanic quantities and bilingual metadata against both supplied matrices', () => {
    expect(
      validateRdi1Matrix(
        rdi1SourceFixture(),
        rdi1MatrixFixture(),
        rdi1CardMatrixFixture(),
      ),
    ).toEqual([]);
  });
  it('reads quoted commas, newlines, doubled quotes, BOM and CRLF without corrupting translations', () => {
    const s = rdi1SourceFixture();
    s.mechanics[0]!.rulesSummary['en-US'] = 'first, "quoted"\nsecond';
    const csv = '\uFEFF' + rdi1MatrixFixture(s).replaceAll('\n', '\r\n');
    expect(parseRdi1Matrix(csv)[0]!.summary_en).toBe(
      s.mechanics[0]!.rulesSummary['en-US'],
    );
    expect(validateRdi1Matrix(s, csv, rdi1CardMatrixFixture(s))).toEqual([]);
  });
  it.each([
    'wrong,header\n',
    'mechanic_id,type,en-US,zh-TW,deirdre,fiona,gerki,zot,summary_en,summary_zh\n',
    rdi1MatrixFixture() + '\n"unclosed',
    rdi1MatrixFixture() + '\n"x"bad,y',
    rdi1MatrixFixture() + '\nx"bad,y',
    rdi1MatrixFixture() + '\nx\ry',
  ])('rejects malformed CSV', (csv) => {
    expect(() => parseRdi1Matrix(csv)).toThrow();
    expect(validateRdi1Matrix(rdi1SourceFixture(), csv, '')).not.toEqual([]);
  });
  it('rejects duplicate, unknown and missing matrix rows, wrong quantities, metadata and Markdown', () => {
    const source = rdi1SourceFixture(),
      csv = rdi1MatrixFixture(),
      md = rdi1CardMatrixFixture();
    expect(
      validateRdi1Matrix(source, csv + '\n' + csv.split('\n')[1], md).join(' '),
    ).toContain('Duplicate matrix');
    expect(
      validateRdi1Matrix(
        source,
        csv.replace('audit_damage', 'audit_other'),
        md,
      ).join(' '),
    ).toContain('Unknown matrix');
    expect(
      validateRdi1Matrix(
        source,
        csv.split('\n').slice(0, 2).join('\n'),
        md,
      ).join(' '),
    ).toContain('Missing matrix');
    expect(
      validateRdi1Matrix(source, csv.replace('"20"', '"nonsense"'), md).join(
        ' ',
      ),
    ).toContain('quantity mismatch');
    expect(
      validateRdi1Matrix(
        source,
        csv.replace('原創稽核測試', '不同文字'),
        md,
      ).join(' '),
    ).toContain('metadata mismatch');
    expect(
      validateRdi1Matrix(source, csv, md.replace('20', '19')).join(' '),
    ).toContain('Card matrix mismatch');
    expect(validateRdi1Matrix(source, csv, '').join(' ')).toContain(
      'row count',
    );
  });
  it('requires identical reviewed hashes and rejects invalid or changed lock inputs', () => {
    const hashes = { source: 'a'.repeat(64), evidence: 'b'.repeat(64) },
      lock = { schemaVersion: 1, engineBaseline: 'step-20', sha256: hashes };
    expect(
      verifyRdi1SourceLock(lock, {
        evidence: hashes.evidence,
        source: hashes.source,
      }),
    ).toEqual([]);
    expect(verifyRdi1SourceLock({}, hashes)).not.toEqual([]);
    expect(
      verifyRdi1SourceLock(lock, { ...hashes, source: 'c'.repeat(64) }).join(
        ' ',
      ),
    ).toContain('differ');
    expect(
      verifyRdi1SourceLock(lock, { source: hashes.source }).join(' '),
    ).toContain('differ');
  });
});
describe('Sometimes audit specifications and engine-gap output', () => {
  it('requires a distinct positive/negative specification for every Sometimes mechanic', () => {
    const source = rdi1SourceFixture();
    expect(verifyRdi1LegalityFixtures(source, legalityFixture)).toEqual([]);
    expect(verifyRdi1LegalityFixtures(source, {}).join(' ')).toContain(
      'schema',
    );
    expect(
      verifyRdi1LegalityFixtures(source, [
        legalityFixture[0],
        legalityFixture[0],
      ]).join(' '),
    ).toContain('Duplicate');
    expect(
      verifyRdi1LegalityFixtures(source, [
        { ...legalityFixture[0], mechanicId: 'audit_unknown' },
      ]).join(' '),
    ).toContain('Missing legality');
    expect(
      verifyRdi1LegalityFixtures(source, [
        { ...legalityFixture[0], mechanicId: 'audit_unknown' },
      ]).join(' '),
    ).toContain('Unknown Sometimes');
    const invalid = structuredClone(legalityFixture);
    invalid[0]!.negative.context = invalid[0]!.positive.context;
    expect(verifyRdi1LegalityFixtures(source, invalid).join(' ')).toContain(
      'Invalid positive/negative',
    );
  });
  it('includes all supplied 23 Sometimes pairs and the 35 reviewed required capabilities', () => {
    const rows = rdi1LegalityFixturesSchema.parse(
      JSON.parse(
        readFileSync('reference/rdi1/sometimes-legality-fixtures.json', 'utf8'),
      ) as unknown,
    );
    const matrix = parseRdi1Matrix(
      readFileSync('reference/rdi1/rdi1-mechanics-matrix.csv', 'utf8'),
    );
    expect(rows.map((r) => r.mechanicId).sort()).toEqual(
      matrix
        .filter((r) => r.type === 'SOMETIMES')
        .map((r) => r.mechanic_id)
        .sort(),
    );
    expect(rows).toHaveLength(23);
    for (const row of rows) {
      expect(row.positive.expectedLegalPlays).toHaveLength(1);
      expect(row.negative.expectedLegalPlays).toEqual([]);
      expect(row.positive.context).not.toEqual(row.negative.context);
    }
    const capabilities = JSON.parse(
      readFileSync('reference/rdi1/required-engine-capabilities.json', 'utf8'),
    ) as { requiredCapabilities: string[] };
    expect(capabilities.requiredCapabilities.sort()).toEqual(
      Object.keys(RDI1_ENGINE_CAPABILITIES).sort(),
    );
  });
  it('generates a deterministic complete gap report without exposing private display text or claiming execution support', () => {
    const source = rdi1SourceFixture(),
      caps = Object.keys(RDI1_ENGINE_CAPABILITIES),
      hashes = { source: 'a'.repeat(64) };
    const first = renderRdi1EngineGap(source, caps, legalityFixture, hashes);
    expect(first).toBe(
      renderRdi1EngineGap(source, [...caps].reverse(), legalityFixture, hashes),
    );
    for (const [id, [status]] of Object.entries(RDI1_ENGINE_CAPABILITIES)) {
      expect(first).toContain(`\`${id}\` | ${status}`);
    }
    expect(first).toContain('positive:');
    expect(first).toContain('negative:');
    expect(first).toContain('Anytime during gambling');
    expect(first).toContain('Gold transfer direction');
    expect(first).not.toContain(source.mechanics[0]!.rulesSummary['en-US']);
    expect(first).not.toContain('READY_FOR_RELEASE');
    expect(rdi1SourceSchema.parse(source)).toEqual(source);
  });
});
