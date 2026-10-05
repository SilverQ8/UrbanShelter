// 지도 타일(OpenFreeMap)의 poi 레이어에서 병원·편의점 같은 장소를 읽는다.
// 정적 파일(CDN)이라 요청 제한이나 서버 오류가 거의 없다.
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { categorizePoi } from '../data/poiCategories';

const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const ZOOM = 14; // poi 레이어가 들어 있는 가장 높은 타일 단계
const MAX_TILES = 9;

let tileTemplatePromise = null;
const tileCache = new Map();

function getTileTemplate() {
  if (!tileTemplatePromise) {
    tileTemplatePromise = fetch(TILEJSON_URL)
      .then((r) => r.json())
      .then((tj) => tj.tiles[0])
      .catch((err) => {
        tileTemplatePromise = null;
        throw err;
      });
  }
  return tileTemplatePromise;
}

function lngToTileX(lng) {
  return Math.floor(((lng + 180) / 360) * 2 ** ZOOM);
}

function latToTileY(lat) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** ZOOM);
}

async function loadTile(x, y, signal) {
  const key = `${ZOOM}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);

  const template = await getTileTemplate();
  const url = template.replace('{z}', ZOOM).replace('{x}', x).replace('{y}', y);
  const resp = await fetch(url, { signal });
  if (!resp.ok) throw new Error(`tile HTTP ${resp.status}`);
  const tile = new VectorTile(new PbfReader(new Uint8Array(await resp.arrayBuffer())));

  const pois = [];
  const layer = tile.layers.poi;
  for (let i = 0; layer && i < layer.length; i++) {
    const f = layer.feature(i);
    const category = categorizePoi(f.properties);
    if (!category) continue;
    const geo = f.toGeoJSON(x, y, ZOOM).geometry;
    if (geo.type !== 'Point') continue;
    pois.push({
      id: `${key}#${i}`,
      name: f.properties['name:ko'] || f.properties.name || '',
      lat: geo.coordinates[1],
      lng: geo.coordinates[0],
      category
    });
  }
  tileCache.set(key, pois);
  return pois;
}

/**
 * @param {{south:number, west:number, north:number, east:number}} bounds
 * @returns {Promise<{status:'ok'|'skipped'|'error', pois:Array}>}
 */
export async function fetchPoisForBounds(bounds, signal) {
  const x0 = lngToTileX(bounds.west);
  const x1 = lngToTileX(bounds.east);
  const y0 = latToTileY(bounds.north); // 위도가 클수록 y가 작다
  const y1 = latToTileY(bounds.south);
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) return { status: 'skipped', pois: [] };

  try {
    const jobs = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadTile(x, y, signal));
    const all = (await Promise.all(jobs)).flat();

    // 범위 안의 장소만, 타일 경계에서 겹친 것은 한 번만
    const seen = new Set();
    const pois = all.filter((p) => {
      if (p.lat < bounds.south || p.lat > bounds.north || p.lng < bounds.west || p.lng > bounds.east) return false;
      const k = `${p.category}|${p.name}|${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { status: 'ok', pois };
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('POI tile fetch failed:', err);
    return { status: 'error', pois: [] };
  }
}
