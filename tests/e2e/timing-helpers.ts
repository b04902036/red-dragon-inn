import { expect, type Page } from '@playwright/test';
import { roomMetadataSchema } from '../../src/protocol/rooms';
export async function passPhaseEnd(pages: Page[], roomId: string) {
  for (let limit = 0; limit <= 4; limit++) {
    const response = await pages[0]!.request.get(`/api/rooms/${roomId}`);
    const view = roomMetadataSchema.parse(await response.json()).view;
    if (!view.phaseEnd || view.responseWindow) return;
    const owner = view.players.find(
      (p) => p.id === view.phaseEnd!.priorityPlayerId,
    )!;
    const page = pages[owner.seat]!;
    const button = page.getByRole('button', {
      name: /^(Pass Anytime|跳過隨時牌)$/,
    });
    await expect(button).toBeEnabled();
    await button.click();
    await expect
      .poll(
        async () =>
          roomMetadataSchema.parse(
            await (await page.request.get(`/api/rooms/${roomId}`)).json(),
          ).view.version,
      )
      .toBeGreaterThan(view.version);
  }
  throw new Error('Phase-end passes did not complete');
}
