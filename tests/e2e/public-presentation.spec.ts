import { test, expect } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { passPhaseEnd } from './timing-helpers';
import { mockPlayback } from './audio-helpers';
import { readFileSync } from 'node:fs';
import { contentPackSchema } from '../../src/content/pack';
const sampleContentPack = contentPackSchema.parse(
  JSON.parse(readFileSync('content/samples/pack.json', 'utf8')),
);
test('full log refresh, four-player HUD and accepted response during animation with a real 30-second deadline', async ({
  browser,
}) => {
  test.setTimeout(90000);
  const contexts = await Promise.all(
    Array.from({ length: 4 }, () => browser.newContext()),
  );
  const pages = await Promise.all(contexts.map((context) => context.newPage()));
  await Promise.all(pages.map((page) => mockPlayback(page)));
  const fixtureVoices = sampleContentPack.decks
    .filter((deck) => deck.type === 'CHARACTER')
    .flatMap((deck) =>
      sampleContentPack.deckCards
        .filter((card) => card.deckId === deck.id)
        .map((card) => ({
          characterId: deck.characterId,
          cardDefinitionId: card.cardId,
          assetPath: `/audio/cards/${deck.characterId}/${card.cardId}.mp3`,
        })),
    );
  const uniqueVoices = [
    ...new Map(
      fixtureVoices.map((entry) => [
        `${entry.characterId}:${entry.cardDefinitionId}`,
        entry,
      ]),
    ).values(),
  ];
  await Promise.all(
    pages.map((page) =>
      page.route('**/audio/cards/manifest.json', (route) =>
        route.fulfill({ json: { schemaVersion: 1, entries: uniqueVoices } }),
      ),
    ),
  );
  const host = pages[0]!,
    guest = pages[1]!;
  const errors: string[] = [];
  pages.forEach((page) =>
    page.on('pageerror', (error) => errors.push(error.message)),
  );
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('Host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    for (let seat = 1; seat < 4; seat++) {
      const page = pages[seat]!;
      await page.goto(invite);
      await page.getByLabel('Your name').fill(`Guest ${seat}`);
      await page.getByRole('button', { name: 'Join room' }).click();
      await expect(page.getByRole('status')).toHaveText('Synced');
    }
    await expect(host.locator('.lobby-seats li')).toHaveCount(4);
    await host.getByRole('button', { name: 'Start match' }).click();
    const view = async () =>
      roomMetadataSchema.parse(
        await (await host.request.get(`/api/rooms/${roomId}`)).json(),
      ).view;
    await expect(host.locator('.player-panel')).toHaveCount(4);
    for (const panel of await host.locator('.player-panel').all()) {
      await expect(panel.locator('.player-hud dd')).toHaveText([
        '20',
        '0',
        '10',
      ]);
      await expect(panel.locator('.pile-counts')).toContainText('Hand: 7');
      await expect(panel.locator('.pile-counts')).toContainText('Drink Me!: 1');
      const box = await panel.boundingBox();
      expect(box!.width).toBeGreaterThan(170);
    }
    await host
      .getByRole('button', { name: 'Discard and draw', exact: true })
      .click();
    await passPhaseEnd(pages, roomId);
    await expect(
      host.getByRole('button', { name: 'Play Sample Friendly Shove' }).first(),
    ).toBeEnabled();
    await host
      .getByRole('button', { name: 'Play Sample Friendly Shove' })
      .first()
      .click();
    await host
      .getByRole('dialog')
      .getByRole('button', { name: 'Guest 1', exact: true })
      .click();
    await host
      .getByRole('button', { name: 'Pass response', exact: true })
      .click();
    await expect(guest.getByRole('timer')).toHaveText(
      /Response: (2[0-9]|30)s remaining/,
    );
    const prompt = (await view()).timedPrompt!;
    expect(prompt.deadlineAt! - prompt.openedAt).toBe(30000);
    await expect(guest.locator('.presentation-zone')).toHaveAttribute(
      'data-presentation-active',
      'true',
    );
    const before = (await view()).version;
    await expect
      .poll(async () =>
        guest.evaluate(
          "window.__audioCalls.filter(path => path && path.includes('/audio/cards/')).length",
        ),
      )
      .toBe(1);
    await guest
      .getByRole('button', { name: 'Respond with Sample Brush It Off' })
      .click();
    await expect
      .poll(async () => (await view()).version)
      .toBeGreaterThan(before);
    await expect(guest.locator('.timeline-scroll')).toContainText(
      'Guest 1 played Sample Brush It Off',
    );
    // The response was accepted while the first voice was still playing.
    expect(
      await guest.evaluate(
        "window.__audioCalls.filter(path => path && path.includes('/audio/cards/')).length",
      ),
    ).toBe(1);
    const count = await guest.locator('.timeline-scroll li').count();
    expect(count).toBeGreaterThan(10);
    const history = await guest
      .locator('.timeline-scroll li')
      .evaluateAll((rows) =>
        rows.map((row) => ({
          sequence: row.getAttribute('data-sequence'),
          text: row.textContent,
        })),
      );
    await guest.reload();
    await expect(guest.locator('.timeline-scroll li')).toHaveCount(count);
    expect(
      await guest.locator('.timeline-scroll li').evaluateAll((rows) =>
        rows.map((row) => ({
          sequence: row.getAttribute('data-sequence'),
          text: row.textContent,
        })),
      ),
    ).toEqual(history);
    await expect(guest.locator('.presentation-zone')).toHaveAttribute(
      'data-presentation-active',
      'false',
    );
    expect(
      await guest.evaluate(
        "window.__audioCalls.filter(path => path && (path.includes('/voice/') || path.includes('/audio/cards/'))).length",
      ),
    ).toBe(0);
    await guest.emulateMedia({ reducedMotion: 'reduce' });
    await expect(guest.locator('.presentation-zone')).toHaveClass(
      /reduced-motion/,
    );
    await guest.setViewportSize({ width: 390, height: 844 });
    await expect(guest.locator('.player-panel')).toHaveCount(4);
    expect(
      await guest.evaluate(
        'document.documentElement.scrollWidth <= innerWidth',
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
