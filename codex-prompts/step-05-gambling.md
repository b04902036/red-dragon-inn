# Step 05 — Gambling sub-engine

## Goal

Implement the RDI-style gambling flow as a sub-state that suspends the normal turn.

Use configuration/content definitions rather than card-name hardcoding.

## Gambling state

Model:
- active/inactive
- initiating player
- participating players
- current priority player
- controller of the round
- pot
- ante amount
- players who passed/left
- control source/history if useful
- suspended normal turn continuation

## Commands/behaviors

Support:
- starting gambling from an allowed effect
- each participating player anteing
- clockwise priority
- Gambling card takes control
- Cheating card takes control
- pass
- leave round if applicable by rule/effect
- winning when everyone except controller has passed
- immediate-win effect hook
- payout to winner
- resume suspended normal turn

Build Winning-Hand-like restrictions generically through effect/timing metadata rather than checking literal copyrighted card names.

## Gold handling

Centralize Gold mutations.
No negative Gold.

Elimination caused by Gold must not be checked at an incorrect timing point. Route it through the engine's elimination-check semantics.

## Tests — mandatory

At minimum:
1. correct participants ante
2. insufficient/zero Gold behavior follows configured engine rule
3. pot equals accepted antes
4. initiator begins with control where configured
5. clockwise priority
6. Gambling card transfers control
7. Cheating card transfers control
8. restricted control source can require a specific card category
9. passes advance correctly
10. all non-controller pass => controller wins
11. pot transfers exactly once
12. immediate win ends round
13. leaving round prevents future Gambling/Cheating play but preserves prior ante
14. reaction cards can still be allowed if timing rules permit
15. normal turn is suspended and resumes correctly
16. duplicate/stale commands cannot duplicate ante or payout
17. disconnect-safe serialization mid-gambling
18. public view shows pot/control/participation without exposing hands

Add deterministic replay test for a complete gambling round.

Run standard verification.

Stop after this step.
