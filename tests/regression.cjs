// Run with: node --test tests/regression.cjs
// A DOM/event fixture and virtual clock exercise the shipped scripts without network access.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function clock() {
  let now = 1788739200000, nextId = 0;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) { const id = ++nextId; tasks.set(id, {fn, at: now + delay}); return id; },
    clearTimeout(id) { tasks.delete(id); },
    async tick(ms) {
      const end = now + ms; await flush();
      for (;;) {
        const next = [...tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; tasks.delete(next[0]); next[1].fn(); await flush();
      }
      now = end; await flush();
    },
    pending: () => tasks.size
  };
}
function world({loadLocation = true, storage = new Map(), blockedStorage = false, geolocation, fetcher, runtime = 'checker-20260907.js'} = {}) {
  const time = clock(), nodes = new Map(), errors = [], geoCalls = [], requests = [];
  function element(id = '') {
    const el = {id, className: '', value: '', children: [], disabled: false, attrs: {}, events: {}, textContent: '', focus() {}, blur() {},
      appendChild(child) { this.children.push(child); },
      addEventListener(name, fn) { this.events[name] = fn; },
      setAttribute(name, value) { this.attrs[name] = value; },
      removeAttribute(name) { delete this.attrs[name]; }};
    el.classList = {add: name => { el.className += ' ' + name; }, remove: name => { el.className = el.className.split(/\s+/).filter(x => x !== name).join(' '); }, contains: name => el.className.split(/\s+/).includes(name)};
    let html = '';
    Object.defineProperty(el, 'innerHTML', {get: () => html, set(value) { html = value; el.children = []; parseIds(value); }});
    if (id) nodes.set(id, el);
    return el;
  }
  function parseIds(html) {
    for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
      const el = element(match[1]); el.className = match[0].match(/class="([^"]*)"/)?.[1] || '';
    }
  }
  parseIds(read('index.html')); nodes.get('radiusSelect').value = '250';
  const geo = geolocation || {getCurrentPosition(ok, fail, options) { geoCalls.push({ok, fail, options}); }};
  const sandbox = {
    document: {getElementById: id => nodes.get(id) || null, createElement: () => element(), head: element(), body: element(), activeElement: null},
    navigator: {geolocation: geo, clipboard: {writeText: async () => {}}},
    localStorage: {getItem: key => { if (blockedStorage) throw Error('blocked'); return storage.get(key) ?? null; }, setItem: (key, value) => { if (blockedStorage) throw Error('blocked'); storage.set(key, value); }},
    console: {error: error => errors.push(error), warn() {}},
    AbortController, DOMException, Blob, URL,
    Date: class extends Date { static now() { return time.now(); } },
    setTimeout: time.setTimeout, clearTimeout: time.clearTimeout,
    requestIdleCallback() {}, scrollTo() {}, addEventListener() {},
    fetch: (url, options) => { requests.push({url, options}); return fetcher ? fetcher(url, options, requests.length) : new Promise(() => {}); }
  };
  sandbox.window = sandbox; vm.createContext(sandbox);
  for (const name of ['audit-data-20260906.js', 'local-stores-20260907.js']) vm.runInContext(read(name), sandbox, {filename: name});
  if (loadLocation) vm.runInContext(read('location-search-20260907.js'), sandbox, {filename: 'location-search-20260907.js'});
  const script = read(runtime).replace('setupEvents();renderQuick();', 'window.__test={STORE_DATA,renderPayment,paymentOrder,comparisonRate,buildCandidatesFromOsm,matchStoreFromText};setupEvents();renderQuick();');
  vm.runInContext(script, sandbox, {filename: runtime});
  assert.equal(errors.length, 0, errors.map(String).join('\n'));
  assert.equal(sandbox.PAYMENT_CHECKER_READY, true);
  return {sandbox, time, errors, nodes, geoCalls, requests, storage, api: sandbox.__test,
    store: name => sandbox.__test.STORE_DATA.find(s => s.store === name),
    start: () => nodes.get('geoBtn').onclick(),
    manual(name) { nodes.get('manualSearch').value = name; nodes.get('searchForm').onsubmit({preventDefault() {}}); },
    pos(accuracy = 20, lat = 35.558, lng = 139.579) { return {coords: {latitude: lat, longitude: lng, accuracy}, timestamp: time.now()}; }
  };
}
const shops = {elements: [{type: 'node', id: 1, lat: 35.558, lon: 139.579, tags: {name: 'マルエツ 中川駅前店', shop: 'supermarket'}}]};
const response = data => ({ok: true, json: async () => data});

test('audit fixes sparse records, keeps unknowns and excludes non-earning Rakuten cash routes', () => {
  const w=world(), data=w.sandbox.PAYMENT_AUDIT_DATA;
  for (const [name,ids] of [['天狗',['paypay','dpay','aupay','card']],['ビッグヨーサン',['paypay','dpay','card']],['サミット',['paypay','rakuten']],['ハックドラッグ',['paypay','rakuten','dpay','aupay','famipay','aeonGroup']]]) {
    for (const id of ids) assert.ok(w.store(name).payments.some(p=>p.id===id),name+':'+id);
  }
  for (const name of data.paymentAudit.excludedRakuten) {
    const s=w.store(name);
    assert.ok(!s.payments.some(p=>p.id==='rakuten'),name);
    assert.equal(s.payments.find(p=>p.id==='rakutenReview').rankable,false,name);
    assert.equal(s.payments.find(p=>p.id==='rakutenReview').r,'0%',name);
    assert.equal(s.payments.find(p=>p.id==='rakutenCard').r,'1.0%',name);
  }
  for (const s of w.api.STORE_DATA) {
    assert.equal(s.local.checks.length,6,s.store);
    assert.equal(new Set(s.payments.map(p=>p.id)).size,s.payments.length,s.store);
    assert.ok(s.audit.sources.every(k=>data.sources[k]),s.store);
    assert.ok(!s.audit.missing.some(t=>t.startsWith('未確認の決済：')),s.store);
  }
  assert.match(w.store('ビッグヨーサン').local.scopeHint,/横浜都筑店/);
  assert.match(w.store('ビッグヨーサン').local.checks.find(c=>c.name==='楽天ペイ').state,/未確認/);
  assert.match(w.store('マイカリー食堂').payments.find(p=>p.id==='famipay').x,/券売機・セルフレジ/);
  assert.equal(w.store('横浜家').payments.length,0);
  assert.equal(w.store('ヨドバシカメラ').payments.length,0);
  assert.equal(w.store('松弁ネット/松屋モバイルオーダー').payments.length,1);
});

test('actual coupon runtime renders all 141 stores even when the coupon network fails', async () => {
  const w=world({runtime:'checker-20260907-autocoupons.js',fetcher:async()=>{throw Error('offline');}});
  await flush();
  for(const s of w.api.STORE_DATA) {
    w.api.renderPayment(s);
    assert.ok(w.nodes.get('result').innerHTML.includes(s.store.replaceAll('&','&amp;')),s.store);
  }
  for(const name of ['天狗','ビッグヨーサン','サミット','セリア','ヨークフーズ']) {
    w.manual(name);assert.ok(w.nodes.get('result').innerHTML.includes(name),name);
  }
  assert.equal(w.errors.length,0,w.errors.map(String).join('\n'));
});

test('all entrypoints have valid script integrity and keep the colorful design', () => {
  for (const name of ['index.html', 'app-v2.html', 'app-v3.html']) {
    const html = read(name);
    assert.match(html, /いまのお店、何で払う？/);
    for (const color of ['#ff4fa3', '#ffe45c', '#4ac7ff', '#60f09b']) assert.ok(html.includes(color));
    const scripts = [...html.matchAll(/<script defer src="\.\/([^"?]+)(?:\?[^" ]+)?" integrity="sha384-([^"]+)"/g)];
    assert.equal(scripts.length, 4);
    assert.deepEqual(scripts.map(m => m[1]), ['audit-data-20260906.js','local-stores-20260907.js','location-search-20260907.js','checker-20260907-autocoupons.js']);
    for (const [, file, digest] of scripts) assert.equal(crypto.createHash('sha384').update(read(file)).digest('base64'), digest, file);
  }
  assert.equal(read('index.html'), read('app-v2.html')); assert.equal(read('index.html'), read('app-v3.html'));
});

test('141 stores render, original rates and PayPay tie ordering survive, list is lazy', () => {
  const w = world(); assert.equal(w.sandbox.PAYMENT_STORE_COUNT, 141);
  assert.equal(w.nodes.get('storeList').children.length, 0); assert.equal(w.nodes.get('quickStores').children.length, 5);
  for (const store of w.api.STORE_DATA) {
    const top = store.payments.filter(p => p.rankable).sort(w.api.paymentOrder);
    for (const p of top) {
      if (p.n === 'PayPay') assert.equal(p.r, '1.5%');
      if (p.n === '三菱UFJカード') assert.equal(p.r, '12.5%');
      if (p.id === 'olive') assert.equal(p.r, '8%');
      if (p.id === 'rakuten') assert.equal(p.r, '1.5%');
    }
    if (top.some(p => p.id === 'paypay') && top.some(p => p.id === 'rakuten')) assert.ok(top.findIndex(p => p.id === 'paypay') < top.findIndex(p => p.id === 'rakuten'));
    w.api.renderPayment(store); assert.ok(w.nodes.get('result').innerHTML.includes(store.store.replaceAll('&', '&amp;')));
  }
  w.manual('コーナン'); assert.match(w.nodes.get('result').innerHTML, /point-pill">楽天 <strong>税抜0.5%/);
  w.manual('ファミマ'); assert.match(w.nodes.get('result').innerHTML, /pay-name">楽天ペイ/);
  assert.equal(w.errors.length, 0);
});

test('Maruetsu accepts manual/nearby aliases, ranks confirmed payments and separates presentation', () => {
  const w = world(); w.manual('まるえつ'); const store = w.store('マルエツ');
  assert.equal(store.payments.slice().sort(w.api.paymentOrder)[0].n, 'PayPay');
  assert.ok(!store.payments.some(p => ['rakuten', 'famipay'].includes(p.id)));
  assert.equal(store.points.length, 1); assert.equal(store.points[0].n, 'WAON POINT'); assert.equal(store.points[0].r, '税抜0.5%');
  assert.ok(store.payments.every(p => p.ownerRate === 0));
  assert.match(store.note, /オーナーズカードはマルエツでは対象外/);
  assert.equal(w.api.matchStoreFromText('マルエツ 中川駅前店').store.store, 'マルエツ');
  assert.equal(w.api.matchStoreFromText('マルエツ 魚悦糀谷店'), null);
});

test('owners rate changes apply to eligible payments, both Aeon brands, copy summaries and saved preference', () => {
  const w = world(); w.manual('イオン');
  assert.match(w.nodes.get('result').innerHTML, /確認済みの返金率3%で比較/);
  assert.match(w.nodes.get('result').innerHTML, /決済 1.0% ＋ 株主優待 3.0%/);
  assert.equal(w.api.comparisonRate(w.store('イオン').payments[0]), 4);
  w.nodes.get('ownersRate').onchange({target: {value: '5'}});
  for (const name of ['イオン', 'イオンスタイル']) { assert.equal(w.api.comparisonRate(w.store(name).payments[0]), 6); assert.match(w.store(name).first, /6.0%/); }
  assert.ok(w.api.STORE_DATA.filter(s => !s.local.aeonOwners).every(s => s.payments.every(p => !p.ownerRate)));
  const restored = world({storage: w.storage}); restored.manual('イオン'); assert.match(restored.nodes.get('result').innerHTML, /6.0%/);
  restored.nodes.get('ownersRate').onchange({target: {value: '0'}}); assert.equal(restored.api.comparisonRate(restored.store('イオン').payments[0]), 1);
  assert.equal(restored.store('イオン').payments[1].ownerRate, 0);
});

test('owners benefits use brand and route allowlists in both shipped runtimes', () => {
  for (const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']) {
    const w=world({runtime,storage:new Map([['payment-checker-aeon-owners-rate','5']])});
    for(const name of ['イオン','イオンスタイル','まいばすけっと','ダイエー','イオンフードスタイル','グルメシティ','マックスバリュ','ピーコックストア','ビッグ・エー','ザ・ビッグ']) {
      const store=w.store(name);w.manual(name);
      assert.match(w.nodes.get('result').innerHTML,/イオン株主優待：返金対象/);
      assert.equal(store.payments.find(p=>p.id==='aeonGroup').ownerRate,5);
      assert.match(store.first,/6.0%/);
    }
    for(const name of ['マルエツ','ミニストップ','ウエルシア','ハックドラッグ','ベルク']) {
      w.manual(name);assert.match(w.nodes.get('result').innerHTML,/イオン株主優待：/);
      assert.doesNotMatch(w.nodes.get('result').innerHTML,/id="ownersRate"/);
      assert.ok(w.store(name).payments.every(p=>p.ownerRate===0));
    }
    assert.equal(w.api.matchStoreFromText('イオンモールの専門店'),null);
    assert.equal(w.api.matchStoreFromText('まいばすけっと 北山田駅前店').store.store,'まいばすけっと');
    w.manual('まいばすけっと');assert.match(w.nodes.get('result').innerHTML,/返金引換証の換金を扱いません/);
    // A higher-rate ineligible route must never inherit the store's cashback in its summary.
    const store=w.store('イオン');store.payments.push({...w.store('マルエツ').payments.find(p=>p.id==='paypay'),r:'10%'});
    w.manual('イオン');w.nodes.get('ownersRate').onchange({target:{value:'5'}});
    assert.match(store.first,/PayPay/);assert.match(store.combination,/株主優待の返金を加算していません/);
    assert.equal(store.payments.find(p=>p.id==='paypay').ownerRate,0);
    // Even confirmed AEON Pay acceptance does not override a cash-only eligibility rule.
    store.local.ownerPaymentIds=['cash'];w.nodes.get('ownersRate').onchange({target:{value:'7'}});
    assert.equal(store.payments.find(p=>p.id==='aeonGroup').ownerRate,0);
    assert.equal(store.payments.find(p=>p.id==='cash').ownerRate,7);
  }
});

test('missing optional location script and denied local storage cannot block manual search', async () => {
  const w = world({loadLocation: false, blockedStorage: true}); await w.start();
  assert.match(w.nodes.get('status').innerHTML, /店名検索はそのまま/);
  w.manual('マルエツ'); assert.match(w.nodes.get('result').innerHTML, /pay-name">PayPay/);
});

test('permission denial ends location immediately without network calls', async () => {
  const w = world(); const running = w.start(); w.geoCalls[0].fail({code: 1}); await running;
  assert.equal(w.geoCalls.length, 1); assert.equal(w.requests.length, 0); assert.equal(w.time.pending(), 0);
  assert.match(w.nodes.get('status').innerHTML, /許可されていません/); w.manual('ベルク'); assert.match(w.nodes.get('result').innerHTML, /ベルク/);
});

test('a browser that never calls back stops within 4.5 seconds; late callbacks cannot overwrite manual results', async () => {
  const w = world(); const running = w.start();
  await w.time.tick(4500); await running; assert.equal(w.geoCalls.length, 2); assert.equal(w.time.pending(), 0);
  assert.equal(w.nodes.get('geoBtn').attrs['aria-busy'], undefined);
  w.manual('コーナン'); const html = w.nodes.get('result').innerHTML;
  for (const call of w.geoCalls) call.ok(w.pos()); await flush();
  assert.equal(w.requests.length, 0); assert.equal(w.nodes.get('result').innerHTML, html);
});

test('accurate location uses the fast path and repeat nearby searches reuse data', async () => {
  const w = world({fetcher: async () => response(shops)}); const running = w.start();
  assert.equal(w.geoCalls[0].options.enableHighAccuracy, false); w.geoCalls[0].ok(w.pos()); await running;
  assert.equal(w.requests.length, 1); assert.equal(w.nodes.get('bubbles').children.length, 1); assert.equal(w.time.pending(), 0);
  await w.start(); assert.equal(w.requests.length, 1); assert.equal(w.geoCalls.length, 1);
  assert.match(w.nodes.get('status').innerHTML, /直近の周辺データ/);
  w.nodes.get('radiusSelect').value = '500'; await w.start(); assert.equal(w.requests.length, 2);
});

test('imprecise location is refined and is not presented as a precise nearby result', async () => {
  const w = world(); const running = w.start(); w.geoCalls[0].ok(w.pos(1500)); await flush();
  assert.equal(w.geoCalls[1].options.enableHighAccuracy, true); await w.time.tick(4500); await running;
  assert.equal(w.requests.length, 0); assert.match(w.nodes.get('status').innerHTML, /誤差が約1500m/);
  assert.ok(!w.nodes.get('quickPanel').classList.contains('hidden'));
});

test('slow first Overpass endpoint starts backup at 800ms and cancels losing request', async () => {
  const w = world({fetcher: (_u, _o, n) => n === 1 ? new Promise(() => {}) : Promise.resolve(response(shops))});
  const running = w.start(); w.geoCalls[0].ok(w.pos()); await flush();
  await w.time.tick(799); assert.equal(w.requests.length, 1); await w.time.tick(1); await running;
  assert.equal(w.requests.length, 2); assert.equal(w.requests[0].options.signal.aborted, true); assert.equal(w.time.pending(), 0);
  assert.equal(w.nodes.get('bubbles').children.length, 1);
});

test('both stalled Overpass endpoints stop after 5 seconds and leave search usable', async () => {
  const w = world(); const running = w.start(); w.geoCalls[0].ok(w.pos()); await flush(); await w.time.tick(5000); await running;
  assert.equal(w.requests.length, 2); assert.ok(w.requests.every(r => r.options.signal.aborted)); assert.equal(w.time.pending(), 0);
  assert.match(w.nodes.get('status').innerHTML, /周辺店舗を取得できません/); w.manual('イオン'); assert.match(w.nodes.get('result').innerHTML, /オーナーズカード/);
});

test('manual search aborts outstanding requests and ignores a delayed server response', async () => {
  let resolveFetch;
  const w = world({fetcher: () => new Promise(resolve => { resolveFetch = resolve; })});
  const running = w.start(); w.geoCalls[0].ok(w.pos()); await flush(); w.manual('ファミマ'); const html = w.nodes.get('result').innerHTML;
  assert.equal(w.requests[0].options.signal.aborted, true); resolveFetch(response(shops)); await running; await w.time.tick(10000);
  assert.equal(w.nodes.get('result').innerHTML, html); assert.equal(w.requests.length, 1); assert.equal(w.time.pending(), 0);
});

test('tap to cancel stops location, and the next search can succeed', async () => {
  const w = world({fetcher: async () => response(shops)}); const first = w.start(); await w.start(); await first;
  assert.match(w.nodes.get('status').innerHTML, /検索を中止/); assert.equal(w.time.pending(), 0);
  const next = w.start(); w.geoCalls[1].ok(w.pos()); await next; assert.equal(w.nodes.get('bubbles').children.length, 1);
});

test('partial or malformed Overpass results use the second endpoint, not an incomplete recommendation', async () => {
  const w = world({fetcher: async (_u, _o, n) => response(n === 1 ? {elements: shops.elements, remark: 'runtime timeout'} : shops)});
  const running = w.start(); w.geoCalls[0].ok(w.pos()); await running;
  assert.equal(w.requests.length, 2); assert.equal(w.nodes.get('bubbles').children.length, 1);
});

test('cached padding is filtered by requested radius, branch matching and output escaping', () => {
  const w = world();
  const data = {elements: [...shops.elements, {type:'node',id:2,lat:35.56,lon:139.579,tags:{name:'ローソン'}}, {type:'node',id:3,lat:35.558,lon:139.579,tags:{name:'カルディ 他支店'}}]};
  const result = w.api.buildCandidatesFromOsm(data,35.558,139.579,120); assert.equal(result.length,1);
  assert.equal(w.api.matchStoreFromText('ベルクス'),null);
  const context = {...result[0],osmName:'マルエツ <img src=x onerror=alert(1)>'};w.api.renderPayment(context.store,context);
  assert.ok(!w.nodes.get('result').innerHTML.includes('<img'));assert.match(w.nodes.get('result').innerHTML,/&lt;img/);
});
