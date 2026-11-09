// Regression test for the v2 fetch layer (Amazon Now) — run: node test-results-tab.js
// Loads the real parser/fetch functions out of src/deals.js (relative path), feeds
// them the sample tez payload in fixtures/sample-api.json, and checks that every
// fetched item renders as a card. Also covers the self-test, the /s HTML fallback,
// retry/backoff, error diagnostics, CSV export and unit-price math. No network.
const fs = require('fs'), path = require('path');
const ROOT = __dirname;
const src = fs.readFileSync(path.join(ROOT, 'src/deals.js'), 'utf8');
let pass = 0, fail = 0;
function check(name, ok, extra) {
  if (ok) { pass++; console.log('  ok - ' + name); }
  else { fail++; console.log('  FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}

// ---- stub the browser globals the fetch layer touches at load/call time ----
global.window = { fetch: null };
global.document = { cookie: '', querySelector: () => null, querySelectorAll: () => [], documentElement: { innerHTML: '' } };
global.location = { hostname: 'www.amazon.in', search: '' };
global.sessionStorage = { getItem: () => null, setItem: () => {} };

// ---- load the fetch layer: everything up to the OFFSITE line, plus a store stub ----
const end = src.indexOf('  // Live data can only be read');
if (end < 0) throw new Error('slice anchor missing in src/deals.js');
const head = src.slice(src.indexOf('(function () {'), end);
const lib = eval(head + `
var store = { brandId: 'TESTBRAND1', lat: '28.61', lon: '77.20', groups: [] };
return { extract, normalise, price, first, guessBrand, classifyFetchError, pageResult, extractFromSearchHtml, selfTest, toCSV, fetchPage };
})();`);

// ---- grab unitOf (+ its UNITS table) from the Filtering section ----
function grabFn(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing function ' + name);
  const j = src.indexOf('{', i);
  let depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}
const uStart = src.indexOf('const UNITS =');
const unitsSrc = src.slice(uStart, src.indexOf('};', uStart) + 2);
const unitOf = eval('(function () {\n' + unitsSrc + '\n' + grabFn('unitOf') + '\nreturn unitOf; })();');

// ---- grab the results-tab sort (byDisc) the Best-deals row uses ----
const byDiscMatch = src.match(/const byDisc = (\(a, b\) => [^;]+);/);
if (!byDiscMatch) throw new Error('byDisc missing in src/deals.js');
const byDisc = eval(byDiscMatch[1]);

// ---- response stub ----
function resp(o) {
  const status = o.status || 200;
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: h => (h.toLowerCase() === 'content-type' ? (o.ct || 'application/json') : null) },
    json: async () => o.json, text: async () => o.text
  };
}
// Minimal card render, mirroring the UI card(): one <article class="card"> per product.
function renderCards(products) {
  return products.map(p =>
    '<article class="card"><div class="im" style="background-image:url(\'' + p.img + '\')">' +
    '<span class="dc">' + p.disc + '% OFF</span></div><div class="inf"><a class="ti" href="' + p.url + '">' +
    p.title + '</a><div class="pr"><b>₹' + p.price + '</b><s>₹' + p.mrp + '</s></div></div></article>').join('');
}

(async () => {
  console.log('== 1. parser: 70 valid tez items in, 70 renderable products out ==');
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/sample-api.json'), 'utf8'));
  const items = lib.extract(fixture, 'Test');
  check('extract returns 70 items (5 invalid entries skipped)', items.length === 70, 'got ' + items.length);
  const gate = items.filter(p => p.id && p.title && p.price > 0 && p.mrp >= p.price && p.disc >= 0 && p.disc <= 100 && p.url.indexOf('https://www.amazon.in/dp/') === 0);
  check('all 70 pass the render gate (id/title/price/mrp/disc/url)', gate.length === 70, 'gated ' + gate.length);
  const cards = renderCards(gate);
  check('70 items render as 70 cards', (cards.match(/<article class="card"/g) || []).length === 70);
  check('string buyingPrice parsed (item 6)', items[5].price === 104, 'got ' + items[5].price);
  check('missing listPrice falls back to mrp = price (item 1)', items[0].mrp === items[0].price);
  check('discount computed from prices when savings missing (item 8)', items[7].disc === Math.round((336 - 106) / 336 * 100), 'got ' + items[7].disc);

  console.log('== 2. built-in self-test (same function the sidebar button runs) ==');
  const st = lib.selfTest();
  st.checks.forEach(c => check('self-test: ' + c.name, c.pass === true));
  check('self-test overall ok', st.ok === true);

  console.log('== 3. error diagnostics (blank grid must say why) ==');
  check('503 classified', lib.classifyFetchError(503, '').indexOf('503') !== -1);
  check('403 classified', lib.classifyFetchError(403, '').indexOf('403') !== -1);
  check('non-JSON classified as sign-in/robot-check', lib.classifyFetchError(200, 'text/html').indexOf('robot') !== -1);

  console.log('== 4. CSV export + unit price ==');
  const csv = lib.toCSV(items.slice(0, 2));
  check('CSV has header + 2 rows', csv.split('\n').length === 3 && csv.indexOf('"Title","Brand","Category"') === 0);
  check('unit price: 10 kg', JSON.stringify(unitOf('Test Atta 10 kg')) === JSON.stringify({ base: 'kg', qty: 10 }));
  check('unit price: 500 g = 0.5 kg', unitOf('Sugar 500 g').qty === 0.5);
  check('unit price: 1 L', unitOf('Milk 1 L').base === 'L');

  console.log('== 5. fetchPage with stubbed fetch: retry, metadata paging, /s fallback ==');
  const kwJob = { kind: 'kw', q: 'diwali', g: { name: 'Snacks (search)' } };
  // 5a. tez returns the 70-item page, metadata says more pages exist.
  global.window.fetch = async () => resp({ json: fixture });
  let r = await lib.fetchPage(kwJob, 1, { stop: false });
  check('tez page: 70 items, more=true from metadata', r.length === 70 && r.more === true, 'len ' + r.length + ' more ' + r.more);
  // 5b. tez empty on page 1 -> /s HTML fallback returns cards (sponsored skipped).
  const html = '<div data-asin="B0FB000001" data-component-type="s-search-result"><h2><a><span>Diwali Diya Set</span></a></h2><span data-csa-c-price-to-pay="99" data-csa-c-strike-through-price="329"></span><img class="s-image" src="https://example.com/d1.jpg"></div>'
    + '<div data-asin="B0FB000002"><h2><a><span>Sponsored Diya</span></a></h2><span class="puis-sponsored-label-text">Sponsored</span><span data-csa-c-price-to-pay="10" data-csa-c-strike-through-price="20"></span></div>'
    + '<div data-asin="B0FB000003"><h2><a><span>Diwali Lights Pack</span></a></h2><span class="a-price"><span class="a-offscreen">₹149</span></span><span class="a-price" data-a-strike><span class="a-offscreen">₹499</span></span></div>';
  global.window.fetch = async url => (String(url).indexOf('/s?i=amazontez') !== -1
    ? resp({ ct: 'text/html', text: html })
    : resp({ json: { data: { widgets: [], metadata: { hasMoreWidgets: false } } } }));
  r = await lib.fetchPage(kwJob, 1, { stop: false });
  check('/s fallback: 2 cards (sponsored skipped), 70% off on first', r.length === 2 && r[0].disc === 70, 'len ' + r.length);
  check('/s fallback cards render', (renderCards(r).match(/<article class="card"/g) || []).length === 2);
  // 5c. 503 twice, then success -> retry with backoff recovers.
  let calls = 0;
  global.window.fetch = async () => { calls++; return calls <= 2 ? resp({ status: 503 }) : resp({ json: fixture }); };
  r = await lib.fetchPage(kwJob, 1, { stop: false });
  check('503 x2 then success: 70 items after retry', r.length === 70 && calls === 3, 'calls ' + calls);
  // 5d. 200 + HTML instead of JSON -> error surfaced on the result, not a blank grid.
  global.window.fetch = async () => resp({ ct: 'text/html', text: '<html>sign in</html>' });
  r = await lib.fetchPage(kwJob, 1, { stop: false });
  check('non-JSON response: 0 items + error message attached', r.length === 0 && typeof r.error === 'string' && r.error.length > 10, 'error=' + r.error);
  // 5e. /s robot-check page surfaces its own error.
  global.window.fetch = async url => (String(url).indexOf('/s?i=amazontez') !== -1
    ? resp({ ct: 'text/html', text: '<html>robot check enter the characters you see</html>' })
    : resp({ json: { data: { widgets: [], metadata: { hasMoreWidgets: false } } } }));
  r = await lib.fetchPage(kwJob, 1, { stop: false });
  check('/s robot-check: error surfaced, not a blank grid', r.length === 0 && /robot/i.test(r.error || ''), 'error=' + r.error);

  console.log('== 7. highest-discount fixture: 85-95% off items render, highest first ==');
  const hd = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/sample-high-discount.json'), 'utf8'));
  const hdItems = lib.extract(hd, 'High-discount');
  check('high-discount fixture: all 11 items extracted (none dropped by the parser)', hdItems.length === 11, 'got ' + hdItems.length);
  const byHdId = {}; hdItems.forEach(p => { byHdId[p.id] = p; });
  check('string MRP "₹999" reads as 999, disc 90%', byHdId.B0HD000002.mrp === 999 && byHdId.B0HD000002.disc === 90, 'mrp ' + byHdId.B0HD000002.mrp + ' disc ' + byHdId.B0HD000002.disc);
  check('number MRP 1000 reads as 1000, disc 95%', byHdId.B0HD000003.mrp === 1000 && byHdId.B0HD000003.disc === 95);
  check('max-only prices read .max, disc 90%', byHdId.B0HD000004.price === 100 && byHdId.B0HD000004.disc === 90);
  check('value-keyed prices read .value, disc 88%', byHdId.B0HD000005.price === 120 && byHdId.B0HD000005.disc === 88);
  check('string prices on both sides compute disc 50% (self-test shape)', byHdId.B0HD000007.price === 299 && byHdId.B0HD000007.mrp === 599 && byHdId.B0HD000007.disc === 50);
  check('fraction savings 0.9 reads as 90%, not 0%', byHdId.B0HD000010.disc === 90, 'disc ' + byHdId.B0HD000010.disc);
  check('no MRP and no savings stays disc 0 (no discount signal to invent)', byHdId.B0HD000011.disc === 0);
  // Same gate the UI's filtered() applies: in stock + disc >= minDisc 30.
  const hdVisible = hdItems.filter(p => p.inStock && p.disc >= 30).sort(byDisc);
  check('10 of 11 pass the min-discount-30 gate (only the no-signal item is hidden)', hdVisible.length === 10, 'visible ' + hdVisible.length);
  check('highest discount renders FIRST in the results tab (95% item first)', hdVisible[0].id === 'B0HD000003', 'first ' + hdVisible[0].id);
  const hdCards = renderCards(hdVisible);
  const firstCard = hdCards.split('<article')[1] || '';
  check('first rendered card is the 95% off item', firstCard.indexOf('95% OFF') !== -1 && firstCard.indexOf('High Discount Number MRP Dal 1 kg') !== -1);

  console.log('\n' + (fail ? 'FAIL: ' + fail + ' check(s) failed, ' + pass + ' passed' : 'PASS: all ' + pass + ' checks passed (70 items -> 70 cards)'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
