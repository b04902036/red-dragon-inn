import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../../src/client/App';

const healthy = { ok: true, service: 'red-dragon-inn' };

describe('home screen', () => {
  it('renders the shell and shows checking until the backend responds', async () => {
    let resolveRequest!: (response: Response) => void;
    const request = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(request);
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Red Dragon Inn', level: 1 }),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Checking backend…');
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', {
      signal: expect.any(AbortSignal),
    });

    await act(async () => {
      resolveRequest(Response.json(healthy));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Backend is healthy');
    expect(screen.getByText('Service: red-dragon-inn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });

  it.each([
    [
      'HTTP failure',
      () => Promise.resolve(new Response('Unavailable', { status: 503 })),
    ],
    ['network failure', () => Promise.reject(new Error('Network unavailable'))],
    ['invalid JSON', () => Promise.resolve(new Response('not json'))],
    ['null payload', () => Promise.resolve(Response.json(null))],
    ['missing fields', () => Promise.resolve(Response.json({}))],
    [
      'unhealthy payload',
      () => Promise.resolve(Response.json({ ...healthy, ok: false })),
    ],
    [
      'unexpected service',
      () => Promise.resolve(Response.json({ ...healthy, service: 'other' })),
    ],
  ])('shows unavailable for %s', async (_name, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Backend is unavailable',
      ),
    );
    expect(
      screen.queryByText('Service: red-dragon-inn'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });

  it('retries and recovers after a failed health check', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(Response.json(healthy));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Backend is unavailable',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Backend is healthy',
      ),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('cancels the pending request when the screen unmounts', () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<App />);
    const options = fetchMock.mock.calls[0]?.[1] as { signal: AbortSignal };

    expect(options.signal.aborted).toBe(false);
    unmount();
    expect(options.signal.aborted).toBe(true);
  });
});
