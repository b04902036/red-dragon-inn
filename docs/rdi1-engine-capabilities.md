# Step 21B generic engine capabilities

The [Step-20 audit](rdi1-engine-gap.md) remains the locked baseline. This document records the generic implementation added in Step 21B. Source verification still checks the original input lock and classifications; it does not regenerate that audit as a current capability registry. No RDI1 decks are compiled, imported, or published by this step.

## Capability closure

All 31 `NEEDS_GENERIC_ENGINE_FEATURE` and both `SUPPORTED_WITH_SCHEMA_EXTENSION` entries are implemented through validated data, shared legality, and persisted continuations.

| Audit capability                       | Generic implementation                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| `drink.contest-score`                  | Score captured at reveal, independent of later modifiers, passes, splits, or Ignore |
| `drink.contest-tie-loop`               | Persisted contest participants, scores, rounds, and tied-highest continuation       |
| `drink.copy-for-all`                   | House source selected before independent per-player copies                          |
| `drink.force-one`                      | `FORCE_DRINK` with a separate Drink frame                                           |
| `drink.force-simultaneous`             | `FORCE_SIMULTANEOUS_DRINK`                                                          |
| `drink.ignore-with-cost`               | Full mandatory payment before Ignore; no free partial-cost effect                   |
| `drink.independent-copies`             | Separate effect arrays/windows, shared public provenance, one physical owner        |
| `drink.order-extra`                    | `ORDER_EXTRA_DRINKS` expands into independent target choices and deals              |
| `drink.pass`                           | `PASS_CURRENT_DRINK` preserves revealer/source and changes recipient                |
| `drink.queue-extra`                    | `QUEUE_EXTRA_DRINK` defers the next reveal until the current Drink finishes         |
| `drink.replace-alcohol-with-fortitude` | Live Alcohol total converted; later Alcohol modifiers follow conversion             |
| `drink.simultaneous-reveal`            | All source selection/reveal precedes the first per-player response                  |
| `drink.skip-events-for-source`         | House discards source-selection Events without executing them                       |
| `drink.split`                          | Combined Chaser effects halved with `Math.ceil`, then resolved independently        |
| `gambling.ante-all`                    | `ANTE_ALL_ACTIVE` creates individual interruptible obligations                      |
| `gambling.cancel-ante-and-leave`       | Cancel pending ante plus leave, including context branches                          |
| `gambling.end-to-inn`                  | `END_GAMBLING`, valid checkpoint restrictions, Inn settlement                       |
| `gambling.final-response-before-leave` | Ejection remains pending through its ordinary nested response window                |
| `gambling.force-leave`                 | `FORCE_LEAVE_GAMBLING`, chosen active opponent                                      |
| `gambling.replace-winner`              | `REPLACE_GAMBLING_WINNER` before escrow payout                                      |
| `gambling.take-from-pot`               | `TAKE_FROM_GAMBLING_POT`, with removed-pot ledger and unchanged control             |
| `gambling.win-from-response`           | Validated `WIN_GAMBLING` in a card-response child                                   |
| `gold.contest-payout`                  | Individual obligations from every other living player to the contest winner         |
| `gold.payment-substitution`            | Exactly one pending Gold substituted from Inn; committed Gold is never reclaimed    |
| `reaction.ante-context`                | `ANTE_REQUIRED` with payer, purpose, amount, and commitment state                   |
| `reaction.counter-family`              | Declared family and protected same-family counter policy                            |
| `reaction.gambling-checkpoint`         | Persisted checkpoint facts and authoritative response eligibility                   |
| `reaction.multi-trigger`               | Structured OR predicates and validated ante/Drink context branches                  |
| `reaction.payment-context`             | `PAYMENT_REQUIRED` before capped/full obligations commit                            |
| `reaction.phase-sometimes`             | Active Order Drink opportunities before and after normal ordering                   |
| `reaction.post-gambling-settlement`    | `GAMBLING_WIN_BEFORE_PAYOUT` before clearing escrow                                 |
| `reaction.post-stat-event`             | `FORTITUDE_LOSS_RESOLVED` only after positive actual loss                           |
| `reaction.source-capabilities`         | Declared/derived operation facts and generic capability predicates                  |

The two already-supported capabilities, `drink.ignore` and `gambling.start-or-control`, remain supported. Additional audited mismatches are addressed: Anytime during gambling, redirected damage retaining original source, Gold collection in the reverse direction, validated living self targets, mandatory costs, and generic character/Drink traits. Drink/Event distinctions remain enforced.

## Schemas and persistence

New DSL operations: `ANTE_ALL_ACTIVE`, `FORCE_LEAVE_GAMBLING`, `REPLACE_GAMBLING_WINNER`, `END_GAMBLING`, `TAKE_FROM_GAMBLING_POT`, `SUBSTITUTE_PAYMENT_FROM_INN`, `CANCEL_CURRENT_ANTE_FOR_SELF`, `COLLECT_GOLD`, `ORDER_EXTRA_DRINKS`, `DEAL_DRINKS`, `FORCE_DRINK`, `QUEUE_EXTRA_DRINK`, `PASS_CURRENT_DRINK`, `SPLIT_CURRENT_DRINK`, `REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE`, `REDIRECT_FORTITUDE_LOSS`, `FORCE_SIMULTANEOUS_DRINK`, `DRINKING_CONTEST`, `ROUND_ON_HOUSE`, and `CONTEXT_BRANCH`. `PAY_INN` adds optional full-payment enforcement. Targets add `SOURCE_ACTOR` and `ORIGINAL_SOURCE_PLAYER`; ordinary chosen targets remain other players unless explicitly extended by policy.

Card metadata adds `targetPolicy`, `phaseOpportunity`, `counterFamily`, `counterPolicy`, `capabilities`, and `mandatoryGoldCost`. Drink definitions add bounded `traitReplacements`; character rules and player state carry generic `traits`. Traits are data identifiers, including `ORC`/`TROLL`, with no character-name checks.

Trigger conditions add `SYSTEM_EVENT`, `PAYMENT_CONTEXT`, `ACTUAL_STAT_LOSS`, `ORIGINAL_SOURCE_PLAYER`, `SOURCE_CAPABILITY`, `COUNTER_FAMILY`, `PHASE_OPPORTUNITY`, and `GAMBLING_CHECKPOINT`. Context includes system facts, source capabilities and counter metadata; pending target/stat facts account for redirection, recipient changes, and collection direction.

Resolution frames add validated system tasks, pending obligations, deferred work, prepared Drink work, held physical source cards, virtual provenance, recipient/conversion flags, and original/response source identities. Control state stores deterministic work ordinals and normal-order/opportunity progress. Gambling adds `ANTE`, checkpoint/settlement progress, settlement reason, and removed-pot accounting. Pending antes reserve payout capacity. Arrays, IDs, integers, references, operation expansion, and stack depth remain bounded and validated.

Public projections add named opportunity types, Drink recipients, and already-revealed prepared Drinks. Virtual copies show public source references without duplicating physical ownership. Future queued Drinks remain hidden until reveal. Private `legalPlays` is the command authority, including `PLAY_CARD` for phase Sometimes; legacy `legalResponses` contains only `PLAY_RESPONSE` entries. New events are `WORKFLOW_CHANGED` and `DRINK_CONTEST_ROUND`; Event-discard context adds `SOURCE_SELECTION`. Pot event values permit zero after cancellation/removal.

The existing version-one JSON snapshots, append-only command/event history, D1 JSON columns, and Durable Object alarm policy store this data. No new SQL migration, binding, timer kind, client-authored state, or executable content is introduced. Older optional fields remain readable.

## Timing and verification

Only living holders of legal Sometimes receive system response opportunities. All six system/phase opportunities use the existing 30-second response prompt. Nested plays invalidate prompt identities, recompute legality and reset deadlines. Anytime retains the existing 15-second phase-end grace, normal phases, source responses, and legal gambling timing. Gambling control category restrictions remain independent of Anytime eligibility.

New scenario suites cover gambling, Drink operations, contest rounds, shared predicates, validation, and response lifecycles. Real Workers tests cover all six system opportunities with D1-pinned original fixtures, WebSockets, Durable Object hibernation, alarm timeout and verified replay. React tests check phase Sometimes command/prompt submission. Playwright checks visible Anytime play during a live gambling round and reconnect consistency. Existing probes now assert the capabilities implemented in this step; their audit artifact remains the Step-20 baseline.

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm run test:e2e`, and `npm run content:verify:rdi1-source`.

Runtime safety bounds remain explicit: 32 nested frames/effects, 64 pending tasks, eight prepared/deferred Drinks, 32-card Chaser/source chains and 256 contest rounds. Limits reject excessive work atomically; they do not choose an invented contest winner. Elimination continues at the established safe boundary after pending resolution, gambling and phase grace.

## Added test inventory

The following suites add 101 Vitest cases and one browser journey. Existing suites also retain regression assertions for shared legality, control categories, replay and source-audit expectations.

| New suite                                         | Cases | Behavior verified                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/engine/generic-opportunities.test.ts`      |     7 | Phase predicates and forged commands; ante/payment prompts and substitution; actual loss and redirected provenance; full Ignore; protected counter families; extra ordering before/after normal ordering                                                                                                  |
| `tests/engine/generic-gambling.test.ts`           |     6 | Anytime and control restrictions; anti-cheat before ejection; winner replacement; repeated antes; committed Gold; checkpoint end/take restrictions                                                                                                                                                        |
| `tests/engine/generic-drinks.test.ts`             |    12 | Mandatory cost and illegal timing; passing; combined Chaser splitting; conversion and later modifiers; hidden deferred Drink; forced Drink; simultaneous/House reveal barrier; trait replacement; capability counters                                                                                     |
| `tests/engine/generic-contest.test.ts`            |     2 | Tied-highest repeat, immutable reveal score, Ignore and collection; zero-score Events execute their own effects                                                                                                                                                                                           |
| `tests/engine/generic-validation.test.ts`         |    28 | Shared legalPlays/command rejection outside opportunities; bounded schemas; metadata dependencies; ID exhaustion; deferred/batch serialization and replay; multi-trigger branches; collection/self targets; invalid stored references                                                                     |
| `tests/engine/generic-reaction-facts.test.ts`     |    13 | All checkpoint prohibitions; source capability and family predicates; actual-loss thresholds and original source; phase predicates and excluded capabilities                                                                                                                                              |
| `tests/engine/generic-response-lifecycle.test.ts` |    18 | Ante, payment, checkpoint, settlement, post-loss, phase, Drink and redirected-damage cases: stale commands, nested counters, refreshed deadlines, timeout, JSON reconnect, deterministic replay and hidden projections                                                                                    |
| `tests/engine/generic-workflow-edges.test.ts`     |     8 | Trait initialization and additional copy effects; payout-capacity reservations; mandatory payment despite source Ignore; unaffordable nested cost; Inn-funded collection; canceled ante without refund; House Event skipping and independent modification; signed Chaser splitting and independent Ignore |
| `tests/worker/generic-opportunities.test.ts`      |     6 | Every new system opportunity inside Workers with D1, live WebSockets, 30-second alarm, hibernation/reconnect, hidden legality, timeout and persisted replay                                                                                                                                               |
| `tests/client/generic-opportunities.test.tsx`     |     1 | Visible phase opportunity and authoritative PLAY_CARD/prompt submission                                                                                                                                                                                                                                   |
| `tests/e2e/gambling-anytime.spec.ts`              |     1 | Two-player visible Anytime play during gambling and reconnect preserving pot/control                                                                                                                                                                                                                      |

## Changed file inventory

- Documentation: `docs/content-format.md`, `docs/drinks-elimination.md`, `docs/gambling-engine.md`, `docs/timed-prompts.md`, `docs/rdi1-engine-capabilities.md`.
- Content schemas: `src/content/cards.ts`, `src/content/effects.ts`, `src/content/pack.ts`, `src/content/reaction-triggers.ts`, `src/content/mechanics.ts`.
- Engine: `src/engine/card-effects-validation.ts`, `src/engine/card-play-legality.ts`, `src/engine/commands.ts`, `src/engine/drinks.ts`, `src/engine/effect-operations.ts`, `src/engine/gambling-state.ts`, `src/engine/gambling.ts`, `src/engine/gold.ts`, `src/engine/invariants.ts`, `src/engine/model.ts`, `src/engine/reaction-legality.ts`, `src/engine/resolution-state.ts`, `src/engine/setup.ts`, `src/engine/timed-prompts.ts`, `src/engine/timing.ts`, `src/engine/turn.ts`, `src/engine/types.ts`, `src/engine/generic-effect-validation.ts`, `src/engine/resolution-ids.ts`, `src/engine/source-capabilities.ts`, `src/engine/workflow-state.ts`, `src/engine/workflows.ts`.
- Protocol/UI: `src/protocol/events.ts`, `src/protocol/projections.ts`, `src/protocol/views.ts`, `src/client/GameTable.tsx`, `src/shared/ui-messages.ts`.
- Tests: all 11 new suites listed above; `tests/fixtures/generic-match.ts`; existing `tests/client/playable-highlighting.test.tsx`, `tests/engine/card-play-legality.test.ts`, `tests/engine/gambling.test.ts`, `tests/engine/rdi1-source-audit.test.ts`, `tests/engine/replay.test.ts`, `tests/engine/timing.test.ts`.

## Visual verification and next-step boundary

Run `npm run dev:fixture`, create a two-player room in separate browser contexts, start a match, pass phase-end grace, and play **Sample Raise the Stakes** as the Action. Pass responses to reach gambling, then play **Sample Quiet Breather** from the other player's hand. Its playable badge/button stays available, Fortitude increases, and pot/controller remain unchanged. Reload that player and confirm the same gambling state. The automated browser test performs this journey.

The new system labels and revealed-copy projection are exercised using original test fixtures; the shipped sample deck deliberately does not acquire the new mechanics. RDI1 visual deck journeys require the separately authorized Step 21C import and later per-card verification. Step 21B provides the generic prerequisites; Step 21C has not begun.
