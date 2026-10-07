# RDI2 private import workspace

This directory is intentionally private/gitignored.

Step 24A is COMPLETE for the explicitly verified project ruleset:

- `source-candidate.json` — reviewed working input; do not import directly.
- `verification-ledger.json` — all 44 mechanic and 23 Drink reviews qualify, preserving publisher/original/matrix/user evidence separately.
- `source-normalized.json` — immutable source artifact; each character totals 40 and the Drink Deck totals 30.
- `source-lock.json` — actual SHA-256 hashes of normalized source, ledger and matrix; unresolvedCount 0.
- `final-row-reaudit.json` — independent final per-row audit receipt.

Run `npm run content:verify:rdi2-source` to verify the existing lock.
`--check-lock` checks eligibility before creation; `--lock` refuses existing
artifacts and writes only after every source gate passes.

Team mode and real test M21/J remain non-blocking TODO work for all steps under
the explicit user decision. No team implementation or passing team test is claimed.
See `docs/rdi2-source-verification-report.md` for exact results and evidence.

These private files must be transferred separately when moving the workspace.
They remain on disk; Git intentionally excludes this directory.

Step 24C later creates:
- `pack.json`
- `compile-report.json`

Do not publish/import `source-candidate.json` directly.
