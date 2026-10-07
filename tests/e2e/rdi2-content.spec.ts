import { test, expect } from '@playwright/test';

for (const setup of ['deck_rdi1_inn', 'deck_rdi2_inn', 'BAR'])
  test(`combined production lobby starts ${setup} and preserves bilingual reconnect`, async ({
    browser,
  }) => {
    const hostContext = await browser.newContext(),
      guestContext = await browser.newContext();
    const host = await hostContext.newPage(),
      guest = await guestContext.newPage();
    const errors: string[] = [];
    for (const page of [host, guest])
      page.on('pageerror', (error) => errors.push(error.message));
    try {
      await host.goto('/');
      await host.getByLabel('Your name').fill('Combined host');
      await host.getByRole('button', { name: 'Create room' }).click();
      await expect(host.getByRole('status')).toHaveText('Synced');
      await expect(
        host.getByLabel('Your character').locator('option'),
      ).toHaveCount(8);
      await expect(
        host.getByLabel('Drink setup').locator('option'),
      ).toHaveCount(3);
      await host.getByLabel('Drink setup').selectOption(setup);
      const invite = await host.getByLabel('Invite link').inputValue();
      await guest.goto(invite);
      await guest.getByLabel('Your name').fill('Combined guest');
      await guest.getByRole('button', { name: 'Join room' }).click();
      await expect(guest.getByRole('status')).toHaveText('Synced');
      await guest
        .getByLabel('Your character')
        .selectOption({ label: 'Gog the Half-Ogre' });
      await expect(guest.getByLabel('Your character')).toHaveValue(/gog/);
      await host.getByRole('button', { name: 'Start match' }).click();
      await expect(host.locator('.hand-card')).toHaveCount(7);
      await expect(guest.locator('.hand-card')).toHaveCount(7);
      expect(
        (await guest.locator('.hand-card').allTextContents()).join(' '),
      ).not.toMatch(/sample/i);
      const language = guest.getByLabel('Language');
      await language.selectOption('zh-TW');
      await expect(guest.getByRole('status')).toHaveText('已同步');
      await guest.reload();
      await expect(guest.getByRole('status')).toHaveText('已同步');
      await expect(guest.locator('.hand-card')).toHaveCount(7);
      await host.getByRole('button', { name: 'Discard and draw' }).click();
      expect(errors).toEqual([]);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
