import { describe, expect, it } from 'vitest';
import {
  decodeClientCommand,
  decodeServerMessage,
  encodeServerMessage,
} from '../../src/protocol/codec';
import { serverMessageSchema } from '../../src/protocol/messages';
import {
  projectPrivatePlayer,
  projectPublicGame,
} from '../../src/protocol/projections';
import { makeGameState } from '../fixtures/game-state';

describe('contract portability inside the Workers runtime', () => {
  it('validates intents and serializes safe projections without Node or browser globals', () => {
    const command = decodeClientCommand(
      '{"type":"PLAY_CARD","commandId":"command_sample","roomId":"room_sample","expectedStateVersion":7,"cardId":"card_sample"}',
    );
    expect(command.type).toBe('PLAY_CARD');
    expect(command).toHaveProperty('expectedStateVersion', 7);

    const state = makeGameState();
    const publicMessage = serverMessageSchema.parse({
      type: 'PUBLIC_STATE',
      view: projectPublicGame(state),
    });
    const publicFrame = encodeServerMessage(publicMessage);
    expect(decodeServerMessage(publicFrame)).toEqual(publicMessage);
    expect(publicFrame).not.toContain('secret_hand');
    expect(publicFrame).not.toContain('secret_future');
    expect(publicFrame).not.toContain('secret_drink');

    const privateMessage = serverMessageSchema.parse({
      type: 'PRIVATE_STATE',
      view: projectPrivatePlayer(state, state.players[0]!.id),
    });
    const privateFrame = encodeServerMessage(privateMessage);
    expect(decodeServerMessage(privateFrame)).toEqual(privateMessage);
    expect(privateFrame).toContain('p0_secret_hand');
    expect(privateFrame).not.toContain('p1_secret_hand');
    expect(privateFrame).not.toContain('secret_future');
    expect(privateFrame).not.toContain('secret_drink');
  });
});
