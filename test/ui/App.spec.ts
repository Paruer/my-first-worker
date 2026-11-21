import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../../src/ui/App.svelte';

afterEach(() => vi.unstubAllGlobals());

it('starts at zero and displays the latest reply after each call', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response('First reply')).mockResolvedValueOnce(new Response('Second reply'));
  vi.stubGlobal('fetch', fetch);
  render(App);

  const button = screen.getByRole('button', { name: 'Call worker' });
  expect(screen.getByText('Count: 0')).toBeDefined();
  expect(fetch).not.toHaveBeenCalled();

  await fireEvent.click(button);
  expect(await screen.findByText('First reply')).toBeDefined();
  expect(screen.getByText('Count: 1')).toBeDefined();

  await fireEvent.click(button);
  expect(await screen.findByText('Second reply')).toBeDefined();
  expect(screen.queryByText('First reply')).toBeNull();
  expect(screen.getByText('Count: 2')).toBeDefined();
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/message', '/api/message']);
});

it('disables the button while waiting and allows retry after a network failure', async () => {
  let rejectRequest!: (error: Error) => void;
  const pending = new Promise<Response>((_, reject) => {
    rejectRequest = reject;
  });
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(new Response('Recovered')));
  render(App);

  const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Call worker' });
  await fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(screen.getByText('Count: 1')).toBeDefined();

  rejectRequest(new Error('Offline'));
  expect(await screen.findByText('Could not reach the Worker.')).toBeDefined();
  expect(button.disabled).toBe(false);

  await fireEvent.click(button);
  expect(await screen.findByText('Recovered')).toBeDefined();
  expect(screen.getByText('Count: 2')).toBeDefined();
});
