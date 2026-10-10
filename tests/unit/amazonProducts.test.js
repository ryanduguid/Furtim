import { productUrls } from '../helpers/amazonProducts.js';

test.each(['www.amazon.com', 'www.amazon.com.au'])('collects unique same-store ASINs on %s', hostname => {
  const origin = `https://${hostname}`;
  const links = [
    `${origin}/a-title/dp/B0C7BKZ883?ref=search`,
    `${origin}/dp/B0C7BKZ883`,
    `${origin}/dp/B000000001/`,
    `${origin}/-/en/title/dp/B000000002`,
    `${origin}/dp/B000000003`,
  ].map(url => ({ url }));
  expect(productUrls(links, `${origin}/s?k=laptop+stand`)).toEqual([
    `${origin}/dp/B0C7BKZ883`, `${origin}/dp/B000000001`, `${origin}/dp/B000000002`,
  ]);
});

test('rejects malformed IDs, cross-store and unexpected-origin links', () => {
  const links = [
    'not a URL', 'javascript:alert(1)',
    'https://www.amazon.com.au/dp/B0C7BKZ883',
    'https://www.amazon.com.evil.test/dp/B0C7BKZ883',
    'http://www.amazon.com/dp/B0C7BKZ883',
    'https://www.amazon.com/dp/B0C7BKZ883extra',
    'https://www.amazon.com/dp/short',
    'https://www.amazon.com/s?next=/dp/B0C7BKZ883',
  ].map(url => ({ url }));
  expect(productUrls(links, 'https://www.amazon.com/s?k=stand')).toEqual([]);
  expect(() => productUrls([], 'https://www.amazon.com.evil.test/s')).toThrow();
  expect(() => productUrls([], 'http://www.amazon.com/s')).toThrow();
});
