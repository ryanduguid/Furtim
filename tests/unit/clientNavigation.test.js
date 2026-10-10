import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { createClient } from '../helpers/client.js';
import { expectGoogleSearch } from '../helpers/searchResult.js';

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('navigation client', () => {
  test('waits beyond the server navigation deadline instead of aborting at 30 seconds', async () => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(Response.json({ ok: true })), 35000);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      }, { once: true });
    }));
    const client = createClient('http://localhost');
    client.timeout = 30000;
    const pending = client.navigate('tab', 'https://example.com').then(
      result => result, error => ({ error: error.message }),
    );
    await jest.advanceTimersByTimeAsync(35000);
    expect(await pending).toEqual({ ok: true });
  });

  test('keeps an explicit deadline while consuming the response body', async () => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, { signal }) => ({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      }),
    }));
    const pending = createClient('http://localhost').navigate('tab', 'https://example.com', { timeout: 50 })
      .catch(error => error.message);
    await jest.advanceTimersByTimeAsync(50);
    expect(await pending).toMatch(/Request timeout after 50ms/);
  });

  test('takes a fresh snapshot before one retry of a declared navigation race', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ code: 'navigation_race', recovery: 'snapshot_then_retry' }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ snapshot: 'loaded' }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    expect(await createClient('http://localhost').navigate('tab', '@google_search hello & world')).toEqual({ ok: true });
    expect(fetch.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      '/tabs/tab/navigate', '/tabs/tab/snapshot', '/tabs/tab/navigate',
    ]);
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[2][1].body);
  });

  test.each([
    [409, { code: 'navigation_race', recovery: 'snapshot_then_retry' }, 3],
    [409, { code: 'other', recovery: 'snapshot_then_retry' }, 1],
    [500, { code: 'navigation_race', recovery: 'snapshot_then_retry' }, 1],
    [400, { error: 'invalid URL' }, 1],
  ])('propagates a persistent or non-recoverable error (HTTP %s)', async (status, body, calls) => {
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async url =>
      Response.json(new URL(url).pathname.endsWith('/snapshot') ? { snapshot: 'loaded' } : body, { status: new URL(url).pathname.endsWith('/snapshot') ? 200 : status }),
    );
    await expect(createClient('http://localhost').navigate('tab', 'https://example.com')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});

describe('search navigation assertions', () => {
  const result = { ok: true, url: 'https://duckduckgo.com/?q=hello+%26+world', searchEngine: 'duckduckgo', fallbackFrom: 'google', navigationOk: true };
  test('accepts a declared successful fallback with the exact decoded query', () => {
    expectGoogleSearch(result, 'hello & world');
    expectGoogleSearch({ ok: true, url: 'https://www.google.com/search?q=hello%20%26%20world' }, 'hello & world');
  });
  test.each([
    { ...result, ok: false },
    { ...result, fallbackFrom: undefined },
    { ...result, navigationOk: false },
    { ...result, url: 'https://duckduckgo.com/?q=other' },
    { ...result, url: 'https://duckduckgo.com.evil.test/?q=hello+%26+world' },
    { ...result, url: 'http://duckduckgo.com/?q=hello+%26+world' },
  ])('rejects failure, wrong query or unexpected destination', candidate => {
    expect(() => expectGoogleSearch(candidate, 'hello & world')).toThrow();
  });
});
