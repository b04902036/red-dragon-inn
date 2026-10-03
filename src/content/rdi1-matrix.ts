import type { Rdi1Source } from './rdi1-source';

/** Small RFC-style CSV reader: quoted commas/newlines and doubled quotes are data. */
export function parseRdi1Matrix(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
  };
  const input = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === ',' || c === '\n') {
      if (c === ',') finishCell();
      else finishRow();
    } else if (c === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || c === '"' || c === '\r')
        throw new Error('Malformed CSV quoting/line ending');
      cell += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (cell !== '' || closed || row.length) finishRow();
  const headers = [
    'mechanic_id',
    'type',
    'en-US',
    'zh-TW',
    'deirdre',
    'fiona',
    'gerki',
    'zot',
    'summary_en',
    'summary_zh',
  ];
  if (JSON.stringify(rows.shift()) !== JSON.stringify(headers))
    throw new Error('Invalid mechanics matrix header');
  if (
    !rows.length ||
    rows.length > 256 ||
    rows.some((r) => r.length !== headers.length)
  )
    throw new Error('Invalid mechanics matrix row count/width');
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]!])));
}
export function validateRdi1Matrix(
  source: Rdi1Source,
  csv: string,
  markdown: string,
) {
  const errors: string[] = [];
  let rows: ReturnType<typeof parseRdi1Matrix>;
  try {
    rows = parseRdi1Matrix(csv);
  } catch (error) {
    return [(error as Error).message];
  }
  if (new Set(rows.map((r) => r.mechanic_id)).size !== rows.length)
    errors.push('Duplicate matrix mechanic key');
  const byId = new Map(source.mechanics.map((m) => [m.id, m]));
  for (const row of rows) {
    const m = byId.get(row.mechanic_id!);
    if (!m) {
      errors.push(`Unknown matrix mechanic ${row.mechanic_id}`);
      continue;
    }
    if (
      row.type !== m.type ||
      row['en-US'] !== m.display['en-US'] ||
      row['zh-TW'] !== m.display['zh-TW'] ||
      row.summary_en !== m.rulesSummary['en-US'] ||
      row.summary_zh !== m.rulesSummary['zh-TW']
    )
      errors.push(`Matrix metadata mismatch ${m.id}`);
    for (const character of source.characters) {
      const quantity = row[character.id]!;
      const actual = character.cards
        .filter((c) => c.mechanicId === m.id)
        .reduce((sum, c) => sum + c.quantity, 0);
      if (!/^\d+$/.test(quantity) || Number(quantity) !== actual)
        errors.push(`Matrix quantity mismatch ${character.id}/${m.id}`);
    }
  }
  for (const m of source.mechanics)
    if (!rows.some((r) => r.mechanic_id === m.id))
      errors.push(`Missing matrix mechanic ${m.id}`);
  const humanRows = markdown
    .split(/\r?\n/)
    .filter((line) => /^\|/.test(line))
    .map((line) =>
      line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim()),
    )
    .filter(
      (cells) =>
        cells.length === 6 &&
        ['ACTION', 'SOMETIMES', 'ANYTIME', 'GAMBLING', 'CHEATING'].includes(
          cells[1]!,
        ),
    );
  if (humanRows.length !== rows.length)
    errors.push('Card matrix row count mismatch');
  for (const [i, row] of rows.entries()) {
    const human = humanRows[i];
    if (
      !human ||
      human[0] !== `${row['en-US']} / ${row['zh-TW']}` ||
      human[1] !== row.type ||
      human
        .slice(2)
        .some(
          (v, seat) => v !== row[['deirdre', 'fiona', 'gerki', 'zot'][seat]!],
        )
    )
      errors.push(`Card matrix mismatch at row ${i + 1}`);
  }
  return errors;
}
