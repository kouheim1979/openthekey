// Builds nearby-stores.json: OpenStreetMap shop locations for the registered brands inside REGION.
// The app searches this file on the device, so a location in the region is never sent anywhere and
// nearby search does not depend on the (often overloaded) public Overpass servers.
// Run in CI (GitHub Actions); exits non-zero without touching the existing file when the data is unusable.
import fs from 'node:fs';
import vm from 'node:vm';

// Yokohama and Kawasaki (south, west, north, east). Positions outside fall back to live Overpass.
const REGION = [35.31, 139.47, 35.66, 139.79];
const OUT = 'nearby-stores.json';
const DATA_FILES = ['audit-data-20260906.js', 'local-stores-20260907.js', 'stores-20260911.js', 'malls-20260913.js', 'rates-20261102.js'];
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const AMENITY = '^(restaurant|cafe|fast_food|bar|pub|fuel|pharmacy|vending_machine)$';
const MIN_ROWS = 500; // a sudden drop means a partial answer, not closed stores

// Same normalisation and alias rule as matchStoreFromText in checker-20260907.js (kept deliberately simple:
// this is a superset filter; the app applies the exact rules, exclusions and branch requirements).
const normalizeText = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[ー‐-‒–—―\-−\s　・･'’`]/g, '').replace(/株式会社|有限会社|合同会社|店$/g, '').trim();

function registeredAliases() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of DATA_FILES) vm.runInContext(fs.readFileSync(name, 'utf8'), sandbox, {filename: name});
  const rows = sandbox.PAYMENT_AUDIT_DATA.rows;
  const aliases = new Set();
  for (const [name, list, , , , , , , , scope] of rows) {
    if (scope !== '店頭') continue;
    const storeName = normalizeText(name);
    for (const alias of [name, ...list]) {
      const a = normalizeText(alias);
      if (a && (a.length >= 3 || a === storeName)) aliases.add(a);
    }
  }
  return [...aliases];
}

function query([s, w, n, e]) {
  return `[out:json][timeout:600][maxsize:1073741824][bbox:${s},${w},${n},${e}];` +
    `(nwr["shop"];nwr["amenity"~"${AMENITY}"];nwr["brand"];);out center tags;`;
}

async function fetchOverpass(body) {
  const errors = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {method: 'POST', body, headers: {'Content-Type': 'text/plain;charset=UTF-8', 'User-Agent': 'openthekey-payment-checker/1.0 (+https://github.com/kouheim1979/openthekey)'}, signal: AbortSignal.timeout(660000)});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const json = await response.json();
        if (!Array.isArray(json.elements) || json.remark) throw new Error('incomplete: ' + (json.remark || 'no elements'));
        console.log('ok', endpoint, json.elements.length, 'elements, osm base', json.osm3s?.timestamp_osm_base);
        return json;
      } catch (error) {
        errors.push(endpoint + ': ' + error.message);
        console.warn('failed', endpoint, error.message);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 60000 * (attempt + 1)));
  }
  throw new Error('All Overpass servers failed: ' + errors.join(' | '));
}

const round = n => Math.round(n * 1e5) / 1e5;

async function main() {
  const aliases = registeredAliases();
  const json = await fetchOverpass(query(REGION));
  const seen = new Set(), rows = [];
  for (const el of json.elements) {
    const tags = el.tags || {};
    const lat = typeof el.lat === 'number' ? el.lat : el.center?.lat;
    const lng = typeof el.lon === 'number' ? el.lon : el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const target = normalizeText([tags['name:ja'], tags.name, tags.brand].filter(Boolean).join(' / '));
    if (!target || !aliases.some(a => target.includes(a))) continue;
    const key = el.type + el.id;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([round(lat), round(lng), tags.name || '', tags.brand || '', tags['name:ja'] || '']);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (rows.length < MIN_ROWS) throw new Error('Too few matching stores (' + rows.length + '); keeping the previous file');
  let previous = 0;
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')).rows.length; } catch (_) {}
  if (previous && rows.length < previous * 0.8) throw new Error(`Matching stores dropped from ${previous} to ${rows.length}; keeping the previous file`);
  const data = {
    version: 1,
    source: 'OpenStreetMap contributors (ODbL) via Overpass API',
    osmBase: json.osm3s?.timestamp_osm_base || '',
    generatedAt: new Date().toISOString(),
    bbox: REGION,
    fields: ['lat', 'lng', 'name', 'brand', 'name:ja'],
    rows
  };
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log('wrote', OUT, rows.length, 'stores,', fs.statSync(OUT).size, 'bytes');
}

main().catch(error => { console.error(error.message); process.exit(1); });
