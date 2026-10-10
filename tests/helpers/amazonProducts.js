export function productUrls(links, searchUrl, limit = 3) {
  const search = new URL(searchUrl);
  if (search.protocol !== 'https:' || !['www.amazon.com', 'www.amazon.com.au'].includes(search.hostname)) {
    throw new Error('Unexpected Amazon search destination');
  }
  const products = new Set();
  for (const { url } of links) {
    let product;
    try { product = new URL(url); } catch { continue; }
    if (product.origin !== search.origin) continue;
    const match = product.pathname.match(/(?:^|\/)dp\/([A-Z0-9]{10})(?:\/|$)/);
    if (match) products.add(`${search.origin}/dp/${match[1]}`);
  }
  return [...products].slice(0, limit);
}
