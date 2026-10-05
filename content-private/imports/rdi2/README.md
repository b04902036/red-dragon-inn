# RDI2 private import workspace

This directory is intentionally private/gitignored.

Initial package files:
- `source-candidate.json` — candidate mechanics reconstructed and cross-checked, NOT source-locked
- `verification-ledger.json` — every mechanic/Drink must be checked individually

Step 24A must create only after every ledger entry is verified:
- `source-normalized.json`
- `source-lock.json`

Step 24C later creates:
- `pack.json`
- `compile-report.json`

Do not publish/import `source-candidate.json` directly.
