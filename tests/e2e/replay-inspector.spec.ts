import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
import { passPhaseEnd } from './timing-helpers';

test('local-only replay inspector verifies a persisted browser match and exports an ignored debug report', async ({
  browser,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const host = await a.newPage();
    const guest = await b.newPage();
    await host.goto('/');
    await host.getByLabel('Your name').fill('Replay host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(
      host.getByRole('heading', { name: 'Your table at the inn' }),
    ).toBeVisible();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const invite = await host
      .getByLabel('Invite link', { exact: true })
      .inputValue();
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('Replay guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(host.locator('.lobby-seats li')).toHaveCount(2);
    await host.getByRole('button', { name: 'Start match' }).click();
    await expect(
      host.getByRole('button', { name: 'Discard and draw' }),
    ).toBeEnabled();
    await host.getByRole('button', { name: 'Discard and draw' }).click();
    const roomId = new URL(invite).searchParams.get('room')!;
    await passPhaseEnd([host, guest], roomId);
    await expect(
      host.getByRole('heading', { name: 'Action', exact: true }),
    ).toBeVisible();
    const response = await host.request.get(`/api/rooms/${roomId}`);
    const metadata = roomMetadataSchema.parse(await response.json());
    const matchId = metadata.view.matchId!;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['.tools/replay-inspector/replay-inspector.js', '--match', matchId],
      { timeout: 30000 },
    );
    expect(stdout).toContain('Replay verified.');
    const raw = JSON.parse(
      await readFile(`.tools/replay-inspector/${matchId}.json`, 'utf8'),
    ) as { entries: unknown[]; replay: { state: { version: number } } };
    expect(raw.entries).toHaveLength(4);
    expect(raw.replay.state.version).toBe(metadata.view.version);
    expect(JSON.stringify(raw)).not.toMatch(
      /resumeToken|tokenHash|activeSessionId/,
    );
    const report = await readFile(
      `.tools/replay-inspector/${matchId}.html`,
      'utf8',
    );
    await host.setContent(report);
    await expect(
      host.getByRole('heading', { name: 'Local replay inspector' }),
    ).toBeVisible();
    await expect(
      host.getByText('Replay verified: beginning and snapshot recovery match.'),
    ).toBeVisible();
    await expect(
      host.getByRole('cell', { name: '20', exact: true }),
    ).toHaveCount(2);
    await expect(
      host.getByText('Lifecycle: PLAYING · phase: ACTION'),
    ).toBeVisible();
    const unavailable = await guest.request.get(`/api/rooms/${roomId}/replay`);
    expect(unavailable.status()).toBe(404);
    expect(await unavailable.text()).not.toContain('manifest');
  } finally {
    await a.close();
    await b.close();
  }
});
