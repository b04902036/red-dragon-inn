import { useState } from 'react';
import type { PrivatePlayerView, PublicGameView } from '../protocol/views';
import type { Presentation } from '../protocol/presentation';
import { useLocale } from './i18n/context';

export function DevCardPicker({
  choices,
  hand,
  discards,
  players,
  playerId,
  phase,
  busy,
  presentation,
  send,
}: {
  choices: NonNullable<PrivatePlayerView['devChoices']>;
  hand: PrivatePlayerView['hand'];
  discards: string[];
  players: PublicGameView['players'];
  playerId: string;
  phase: 'DISCARD_DRAW' | 'ORDER_DRINK';
  busy: boolean;
  presentation: Presentation;
  send: (
    type: 'DEV_DISCARD_DRAW' | 'DEV_ORDER_DRINK',
    fields: Record<string, unknown>,
  ) => void;
}) {
  const { t } = useLocale();
  const kept = hand.filter((card) => !discards.includes(card.id));
  const available = choices.characterCards
    .map((choice) => ({
      ...choice,
      count:
        choice.count -
        kept.filter((card) => card.definitionId === choice.definitionId).length,
    }))
    .filter((choice) => choice.count > 0);
  const needed = Math.min(
    choices.handSize - kept.length,
    available.reduce((n, choice) => n + choice.count, 0),
  );
  const [draws, setDraws] = useState<string[]>(
    Array.from({ length: needed }, () => ''),
  );
  const [drink, setDrink] = useState('');
  const [target, setTarget] = useState('');
  const name = (definitionId: string) =>
    presentation.cards.find((card) => card.id === definitionId)?.name ??
    definitionId;
  return (
    <section className="dev-card-picker" aria-label={t('dev.title')}>
      <h2>{t('dev.title')}</h2>
      {phase === 'DISCARD_DRAW' ? (
        <>
          <p>{t('dev.drawHelp', { count: needed })}</p>
          {draws.map((value, index) => (
            <label key={index}>
              {t('dev.drawSlot', { slot: index + 1 })}
              <select
                value={value}
                disabled={busy}
                onChange={(event) =>
                  setDraws(
                    draws.map((old, i) =>
                      i === index ? event.target.value : old,
                    ),
                  )
                }
              >
                <option value="">{t('dev.choose')}</option>
                {available.map((choice) => (
                  <option
                    key={choice.definitionId}
                    value={choice.definitionId}
                    disabled={
                      draws.filter(
                        (id, i) => i !== index && id === choice.definitionId,
                      ).length >= choice.count
                    }
                  >
                    {name(choice.definitionId)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button
            disabled={
              busy ||
              draws.some((id) => !id) ||
              available.some(
                (choice) =>
                  draws.filter((id) => id === choice.definitionId).length >
                  choice.count,
              )
            }
            onClick={() =>
              send('DEV_DISCARD_DRAW', {
                cardIds: discards,
                definitionIds: draws,
              })
            }
          >
            {t('dev.drawConfirm')}
          </button>
        </>
      ) : (
        <>
          <label>
            {t('dev.drink')}
            <select
              value={drink}
              disabled={busy}
              onChange={(event) => setDrink(event.target.value)}
            >
              <option value="">{t('dev.choose')}</option>
              {choices.innCards.map((choice) => (
                <option key={choice.definitionId} value={choice.definitionId}>
                  {name(choice.definitionId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('dev.target')}
            <select
              value={target}
              disabled={busy}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">{t('dev.choose')}</option>
              {players
                .filter(
                  (player) => !player.eliminated && player.id !== playerId,
                )
                .map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
            </select>
          </label>
          <button
            disabled={busy || !drink || !target}
            onClick={() =>
              send('DEV_ORDER_DRINK', {
                definitionId: drink,
                targetPlayerId: target,
              })
            }
          >
            {t('dev.drinkConfirm')}
          </button>
        </>
      )}
    </section>
  );
}
