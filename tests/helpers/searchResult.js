import { expect } from '@jest/globals';

export function expectGoogleSearch(result, query) {
  expect(result.ok).toBe(true);
  const url = new URL(result.url);
  expect(url.protocol).toBe('https:');
  const engine = result.searchEngine || 'google';
  const hosts = { google: 'www.google.com', duckduckgo: 'duckduckgo.com', bing: 'www.bing.com' };
  expect(url.hostname).toBe(hosts[engine]);
  expect(url.searchParams.get('q')).toBe(query);
  if (engine === 'google') {
    expect(url.pathname).toBe('/search');
    expect(result.fallbackFrom).toBeUndefined();
  } else {
    expect(result.fallbackFrom).toBe('google');
    expect(result.navigationOk).toBe(true);
  }
}
