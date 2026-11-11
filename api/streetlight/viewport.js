import proj4 from 'proj4';
import { getSupabase } from '../_lib/supabase.js';
import { isInvalidOceanCoordinate, getDistM } from '../_lib/geo.js';
import { getStreetlightCache, resolveNearestDistrict } from '../_lib/data.js';

const KAKAO_KEY = process.env.VITE_KAKAO_MAP_API_KEY || 'c8d493c6110cd5e37a14a82a89e3690e';
const KAKAO_HEADERS = {
  Authorization: `KakaoAK ${KAKAO_KEY}`,
  KA: 'sdk/1.0.0 os/javascript lang/ko-KR device/pc origin/http://localhost:5173'
};
const SAFETY_API_KEY = process.env.VITE_STREETLIGHT_API_KEY || '1H310859JSVJG543';
const nationwideDynamicCache = new Map();

async function resolveEmdCode(lat, lng) {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`;
    const resp = await fetch(url, { headers: KAKAO_HEADERS, signal: AbortSignal.timeout(1200) });
    if (!resp.ok) return null;
    const json = await resp.json();
    const bDoc = json?.documents?.find(x => x.region_type === 'B');
    if (!bDoc?.code) return null;
    return {
      emdCd: bDoc.code.slice(0, 8),
      addressName: bDoc.address_name,
      dong: bDoc.region_3depth_name
    };
  } catch {
    return null;
  }
}

async function fetchNationwideStreetlightsByEmd(emdCd, dongName) {
  if (nationwideDynamicCache.has(emdCd)) {
    return nationwideDynamicCache.get(emdCd);
  }

  const items = [];
  try {
    const params = new URLSearchParams({
      serviceKey: SAFETY_API_KEY,
      pageNo: '1',
      numOfRows: '1000',
      returnType: 'json',
      emdCd
    });
    const url = `https://www.safetydata.go.kr/V2/api/DSSP-IF-00084?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const body = data.body || [];
      for (const it of body) {
        if (!it.XMAP_CRTS || !it.YMAP_CRTS) continue;
        const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [parseFloat(it.XMAP_CRTS), parseFloat(it.YMAP_CRTS)]);
        if (isNaN(lat) || isNaN(lng) || isInvalidOceanCoordinate(lat, lng)) continue;

        const roadAddr = it.ROAD_NM_ADDR || it.ADDR || '';
        items.push({
          id: `SL_SAFETY_${it.SN || `${lat.toFixed(5)}_${lng.toFixed(5)}`}`,
          name: roadAddr ? `${roadAddr} 안심가로등` : `${dongName || '도심'} 안심가로등`,
          address: roadAddr || dongName || '',
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          type: 'smart_led',
          lumens: 7500,
          radius: 15,
          manager: it.FCLT_GVMNFC_NM || '관할 지자체 도로관리청'
        });
      }
    }
  } catch (err) {
    console.warn(`[DSSP] ${emdCd} fetch error:`, err.message);
  }

  nationwideDynamicCache.set(emdCd, items);
  return items;
}

async function resolveLocalRoadAndManager(lat, lng) {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`;
    const resp = await fetch(url, { headers: KAKAO_HEADERS, signal: AbortSignal.timeout(1200) });
    if (!resp.ok) return null;
    const json = await resp.json();
    const doc = json?.documents?.[0];
    if (!doc) return null;
    const sido = doc.address?.region_1depth_name || '';
    const sigungu = doc.address?.region_2depth_name || '';
    const dong = doc.address?.region_3depth_name || '';
    const roadName = doc.road_address?.road_name || dong || sigungu || '보행로';
    const manager = sigungu ? `${sido} ${sigungu} 도로관리과`.trim() : '관할 지자체 도로관리과';
    return { roadName, manager };
  } catch {
    return null;
  }
}

function interpolateRoadStreetlights(ways, defaultRoadName = '보행로', defaultManager = '관할 지자체 도로관리과') {
  const lights = [];
  const visitedCoordKeys = new Set();

  for (const w of ways) {
    const geom = w.geometry;
    if (!Array.isArray(geom) || geom.length < 2) continue;

    const rawName = w.tags?.name || '';
    const roadName = rawName && rawName !== '보행로' ? rawName : defaultRoadName;
    const hwType = w.tags?.highway || '';
    const isMain = ['primary', 'secondary', 'tertiary'].includes(hwType);
    const intervalMeters = isMain ? 55 : 45;

    let currentCarry = 0;
    for (let i = 0; i < geom.length - 1; i++) {
      const p1 = geom[i];
      const p2 = geom[i + 1];
      const segDist = getDistM(p1.lat, p1.lon, p2.lat, p2.lon);
      if (segDist < 5) continue;

      let distFromP1 = intervalMeters - currentCarry;
      while (distFromP1 <= segDist) {
        const ratio = distFromP1 / segDist;
        const lat = Number((p1.lat + (p2.lat - p1.lat) * ratio).toFixed(6));
        const lon = Number((p1.lon + (p2.lon - p1.lon) * ratio).toFixed(6));

        if (!isInvalidOceanCoordinate(lat, lon)) {
          const key = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
          if (!visitedCoordKeys.has(key)) {
            visitedCoordKeys.add(key);
            lights.push({
              id: `SL_ROAD_${w.id}_${lights.length + 1}`,
              name: `${roadName} 가로등 #${lights.length + 1}`,
              address: roadName,
              lat,
              lng: lon,
              type: roadName.includes('해변') ? 'coastal_led' : 'smart_led',
              lumens: isMain ? 9000 : 7500,
              radius: 15,
              manager: defaultManager
            });
          }
        }
        distFromP1 += intervalMeters;
      }
      currentCarry = segDist - (distFromP1 - intervalMeters);
    }
  }
  return lights;
}

const viewportRoadCache = new Map();

async function fetchOsmRoadStreetlights(minLat, minLng, maxLat, maxLng) {
  const cacheKey = `${minLat.toFixed(3)}_${minLng.toFixed(3)}_${maxLat.toFixed(3)}_${maxLng.toFixed(3)}`;
  if (viewportRoadCache.has(cacheKey)) {
    return viewportRoadCache.get(cacheKey);
  }

  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const latQ1 = minLat + (maxLat - minLat) * 0.25;
  const latQ3 = minLat + (maxLat - minLat) * 0.75;
  const lngQ1 = minLng + (maxLng - minLng) * 0.25;
  const lngQ3 = minLng + (maxLng - minLng) * 0.75;

  // 화면 전체 도로망(상·중·하 가로축 + 좌·중·우 세로축 + 대각선)을 커버하는 8개 보행 축 병렬 추출
  const osrmUrls = [
    `https://router.project-osrm.org/route/v1/foot/${minLng},${cLat};${maxLng},${cLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${latQ1};${maxLng},${latQ1}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${latQ3};${maxLng},${latQ3}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${cLng},${minLat};${cLng},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${lngQ1},${minLat};${lngQ1},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${lngQ3},${minLat};${lngQ3},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${minLat};${maxLng},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${maxLat};${maxLng},${minLat}?overview=full&geometries=geojson`
  ];

  const [localInfo, ...osrmResults] = await Promise.all([
    resolveLocalRoadAndManager(cLat, cLng),
    ...osrmUrls.map(async (url, i) => {
      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (!resp.ok) return null;
        const json = await resp.json();
        const coords = json.routes?.[0]?.geometry?.coordinates;
        const roadName = json.routes?.[0]?.legs?.[0]?.steps?.[0]?.name || '';
        if (Array.isArray(coords) && coords.length > 1) {
          return {
            id: `OSRM_ROAD_${i}`,
            tags: { name: roadName, highway: 'residential' },
            geometry: coords.map(c => ({ lat: c[1], lon: c[0] }))
          };
        }
      } catch {
        // ignore
      }
      return null;
    })
  ]);

  const ways = osrmResults.filter(Boolean);
  const district = resolveNearestDistrict(cLat, cLng);
  const defaultRoadName = localInfo?.roadName || district?.name || '안심보행로';
  const defaultManager = localInfo?.manager || (district?.name ? `${district.name} 도로관리과` : '관할 지자체 도로관리과');

  if (ways.length > 0) {
    const lights = interpolateRoadStreetlights(ways, defaultRoadName, defaultManager);
    if (lights.length > 0) {
      viewportRoadCache.set(cacheKey, lights);
      return lights;
    }
  }

  return [];
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  const zoom = parseInt(req.query.zoom || '16', 10);
  const minLat = parseFloat(req.query.minLat || '0');
  const maxLat = parseFloat(req.query.maxLat || '0');
  const minLng = parseFloat(req.query.minLng || '0');
  const maxLng = parseFloat(req.query.maxLng || '0');
  const lat = parseFloat(req.query.lat || '0') || (minLat + maxLat) / 2;
  const lng = parseFloat(req.query.lng || '0') || (minLng + maxLng) / 2;

  if (zoom < 14) {
    return res.status(200).json({
      streetlights: [],
      count: 0,
      isZoomTooLow: true,
      minZoomRequired: 14,
      message: '축척 14 이상 확대 시 표시됩니다.'
    });
  }

  let matches = [];
  const supabase = getSupabase();

  // 1. Supabase Cloud Database 조회 (활성화된 경우)
  if (supabase && minLat && maxLat && minLng && maxLng) {
    try {
      const { data: supaLights } = await supabase
        .from('streetlight_locations')
        .select('sl_id, name, address, lat, lng, type, lumens, radius, manager')
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng)
        .limit(300);
      if (supaLights && supaLights.length > 0) {
        matches = supaLights.map(s => ({
          id: s.sl_id,
          name: s.name,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          type: s.type || 'smart_led',
          lumens: s.lumens || 8000,
          radius: s.radius || 15,
          manager: s.manager || '지자체 도로관리과'
        }));
      }
    } catch {
      // fallback
    }
  }

  // 2. 로컬 캐시 조회 (부산광역시 39,348개 실제 공공 가로등 데이터셋)
  const slCache = getStreetlightCache();
  const localMatches = slCache.filter(s =>
    s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng && !isInvalidOceanCoordinate(s.lat, s.lng)
  );
  const existingIds = new Set(matches.map(s => s.id));
  for (const m of localMatches) {
    if (!existingIds.has(m.id)) {
      matches.push(m);
      existingIds.add(m.id);
    }
  }

  // 3. 전국 실시간 온디맨드 조회 (서울, 경기, 대구, 인천, 대전, 광주, 제주 등 전국 모든 지역)
  if (matches.length < 50 && lat && lng) {
    try {
      const region = await resolveEmdCode(lat, lng);
      if (region?.emdCd) {
        const liveLights = await fetchNationwideStreetlightsByEmd(region.emdCd, region.dong);
        for (const item of liveLights) {
          if (!existingIds.has(item.id)) {
            matches.push(item);
            existingIds.add(item.id);
          }
        }
      }
    } catch (err) {
      console.warn('Nationwide live streetlight fetch error:', err);
    }
  }

  // Strict Viewport Bounding Box Filtering
  if (minLat && maxLat && minLng && maxLng) {
    matches = matches.filter(s =>
      s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng && !isInvalidOceanCoordinate(s.lat, s.lng)
    );
  }

  // 화면 중앙 거리순 정렬
  const getLightDistFromCenter = (itemLat, itemLng) => {
    const dLat = itemLat - lat;
    const dLng = (itemLng - lng) * Math.cos((lat * Math.PI) / 180);
    return dLat * dLat + dLng * dLng;
  };

  if (lat && lng) {
    matches.sort((a, b) => getLightDistFromCenter(a.lat, a.lng) - getLightDistFromCenter(b.lat, b.lng));
  }

  const slLimit = 200;
  const finalLights = matches.slice(0, slLimit);

  return res.status(200).json({
    streetlights: finalLights,
    count: matches.length,
    displayedCount: finalLights.length,
    isZoomTooLow: false
  });
}
