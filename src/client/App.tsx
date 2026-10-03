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
import { useLocale } from './i18n/context';
import { LocaleProvider, LanguageSelector } from './i18n/LocaleProvider';
import { uiMessage } from '../shared/ui-messages';
import type { UiMessage } from '../shared/ui-messages';
import { AudioProvider, AudioControls } from './audio/AudioProvider';

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
  return (
    <LocaleProvider>
      <AudioProvider>
        <header className="preferences">
          <LanguageSelector />
          <AudioControls />
        </header>
        <Application />
      </AudioProvider>
    </LocaleProvider>
  );
}
function Application() {
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
  const { t, message } = useLocale();
  const [health, setHealth] = useState<HealthState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState('');
  const [code, setCode] = useState(
    new URLSearchParams(location.search).get('room') ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<UiMessage | null>(null);
  async function join(create: boolean) {
    const id = create ? null : roomCode(code);
    if (!create && !id) {
      setError(uiMessage('landing.invalidCode'));
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
          uiMessage(
            response.status === 409
              ? 'landing.full'
              : response.status === 404
                ? 'landing.missing'
                : response.status === 503
                  ? 'landing.content'
                  : 'landing.failed',
          ),
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
      setError(uiMessage('landing.failed'));
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
      <p className="eyebrow">{t('landing.welcome')}</p>
      <h1>{t('app.title')}</h1>
      <p className="intro">{t('landing.intro')}</p>
      <form
        className="room-form"
        onSubmit={(event) => {
          event.preventDefault();
          void join(false);
        }}
      >
        <label>
          {t('landing.name')}
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
          {t('landing.create')}
        </button>
        <label>
          {t('landing.code')}
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
          {t('landing.join')}
        </button>
        {error && (
          <p role="alert" className="notice">
            {message(error)}
          </p>
        )}
      </form>
      <section className="health-card" aria-labelledby="health-heading">
        <h2 id="health-heading">{t('health.title')}</h2>
        <p role="status" aria-live="polite">
          {health.status === 'checking' && t('health.checking')}
          {health.status === 'healthy' && t('health.healthy')}
          {health.status === 'unavailable' && t('health.failed')}
        </p>
        {health.status === 'healthy' && (
          <p className="service">
            {t('health.service', { service: health.health.service })}
          </p>
        )}
        <button onClick={checkAgain} disabled={health.status === 'checking'}>
          {t('health.retry')}
        </button>
      </section>
      <p className="footnote">{t('landing.footnote')}</p>
    </main>
  );
}
