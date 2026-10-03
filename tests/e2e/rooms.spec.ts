import { expect, test } from '@playwright/test';

test('two browser contexts join a live room, receive private hands, reject stale commands, and resume a seat', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  try {
    const a = await hostContext.newPage(),
      b = await guestContext.newPage();
    for (const page of [a, b]) await page.goto('/');
    const host = await a.evaluate(async () => {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Browser host' }),
      });
      return response.json() as Promise<{
        roomId: string;
        credentials: { roomId: string; playerId: string; resumeToken: string };
      }>;
    });
    const guest = await b.evaluate(async (roomId) => {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Browser guest' }),
      });
      return response.json() as Promise<{
        credentials: { roomId: string; playerId: string; resumeToken: string };
      }>;
    }, host.roomId);
    for (const [page, credentials] of [
      [a, host.credentials],
      [b, guest.credentials],
    ] as const) {
      await page.evaluate(async (credentials) => {
        const socket = new WebSocket(
          `${(globalThis as unknown as { location: { origin: string } }).location.origin.replace('http', 'ws')}/api/rooms/${credentials.roomId}/ws`,
        );
        const messages: Record<string, unknown>[] = [];
        Object.assign(globalThis, { roomProbe: { socket, messages } });
        await new Promise<void>((resolve, reject) => {
          socket.onerror = () => reject(new Error('Socket failed'));
          socket.onopen = () =>
            socket.send(JSON.stringify({ type: 'HELLO', ...credentials }));
          socket.onmessage = (event) => {
            const message = JSON.parse(event.data) as Record<string, unknown>;
            messages.push(message);
            if (message.type === 'PRIVATE_STATE') resolve();
          };
        });
      }, credentials);
    }
    const send = async (page: typeof a, command: Record<string, unknown>) =>
      page.evaluate((command) => {
        const probe = (
          globalThis as unknown as { roomProbe: { socket: WebSocket } }
        ).roomProbe;
        probe.socket.send(JSON.stringify({ type: 'COMMAND', command }));
      }, command);
    await send(a, {
      type: 'START_MATCH',
      roomId: host.roomId,
      commandId: 'command_browser_start',
      expectedStateVersion: 1,
    });
    const snapshot = async (page: typeof a) =>
      page.evaluate(() => {
        const probe = (
          globalThis as unknown as {
            roomProbe: {
              messages: { type: string; view?: Record<string, unknown> }[];
            };
          }
        ).roomProbe;
        return {
          messages: probe.messages,
          public: [...probe.messages]
            .reverse()
            .find((message) => message.type === 'PUBLIC_STATE')?.view,
          private: [...probe.messages]
            .reverse()
            .find((message) => message.type === 'PRIVATE_STATE')?.view,
        };
      });
    await expect
      .poll(async () => (await snapshot(b)).public?.lifecycle)
      .toBe('PLAYING');
    await expect
      .poll(async () => (await snapshot(a)).private?.hand)
      .toHaveLength(7);
    await expect
      .poll(async () => (await snapshot(b)).private?.hand)
      .toHaveLength(7);
    const hostView = await snapshot(a),
      guestView = await snapshot(b);
    expect(hostView.public).toEqual(guestView.public);
    for (const card of hostView.private!.hand as { id: string }[])
      expect(JSON.stringify(guestView.messages)).not.toContain(
        JSON.stringify(card.id),
      );
    expect(JSON.stringify(guestView.messages)).not.toContain('rng');
    await send(a, {
      type: 'DISCARD',
      roomId: host.roomId,
      commandId: 'command_browser_discard',
      expectedStateVersion: 2,
      cardIds: [],
    });
    await expect
      .poll(async () => (await snapshot(b)).public?.phase)
      .toBe('DISCARD_DRAW');
    await send(a, {
      type: 'SKIP_ACTION',
      roomId: host.roomId,
      commandId: 'command_browser_stale',
      expectedStateVersion: 2,
    });
    await expect
      .poll(
        async () =>
          (await snapshot(a)).messages.filter(
            (message) => message.type === 'COMMAND_REJECTED',
          ).length,
      )
      .toBe(1);
    await a.reload();
    await a.evaluate(async (credentials) => {
      const socket = new WebSocket(
        `${(globalThis as unknown as { location: { origin: string } }).location.origin.replace('http', 'ws')}/api/rooms/${credentials.roomId}/ws`,
      );
      const messages: Record<string, unknown>[] = [];
      Object.assign(globalThis, { roomProbe: { socket, messages } });
      await new Promise<void>((resolve, reject) => {
        socket.onerror = () => reject(new Error('Reconnect failed'));
        socket.onopen = () =>
          socket.send(JSON.stringify({ type: 'HELLO', ...credentials }));
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as Record<string, unknown>;
          messages.push(message);
          if (message.type === 'PRIVATE_STATE') resolve();
        };
      });
    }, host.credentials);
    expect((await snapshot(a)).public?.phase).toBe('DISCARD_DRAW');
    expect((await snapshot(a)).private?.playerId).toBe(
      host.credentials.playerId,
    );
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
