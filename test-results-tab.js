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

  console.log('\n' + (fail ? 'FAIL: ' + fail + ' check(s) failed, ' + pass + ' passed' : 'PASS: all ' + pass + ' checks passed (70 items -> 70 cards)'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e); process.exit(1); });
