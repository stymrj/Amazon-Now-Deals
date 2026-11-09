// Bot platform test (Amazon Now) — run: node test/bot-platform.test.js
// Requires bot/platform.js directly and calls fetchPage with a stubbed fetch.
// No network, no Telegram, no real cookies.
const path = require('path');
const platform = require(path.join(__dirname, '..', 'bot', 'platform.js'));
// The production price() from bot/core.js (the ctx the bot actually runs
// with) — the test must exercise the real function, not a copy of it.
const { price } = require(path.join(__dirname, '..', 'bot', 'core.js'));
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
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

  // 6. highest-discount edge shapes: string MRP, max-only and value-keyed
  // prices, fraction savings — all must parse with their true discounts.
  const edge = { data: { widgets: [{ data: { products: [
    { asin: 'B0HD000002', title: 'Bot String MRP Rice 1 kg', buyingPrice: { amount: 99 }, listPrice: '₹999', heroImage: {} },
    { asin: 'B0HD000004', title: 'Bot Max Price Oil 1 L', buyingPrice: { max: 100 }, listPrice: { max: 1000 }, heroImage: {} },
    { asin: 'B0HD000005', title: 'Bot Value Price Ghee 1 L', buyingPrice: { value: 120 }, listPrice: { value: 1000 }, heroImage: {} },
    { asin: 'B0HD000010', title: 'Bot Fraction Savings Coffee 200 g', buyingPrice: { amount: 100 }, listPrice: { amount: 1000 }, savings: { percentage: 0.9 }, heroImage: {} }
  ] } }], metadata: { hasMoreWidgets: false } } };
  c.fetch = async () => resp({ json: edge });
  r = await platform.fetchPage(catJob, 1, c);
  check('bot edge shapes: all 4 items extracted', r.length === 4, 'len ' + r.length);
  const edgeById = {}; r.forEach(p => { edgeById[p.id] = p; });
  check('bot string MRP: disc 90%', (edgeById.B0HD000002 || {}).disc === 90, 'disc ' + (edgeById.B0HD000002 || {}).disc);
  check('bot max-only prices: disc 90%', (edgeById.B0HD000004 || {}).disc === 90);
  check('bot value-keyed prices: disc 88%', (edgeById.B0HD000005 || {}).disc === 88);
  check('bot fraction savings 0.9: disc 90%', (edgeById.B0HD000010 || {}).disc === 90);

  console.log('\n' + (fail ? 'FAIL: ' + fail + ' check(s) failed, ' + pass + ' passed' : 'PASS: all ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
