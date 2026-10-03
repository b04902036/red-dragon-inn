export type RejectionCode =
  | 'INVALID_COMMAND'
  | 'WRONG_ROOM'
  | 'UNKNOWN_PLAYER'
  | 'VERSION_CONFLICT'
  | 'VERSION_EXHAUSTED'
  | 'COMMAND_ID_CONFLICT'
  | 'WRONG_LIFECYCLE'
  | 'NOT_HOST'
  | 'NOT_ACTIVE_PLAYER'
  | 'WRONG_PHASE'
  | 'CARD_NOT_IN_HAND'
  | 'UNSUPPORTED_CARD'
  | 'INVALID_TARGET'
  | 'RESOLUTION_PENDING'
  | 'UNSUPPORTED_COMMAND'
  | 'TURN_LIMIT'
  | 'WRONG_WINDOW'
  | 'NOT_ELIGIBLE'
  | 'NOT_PRIORITY'
  | 'ALREADY_PASSED'
  | 'ILLEGAL_TIMING'
  | 'INVALID_CHOICE'
  | 'INVALID_EFFECT'
  | 'STACK_LIMIT'
  | 'NO_GAMBLING'
  | 'CONTROL_RESTRICTED'
  | 'LEAVE_NOT_ALLOWED'
  | 'GOLD_CAPACITY';
export class CommandError extends Error {
  constructor(readonly code: RejectionCode) {
    super(code);
  }
}
export function requireCommand(
  condition: boolean,
  code: RejectionCode,
): asserts condition {
  if (!condition) throw new CommandError(code);
}
