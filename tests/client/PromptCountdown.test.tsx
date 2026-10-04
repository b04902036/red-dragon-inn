import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { PromptCountdown } from '../../src/client/PromptCountdown';
import { LocaleProvider } from '../../src/client/i18n/LocaleProvider';
import { playerIdSchema, responseWindowIdSchema } from '../../src/shared/ids';

it.each(['en-US', 'zh-TW'])(
  'renders the untimed owner decision in %s without a countdown',
  (locale) => {
    localStorage.setItem('rdi:locale', locale);
    render(
      <LocaleProvider>
        <PromptCountdown
          prompt={{
            promptId: 'prompt_owner',
            kind: 'RESPONSE_DECISION',
            windowId: responseWindowIdSchema.parse('window_owner'),
            priorityPlayerId: playerIdSchema.parse('player_owner'),
            openedAt: 1000,
            deadlineAt: null,
          }}
        />
      </LocaleProvider>,
    );
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      locale === 'zh-TW' ? '不限時' : 'no time limit',
    );
  },
);
