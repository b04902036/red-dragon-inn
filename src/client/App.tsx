import { useEffect, useState } from 'react';
import { fetchHealth, type HealthState } from './health';
import './styles.css';
import { RoomScreen } from './RoomScreen';
import type { RoomCredentials } from './use-room';
import {
  roomCredentialsSchema,
  roomJoinResponseSchema,
} from '../protocol/rooms';
import { roomIdSchema } from '../shared/ids';

function roomCode(value: string) {
  try {
    return roomIdSchema.parse(
      value.includes('://')
        ? new URL(value).searchParams.get('room')
        : value.trim(),
    );
  } catch {
    return null;
  }
}
function restoreSeat() {
  const roomId = roomCode(
    new URLSearchParams(location.search).get('room') ?? '',
  );
  if (!roomId) return null;
  try {
    const parsed = roomCredentialsSchema.parse(
      JSON.parse(sessionStorage.getItem(`rdi-room:${roomId}`) ?? 'null'),
    );
    return parsed.roomId === roomId ? parsed : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [credentials, setCredentials] = useState<RoomCredentials | null>(
    restoreSeat,
  );
  if (credentials)
    return (
      <RoomScreen
        key={credentials.playerId}
        credentials={credentials}
        leave={() => {
          history.replaceState(null, '', '/');
          setCredentials(null);
        }}
      />
    );
  return <Landing enter={setCredentials} />;
}
function Landing({ enter }: { enter: (credentials: RoomCredentials) => void }) {
  const [health, setHealth] = useState<HealthState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get('room') ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function join(create: boolean) {
    const id = create ? null : roomCode(code);
    if (!create && !id) {
      setError('Enter a valid room code or invite link.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        create ? '/api/rooms' : `/api/rooms/${id}/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: name.trim() }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? 'This table is full or its match has started.'
            : response.status === 404
              ? 'That room could not be found.'
              : 'The room could not be opened. Please try again.',
        );
        return;
      }
      const result = roomJoinResponseSchema.parse(await response.json());
      sessionStorage.setItem(
        `rdi-room:${result.roomId}`,
        JSON.stringify(result.credentials),
      );
      history.replaceState(null, '', `/?room=${result.roomId}`);
      enter(result.credentials);
    } catch {
      setError('The room could not be opened. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setHealth({ status: 'healthy', health: result });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setHealth({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, [attempt]);

  function checkAgain() {
    setHealth({ status: 'checking' });
    setAttempt((current) => current + 1);
  }

  return (
    <main className="home">
      <p className="eyebrow">Welcome to the inn</p>
      <h1>Red Dragon Inn</h1>
      <p className="intro">
        A place to gather, play cards, and share an adventure.
      </p>
      <form
        className="room-form"
        onSubmit={(event) => {
          event.preventDefault();
          void join(false);
        }}
      >
        <label>
          Your name
          <input
            required
            maxLength={80}
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={busy || name.trim().length === 0}
          onClick={() => {
            void join(true);
          }}
        >
          Create room
        </button>
        <label>
          Room code or invite link
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={
            busy || name.trim().length === 0 || code.trim().length === 0
          }
        >
          Join room
        </button>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
      </form>
      <section className="health-card" aria-labelledby="health-heading">
        <h2 id="health-heading">Backend status</h2>
        <p role="status" aria-live="polite">
          {health.status === 'checking' && 'Checking backend…'}
          {health.status === 'healthy' && 'Backend is healthy'}
          {health.status === 'unavailable' &&
            'Backend is unavailable. Please try again.'}
        </p>
        {health.status === 'healthy' && (
          <p className="service">Service: {health.health.service}</p>
        )}
        <button onClick={checkAgain} disabled={health.status === 'checking'}>
          Check again
        </button>
      </section>
      <p className="footnote">
        Original sample cards · Gather 2–4 friends for a game.
      </p>
    </main>
  );
}
