# RDI2 START HERE

This ZIP is already arranged to match your repository root.

## Install

Extract the ZIP **directly into the current repo root**.

After extraction you should have:

```text
content-private/imports/rdi2/
reference/rdi2/
codex-prompts/step-24a-rdi2-source-lock.md
codex-prompts/step-24b-rdi2-engine-capabilities.md
codex-prompts/step-24c-rdi2-compile-publish.md
codex-prompts/step-24d-rdi1-rdi2-full-verification.md
codex-prompts/step-25-rdi1-rdi2-release-audit.md
```

Do not put the ZIP inside another project subfolder.

## Execution order

```text
24A -> 24B -> 24C -> 24D -> 25
```

Never skip 24A.

## Why 24A is strict

The user requires no guessing.

The supplied candidate has already been cross-checked, but it is intentionally **not source-locked**.
Step 24A must verify every mechanic and every Drink independently.

There is one known hard conflict in the evidence: Fine Ambrosia's classification.
Step 24A MUST resolve it using primary/current evidence before producing `source-normalized.json`.
If it cannot, it must stop and ask for a current card image/scan.

## Codex invocation for Step 24A

```text
Read AGENTS.md and codex-prompts/step-24a-rdi2-source-lock.md.

The repository has completed the RDI1 Step 22 release milestone.

Implement ONLY Step 24A.
Do not start Step 24B.

The user requires zero guessing.
Verify every RDI2 mechanic row and Drink record one by one.
If any item cannot be verified, stop and report it rather than inferring an answer.

Run all required tests and review git diff before stopping.
```

## Private directory

Keep:

```text
content-private/
```

gitignored, just like RDI1.

The `reference/rdi2/` and `codex-prompts/` files may be committed.
