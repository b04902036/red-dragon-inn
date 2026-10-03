/** Step-20 assessment, not a runtime registry or a promise of execution support. */
export const RDI1_ENGINE_CAPABILITIES = {
  'drink.contest-score': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No immutable contest score separate from mutable Drink effects.',
  ],
  'drink.contest-tie-loop': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No contest participants, repeat-round state or tie continuation.',
  ],
  'drink.copy-for-all': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No copy-before-response workflow for an Inn source.',
  ],
  'drink.force-one': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'timing.ts',
    'startDrink only handles the active turn drinker; no chosen-player forced continuation.',
  ],
  'drink.force-simultaneous': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No reveal-all barrier followed by independently responding drinkers.',
  ],
  'drink.ignore': [
    'ALREADY_SUPPORTED',
    'effect-operations.ts',
    'IGNORE excludes the affected drinker from the combined Drink/Chaser frame.',
  ],
  'drink.ignore-with-cost': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gold.ts',
    'PAY_INN caps payment at available Gold; a mandatory full cost cannot be substituted by a free partial payment.',
  ],
  'drink.independent-copies': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'resolution-state.ts',
    'Frames support nesting, but not independently mutable copies of one revealed Drink.',
  ],
  'drink.order-extra': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'turn.ts',
    'ORDER_DRINK orders one normal Drink and completes the phase; no queued extra orders.',
  ],
  'drink.pass': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No current-Drink recipient transfer preserving source/Chaser provenance.',
  ],
  'drink.queue-extra': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'resolution-state.ts',
    'No separate queued Drink continuation on another drinker’s reveal.',
  ],
  'drink.replace-alcohol-with-fortitude': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'effect-operations.ts',
    'MODIFY_DRINK adds fixed deltas; it cannot replace Alcohol with the live equal Fortitude gain.',
  ],
  'drink.simultaneous-reveal': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'Reveals and response windows currently run one frame at a time.',
  ],
  'drink.skip-events-for-source': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'Chasers skip Events, but a Round-on-the-House source selection continuation does not exist.',
  ],
  'drink.split': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'drinks.ts',
    'No two independent Drinks using ceil rounding after combining Chasers.',
  ],
  'gambling.ante-all': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'Initial antes exist; raising all active participants with response checkpoints does not.',
  ],
  'gambling.cancel-ante-and-leave': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'Antes are charged synchronously; no pending individual ante to cancel.',
  ],
  'gambling.end-to-inn': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'Settlement always credits a player, with no Inn destination or checkpoint restrictions.',
  ],
  'gambling.final-response-before-leave': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'No targeted forced-leave checkpoint; SELF leave already preserves ordinary preceding card responses.',
  ],
  'gambling.force-leave': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'effects.ts',
    'LEAVE_GAMBLING accepts SELF only, and cannot eject a chosen active gambler.',
  ],
  'gambling.replace-winner': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'No before-payout winner-replacement opportunity.',
  ],
  'gambling.start-or-control': [
    'ALREADY_SUPPORTED',
    'timing.ts',
    'PLAY_CARD injects START_GAMBLING; GAMBLING_PLAY injects TAKE_GAMBLING_CONTROL and enforces control categories.',
  ],
  'gambling.take-from-pot': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'TRANSFER_GOLD transfers player stashes; pot escrow is not an effect target.',
  ],
  'gambling.win-from-response': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'card-effects-validation.ts',
    'WIN_GAMBLING requires the suspended Gambling parent, rejecting a response child of a Cheating frame.',
  ],
  'gold.contest-payout': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gold.ts',
    'Ordinary transfers exist, but no contest-winner payout continuation.',
  ],
  'gold.payment-substitution': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gold.ts',
    'No pending payment obligation or exactly-one-Gold Inn substitution accounting.',
  ],
  'reaction.ante-context': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'reaction-legality.ts',
    'ReactionContext contains pending frame operations, not an individual ante obligation.',
  ],
  'reaction.counter-family': [
    'SUPPORTED_WITH_SCHEMA_EXTENSION',
    'reaction-legality.ts',
    'Existing shared predicates/windows can enforce family equality after validated family metadata and a shared predicate are added.',
  ],
  'reaction.gambling-checkpoint': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'timing.ts',
    'No interruptible between-control checkpoint with final-pass and ending-source restrictions.',
  ],
  'reaction.multi-trigger': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'reaction-triggers.ts',
    'OR alternatives exist; source branches also require missing system/ante opportunities and context-dependent effects.',
  ],
  'reaction.payment-context': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'reaction-legality.ts',
    'No payment-required system event or payer/amount facts.',
  ],
  'reaction.phase-sometimes': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'timed-prompts.ts',
    'Phase-end grace filters ANYTIME; no active Order Drink Sometimes opportunity before/after normal ordering.',
  ],
  'reaction.post-gambling-settlement': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'gambling.ts',
    'settleGambling clears escrow and pays synchronously, without a final reaction window.',
  ],
  'reaction.post-stat-event': [
    'NEEDS_GENERIC_ENGINE_FEATURE',
    'stats.ts',
    'Stat changes emit actual deltas but do not suspend for post-loss retaliation before elimination.',
  ],
  'reaction.source-capabilities': [
    'SUPPORTED_WITH_SCHEMA_EXTENSION',
    'reaction-legality.ts',
    'Existing card response evaluation can use validated capability/exclusion facts; titles must never substitute for those facts.',
  ],
} as const;
export type Rdi1Capability = keyof typeof RDI1_ENGINE_CAPABILITIES;
