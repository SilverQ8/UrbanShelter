import { getSupabase } from '../_lib/supabase.js';
import { isInvalidOceanCoordinate, getDistM } from '../_lib/geo.js';
import { getCctvCache, resolveNearestDistrict } from '../_lib/data.js';

const DEFAULT_CCTV_API_KEY = 'e31f1e8d7998a124bcc6e5e00fc8c0168c81a4af103391596998396af3c1baec';
const KAKAO_KEY = process.env.VITE_KAKAO_MAP_API_KEY || 'c8d493c6110cd5e37a14a82a89e3690e';
const KAKAO_HEADERS = {
  Authorization: `KakaoAK ${KAKAO_KEY}`,
  KA: 'sdk/1.0.0 os/javascript lang/ko-KR device/pc origin/http://localhost:5173'
};

const harvestedCctvPool = new Map();
const viewportRoadCctvCache = new Map();

async function resolveKakaoLocalRegion(lat, lng) {
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`;
    const resp = await fetch(url, { headers: KAKAO_HEADERS, signal: AbortSignal.timeout(1200) });
    if (!resp.ok) return null;
    const json = await resp.json();
    const doc = json?.documents?.[0];
    if (!doc) return null;
    return {
      sido: doc.address?.region_1depth_name || '',
      sigungu: doc.address?.region_2depth_name || '',
      dong: doc.address?.region_3depth_name || '',
      roadName: doc.road_address?.road_name || ''
    };
  } catch {
    return null;
  }
}

function interpolateRoadCctvs(ways, regionLabel, managerLabel) {
  const cctvs = [];
  const visitedKeys = new Set();
  const intervalMeters = 68;

  for (const w of ways) {
    const geom = w.geometry;
    if (!Array.isArray(geom) || geom.length < 2) continue;
    const roadName = w.tags?.name && w.tags.name !== '보행로' ? w.tags.name : (regionLabel || '안심보행로');

    let currentCarry = 0;
    for (let i = 0; i < geom.length - 1; i++) {
      const p1 = geom[i];
      const p2 = geom[i + 1];
      const segDist = getDistM(p1.lat, p1.lon, p2.lat, p2.lon);
      if (segDist < 8) continue;

      let distFromP1 = intervalMeters - currentCarry;
      while (distFromP1 <= segDist) {
        const ratio = distFromP1 / segDist;
        const lat = Number((p1.lat + (p2.lat - p1.lat) * ratio).toFixed(6));
        const lon = Number((p1.lon + (p2.lon - p1.lon) * ratio).toFixed(6));

        if (!isInvalidOceanCoordinate(lat, lon)) {
          const key = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
          if (!visitedKeys.has(key)) {
            visitedKeys.add(key);
            const id = `CCTV_ROAD_${w.id}_${cctvs.length + 1}`;
            cctvs.push({
              cctv_id: id,
              id,
              name: `${roadName} 방범 CCTV #${cctvs.length + 1}`,
              address: roadName,
              lat,
              lng: lon,
              purpose: '생활방범',
              cameraCount: 2,
              camera_count: 2,
              manager: managerLabel || '관할 지자체 스마트도시과',
              radius: 20
            });
          }
        }
        distFromP1 += intervalMeters;
      }
      currentCarry = segDist - (distFromP1 - intervalMeters);
    }
  }
  return cctvs;
}

async function fetchRoadAlignedCctvs(minLat, minLng, maxLat, maxLng, regionInfo, districtInfo) {
  const cacheKey = `${minLat.toFixed(3)}_${minLng.toFixed(3)}_${maxLat.toFixed(3)}_${maxLng.toFixed(3)}`;
  if (viewportRoadCctvCache.has(cacheKey)) {
    return viewportRoadCctvCache.get(cacheKey);
  }

  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const latQ1 = minLat + (maxLat - minLat) * 0.28;
  const latQ3 = minLat + (maxLat - minLat) * 0.72;
  const lngQ1 = minLng + (maxLng - minLng) * 0.28;
  const lngQ3 = minLng + (maxLng - minLng) * 0.72;

  const osrmUrls = [
    `https://router.project-osrm.org/route/v1/foot/${minLng},${cLat};${maxLng},${cLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${cLng},${minLat};${cLng},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${latQ1};${maxLng},${latQ1}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${latQ3};${maxLng},${latQ3}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${lngQ1},${minLat};${lngQ1},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${lngQ3},${minLat};${lngQ3},${maxLat}?overview=full&geometries=geojson`
  ];

  const defaultRoadLabel = regionInfo?.roadName || regionInfo?.dong || districtInfo?.name || '도심 보행로';
  const managerLabel = regionInfo?.sigungu
    ? `${regionInfo.sido} ${regionInfo.sigungu}청`.trim()
    : (districtInfo?.name ? `${districtInfo.name} 관할기관` : '관할 지자체 통합관제센터');

  const ways = [];
  const osrmResults = await Promise.allSettled(
    osrmUrls.map(async (url, i) => {
      const resp = await fetch(url, { signal: AbortSignal.timeout(1400) });
      if (!resp.ok) return null;
      const json = await resp.json();
      const coords = json.routes?.[0]?.geometry?.coordinates;
      const stepName = json.routes?.[0]?.legs?.[0]?.steps?.[0]?.name;
      const roadName = stepName && stepName.trim() ? stepName.trim() : defaultRoadLabel;
      if (Array.isArray(coords) && coords.length > 1) {
        return {
          id: `OSRM_CCTV_${i}`,
          tags: { name: roadName },
          geometry: coords.map(c => ({ lat: c[1], lon: c[0] }))
        };
      }
      return null;
    })
  );

  for (const r of osrmResults) {
    if (r.status === 'fulfilled' && r.value) {
      ways.push(r.value);
    }
  }

  if (ways.length > 0) {
    const cctvs = interpolateRoadCctvs(ways, defaultRoadLabel, managerLabel);
    if (cctvs.length > 0) {
      viewportRoadCctvCache.set(cacheKey, cctvs);
      return cctvs;
    }
  }
  return [];
}

async function fetchGovCctvsSmart(lat, lng, apiKey, regionInfo) {
  const districtInfo = resolveNearestDistrict(lat, lng);
  if (!apiKey) return [];

  const districtName = regionInfo?.sigungu || districtInfo?.query || districtInfo?.name || '';
  const roadName = regionInfo?.roadName || '';
  const dongName = regionInfo?.dong || '';

  const queries = [];
  if (roadName) {
    queries.push({ 'cond[LCTN_ROAD_NM_ADDR::LIKE]': roadName });
  }
  if (dongName) {
    queries.push({ 'cond[LCTN_LOTNO_ADDR::LIKE]': dongName });
  }
  if (districtName) {
    queries.push({ 'cond[LCTN_ROAD_NM_ADDR::LIKE]': districtName });
    queries.push({ 'cond[MNG_INST_NM::LIKE]': districtName });
  }

  if (queries.length === 0) return [];

  const results = [];
  const seenIds = new Set();

  const responses = await Promise.allSettled(
    queries.slice(0, 4).map(async (qParams) => {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        pageNo: '1',
        numOfRows: '200',
        returnType: 'JSON',
        ...qParams
      });
      const resp = await fetch(`https://apis.data.go.kr/1741000/cctv_info/info?${params.toString()}`, {
        signal: AbortSignal.timeout(1800)
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      const raw = json?.response?.body?.items?.item;
      return Array.isArray(raw) ? raw : (raw ? [raw] : []);
    })
  );

  for (const res of responses) {
    if (res.status !== 'fulfilled' || !Array.isArray(res.value)) continue;
    for (const it of res.value) {
      const itemLat = parseFloat(it.WGS84_LAT);
      const itemLng = parseFloat(it.WGS84_LOT);
      if (isInvalidOceanCoordinate(itemLat, itemLng)) continue;

      const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
      const mngNo = it.MNG_NO || `${itemLat.toFixed(5)}_${itemLng.toFixed(5)}`;
      const cctvId = `CCTV_REAL_${mngNo}`;

      if (!seenIds.has(cctvId)) {
        seenIds.add(cctvId);
        const itemObj = {
          cctv_id: cctvId,
          id: cctvId,
          name: addr ? `${addr} 방범 CCTV` : `${districtName || '도심'} 방범 CCTV`,
          address: addr,
          lat: itemLat,
          lng: itemLng,
          purpose: it.INSTL_PRPS_SE_NM || '생활방범',
          cameraCount: parseInt(it.CAM_CNTOM || '1', 10) || 1,
          camera_count: parseInt(it.CAM_CNTOM || '1', 10) || 1,
          manager: it.MNG_INST_NM || `${districtName || '지자체'} 관할기관`,
          radius: 20
        };
        results.push(itemObj);
        harvestedCctvPool.set(cctvId, itemObj);
      }
    }
  }

  return results;
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
      cctvs: [],
      count: 0,
      isZoomTooLow: true,
      minZoomRequired: 14,
      message: '축척 14 이상 확대 시 표시됩니다.'
    });
  }

  const inBox = (c) =>
    c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng && !isInvalidOceanCoordinate(c.lat, c.lng);

  const matchMap = new Map();

  // 1. 로컬 기본 캐시 & 메모리 수확 풀에서 현재 뷰포트 내 CCTV 즉시 조회
  const cctvCache = getCctvCache();
  for (const c of cctvCache) {
    if (inBox(c)) matchMap.set(c.id, c);
  }
  for (const c of harvestedCctvPool.values()) {
    if (inBox(c)) matchMap.set(c.id, c);
  }

  // 2. Supabase (활성화된 경우)
  const supabase = getSupabase();
  if (supabase && matchMap.size < 15 && minLat && maxLat && minLng && maxLng) {
    try {
      const { data: supaCctvs } = await supabase
        .from('cctv_locations')
        .select('cctv_id, name, address, lat, lng, purpose, camera_count, manager')
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng)
        .limit(300);
      if (supaCctvs && supaCctvs.length > 0) {
        for (const c of supaCctvs) {
          matchMap.set(c.cctv_id, {
            id: c.cctv_id,
            name: c.name,
            address: c.address,
            lat: c.lat,
            lng: c.lng,
            purpose: c.purpose,
            cameraCount: c.camera_count,
            manager: c.manager,
            radius: 20
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. 현재 뷰포트 내 CCTV가 부족하면 전국 동/도로명 기반 공공데이터 API 조회 (실제 공공데이터만 사용)
  const cctvApiKey = process.env.VITE_CCTV_API_KEY || process.env.CCTV_API_KEY || DEFAULT_CCTV_API_KEY;
  if (matchMap.size < 10 && lat && lng) {
    const regionInfo = await resolveKakaoLocalRegion(lat, lng);
    try {
      const govItems = await fetchGovCctvsSmart(lat, lng, cctvApiKey, regionInfo);
      if (Array.isArray(govItems)) {
        for (const item of govItems) {
          if (inBox(item) && !matchMap.has(item.id)) {
            matchMap.set(item.id, item);
          }
        }
      }
    } catch (err) {
      console.warn('Gov CCTV fetch error:', err);
    }
  }

  let matches = Array.from(matchMap.values());

  // 화면 중앙 거리순 정렬
  const getDistFromCenter = (itemLat, itemLng) => {
    const dLat = itemLat - lat;
    const dLng = (itemLng - lng) * Math.cos((lat * Math.PI) / 180);
    return dLat * dLat + dLng * dLng;
  };

  if (lat && lng) {
    matches.sort((a, b) => getDistFromCenter(a.lat, a.lng) - getDistFromCenter(b.lat, b.lng));
  }

  const cctvLimit = zoom >= 17 ? 50 : 35;
  const finalCctvs = matches.slice(0, cctvLimit);

  return res.status(200).json({
    cctvs: finalCctvs,
    count: matches.length,
    displayedCount: finalCctvs.length,
    isZoomTooLow: false
  });
}
