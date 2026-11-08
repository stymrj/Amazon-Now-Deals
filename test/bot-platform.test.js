// Bot platform test (Amazon Now) — run: node test/bot-platform.test.js
// Requires bot/platform.js directly and calls fetchPage with a stubbed fetch.
// No network, no Telegram, no real cookies.
const path = require('path');
const platform = require(path.join(__dirname, '..', 'bot', 'platform.js'));
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
const price = v => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') { for (const k of ['value', 'amount', 'text', 'defaultValue']) { const p = price(v[k]); if (p > 0) return p; } return 0; }
  const m = String(v).replace(/,/g, '').match(/\d+(\.\d+)?/);
  return m ? +m[0] : 0;
};
const brandOf = t => (String(t).trim().split(/\s+/)[0] || '').replace(/[^\w&'-]/g, '');
function resp(o) {
  const status = o.status || 200;
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: h => (h.toLowerCase() === 'content-type' ? (o.ct || 'application/json') : null) },
    json: async () => o.json, text: async () => o.text
  };
}
function tezFixture(n, hasMore) {
  const products = [];
  for (let i = 0; i < n; i++) products.push({ asin: 'B0BOT' + String(i).padStart(5, '0'), title: 'Bot Test Atta ' + (i + 1), buyingPrice: { amount: 100 + i }, listPrice: { amount: 200 + i }, savings: { percentage: 50 }, heroImage: { mediumResImageUrl: 'https://example.com/' + i + '.jpg' } });
  return { data: { widgets: [{ data: { products } }], metadata: { hasMoreWidgets: hasMore, nextOffset: 10 } } };
}
const ctx = env => ({ env, fetch: null, sleep: async () => {}, price, brandOf });
const catJob = { g: { name: 'Grocery & Staples', merch: false }, sub: ['204870009031', 'Atta & Flours'] };
const kwJob = { g: { name: 'Grocery (search)' }, sub: ['dal', 'Dal'] };

(async () => {
  console.log('== Amazon bot/platform.js ==');
  // 1. category job: items parsed, .more from metadata.
  let seenUrl = '';
  let c = ctx({ AMAZON_COOKIE: 'ck', AMAZON_BRAND_ID: 'B1' });
  c.fetch = async url => { seenUrl = String(url); return resp({ json: tezFixture(10, true) }); };
  let r = await platform.fetchPage(catJob, 1, c);
  check('category job: 10 items, more=true from metadata', r.length === 10 && r.more === true, 'len ' + r.length);
  check('category job uses tez/browse/category endpoint', seenUrl.indexOf('/tez/browse/category?nodeId=204870009031') !== -1, seenUrl);
  check('discount computed (50%)', r[0].disc === 50 && r[0].url === 'https://www.amazon.in/dp/B0BOT00000');
  // 2. keyword job uses searchByKeyword.
  c.fetch = async url => { seenUrl = String(url); return resp({ json: tezFixture(3, false) }); };
  r = await platform.fetchPage(kwJob, 1, c);
  check('keyword job uses searchByKeyword', seenUrl.indexOf('/tez/browse/searchByKeyword?keyword=dal') !== -1, seenUrl);
  check('keyword job: 3 items, more=false', r.length === 3 && r.more === false);
  // 3. merch node uses the merch endpoint.
  const merchJob = { g: { name: 'Ice Creams & Frozen', merch: true }, sub: ['216450600031', 'Ice Cream Store'] };
  c.fetch = async url => { seenUrl = String(url); return resp({ json: tezFixture(2, false) }); };
  await platform.fetchPage(merchJob, 1, c);
  check('merch node uses tez/browse/merch endpoint', seenUrl.indexOf('/tez/browse/merch?nodeId=216450600031') !== -1, seenUrl);
  // 4. 503 then success: retried.
  let calls = 0;
  c.fetch = async () => { calls++; return calls === 1 ? resp({ status: 503 }) : resp({ json: tezFixture(4, false) }); };
  r = await platform.fetchPage(catJob, 1, c);
  check('503 then success: 4 items after retry', r.length === 4 && calls === 2, 'calls ' + calls);
  // 5. non-JSON response: blocked error (caller stops the run, tells user to refresh cookie).
  c.fetch = async () => resp({ ct: 'text/html', text: '<html>sign in</html>' });
  let threw = null;
  try { await platform.fetchPage(catJob, 1, c); } catch (e) { threw = e; }
  check('non-JSON response throws a blocked error', !!threw && threw.blocked === true, threw && threw.message);

  console.log('\n' + (fail ? 'FAIL: ' + fail + ' check(s) failed, ' + pass + ' passed' : 'PASS: all ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
