// Amazon Now: the tez/browse JSON endpoints, with your own session cookie and brand ID.
'use strict';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const first = (...v) => { for (const x of v) { const s = x && typeof x === 'object' ? (x.name || x.displayName || x.text) : x; if (s) return String(s); } return ''; };

function normalise(y, cat, { price, brandOf }) {
  const title = y.title, sell = price(y.buyingPrice && y.buyingPrice.amount);
  if (!title || !sell) return null;
  let mrp = price(y.listPrice && y.listPrice.amount); if (mrp < sell) mrp = sell;
  let disc = y.savings && y.savings.percentage != null ? parseInt(y.savings.percentage, 10) : NaN;
  if (!(disc >= 0)) disc = mrp > sell ? Math.round((mrp - sell) / mrp * 100) : 0;
  return { id: String(y.asin), title: String(title) + (y.packSize ? ' · ' + y.packSize : ''), brand: first(y.brand, y.brandName, y.byLine, y.manufacturer) || brandOf(title), price: sell, mrp, disc, url: 'https://www.amazon.in/dp/' + y.asin, inStock: true, cat };
}
function extract(json, cat, ctx) {
  const out = [], seen = new Set();
  (function walk(o, d) {
    if (!o || typeof o !== 'object' || d > 16) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, d + 1); return; }
    if (o.asin && o.title && o.buyingPrice) { const p = normalise(o, cat, ctx); if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); } return; }
    for (const k in o) walk(o[k], d + 1);
  })(json, 0);
  return out;
}

module.exports = {
  label: 'Amazon Now',
  required: ['AMAZON_COOKIE', 'AMAZON_BRAND_ID'],
  workers: 3,
  pageSize: 8,
  async fetchPage(job, page, ctx) {
    const { env, fetch, sleep } = ctx;
    const offset = (page - 1) * 10;
    if (offset >= 30) return [];
    const [code] = job.sub, bid = encodeURIComponent(env.AMAZON_BRAND_ID);
    const url = /^\d+$/.test(code)
      ? 'https://www.amazon.in/tez/browse/' + (job.g.merch ? 'merch' : 'category') + '?nodeId=' + code + '&brandId=' + bid + '&offset=' + offset
      : 'https://www.amazon.in/tez/browse/searchByKeyword?keyword=' + encodeURIComponent(code) + '&brandId=' + bid + '&offset=' + offset + '&spellCorrectionDisabled=false';
    await sleep(400 + Math.random() * 600);
    for (let a = 0; a < 4; a++) {
      const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA, referer: 'https://www.amazon.in/tez/browse/home', cookie: env.AMAZON_COOKIE } });
      if (r.status === 429 || r.status === 503) { await sleep(4000 * (a + 1)); continue; }
      if (r.status === 401 || r.status === 403) throw Object.assign(new Error(`Amazon refused the session (HTTP ${r.status}). Refresh AMAZON_COOKIE.`), { blocked: true });
      if (!r.ok) return [];
      const ct = r.headers.get('content-type') || '';
      if (ct.indexOf('json') < 0) throw Object.assign(new Error('Amazon returned a web page instead of data (signed out or a robot check). Refresh AMAZON_COOKIE.'), { blocked: true });
      return extract(await r.json(), job.g.name + ' › ' + job.sub[1], ctx);
    }
    throw new Error('rate limited');
  }
};
