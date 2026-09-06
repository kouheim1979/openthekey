/* Optional location service. Failure here must never block the payment checker. */
(function () {
  'use strict';
  const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const LOCATION_MS = 4500, SEARCH_MS = 5000, POSITION_AGE_MS = 30000, CACHE_MS = 120000;
  function abortError() { return new DOMException('検索を中止しました', 'AbortError'); }
  function locationError(code, message) { return Object.assign(new Error(message), {code}); }
  function distance(a, b) {
    const radians = n => n * Math.PI / 180;
    const x = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function validPosition(p) {
    return Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 && Number.isFinite(p.accuracy) && p.accuracy >= 0;
  }
  function buildQuery(lat, lng, radius) {
    if (!validPosition({lat, lng, accuracy: 0}) || !Number.isFinite(radius) || radius < 1 || radius > 1200) throw new Error('検索範囲が不正です');
    const around = '(around:' + radius + ',' + lat + ',' + lng + ')';
    return '[out:json][timeout:5];(nwr' + around + '["shop"];nwr' + around + '["amenity"~"^(restaurant|cafe|fast_food|bar|pub|fuel|pharmacy|vending_machine)$"];nwr' + around + '["brand"];);out center tags;';
  }
  function createClient(options = {}) {
    const geo = options.geolocation || navigator.geolocation;
    const request = options.fetch || ((...args) => fetch(...args));
    let lastPosition = null;
    // Memory only: coordinates and shop results disappear when this page closes.
    const cache = [];
    function onePosition(signal, highAccuracy, timeout) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(abortError()); return; }
        let settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal.removeEventListener('abort', onAbort);
          if (error) reject(error); else resolve(value);
        };
        const onAbort = () => finish(abortError());
        // Browsers may exclude time spent waiting for permission from their own timeout.
        const timer = setTimeout(() => finish(locationError(3, '現在地の確認に時間がかかっています')), timeout);
        signal.addEventListener('abort', onAbort, {once: true});
        try {
          geo.getCurrentPosition(pos => {
            const p = {lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, at: pos.timestamp || Date.now()};
            if (!validPosition(p) || Date.now() - p.at > POSITION_AGE_MS) { finish(locationError(2, '現在地を確認できませんでした')); return; }
            finish(null, p);
          }, error => finish(error), {enableHighAccuracy: highAccuracy, timeout, maximumAge: highAccuracy ? 0 : POSITION_AGE_MS});
        } catch (error) { finish(error); }
      });
    }
    async function locate(signal, radius, onRefining = () => {}) {
      if (!geo) throw locationError(2, 'このブラウザでは位置情報を利用できません');
      const deadline = Date.now() + LOCATION_MS;
      let position = lastPosition && Date.now() - lastPosition.at <= POSITION_AGE_MS ? lastPosition : null;
      if (signal.aborted) throw abortError();
      if (!position) {
        try { position = await onePosition(signal, false, 3000); }
        catch (error) {
          if (error.name === 'AbortError' || error.code === 1) throw error;
          position = await onePosition(signal, true, Math.max(1, deadline - Date.now()));
        }
      }
      if (position.accuracy > Math.max(radius, 100) && Date.now() < deadline) {
        onRefining();
        try {
          const refined = await onePosition(signal, true, Math.max(1, deadline - Date.now()));
          if (refined.accuracy < position.accuracy) position = refined;
        } catch (error) { if (error.name === 'AbortError' || error.code === 1) throw error; }
      }
      if (signal.aborted) throw abortError();
      lastPosition = position;
      return position;
    }
    function fetchShops(query, signal) {
      return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(abortError()); return; }
        let settled = false, failures = 0, backupStarted = false;
        const controllers = [], timers = [];
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          timers.forEach(clearTimeout);
          signal.removeEventListener('abort', onAbort);
          controllers.forEach(controller => controller.abort());
          if (error) reject(error); else resolve(value);
        };
        const onAbort = () => finish(abortError());
        signal.addEventListener('abort', onAbort, {once: true});
        const startBackup = () => { if (!settled && !backupStarted) { backupStarted = true; run(ENDPOINTS[1]); } };
        async function run(endpoint) {
          const controller = new AbortController();
          controllers.push(controller);
          try {
            const response = await request(endpoint, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=UTF-8'}, body: query, signal: controller.signal});
            if (!response.ok) throw new Error('店舗検索の接続先が混み合っています');
            const json = await response.json();
            if (!json || !Array.isArray(json.elements) || json.remark) throw new Error('店舗検索の結果を確認できませんでした');
            finish(null, json);
          } catch (error) {
            if (settled) return;
            failures++;
            if (failures >= ENDPOINTS.length) finish(error); else startBackup();
          }
        }
        timers.push(setTimeout(() => finish(new Error('店舗検索に時間がかかっています')), SEARCH_MS));
        // Avoid serial 14-second waits: try the second server only if the first is slow.
        timers.push(setTimeout(startBackup, 800));
        run(ENDPOINTS[0]);
      });
    }
    async function search(position, radius, signal) {
      if (signal.aborted) throw abortError();
      const hit = cache.find(item => Date.now() - item.at <= CACHE_MS && radius + distance(position, item) <= item.radius);
      if (hit) return {data: hit.data, cached: true};
      // Padding allows small movements to reuse a recent result without missing the new edge.
      const requestedRadius = radius + 75;
      const data = await fetchShops(buildQuery(position.lat, position.lng, requestedRadius), signal);
      if (signal.aborted) throw abortError();
      cache.unshift({lat: position.lat, lng: position.lng, radius: requestedRadius, at: Date.now(), data});
      cache.splice(3);
      return {data, cached: false};
    }
    return {locate, search};
  }
  window.PaymentLocation = {createClient, buildQuery};
})();
