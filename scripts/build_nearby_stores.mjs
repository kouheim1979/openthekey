// Builds nearby-stores.json: OpenStreetMap shop locations for the registered brands inside REGION.
// The app searches this file on the device, so a location in the region is never sent anywhere and
// nearby search does not depend on the (often overloaded) public Overpass servers.
//
// Input: a GeoJSON-sequence export of shop/amenity/brand objects made by osmium from the Geofabrik
// Kanto extract (see .github/workflows/nearby-stores.yml). Bulk extracts are used because the public
// Overpass servers returned 502/504 for a city-wide query on 2026-11-02.
// Usage: node scripts/build_nearby_stores.mjs poi.geojsonseq [osm-data-timestamp]
// Exits non-zero without touching the existing file when the data looks unusable.
import fs from 'node:fs';
import vm from 'node:vm';

// Yokohama and Kawasaki (south, west, north, east). Positions outside fall back to live Overpass.
export const REGION = [35.31, 139.47, 35.66, 139.79];
const OUT = 'nearby-stores.json';
const DATA_FILES = ['audit-data-20260906.js', 'local-stores-20260907.js', 'stores-20260911.js', 'malls-20260913.js', 'rates-20261102.js'];
const MIN_ROWS = 500; // a sudden drop means a partial extract, not closed stores

// Same normalisation and alias rule as matchStoreFromText in checker-20260907.js (a superset filter:
// the app applies the exact rules, exclusions and branch requirements).
const normalizeText = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[ー‐-‒–—―\-−\s　・･'’`]/g, '').replace(/株式会社|有限会社|合同会社|店$/g, '').trim();

export function registeredAliases() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of DATA_FILES) vm.runInContext(fs.readFileSync(name, 'utf8'), sandbox, {filename: name});
  const aliases = new Set();
  for (const [name, list, , , , , , , , scope] of sandbox.PAYMENT_AUDIT_DATA.rows) {
    if (scope !== '店頭') continue;
    const storeName = normalizeText(name);
    for (const alias of [name, ...list]) {
      const a = normalizeText(alias);
      if (a && (a.length >= 3 || a === storeName)) aliases.add(a);
    }
  }
  return [...aliases];
}

// Representative point like Overpass "out center": the middle of the geometry's bounding box.
export function centerOf(geometry) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  const visit = c => {
    if (typeof c[0] === 'number') {
      minLng = Math.min(minLng, c[0]); maxLng = Math.max(maxLng, c[0]);
      minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]);
    } else c.forEach(visit);
  };
  if (!geometry || !geometry.coordinates) return null;
  visit(geometry.coordinates);
  return Number.isFinite(minLat) ? [(minLat + maxLat) / 2, (minLng + maxLng) / 2] : null;
}

const round = n => Math.round(n * 1e5) / 1e5;

export function buildRows(lines, aliases, region = REGION) {
  const [s, w, n, e] = region, seen = new Set(), rows = [];
  for (const raw of lines) {
    const line = raw.replace(/^\u001e/, '').trim();
    if (!line) continue;
    let feature;
    try { feature = JSON.parse(line); } catch (_) { continue; }
    const tags = feature.properties || {};
    const center = centerOf(feature.geometry);
    if (!center) continue;
    const [lat, lng] = center;
    if (lat < s || lat > n || lng < w || lng > e) continue;
    const target = normalizeText([tags['name:ja'], tags.name, tags.brand].filter(Boolean).join(' / '));
    if (!target || !aliases.some(a => target.includes(a))) continue;
    const key = (tags['@type'] || '') + (tags['@id'] || '') + '|' + round(lat) + ',' + round(lng);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([round(lat), round(lng), tags.name || '', tags.brand || '', tags['name:ja'] || '']);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || String(a[2]).localeCompare(String(b[2])));
  return rows;
}

function main() {
  const [input, timestamp] = process.argv.slice(2);
  if (!input) throw new Error('usage: node scripts/build_nearby_stores.mjs poi.geojsonseq [osm-data-timestamp]');
  const rows = buildRows(fs.readFileSync(input, 'utf8').split('\n'), registeredAliases());
  if (rows.length < MIN_ROWS) throw new Error('Too few matching stores (' + rows.length + '); keeping the previous file');
  let previous = 0;
  try { previous = JSON.parse(fs.readFileSync(OUT, 'utf8')).rows.length; } catch (_) {}
  if (previous && rows.length < previous * 0.8) throw new Error(`Matching stores dropped from ${previous} to ${rows.length}; keeping the previous file`);
  const data = {
    version: 1,
    source: '© OpenStreetMap contributors (ODbL), Geofabrik Kanto extract',
    osmBase: timestamp || new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    bbox: REGION,
    fields: ['lat', 'lng', 'name', 'brand', 'name:ja'],
    rows
  };
  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log('wrote', OUT, rows.length, 'stores,', fs.statSync(OUT).size, 'bytes, OSM data', data.osmBase);
}

if (import.meta.url === 'file://' + process.argv[1]) {
  try { main(); } catch (error) { console.error(error.message); process.exit(1); }
}
