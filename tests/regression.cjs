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
function clock(start = 1788739200000) {
  let now = start, nextId = 0;
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
function world({loadLocation = true, storage = new Map(), blockedStorage = false, geolocation, fetcher, runtime = 'checker-20260907.js', now, skipData = []} = {}) {
  const time = clock(now), nodes = new Map(), errors = [], geoCalls = [], requests = [], windowEvents = {};
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
    requestIdleCallback() {}, scrollTo() {}, addEventListener(name, fn) { (windowEvents[name] ||= []).push(fn); },
    fetch: (url, options) => { requests.push({url, options}); return fetcher ? fetcher(url, options, requests.length) : new Promise(() => {}); }
  };
  sandbox.window = sandbox; vm.createContext(sandbox);
  for (const name of DATA_FILES) if (!skipData.includes(name)) vm.runInContext(read(name), sandbox, {filename: name});
  if (loadLocation) vm.runInContext(read('location-search-20260907.js'), sandbox, {filename: 'location-search-20260907.js'});
  const script = read(runtime).replace('setupEvents();renderQuick();', 'window.__test={STORE_DATA,renderPayment,paymentOrder,comparisonRate,comparisonLabel,buildCandidatesFromOsm,matchStoreFromText,refreshStoreSummary,officialRateShort,officialRateNote,couponState:typeof couponState===\'function\'?couponState:null,loadPublicCoupons:typeof loadPublicCoupons===\'function\'?loadPublicCoupons:null};setupEvents();renderQuick();');
  vm.runInContext(script, sandbox, {filename: runtime});
  assert.equal(errors.length, 0, errors.map(String).join('\n'));
  assert.equal(sandbox.PAYMENT_CHECKER_READY, true);
  return {sandbox, time, errors, nodes, geoCalls, requests, storage, windowEvents, api: sandbox.__test,
    store: name => sandbox.__test.STORE_DATA.find(s => s.store === name),
    start: () => nodes.get('geoBtn').onclick(),
    manual(name) { nodes.get('manualSearch').value = name; nodes.get('searchForm').onsubmit({preventDefault() {}}); },
    pos(accuracy = 20, lat = 35.558, lng = 139.579) { return {coords: {latitude: lat, longitude: lng, accuracy}, timestamp: time.now()}; }
  };
}
const DATA_FILES = ['audit-data-20260906.js', 'local-stores-20260907.js', 'stores-20260911.js', 'malls-20260913.js', 'rates-20261102.js'];
const shops = {elements: [{type: 'node', id: 1, lat: 35.558, lon: 139.579, tags: {name: 'マルエツ 中川駅前店', shop: 'supermarket'}}]};
const response = data => ({ok: true, json: async () => data});

test('Kohnan balance preference stays separate from numeric rewards and resets with a new session', () => {
  for (const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']) {
    const w=world({runtime});
    w.manual('コーナンPay');
    const shop=w.store('コーナン');
    assert.equal(shop.payments.find(p=>p.id==='kohnanMoney').rankable,false);
    assert.match(shop.first,/PayPay/);
    w.nodes.get('kohnanPriority').onchange({target:{value:'balance'}});
    assert.match(w.nodes.get('result').innerHTML,/今回の優先：コーナンPay/);
    assert.match(shop.combination,/今回はチャージ済み残高/);
    assert.match(shop.first,/PayPay/);
    assert.equal(w.api.comparisonRate(shop.payments.find(p=>p.id==='paypay')),1.5);
    w.manual('セリア');
    assert.doesNotMatch(w.nodes.get('result').innerHTML,/今回の優先：コーナンPay|支店ごとの適用を確認できていない/);
    assert.equal(w.store('セリア').payments.find(p=>p.id==='rakutenReview').r,'0%');
    w.manual('コーナン');
    assert.match(w.nodes.get('result').innerHTML,/今回の優先：コーナンPay/);
    w.nodes.get('kohnanPriority').onchange({target:{value:'normal'}});
    assert.doesNotMatch(w.nodes.get('result').innerHTML,/今回の優先：コーナンPay/);
    assert.match(shop.combination,/PayPay 1.5%で支払い/);
    const fresh=world({runtime,storage:w.storage});fresh.manual('コーナン');
    assert.doesNotMatch(fresh.nodes.get('result').innerHTML,/今回の優先：コーナンPay/);
  }
});

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

test('actual coupon runtime renders all 155 stores even when the coupon network fails', async () => {
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
    assert.equal(scripts.length, 7);
    assert.deepEqual(scripts.map(m => m[1]), ['audit-data-20260906.js','local-stores-20260907.js','stores-20260911.js','malls-20260913.js','rates-20261102.js','location-search-20260907.js','checker-20260907-autocoupons.js']);
    for (const [, file, digest] of scripts) assert.equal(crypto.createHash('sha384').update(read(file)).digest('base64'), digest, file);
  }
  assert.equal(read('index.html'), read('app-v2.html')); assert.equal(read('index.html'), read('app-v3.html'));
});

test('155 stores render, personal rates and PayPay tie ordering survive, list is lazy', () => {
  const w = world(); assert.equal(w.sandbox.PAYMENT_STORE_COUNT, 155);
  assert.equal(w.nodes.get('storeList').children.length, 0); assert.equal(w.nodes.get('quickStores').children.length, 5);
  for (const store of w.api.STORE_DATA) {
    const top = store.payments.filter(p => p.rankable).sort(w.api.paymentOrder);
    for (const p of top) {
      if (p.n === 'PayPay') assert.equal(p.r, '1.5%');
      if (p.n === '三菱UFJカード') assert.equal(p.r, '10%');
      if (['olive','oliveStar'].includes(p.id)) assert.equal(p.r, '9%');
      if (['smbc','smbcStar'].includes(p.id)) assert.equal(p.r, '8%');
      if (p.id === 'rakuten') assert.equal(p.r, '1.5%');
    }
    if (top.some(p => p.id === 'paypay') && top.some(p => p.id === 'rakuten')) assert.ok(top.findIndex(p => p.id === 'paypay') < top.findIndex(p => p.id === 'rakuten'));
    w.api.renderPayment(store); assert.ok(w.nodes.get('result').innerHTML.includes(store.store.replaceAll('&', '&amp;')));
  }
  w.manual('コーナン'); assert.match(w.nodes.get('result').innerHTML, /point-pill">楽天 <strong>税抜0.5%/);
  w.manual('ファミマ'); assert.match(w.nodes.get('result').innerHTML, /pay-name">楽天ペイ/);
  assert.equal(w.errors.length, 0);
});

test('personal rates cover every UFJ route and keep store/card eligibility distinct', () => {
  for (const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']) {
    const w=world({runtime});
    assert.equal(w.sandbox.PAYMENT_AUDIT_DATA.settings.mufg,10);
    assert.equal(w.sandbox.PAYMENT_AUDIT_DATA.settings.olive,9);
    assert.equal(w.sandbox.PAYMENT_AUDIT_DATA.settings.smbc,8);
    for (const store of w.api.STORE_DATA) {
      for (const p of store.payments) {
        if (p.n==='三菱UFJカード') assert.equal(p.r,'10%',store.store);
        if (p.id==='olive') assert.equal(store.payments.find(q=>q.id==='smbc').r,'8%',store.store);
        if (p.id==='oliveStar') assert.equal(store.payments.find(q=>q.id==='smbcStar').r,'8%',store.store);
      }
      w.api.renderPayment(store);
      assert.doesNotMatch(w.nodes.get('result').innerHTML,/12\.5%/,store.store);
    }
    for (const name of ['ローソン','くら寿司','スシロー','松屋','オーケー','スタバ','コカ・コーラ自販機','カーブス','ピザハットオンライン','松弁ネット/松屋モバイルオーダー']) assert.match(w.store(name).first,/三菱UFJカード（10%/);
    for (const name of ['マクドナルド','すき家','サイゼリヤ','はま寿司','かっぱ寿司']) {
      assert.match(w.store(name).first,/Olive（9%/);
      assert.ok(!w.store(name).payments.some(p=>p.n==='三菱UFJカード'));
    }
    assert.ok(!w.store('ローソン・スリーエフ').payments.some(p=>p.n==='三菱UFJカード'));
    assert.ok(!w.store('ファミリーマート').payments.some(p=>['mufg','olive','smbc'].includes(p.id)));
    assert.match(w.store('スタバ').payments.find(p=>p.id==='smbcStar').x,/Apple Payでモバイルオーダー/);
    assert.match(w.store('オーケー').combination,/10%/);
    assert.match(w.store('ミニストップ').combination,/Olive 9%／ゴールドNL 8%/);
  }
});

test('seven bonus requires current confirmation, ranks 11.5/10.5 and keeps tax-exclusive miles separate', async () => {
  for (const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']) {
    const w=world({runtime,blockedStorage:true});w.manual('セブン');
    const store=w.store('セブン-イレブン'),olive=store.payments.find(p=>p.id==='olive'),smbc=store.payments.find(p=>p.id==='smbc');
    assert.match(store.first,/三菱UFJカード（10%/);
    assert.equal(olive.r,'9%');assert.equal(smbc.r,'8%');
    assert.equal(store.points[0].n,'セブンマイル');assert.equal(store.points[0].base,undefined);
    w.nodes.get('sevenBonus').onchange({target:{value:'on'}});
    assert.equal(olive.r,'11.5%');assert.equal(smbc.r,'10.5%');
    assert.match(store.first,/Olive（11\.5%/);assert.match(store.second,/ゴールドNL（10\.5%/);
    assert.match(w.nodes.get('result').innerHTML,/セブン追加2\.5%込み/);
    assert.match(store.combination,/税抜基準/);
    assert.equal(w.api.comparisonRate(olive),11.5,'miles must not enter the payment rank');
    let copied='';w.sandbox.navigator.clipboard.writeText=async text=>{copied=text};
    await w.nodes.get('copyBtn').onclick();assert.match(copied,/1位：Olive（11\.5%/);assert.match(copied,/セブンマイル/);
    w.manual('ローソン');assert.equal(w.store('ローソン').payments.find(p=>p.id==='olive').r,'9%');
    assert.doesNotMatch(w.nodes.get('result').innerHTML,/id="sevenBonus"/);
    w.manual('セブン');w.nodes.get('sevenBonus').onchange({target:{value:'off'}});
    assert.equal(olive.r,'9%');assert.equal(smbc.r,'8%');assert.match(store.first,/三菱UFJカード（10%/);
    assert.doesNotMatch(w.nodes.get('result').innerHTML,/セブン追加2\.5%込み/);
    const fresh=world({runtime});fresh.manual('セブン');assert.match(fresh.store('セブン-イレブン').first,/三菱UFJカード（10%/);
  }
});

test('official sub-brands match manual and nearby names without inheriting unverified payments', () => {
  for (const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']) {
    const w=world({runtime});
    for (const [alias,name,id,rate] of [
      ['プレッセ','プレッセ','mufg','10%'],['東急ストアフードステーション','フードステーション','mufg','10%'],
      ['meat meet','MEATMeet','mufg','10%'],['パワーマート','パワーマート','mufg','10%'],
      ['サンリブボーノ','サンリブBUONO','mufg','10%'],['生鮮げんき市場','生鮮げんき市場','mufg','10%'],
      ['モスバーガー&カフェ','モスバーガー＆カフェ','olive','9%']]) {
      w.manual(alias);assert.ok(w.nodes.get('result').innerHTML.includes(name.replaceAll('&','&amp;')),alias);
      assert.equal(w.api.matchStoreFromText(alias+' 横浜店').store.store,name);
      assert.equal(w.store(name).payments.find(p=>p.id===id).r,rate);
      assert.ok(!w.store(name).payments.some(p=>['paypay','rakuten','jalTokyu','dpay'].includes(p.id)),name);
    }
  }
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

test('JAL TOKYU without premium separates miles and presentation, shares valuation and scopes facility points', () => {
 for(const runtime of ['checker-20260907.js','checker-20260907-autocoupons.js']){
  const w=world({runtime});const cafe=w.store('サンマルクカフェ 港北東急SC店');
  w.manual(cafe.store);
  assert.equal(cafe.payments.find(p=>p.id==='jalTokyu').r,'0.5%相当');
  assert.match(cafe.first,/PayPay/);assert.match(cafe.second,/楽天ペイ/);
  assert.match(cafe.combination,/計2.5%目安/);
  assert.match(w.nodes.get('result').innerHTML,/通常200円＝1マイル/);
  assert.equal(cafe.points.find(p=>p.n==='TOKYU POINT').base,1);
  assert.equal(cafe.points.find(p=>p.n==='myサンマルク').base,undefined);
  w.nodes.get('jalMileValue').onchange({target:{value:'4'}});
  assert.match(cafe.first,/JALカード/);assert.match(cafe.combination,/計3.0%相当/);
  assert.equal(w.store('東急ストア').payments.find(p=>p.id==='jalTokyu').r,'2.0%相当');
  const restored=world({runtime,storage:w.storage});assert.equal(restored.store(cafe.store).payments.find(p=>p.id==='jalTokyu').r,'2.0%相当');
  assert.equal(w.api.matchStoreFromText('サンマルクカフェ 新宿店'),null);
  assert.equal(w.api.matchStoreFromText('サンマルクカフェ 港北東急SC店').store.store,cafe.store);
  assert.equal(w.api.matchStoreFromText('港北東急SC ロピア'),null);
  assert.ok(w.api.STORE_DATA.filter(s=>s!==cafe).every(s=>!s.local.kohokuPoints));
  assert.ok(w.store('イオン').payments.every(p=>p.id!=='jalTokyu'));
 }
 const denied=world({blockedStorage:true});denied.manual('サンマルクカフェ 港北東急SC店');
 denied.nodes.get('jalMileValue').onchange({target:{value:'1.5'}});
 assert.equal(denied.store('サンマルクカフェ 港北東急SC店').payments.find(p=>p.id==='jalTokyu').r,'0.75%相当');
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

// ---- 2026-11-02 audit additions ----
const NOW = 1788739200000; // virtual clock start: 2026-09-07T00:00:00Z
const iso = ms => new Date(ms).toISOString();
const jstDate = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const isCoupon = url => String(url).startsWith('./coupon-feed.json');
const abortable = (_url, options) => new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
function couponWorld(feed, extra = {}) {
  return world({runtime: 'checker-20260907-autocoupons.js', ...extra,
    fetcher: (url, options, n) => isCoupon(url) ? (typeof feed === 'function' ? feed(url, options, n) : Promise.resolve(response(feed))) : (extra.overpass ? extra.overpass(url, options, n) : new Promise(() => {}))});
}

test('every ranked payment is verified and numeric; presentation points never change the ranking', () => {
  for (const runtime of ['checker-20260907.js', 'checker-20260907-autocoupons.js']) {
    const w = world({runtime});
    for (const store of w.api.STORE_DATA) {
      const ranked = store.payments.filter(p => p.rankable).sort(w.api.paymentOrder);
      for (const p of ranked) assert.match(String(p.r), /\d(?:\.\d+)?%/, store.store + ':' + p.id);
      for (const p of store.payments.filter(p => !p.rankable)) assert.ok(!store.first.startsWith(p.n + '（' + p.r), store.store);
      const before = [store.first, store.second, store.third];
      const savedPoints = store.points; store.points = [];
      w.api.refreshStoreSummary(store);
      assert.deepEqual([store.first, store.second, store.third], before, 'presentation points leaked into ranking: ' + store.store);
      store.points = savedPoints; w.api.refreshStoreSummary(store);
      // The headline rate equals the payment's own comparison rate, never payment + presentation.
      if (ranked[0]) assert.equal(w.api.comparisonRate(ranked[0]), Number(String(w.api.comparisonLabel(ranked[0])).match(/\d+(?:\.\d+)?/)[0]), store.store);
    }
  }
});

test('equal rates keep the owner order: PayPay, then Rakuten Pay, then the listed order', () => {
  const w = world();
  for (const store of w.api.STORE_DATA) {
    const ranked = store.payments.filter(p => p.rankable).sort(w.api.paymentOrder);
    for (let i = 1; i < ranked.length; i++) {
      const a = ranked[i - 1], b = ranked[i];
      assert.ok(w.api.comparisonRate(a) >= w.api.comparisonRate(b), store.store);
      if (w.api.comparisonRate(a) === w.api.comparisonRate(b)) {
        const order = p => p.n === 'PayPay' ? 0 : p.n === '楽天ペイ' ? 1 : 2;
        assert.ok(order(a) <= order(b), store.store + ': ' + a.n + ' / ' + b.n);
        if (order(a) === 2 && order(b) === 2) assert.ok(store.payments.indexOf(a) < store.payments.indexOf(b), 'stable order ' + store.store);
      }
    }
  }
  w.manual('ベルク');
  assert.match(w.store('ベルク').first, /^PayPay（1\.5%/); assert.match(w.store('ベルク').second, /^楽天ペイ（1\.5%/);
  assert.match(w.nodes.get('result').innerHTML, /同じ還元率/);
});

test('personal comparison values are labelled beside official base rates without changing the ranking', () => {
  for (const runtime of ['checker-20260907.js', 'checker-20260907-autocoupons.js']) {
    const w = world({runtime});
    const data = w.sandbox.PAYMENT_AUDIT_DATA;
    assert.equal(data.settings.olive, 9); assert.equal(data.settings.smbc, 8); assert.equal(data.settings.mufg, 10);
    assert.equal(data.officialRates.olive.base, 8); assert.equal(data.officialRates.smbc.base, 7); assert.equal(data.officialRates.mufg.base, 7);
    w.manual('ローソン'); const lawson = w.store('ローソン'), html = w.nodes.get('result').innerHTML;
    assert.match(lawson.first, /三菱UFJカード（10%/);
    assert.match(html, /本人設定値（公式7%・条件で最大20%）/);
    assert.match(html, /本人設定値（公式8%）/); assert.match(html, /本人設定値（公式7%）/);
    assert.equal(w.api.comparisonRate(lawson.payments.find(p => p.id === 'olive')), 9, 'official 8% is a label only');
    w.manual('ベルク'); assert.match(w.nodes.get('result').innerHTML, /条件達成時の値（未達時1\.0%）/);
    assert.match(w.nodes.get('result').innerHTML, /見合わせ中で新時期未定のため要確認/);
    w.manual('セブン'); w.nodes.get('sevenBonus').onchange({target: {value: 'on'}});
    assert.match(w.nodes.get('result').innerHTML, /本人設定値（公式10\.5%（セブン追加込み））/);
    assert.ok(w.store('セブン-イレブン').audit.sources.includes('smbc202602'));
    assert.ok(w.store('セブン-イレブン').conditions.some(c => /最大11%＝8%＋3%/.test(c)));
    assert.ok(w.store('オーケー').conditions.some(c => /アメリカン・エキスプレスは2026年12月15日利用分まで/.test(c)));
  }
});

test('dated programme ends drop out of the ranking on the next Japanese calendar day', () => {
  for (const runtime of ['checker-20260907.js', 'checker-20260907-autocoupons.js']) {
    const last = world({runtime, now: Date.parse('2026-12-15T23:59:00+09:00')});
    assert.match(last.store('ドミー').first, /三菱UFJカード（10%・.*2026-12-15まで/);
    const after = world({runtime, now: Date.parse('2026-12-16T00:00:00+09:00')}), dommy = after.store('ドミー');
    const mufg = dommy.payments.find(p => p.id === 'mufg');
    assert.equal(mufg.rankable, false); assert.equal(mufg.r, '終了');
    assert.match(dommy.first, /^楽天ペイ（1\.5%/);
    after.manual('ドミー'); const html = after.nodes.get('result').innerHTML;
    assert.match(html, /2026-12-15で優遇終了/); assert.doesNotMatch(html, /pay-name">三菱UFJカード/);
    // Other UFJ stores are unaffected by the Dommy end date.
    assert.match(after.store('オーケー').first, /三菱UFJカード（10%/);
    assert.ok(dommy.conditions.some(c => /2026年12月15日利用分まで/.test(c)));
  }
});

test('V coupons from the public list are candidates only until acquisition is confirmed', async () => {
  const feed = {updatedAt: iso(NOW), errors: [], offers: [{provider: 'vpass', brand: 'アカチャンホンポ', rate: 3, sourceUrl: 'https://www.smbc-card.com/camp/vcoupon/index.jsp', note: 'Vクーポン公開掲載。獲得済み・対象カードであることが必要'}]};
  const w = couponWorld(feed); await flush();
  w.manual('アカチャンホンポ'); const store = w.store('アカチャンホンポ');
  const card = () => store.payments.find(p => p.id === 'card');
  assert.equal(w.api.comparisonRate(card()), 0.5, 'not applied before confirmation');
  assert.match(w.nodes.get('result').innerHTML, /Vクーポンを獲得済み・対象カードで支払う/);
  assert.doesNotMatch(w.nodes.get('result').innerHTML, /クーポン条件付き/);
  const key = 'vpass|アカチャンホンポ||';
  assert.match(w.nodes.get('result').innerHTML, new RegExp('data-coupon-key="' + key.replace(/[|]/g, '\\|') + '"'));
  w.api.couponState(store).checked[key] = true; w.api.refreshStoreSummary(store); w.api.renderPayment(store);
  assert.equal(w.api.comparisonRate(card()), 3.5);
  assert.match(store.second, /Olive通常（3\.5%/); assert.match(store.first, /三菱UFJカード（10%/);
  assert.match(w.nodes.get('result').innerHTML, /獲得済みと確認・上限と期間は公式で確認/);
  assert.equal(w.errors.length, 0);
});

test('expired, capped and stale coupons are handled; normal ranking survives coupon timeouts', async () => {
  const today = jstDate(NOW), yesterday = jstDate(NOW - 86400000), tomorrow = jstDate(NOW + 86400000);
  const offers = [
    {id: 'old', provider: 'paypay', brand: 'ベルク', rate: 20, maxBonus: 500, start: '2026-08-01', end: yesterday, termsVerified: true, title: '終了済み'},
    {id: 'cap', provider: 'paypay', brand: 'ベルク', rate: 5, maxBonus: 100, capScope: 'transaction', maxUses: 1, start: today, end: tomorrow, termsVerified: true, title: '上限付き'}];
  const w = couponWorld({updatedAt: iso(NOW), errors: [], offers}); await flush();
  w.manual('ベルク'); const store = w.store('ベルク'); let html = w.nodes.get('result').innerHTML;
  assert.doesNotMatch(html, /終了済み/); assert.match(html, /上限付き/); assert.match(html, /上限100pt\/transaction/);
  w.api.couponState(store).checked.cap = true; w.api.couponState(store).amount = 20000; w.api.refreshStoreSummary(store);
  const pp = store.payments.find(p => p.id === 'paypay');
  assert.equal(pp.couponPoints, 100, 'cap reached'); assert.equal(w.api.comparisonRate(pp), 2);
  w.api.couponState(store).amount = 1000; w.api.refreshStoreSummary(store); assert.equal(w.api.comparisonRate(pp), 6.5);
  w.api.couponState(store).checked.old = true; w.api.couponState(store).checked.cap = false; w.api.refreshStoreSummary(store);
  assert.equal(w.api.comparisonRate(pp), 1.5, 'an expired coupon is never applied');

  const stale = couponWorld({updatedAt: iso(NOW - 49 * 3600000), errors: [], offers}); await flush();
  stale.manual('ベルク'); assert.match(stale.nodes.get('result').innerHTML, /情報が古いため不使用/);
  stale.api.couponState(stale.store('ベルク')).checked.cap = true; stale.api.couponState(stale.store('ベルク')).amount = 1000;
  stale.api.refreshStoreSummary(stale.store('ベルク')); assert.equal(stale.api.comparisonRate(stale.store('ベルク').payments.find(p => p.id === 'paypay')), 1.5);

  const slow = couponWorld(abortable); slow.manual('ベルク');
  assert.match(slow.nodes.get('result').innerHTML, /確認中/); assert.match(slow.store('ベルク').first, /^PayPay（1\.5%/);
  await slow.time.tick(12000);
  assert.match(slow.nodes.get('result').innerHTML, /取得未完了/); assert.match(slow.store('ベルク').first, /^PayPay（1\.5%/);
  assert.equal(slow.time.pending(), 0);
  const failed = couponWorld(async () => ({ok: false, status: 503, json: async () => ({})})); await flush();
  failed.manual('セブン'); assert.match(failed.store('セブン-イレブン').first, /三菱UFJカード（10%/);
  assert.equal(failed.errors.length + slow.errors.length + w.errors.length + stale.errors.length, 0);
});

test('coupon refresh after a back-forward restore re-fetches without cache and keeps the chosen store', async () => {
  let n = 0;
  const w = couponWorld(() => { n++; return Promise.resolve(response({updatedAt: iso(NOW), errors: [], offers: []})); }); await flush();
  assert.equal(n, 1);
  w.manual('ローソン'); const html = w.nodes.get('result').innerHTML;
  for (const fn of w.windowEvents.pageshow || []) fn({persisted: false}); await flush(); assert.equal(n, 1);
  await w.time.tick(1000);
  for (const fn of w.windowEvents.pageshow || []) fn({persisted: true}); await flush(); assert.equal(n, 2);
  const couponRequests = w.requests.filter(r => isCoupon(r.url));
  assert.ok(couponRequests.every(r => r.options.cache === 'no-store'));
  assert.notEqual(couponRequests[0].url, couponRequests[1].url, 'cache-busting query changes');
  assert.match(w.nodes.get('result').innerHTML, /store-name">ローソン/); assert.equal(w.nodes.get('result').innerHTML.length > 0, true);
  // A late coupon response must not reopen a result the user already closed.
  let release; const late = couponWorld(() => new Promise(resolve => { release = resolve; }));
  late.manual('ローソン'); late.nodes.get('clearBtn').onclick();
  release(response({updatedAt: iso(NOW), errors: [], offers: []})); await flush();
  assert.ok(late.nodes.get('resultPanel').classList.contains('hidden'));
  assert.ok(html.includes('ローソン'));
});

test('a missing optional data file is reported while manual search keeps working', () => {
  const ok = world(); assert.equal(ok.nodes.get('status').innerHTML, '');
  const w = world({skipData: ['rates-20261102.js']});
  assert.match(w.nodes.get('status').innerHTML, /11月の還元率確認/);
  assert.match(w.nodes.get('status').className, /error/);
  w.manual('ローソン'); assert.match(w.store('ローソン').first, /三菱UFJカード（10%/);
  assert.doesNotMatch(w.nodes.get('result').innerHTML, /本人設定値（/);
  const malls = world({skipData: ['malls-20260913.js']}); assert.match(malls.nodes.get('status').innerHTML, /トレッサ・ららぽーと/);
});

test('location requests send a rounded point, keep precise distances local and reuse the padded cache', async () => {
  const w = world({fetcher: async () => response(shops)}); const running = w.start();
  w.geoCalls[0].ok(w.pos(20, 35.558123456, 139.579987654)); await running;
  const body = w.requests[0].options.body;
  assert.match(body, /around:335,35\.5581,139\.58\)/);
  assert.doesNotMatch(body, /35\.55812|139\.57998/);
  assert.equal(w.nodes.get('bubbles').children.length, 1);
  const shown = w.nodes.get('bubbles').children[0].innerHTML;
  assert.match(shown, /dist">\d+m/);
  await w.start(); assert.equal(w.requests.length, 1, 'same place reuses the padded result');
  assert.equal(w.storage.size, 0, 'coordinates are not stored');
});

test('versioned URLs, data versions and SRI stay consistent across the three entry pages', () => {
  const build = read('scripts/build_auto_coupon_checker.py');
  const version = build.match(/VERSION='([^']+)'/)[1];
  for (const name of ['index.html', 'app-v2.html', 'app-v3.html']) {
    const html = read(name);
    assert.match(html, new RegExp('data-ui-version="' + version + '"'));
    const versions = [...html.matchAll(/<script defer src="\.\/[^"?]+\?v=([^"]+)"/g)].map(m => m[1]);
    assert.equal(versions.length, 7); assert.ok(versions.every(v => v === version), name);
    assert.match(html, /rates-20261102\.js\?v=[^"]+" integrity="sha384-[A-Za-z0-9+/=]+" onerror=/);
  }
  assert.match(read('.github/workflows/coupon-auto.yml'), new RegExp('autocoupons\\.js\\?v=' + version));
  assert.match(read('.github/workflows/coupon-auto.yml'), /if: github\.ref == 'refs\/heads\/main'/);
});

test('UFJ 50,000-yen cap: marking the period as used re-ranks every UFJ store and resets on the 16th (JST)', () => {
  for (const runtime of ['checker-20260907.js', 'checker-20260907-autocoupons.js']) {
    const w = world({runtime}); w.manual('オーケー');
    let html = w.nodes.get('result').innerHTML;
    assert.match(html, /三菱UFJの5万円枠（8\/16〜9\/15）/); assert.match(w.store('オーケー').first, /三菱UFJカード（10%/);
    w.nodes.get('mufgCap').onchange({target: {value: 'used'}});
    const okMufg = w.store('オーケー').payments.find(p => p.id === 'mufg');
    assert.equal(okMufg.r, '0.4%'); assert.equal(w.api.officialRateShort(okMufg), '');
    // OK Club cash discount on food (3/103 = 2.91%) is then the best option, ahead of PayPay.
    assert.match(w.store('オーケー').first, /^OKクラブ＋現金（約2\.9%割引/); assert.match(w.store('オーケー').second, /^PayPay（1\.5%/);
    assert.match(w.store('ローソン').first, /^Olive（9%/, 'cap is shared by every UFJ store');
    assert.match(w.store('スタバ').first, /^Olive（9%/);
    assert.match(w.store('オーケー').combination, /使い切ったため0\.4%相当/); assert.doesNotMatch(w.store('オーケー').combination, /対象決済10%/);
    assert.match(w.store('スタバ').combination, /使い切ったため0\.4%相当/);
    assert.equal(w.storage.get('payment-checker-mufg-cap-period'), '2026-08-16');
    html = w.nodes.get('result').innerHTML; assert.match(html, /今期は使い切った（0\.4%相当）" selected|value="used" selected/);
    const sameDay = world({runtime, storage: w.storage, now: Date.parse('2026-09-15T23:59:00+09:00')});
    assert.match(sameDay.store('オーケー').first, /^OKクラブ＋現金/);
    const nextPeriod = world({runtime, storage: w.storage, now: Date.parse('2026-09-16T00:00:00+09:00')});
    assert.match(nextPeriod.store('オーケー').first, /三菱UFJカード（10%/); nextPeriod.manual('オーケー');
    assert.match(nextPeriod.nodes.get('result').innerHTML, /三菱UFJの5万円枠（9\/16〜10\/15）/);
    w.nodes.get('mufgCap').onchange({target: {value: 'open'}});
    assert.match(w.store('オーケー').first, /三菱UFJカード（10%/); assert.equal(w.storage.get('payment-checker-mufg-cap-period'), '');
    // Ended programmes stay ended even when the cap is toggled.
    const ended = world({runtime, now: Date.parse('2026-12-20T12:00:00+09:00')}); ended.manual('ドミー');
    assert.doesNotMatch(ended.nodes.get('result').innerHTML, /id="mufgCap"/);
    ended.manual('オーケー'); ended.nodes.get('mufgCap').onchange({target: {value: 'used'}});
    assert.equal(ended.store('ドミー').payments.find(p => p.id === 'mufg').r, '終了');
  }
  const newYear = world({now: Date.parse('2027-01-10T12:00:00+09:00')}); newYear.manual('オーケー');
  assert.match(newYear.nodes.get('result').innerHTML, /三菱UFJの5万円枠（12\/16〜1\/15）/);
  const blocked = world({blockedStorage: true}); blocked.manual('オーケー'); blocked.nodes.get('mufgCap').onchange({target: {value: 'used'}});
  assert.match(blocked.store('オーケー').first, /^OKクラブ＋現金/);
  assert.equal(blocked.errors.length, 0);
});
