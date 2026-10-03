# Codex execution guide

## Where these files go

Copy this whole structure into the repository root:

```text
<repo-root>/
  AGENTS.md
  codex-prompts/
    README.md
    step-00-bootstrap.md
    step-01-architecture-contracts.md
    step-02-content-and-d1.md
    step-03-core-turn-engine.md
    step-04-resolution-stack.md
    step-05-gambling.md
    step-06-drinks-and-elimination.md
    step-07-durable-object-realtime.md
    step-08-game-ui.md
    step-09-persistence-reconnect-replay.md
    step-10-private-content-import.md
    step-11-security-and-deploy.md
    step-12-final-audit.md
```

`AGENTS.md` is always active global policy for Codex. The `step-XX` files are executed one at a time.

## How to use with Codex

For a fresh repository, start Codex at the repository root and give it:

```text
Read AGENTS.md and codex-prompts/step-00-bootstrap.md.
Implement ONLY that step.
Do not start the next step.
Run every required verification/test in the prompt.
At the end, review git diff and report whether all acceptance criteria passed.
```

After reviewing the result, move to the next file:

```text
Read AGENTS.md and codex-prompts/step-01-architecture-contracts.md.
Implement ONLY that step.
Do not start the next step.
Run every required verification/test in the prompt.
At the end, review git diff and report whether all acceptance criteria passed.
```

Repeat in numerical order.

## If Codex is resuming an existing implementation

Use:

```text
Read AGENTS.md and the current step prompt.
First inspect the repository and existing tests.
Do not rewrite working architecture unnecessarily.
Implement only the missing requirements from this step.
Run all required verification and regression tests.
```

## Gate rule

Never proceed merely because Codex says "done."

A step passes only if:
- acceptance criteria are satisfied,
- required tests were added,
- existing tests still pass,
- typecheck/lint/build pass,
- applicable E2E/runtime tests pass,
- git diff has been reviewed.

If a step fails, give Codex the same step again together with its failing test output.

## Content note

The repository must be able to run entirely with sample/test data.
Real card text/art should be loaded from a private, user-owned/licensed content package and must not be required for CI.
