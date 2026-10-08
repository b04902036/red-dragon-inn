import { act, render, fireEvent, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import {
  AudioEngine,
  audioPaths,
  type AudioElement,
} from '../../src/client/audio/audio-engine';
import { AudioContext } from '../../src/client/audio/context';
import {
  defaultAudioSettings,
  readAudioSettings,
} from '../../src/client/audio/settings';
import { parseCardVoices } from '../../src/client/audio/card-voice-catalog';
import { useCardVoices } from '../../src/client/audio/use-card-voices';
import {
  initialRoomState,
  type RoomClientState,
} from '../../src/client/room-state';
import { projectPublicGame } from '../../src/protocol/projections';
import { publicNarrationEventSchema } from '../../src/protocol/public-narration';
import { started } from '../fixtures/core-match';
class Media implements AudioElement {
  loop = false;
  volume = 1;
  currentTime = 0;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  listeners = new Map<string, () => void>();
  constructor(readonly path: string) {}
  addEventListener(type: string, listener: () => void) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
  end() {
    this.listeners.get('ended')?.();
  }
}
const path = (name: string) =>
  `/audio/cards/character_sample/carddef_${name}/v_test.mp3`;
function engineFixture() {
  const media: Media[] = [];
  const engine = new AudioEngine(
    defaultAudioSettings,
    (name) => {
      const audio = new Media(name);
      media.push(audio);
      return audio;
    },
    sessionStorage,
  );
  return { engine, media };
}
afterEach(() => {
  sessionStorage.clear();
  vi.useRealTimers();
});
it('serializes titles and the existing attention voice without overlap; ducking restores current music volume', async () => {
  const { engine, media } = engineFixture();
  await engine.unlock();
  engine.observeCard('match:1', path('a'), true);
  engine.observe('prompt:1', true, true);
  engine.observeCard('match:2', path('b'), true);
  expect(media.map((audio) => audio.path)).toEqual([
    audioPaths.music,
    audioPaths.chime,
    path('a'),
  ]);
  expect(media[0]!.volume).toBeCloseTo(0.06);
  engine.applySettings({ ...defaultAudioSettings, musicVolume: 0.5 });
  expect(media[0]!.volume).toBeCloseTo(0.15);
  media[2]!.end();
  expect(media[3]!.path).toBe(audioPaths.voice);
  expect(media[2]!.pause).toHaveBeenCalled();
  media[3]!.end();
  expect(media[4]!.path).toBe(path('b'));
  media[4]!.end();
  expect(media[0]!.volume).toBe(0.5);
  engine.dispose();
});
it('consumes HISTORY, duplicate, locked and muted events; reconnect/session remount never replays', async () => {
  const { engine, media } = engineFixture();
  engine.observeCard('match:locked', path('a'), true);
  await engine.unlock();
  engine.observeCard('match:locked', path('a'), true);
  engine.observeCard('match:history', path('a'), false);
  engine.observeCard('match:history', path('a'), true);
  engine.applySettings({ ...defaultAudioSettings, voiceMuted: true });
  engine.observeCard('match:muted', path('a'), true);
  engine.applySettings(defaultAudioSettings);
  engine.observeCard('match:muted', path('a'), true);
  engine.observeCard('match:live', path('a'), true);
  engine.observeCard('match:live', path('a'), true);
  expect(media.filter((audio) => audio.path.includes('/cards/'))).toHaveLength(
    1,
  );
  engine.dispose();
  const next = engineFixture();
  await next.engine.unlock();
  next.engine.observeCard('match:live', path('a'), true);
  expect(next.media).toHaveLength(2);
  next.engine.dispose();
});
it('voice controls are independent from SFX, cancel muted speech and restore music without altering stored settings', async () => {
  const { engine, media } = engineFixture();
  await engine.unlock();
  engine.applySettings({
    ...defaultAudioSettings,
    sfxMuted: true,
    voiceVolume: 0.4,
  });
  engine.observeCard('match:1', path('a'), true);
  expect(media[2]!.play).toHaveBeenCalledOnce();
  expect(media[2]!.volume).toBe(0.4);
  engine.applySettings({ ...defaultAudioSettings, cardVoicesEnabled: false });
  expect(media[2]!.pause).toHaveBeenCalled();
  expect(media[0]!.volume).toBe(defaultAudioSettings.musicVolume);
  engine.observeCard('match:2', path('b'), true);
  expect(media).toHaveLength(3);
  expect(
    readAudioSettings({ getItem: () => '{"voiceVolume":2,"voiceMuted":true}' }),
  ).toMatchObject({ voiceVolume: 1, voiceMuted: true });
  engine.dispose();
});
it('failed playback, missing files and watchdog advance the queue without changing audio readiness', async () => {
  vi.useFakeTimers();
  const { engine, media } = engineFixture();
  await engine.unlock();
  engine.observeCard('match:missing', null, true);
  engine.observeCard('match:remote', 'https://example.com/speech.mp3', true);
  expect(media).toHaveLength(2);
  engine.observeCard('match:1', path('a'), true);
  engine.observeCard('match:2', path('b'), true);
  media[2]!.listeners.get('error')!();
  expect(media[3]!.path).toBe(path('b'));
  vi.advanceTimersByTime(30000);
  expect(media[0]!.volume).toBe(defaultAudioSettings.musicVolume);
  expect(engine.status).toBe('ready');
  engine.dispose();
});
it('catalog rejects external URLs, path collisions and ownership mismatches', () => {
  const entry = {
    characterId: 'character_sample',
    cardDefinitionId: 'carddef_a',
    variantId: 'v_test',
    assetPath: path('a'),
  };
  const families = [
    {
      characterId: entry.characterId,
      cardDefinitionId: entry.cardDefinitionId,
      variantIds: ['v_test'],
    },
  ];
  expect(
    parseCardVoices({ schemaVersion: 2, families, entries: [entry] }).size,
  ).toBe(2);
  expect(() =>
    parseCardVoices({ schemaVersion: 2, families, entries: [entry, entry] }),
  ).toThrow();
  expect(() =>
    parseCardVoices({
      schemaVersion: 2,
      families,
      entries: [{ ...entry, characterId: 'character_other' }],
    }),
  ).toThrow();
  expect(() =>
    parseCardVoices({
      schemaVersion: 2,
      families,
      entries: [{ ...entry, assetPath: 'https://example.com/file.mp3' }],
    }),
  ).toThrow();
});
it('only LIVE CARD_PLAYED speaks with the owning player character; rerender/history/non-card events stay silent and inputs stay usable', async () => {
  const { engine, media } = engineFixture();
  await engine.unlock();
  const view = projectPublicGame(started(1, 7));
  const actor = view.players[0]!;
  const definition = 'carddef_sample_title';
  const assetPath = `/audio/cards/${actor.characterId}/${definition}/v_test.mp3`;
  const catalog = parseCardVoices({
    schemaVersion: 2,
    families: [
      {
        characterId: actor.characterId,
        cardDefinitionId: definition,
        variantIds: ['v_test', 'v_other'],
      },
    ],
    entries: [
      {
        characterId: actor.characterId,
        cardDefinitionId: definition,
        variantId: 'v_test',
        assetPath,
      },
      {
        characterId: actor.characterId,
        cardDefinitionId: definition,
        variantId: 'v_other',
        assetPath: `/audio/cards/${actor.characterId}/${definition}/v_other.mp3`,
      },
    ],
  });
  const played = (sequence: number, variant = 'v_test') =>
    publicNarrationEventSchema.parse({
      type: 'CARD_PLAYED',
      id: `${view.matchId}:${sequence}`,
      matchId: view.matchId,
      sequence,
      stateVersion: 2,
      eventIndex: 0,
      playerId: actor.id,
      cardDefinitionId: definition,
      presentationVariantId: variant,
      resolutionId: null,
      parentId: null,
      targetPlayerIds: [],
      responseRelation: null,
    });
  const respond = vi.fn();
  function Harness({ state }: { state: RoomClientState }) {
    useCardVoices(state);
    return <button onClick={respond}>Respond immediately</button>;
  }
  const ui = (
    state: RoomClientState,
    cardVoices: typeof catalog | null = catalog,
  ) => (
    <AudioContext
      value={{
        engine,
        settings: defaultAudioSettings,
        status: 'ready',
        update: () => {},
        unlock: () => {},
        cardVoices,
      }}
    >
      <Harness state={state} />
    </AudioContext>
  );
  const initial = {
    ...initialRoomState,
    publicView: view,
    log: [played(1)],
    liveEventIds: [played(1).id],
  };
  const rendered = render(ui(initial, null));
  // Loading the catalog late must consume, rather than replay, earlier LIVE events.
  rendered.rerender(ui(initial));
  expect(media).toHaveLength(2);
  const nonCard = publicNarrationEventSchema.parse({
    type: 'TURN_STARTED',
    id: `${view.matchId}:4`,
    matchId: view.matchId,
    sequence: 4,
    stateVersion: 2,
    eventIndex: 0,
    playerId: actor.id,
    turnNumber: 2,
  });
  const live = {
    ...initial,
    log: [
      played(1),
      played(2),
      played(3, 'v_other'),
      played(5, 'v_missing'),
      nonCard,
    ],
    liveEventIds: [played(2).id, played(3).id, played(5).id, nonCard.id],
  };
  rendered.rerender(ui(live));
  expect(media[2]!.path).toBe(assetPath);
  expect(media[2]!.play).toHaveBeenCalledOnce();
  rendered.rerender(ui({ ...live }));
  fireEvent.click(screen.getByRole('button', { name: 'Respond immediately' }));
  expect(respond).toHaveBeenCalledOnce();
  await act(async () => media[2]!.end());
  expect(media[3]!.path).toBe(
    `/audio/cards/${actor.characterId}/${definition}/v_other.mp3`,
  );
  expect(media[2]!.play).toHaveBeenCalledTimes(1);
  await act(async () => media[3]!.end());
  expect(media).toHaveLength(4);
  engine.dispose();
});
it('legacy instances resolve only a known single-variant family, including partially populated manifests', () => {
  const families = [
    {
      characterId: 'character_sample',
      cardDefinitionId: 'carddef_a',
      variantIds: ['v_only'],
    },
    {
      characterId: 'character_sample',
      cardDefinitionId: 'carddef_b',
      variantIds: ['v_one', 'v_two'],
    },
  ];
  const entries = families.map((family) => ({
    characterId: family.characterId,
    cardDefinitionId: family.cardDefinitionId,
    variantId: family.variantIds[0],
    assetPath: `/audio/cards/${family.characterId}/${family.cardDefinitionId}/${family.variantIds[0]}.mp3`,
  }));
  const catalog = parseCardVoices({ schemaVersion: 2, families, entries });
  expect(catalog.get('character_sample:carddef_a')).toBe(entries[0]!.assetPath);
  expect(catalog.get('character_sample:carddef_b')).toBeUndefined();
  expect(catalog.get('character_sample:carddef_b:v_two')).toBeUndefined();
  expect(() =>
    parseCardVoices({
      schemaVersion: 2,
      families: [...families, families[0]],
      entries,
    }),
  ).toThrow();
});
