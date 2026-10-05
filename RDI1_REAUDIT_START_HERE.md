# RDI1 Fresh Re-Audit Package — START HERE

Extract this ZIP directly into the repository root.

It does NOT overwrite `content-private/imports/rdi1/source-normalized.json`.

Files are intentionally additive:

```text
reference/rdi1/reaudit-2026-10-05/
content-private/imports/rdi1/reaudit-required-corrections.json
codex-prompts/step-rdi1-fresh-reaudit-fix.md
```

Review `reference/rdi1/reaudit-2026-10-05/RDI1_REAUDIT_REPORT.md` first.

Then give Codex:

```text
Read AGENTS.md and codex-prompts/step-rdi1-fresh-reaudit-fix.md.

Perform ONLY the RDI1 fresh re-audit correction step.
Do not begin RDI2.

Reproduce the audit checks before editing.
Apply only externally verified corrections.
Do not guess.
Do not overwrite content_rdi1_mechanics_v1.
Create a new immutable corrected version only after all per-item checks pass.
```
