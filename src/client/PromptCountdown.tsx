import { useEffect, useState } from 'react';
import type { PublicGameView } from '../protocol/views';
import { useLocale } from './i18n/context';
export function PromptCountdown({
  prompt,
}: {
  prompt: PublicGameView['timedPrompt'];
}) {
  const [now, setNow] = useState(() => Date.now());
  const { t } = useLocale();
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, []);
  if (!prompt) return null;
  return (
    <p role="timer" data-prompt-id={prompt.promptId}>
      {t(
        prompt.kind === 'RESPONSE_DECISION'
          ? 'timer.response'
          : 'timer.anytime',
        { seconds: Math.max(0, Math.ceil((prompt.deadlineAt - now) / 1000)) },
      )}
    </p>
  );
}
