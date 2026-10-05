import { test, expect } from '@playwright/test';
import { passPhaseEnd } from './timing-helpers';

test('production lobby selects the four published RDI1 characters and plays a pinned bilingual match', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host, guest])
    page.on('pageerror', (error) => errors.push(error.message));
  try {
    await host.goto('/');
    await host.getByLabel('Your name').fill('RDI1 host');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    const selector = host.getByLabel('Your character');
    await expect(selector.locator('option')).toHaveCount(4);
    expect(await selector.locator('option').allTextContents()).toEqual([
      'Deirdre the Priestess',
      'Fiona the Volatile',
      'Gerki the Sneak',
      'Zot the Wizard and Pooky',
    ]);
    await selector.selectOption('character_rdi_deirdre_the_priestess');
    const invite = await host.getByLabel('Invite link').inputValue();
    const roomId = new URL(invite).searchParams.get('room')!;
    const presentation = await host.request.get(
      `/api/rooms/${roomId}/presentation?locale=zh-TW`,
    );
    expect(presentation.status()).toBe(200);
    expect(await presentation.json()).toMatchObject({
      contentVersionId: 'content_rdi1_mechanics_v2',
      characters: expect.arrayContaining([
        expect.objectContaining({
          name: expect.stringContaining('迪爾德麗・女祭司'),
        }),
      ]),
    });
    await guest.goto(invite);
    await guest.getByLabel('Your name').fill('RDI1 guest');
    await guest.getByRole('button', { name: 'Join room' }).click();
    await expect(guest.getByRole('status')).toHaveText('Synced');
    await guest
      .getByLabel('Your character')
      .selectOption('character_rdi_zot_the_wizard_and_pooky');
    await expect(guest.getByLabel('Your character')).toHaveValue(
      'character_rdi_zot_the_wizard_and_pooky',
    );
    await host.getByRole('button', { name: 'Start match' }).click();
    await expect(
      host.getByRole('button', { name: 'Discard and draw' }),
    ).toBeEnabled();
    await expect(host.locator('.hand-card')).toHaveCount(7);
    expect(
      (await host.locator('.hand-card').allTextContents()).join(' '),
    ).not.toMatch(/sample/i);
    await host.getByRole('button', { name: 'Discard and draw' }).click();
    await expect(host.getByRole('status')).toHaveText('Synced');
    await passPhaseEnd([host, guest], roomId);
    await expect(
      host.getByRole('button', { name: 'Skip action', exact: true }),
    ).toBeEnabled();
    await guest.reload();
    await expect(guest.getByRole('status')).toHaveText('Synced');
    await expect(guest.locator('.hand-card')).toHaveCount(7);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
