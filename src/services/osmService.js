// OpenStreetMap(Overpass API)에서 경로 주변의 실제 건물·나무를 가져와 그림자 계산에 쓴다.

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

const LEVEL_HEIGHT_M = 3.2; // 층당 높이(m)
const DEFAULT_LEVELS = 4; // 높이·층수 정보가 없는 건물의 추정 층수
const LOW_RISE_TYPES = new Set(['house', 'detached', 'semidetached_house', 'garage', 'garages', 'shed', 'hut', 'cabin', 'roof', 'carport']);
const LOW_RISE_LEVELS = 2;

const MAX_LAT_SPAN = 0.05; // 약 5.5km
const MAX_LNG_SPAN = 0.06;

const cache = new Map();

// 같은 구역을 다시 받지 않도록 브라우저에 일주일간 저장한다(Overpass 공개 서버는 요청 제한이 있다).
const STORAGE_PREFIX = 'urbanshelter.osm.v1.';
const STORAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STORAGE_MAX_ENTRIES = 3;

function readStored(key) {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > STORAGE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeStored(key, data) {
  try {
    const keys = Object.keys(window.localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .map((k) => ({ k, savedAt: JSON.parse(window.localStorage.getItem(k) || '{}').savedAt || 0 }))
      .sort((a, b) => a.savedAt - b.savedAt);
    while (keys.length >= STORAGE_MAX_ENTRIES) window.localStorage.removeItem(keys.shift().k);
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // 저장 공간이 부족하거나 사용할 수 없으면 메모리 캐시만 쓴다.
  }
}

function toNumber(value) {
  const n = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// 건물 높이(m)와 근거: 'height'(높이 태그) | 'levels'(층수 태그) | 'estimate'(추정)
function resolveHeight(tags) {
  const h = toNumber(tags.height);
  if (h && h > 0) return { height: h, heightSource: 'height' };
  const levels = toNumber(tags['building:levels']);
  if (levels && levels > 0) return { height: Math.round(levels * LEVEL_HEIGHT_M * 10) / 10, heightSource: 'levels' };
  const levelsGuess = LOW_RISE_TYPES.has(tags.building) ? LOW_RISE_LEVELS : DEFAULT_LEVELS;
  return { height: Math.round(levelsGuess * LEVEL_HEIGHT_M * 10) / 10, heightSource: 'estimate' };
}

function parseElements(elements) {
  const buildings = [];
  const trees = [];

  for (const el of elements) {
    const tags = el.tags || {};
    if (el.type === 'way' && tags.building && Array.isArray(el.geometry)) {
      const ring = el.geometry.map((g) => [g.lat, g.lon]);
      if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) {
        ring.pop();
      }
      if (ring.length < 3) continue;
      buildings.push({
        id: `osm_${el.id}`,
        name: tags.name || tags['name:ko'] || '건물',
        polygon: ring,
        ...resolveHeight(tags)
      });
    } else if (el.type === 'node' && tags.natural === 'tree') {
      const crown = toNumber(tags.diameter_crown);
      trees.push({
        id: `osm_tree_${el.id}`,
        lat: el.lat,
        lng: el.lon,
        height: toNumber(tags.height) || 7,
        radius: crown ? Math.max(2, crown / 2) : 4
      });
    }
  }

  return { buildings, trees };
}

async function queryOverpass(endpoint, query, signal) {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 20000);
  const onAbort = () => timeout.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: timeout.signal
    });
    if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * @param {{south:number, west:number, north:number, east:number}} bbox
 * @returns {Promise<{status:'ok'|'skipped'|'error', buildings:Array, trees:Array}>}
 */
export async function fetchOsmShadeData(bbox, signal) {
  if (bbox.north - bbox.south > MAX_LAT_SPAN || bbox.east - bbox.west > MAX_LNG_SPAN) {
    return { status: 'skipped', buildings: [], trees: [] };
  }

  // 0.005° 격자에 맞춰 캐시 키를 만들어, 비슷한 경로는 다시 받지 않는다.
  const snap = (v, fn) => fn(v / 0.005) * 0.005;
  const s = snap(bbox.south, Math.floor);
  const w = snap(bbox.west, Math.floor);
  const n = snap(bbox.north, Math.ceil);
  const e = snap(bbox.east, Math.ceil);
  const key = [s, w, n, e].map((v) => v.toFixed(3)).join('_');
  if (cache.has(key)) return cache.get(key);
  const stored = readStored(key);
  if (stored) {
    const result = { status: 'ok', ...stored };
    cache.set(key, result);
    return result;
  }

  const box = `${s.toFixed(4)},${w.toFixed(4)},${n.toFixed(4)},${e.toFixed(4)}`;
  const query = `[out:json][timeout:25];(way["building"](${box});node["natural"="tree"](${box}););out geom tags;`;

  // 공개 Overpass 서버는 과부하로 504가 자주 나므로 주 서버를 여러 번 재시도한 뒤 보조 서버를 쓴다.
  const attempts = [ENDPOINTS[0], ENDPOINTS[0], ENDPOINTS[0], ENDPOINTS[1]];
  for (let i = 0; i < attempts.length; i++) {
    const endpoint = attempts[i];
    try {
      const json = await queryOverpass(endpoint, query, signal);
      const result = { status: 'ok', ...parseElements(json.elements || []) };
      cache.set(key, result);
      writeStored(key, { buildings: result.buildings, trees: result.trees });
      return result;
    } catch (err) {
      if (signal?.aborted) return { status: 'error', buildings: [], trees: [] };
      console.warn(`OSM fetch failed (${endpoint}):`, err);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  return { status: 'error', buildings: [], trees: [] };
}
