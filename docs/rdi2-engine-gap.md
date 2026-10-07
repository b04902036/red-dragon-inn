# Step 24B engine gap audit

This is the historical Step 24B verification record. The subsequent [Step 24C report](rdi2-compile-publish.md) covers actual RDI2 compilation/publication and the official 30-card active Bar Deck with a hidden reserve; its implementation supersedes the preliminary mixed-deck setup entry below.

Prerequisite: `npm run content:verify:rdi2-source` passes with 44 mechanics,
23 Drink records, 160 Character cards and 30 Drinks. The immutable source lock
is valid. This step adds generic runtime capabilities; it does not compile or
publish RDI2. Team mode remains the user-authorized non-blocking TODO.

| Capability                                                         | Initial classification          | Existing support / required change                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Gambling start/control, raise, immediate win, forced leave         | ALREADY_SUPPORTED               | Existing gambling workflows and anti-cheat response tests; extend forced-leave self-target permission as explicit data.                       |
| Gambling checkpoint, pot-to-Inn, take-from-pot, winner replacement | ALREADY_SUPPORTED               | Existing payment/checkpoint/settlement tasks.                                                                                                 |
| Gambling restart before payout                                     | NEEDS_GENERIC_ENGINE_FEATURE    | Retain pot and departures, re-ante remaining players, replace controller, cancel old settlement, record the specific restart-blocking family. |
| Gold payment substitution                                          | SUPPORTED_WITH_SCHEMA_EXTENSION | Existing payment tasks; support the entire current obligation, not only one Gold.                                                             |
| Gold prevention / ante satisfied without movement                  | NEEDS_GENERIC_ENGINE_FEATURE    | Preserve payment satisfaction separately from transferred Gold.                                                                               |
| Ignore, Negate, counter families and Drink-modifier counters       | ALREADY_SUPPORTED               | Shared legality, source capabilities and stack resolution.                                                                                    |
| Direct Fortitude / Alcohol / Gold changes, collection, healing     | ALREADY_SUPPORTED               | Validated numeric operations and existing bounds.                                                                                             |
| Heavy damage with later Inn payment; songs                         | ALREADY_SUPPORTED               | Ordered effect arrays and separate payment tasks; payment is a resolving effect.                                                              |
| Post-loss original source and mitigation-card history              | ALREADY_SUPPORTED               | Step 24A generic optional predicates and per-effect accepted-play history.                                                                    |
| Living-player-count predicate / exclude original source target     | SUPPORTED_WITH_SCHEMA_EXTENSION | Add bounded predicate and generic target exclusion.                                                                                           |
| Share Pain / responder mitigation lock                             | NEEDS_GENERIC_ENGINE_FEATURE    | Per-loss recipient amounts, ceiling halves and responder-only lock.                                                                           |
| Fortitude redirect and two-player fallback                         | SUPPORTED_WITH_SCHEMA_EXTENSION | Existing redirect; add scoped loss routing, source exclusion and shared Ignore fallback.                                                      |
| Drink Ignore/pass/external split, modifiers, Alcohol-to-Fortitude  | ALREADY_SUPPORTED               | Existing shared Drink operations.                                                                                                             |
| Drink whole-base replacement                                       | NEEDS_GENERIC_ENGINE_FEATURE    | Track base numeric effects separately from prior non-Drink modifiers; remove replaced Drink effects.                                          |
| Paid/free extra orders                                             | ALREADY_SUPPORTED               | Existing own Order phase and repeated other-player target choices.                                                                            |
| Refill-payment waiver / context alternative                        | NEEDS_GENERIC_ENGINE_FEATURE    | Refill obligations must enter normal payment response pipeline before transfer.                                                               |
| Simultaneous Inn Drinks / leading Event search                     | SUPPORTED_WITH_SCHEMA_EXTENSION | Existing deferred Drink batch; enable base Event skipping while retaining distinct Chaser behavior.                                           |
| Other-player Drink phase extra Drink                               | SUPPORTED_WITH_SCHEMA_EXTENSION | Existing reveal response; add separate Drink phase opportunity without changing Gog's reveal template.                                        |
| Mead built-in split                                                | NEEDS_GENERIC_ENGINE_FEATURE    | Optional decision after initial responses, prior modifiers, independent half responses, no Event/Chaser/external split.                       |
| Optional two-Drink Challenge                                       | NEEDS_GENERIC_ENGINE_FEATURE    | Accept/decline, two independent Inn chains, Event search, survival/rescue checkpoint then payment.                                            |
| Round on the House                                                 | ALREADY_SUPPORTED               | Independent copies, recipient trait evaluation and separate responses.                                                                        |
| Drinking Contest                                                   | ALREADY_SUPPORTED               | Current zero-Event scoring, modified revealed score and post-contest settlement.                                                              |
| Orc/Troll/Ogre/Half-Ogre entire numeric replacements               | ALREADY_SUPPORTED               | Validated character traits copied during setup; Drink replacement values override both ordinary numeric attributes.                           |
| Mixed-set Bar Deck                                                 | SUPPORTED_WITH_SCHEMA_EXTENSION | Setup currently insists on one Inn deck; accept an explicit server-owned list and combine physical instances.                                 |
| 30-second event responses / Sometimes voice / 15-second grace      | ALREADY_SUPPORTED               | Existing server timing and private voice projection; turn owner remains untimed. All new features must reuse this path.                       |

The bindings below implement these gaps through shared schemas and operations.
Acceptance checks use synthetic fixtures; source facts stay in the private lock.

## Runtime bindings

The following mapping covers every `engineRequirements` key in the locked
character source. Generic Drink requirements from the Step 24B prompt are
included separately below. These are engine bindings for subsequent compilation;
no RDI2 pack has been created or published.

| Locked requirement                              | Runtime binding                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| gambling.start-or-control                       | START_GAMBLING / TAKE_GAMBLING_CONTROL                                                                   |
| gambling.ante-all                               | ANTE_ALL_ACTIVE / PAYMENT tasks                                                                          |
| gambling.force-leave                            | FORCE_LEAVE_GAMBLING; allowSelfTarget is explicit data                                                   |
| gambling.win-from-response                      | NEGATE followed by WIN_GAMBLING                                                                          |
| reaction.gambling-checkpoint                    | CHECKPOINT task / GAMBLING_CHECKPOINT predicate                                                          |
| gambling.end-to-inn                             | END_GAMBLING / SETTLEMENT toInn                                                                          |
| gambling.restart-before-payout                  | RESTART_GAMBLING_ROUND / restarted settlement and persistent pot                                         |
| gold.loss-substitution                          | SUBSTITUTE_PAYMENT_FROM_INN with scope CURRENT_OBLIGATION; absent scope retains legacy one-Gold behavior |
| gold.prevent-loss                               | PREVENT_CURRENT_GOLD_LOSS / PAYMENT.prevented                                                            |
| gambling.ante-satisfied-without-transfer        | PAYMENT.prevented leaves participation intact with zero contribution                                     |
| gambling.take-from-pot                          | TAKE_FROM_GAMBLING_POT                                                                                   |
| gambling.cancel-ante-and-leave                  | CANCEL_CURRENT_ANTE_FOR_SELF / LEAVE_GAMBLING                                                            |
| reaction.multi-trigger                          | responseTrigger alternatives / contextual operations                                                     |
| reaction.counter-family                         | counterFamily / counterPolicy / allowedCounterFamilies                                                   |
| drink.ignore                                    | IGNORE                                                                                                   |
| drink.order-extra                               | ORDER_EXTRA_DRINKS with separate other-player choices                                                    |
| drink.free-extra-orders                         | ORDER_EXTRA_OR_WAIVE_REFILL in own Order phase                                                           |
| drink.refill-payment-waiver                     | ORDER_EXTRA_OR_WAIVE_REFILL during PAYMENT purpose REFILL                                                |
| drink.simultaneous-from-inn                     | FORCE_SIMULTANEOUS_DRINK source INN                                                                      |
| drink.simultaneous-from-inn-leading-event-skip  | skipLeadingEvents true; Chaser Event handling remains separate                                           |
| drink.queue-extra                               | QUEUE_EXTRA_DRINK / independent FORCED_DRINK task                                                        |
| reaction.other-player-drink-phase-opportunity   | PHASE_OPPORTUNITY phase DRINK actor OTHER                                                                |
| drink.pass                                      | PASS_CURRENT_DRINK                                                                                       |
| drink.split                                     | SPLIT_CURRENT_DRINK                                                                                      |
| drink.replace-alcohol-with-fortitude            | REPLACE_DRINK_ALCOHOL_WITH_FORTITUDE                                                                     |
| drink.modify                                    | MODIFY_DRINK / MODIFY_PENDING_EFFECT                                                                     |
| drink.replace-base-effects                      | REPLACE_DRINK_BASE / drinkBase metadata                                                                  |
| reaction.source-capabilities                    | SOURCE_CAPABILITY / shared operation-derived facts                                                       |
| effect.sequence                                 | ordered effect arrays; tasks suspend between operations                                                  |
| effect.partial-resolution                       | CHANGE_STAT followed by PAY_INN resolving effect                                                         |
| reaction.post-stat-event                        | POST_LOSS / ACTUAL_STAT_LOSS                                                                             |
| damage.original-source                          | origin / responseToOrigin / POST_LOSS originalPlayer and originalCard                                    |
| reaction.mitigation-card-history                | fortitudeMitigationPlays scoped by player and effect index                                               |
| damage.split-with-source                        | SHARE_FORTITUDE_LOSS / per-effect routing with ceiling halves                                            |
| reaction.self-mitigation-lock                   | per-effect mitigationLockedPlayerIds                                                                     |
| damage.redirect                                 | REDIRECT_FORTITUDE_LOSS with excludeOriginalSource and twoPlayerIgnoreFallback                           |
| team.variant-runtime-and-other-player-targeting | Non-blocking TODO; no team runtime or passing team test claimed                                          |

Additional Step 24B bindings: validated character `rules.traits` and Drink
`traitReplacements` cover Orc, Troll, Ogre and Half-Ogre; `builtInSplit: true`
adds the optional post-response Mead choice; `OPTIONAL_DRINK_CHALLENGE` adds
accept/decline, independent Inn Drinks and a survival response checkpoint;
`innDrinkDeckIds` selects and combines multiple Inn decks at server setup.

Compatibility: new matches enable ordinary refill payments through
`rules.drinks.refillPayment`. Older pinned rules without that field retain their
ordinary-order behavior. Existing explicit Drink Event refill settings retain
their own behavior. Immutable RDI1/RDI2 source and existing published packs are
not rewritten. Standard winner-replacement operation data defaults to blocking
restart; a different future winner-replacement family can set
`blocksRestart: false` without changing the standard family.

## Acceptance coverage

| Required integration case                          | Verification                                                                                                                                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Restart before payout                           | `step24b-payments-gambling.test.ts`: persistent pot, re-antes, left-hand priority, departed players and specific winner-replacement restriction.                                                |
| 2–3. Gold prevention for ordinary payment and ante | Same suite: Inn/player obligations, later effects still resolve, participation retained with zero contribution.                                                                                 |
| 4. Fixed-four Drink replacement                    | `step24b-drinks.test.ts`: compound base and native effects replaced, prior/future modifiers retained, prior Alcohol conversion preserved.                                                       |
| 5–6. Share Pain rounding and self-mitigation lock  | `step24b-damage.test.ts`, `step24b-edge-cases.test.ts`, `step24b-routing-regression.test.ts`: odd/even loss, legal counter, independent other-player mitigation and multi-target source.        |
| 7–8. Redirect provenance and two-player fallback   | Damage/routing suites: original source retained, source excluded as target, only Fortitude redirected, successive redirects, shared whole-card Ignore fallback.                                 |
| 9–10. Free extra orders and refill waiver          | Payment/edge suites: normal target choices, same other player twice, only responder's queued fee prevented.                                                                                     |
| 11. Simultaneous Inn Drinks skipping Events        | Drink suite: leading Event search, Chaser Event termination, all reveals precede consumption.                                                                                                   |
| 12. Heavy hit plus payment effect                  | Existing `rdi2-m31-project.test.ts` and `rdi2-m33-source.test.ts`: normal damage and later payment, legal substitution, self-payment Ignore restriction.                                        |
| 13. Half-Ogre replacement                          | Drink suite: whole numeric replacement for Ogre/Half-Ogre, Orc, Troll and ordinary Human control.                                                                                               |
| 14–16. Mead                                        | Drink/edge suites: modifiers before split, separate responses after split, optional keep, one physical discard, external split rejected, Chaser/Event result cannot invoke built-in split.      |
| 17. Challenge                                      | Drink/edge suites: accept/decline, two chains, leading Event search, Chaser termination, Ignore, survival checkpoint/rescue, failed challenge has no payout.                                    |
| 18–19. House and Contest                           | Existing `rdi1-drinks.test.ts`: independently interruptible copies, physical ownership, tie loops, modified revealed score and payout; new Mead House-result rejection.                         |
| 20. Timing/voice                                   | Existing `timing.test.ts` and `rdi1-release-timing.test.ts`, plus new `verifyOpportunity` checks: 30-second event response, Sometimes-only voice, separate 15-second grace, untimed turn owner. |

The five new engine suites contain 42 cases. They also execute inside the actual
Workers runtime through `tests/worker/step24b-runtime.test.ts`. Two additional D1
tests persist and recover routed damage/mitigation locks and a Mead decision;
two React cases verify accessible English/Traditional Chinese choice controls.
The shared prompt harness checks stale rejection without mutation, timeout,
private legal-card projections, snapshot recovery and deterministic replay.
Nested card plays use the existing prompt invalidation and fresh-window path.

Changed implementation areas: strict effect/trigger/Drink schemas; gambling,
payment, damage-routing and Drink workflows; snapshot invariants; server-owned
mixed Inn-deck selection; and localized generic choice labels. No character-name
or card-title dispatch was added to the engine. Existing private-index removals
and Step 24A changes were preserved.

## Final verification — 2026-10-07

Step 24B is complete for the locked project ruleset. Team runtime remains the
explicitly authorized non-blocking TODO. Step 24C is safe to begin when requested;
it has not been started. No RDI2 compilation, import, publication or deployment
was performed.

| Check                                | Final result                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                  | Exit 0                                                                                                                                            |
| `npm run lint`                       | Exit 0                                                                                                                                            |
| `npm test`                           | Exit 0; 2,533 passed across 28 configured runtime groups                                                                                          |
| `npm run build`                      | Exit 0                                                                                                                                            |
| `npm run test:e2e`                   | Exit 0; 27 passed (24 main, 1 development, 2 RDI1 production)                                                                                     |
| `npm run test:coverage`              | Exit 0; all 93 measured files meet every existing per-file 90% gate; aggregate statements 99.50%, branches 97.84%, functions 99.61%, lines 99.62% |
| `npm run content:verify:rdi2-source` | Exit 0; 44 mechanics, 23 Drink records, four 40-card decks, 30 physical Drinks, zero errors                                                       |
| `npm run content:verify:rdi1`        | Exit 0; four 40-card decks, 30 Drinks, no unknown mechanics/effects or missing translations                                                       |
| `npm run content:verify:zh-TW`       | Exit 0; 225/225 production fields translated, no UI/content issues                                                                                |
| `npm run verify:build`               | Exit 0                                                                                                                                            |
| Immutable RDI1 v1 source-lock hashes | All six archived artifacts match; the edition was not rewritten                                                                                   |
| `git diff --check` and diff review   | Passed; no debug logging, private source text or secrets added                                                                                    |

An additional `npm run content:verify:production` probe exits 1 because it checks
the entire 76-character catalog, while the configured published edition remains
`content_rdi1_mechanics_v2` with four characters. It reports 72 absent characters,
zero other content errors and no missing Traditional Chinese. This is the
existing full-catalog release limitation described in
[the RDI1 publication report](rdi1-compile-publish.md), not a passing full-catalog
release claim. The first concurrent probe encountered a local D1 internal error;
the sequential retry completed and reported that catalog limitation. Completing
that catalog would require later content steps, outside this engine-only step.

Validation logs and coverage reports are local ignored artifacts under `.tools/`
and `coverage/`. The tests use synthetic card data or existing private fixtures;
no private content was copied into public assets.
