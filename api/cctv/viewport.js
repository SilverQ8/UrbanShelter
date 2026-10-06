import { getSupabase } from '../_lib/supabase.js';
import { isInvalidOceanCoordinate } from '../_lib/geo.js';
import { getCctvCache, resolveNearestDistrict } from '../_lib/data.js';

async function fetchGovCctvsSmart(lat, lng, apiKey) {
  const districtInfo = resolveNearestDistrict(lat, lng);
  if (!districtInfo || !apiKey) return [];

  const districtName = districtInfo.query || districtInfo.name;
  const queries = [
    { 'cond[MNG_INST_NM::LIKE]': districtName },
    { 'cond[LCTN_LOTNO_ADDR::LIKE]': districtName },
    { 'cond[LCTN_ROAD_NM_ADDR::LIKE]': districtName }
  ];

  const results = [];
  const seenIds = new Set();

  for (const qParams of queries) {
    if (results.length >= 70) break;
    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: '100',
      returnType: 'JSON',
      ...qParams
    });

    try {
      const resp = await fetch(`https://apis.data.go.kr/1741000/cctv_info/info?${params.toString()}`, { signal: AbortSignal.timeout(3500) });
      if (!resp.ok) continue;
      const json = await resp.json();
      const items = json?.response?.body?.items?.item || [];

      for (const it of items) {
        const itemLat = parseFloat(it.WGS84_LAT);
        const itemLng = parseFloat(it.WGS84_LOT);
        if (isInvalidOceanCoordinate(itemLat, itemLng)) continue;

        const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
        const mngNo = it.MNG_NO || `${itemLat}_${itemLng}`;
        const cctvId = `CCTV_REAL_${mngNo}`;

        if (!seenIds.has(cctvId)) {
          seenIds.add(cctvId);
          results.push({
            cctv_id: cctvId,
            id: cctvId,
            name: addr ? `${addr} 방범 CCTV` : `${districtInfo.name} CCTV`,
            address: addr,
            lat: itemLat,
            lng: itemLng,
            purpose: it.INSTL_PRPS_SE_NM || '생활방범',
            camera_count: parseInt(it.CAM_CNTOM || '1', 10) || 1,
            manager: it.MNG_INST_NM || `${districtInfo.name} 관할기관`,
            radius: 20
          });
        }
      }
    } catch {
      // try next
    }
  }

  const supabase = getSupabase();
  if (supabase && results.length > 0) {
    supabase
      .from('cctv_locations')
      .upsert(
        results.map(r => ({
          cctv_id: r.cctv_id,
          name: r.name,
          address: r.address,
          lat: r.lat,
          lng: r.lng,
          purpose: r.purpose,
          camera_count: r.camera_count,
          manager: r.manager
        })),
        { onConflict: 'cctv_id', ignoreDuplicates: true }
      )
      .then(() => {})
      .catch(() => {});
  }

  return results;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const zoom = parseInt(req.query.zoom || '16', 10);
  const minLat = parseFloat(req.query.minLat || '0');
  const maxLat = parseFloat(req.query.maxLat || '0');
  const minLng = parseFloat(req.query.minLng || '0');
  const maxLng = parseFloat(req.query.maxLng || '0');
  const lat = parseFloat(req.query.lat || '0');
  const lng = parseFloat(req.query.lng || '0');

  if (zoom < 13) {
    return res.status(200).json({
      cctvs: [],
      count: 0,
      isZoomTooLow: true,
      minZoomRequired: 13,
      message: '일정 축척 이상 확대 시에만 표시됩니다.'
    });
  }

  let matches = [];
  const supabase = getSupabase();

  // 1. Supabase Cloud Database 우선 조회
  if (supabase && minLat && maxLat && minLng && maxLng) {
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
        matches = supaCctvs.map(c => ({
          id: c.cctv_id,
          name: c.name,
          address: c.address,
          lat: c.lat,
          lng: c.lng,
          purpose: c.purpose,
          cameraCount: c.camera_count,
          manager: c.manager,
          radius: 20
        }));
      }
    } catch {
      // fallback
    }
  }

  // 2. Base cache fallback
  const cctvCache = getCctvCache();
  if (matches.length < 5) {
    const localMatches = cctvCache.filter(c =>
      c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng && !isInvalidOceanCoordinate(c.lat, c.lng)
    );
    const existingIds = new Set(matches.map(c => c.id));
    for (const m of localMatches) {
      if (!existingIds.has(m.id)) {
        matches.push(m);
        existingIds.add(m.id);
      }
    }
  }

  // 3. Dynamic harvesting
  const cctvApiKey = process.env.VITE_CCTV_API_KEY || process.env.CCTV_API_KEY;
  if (matches.length < 5 && lat && lng && cctvApiKey) {
    try {
      const govItems = await fetchGovCctvsSmart(lat, lng, cctvApiKey);
      const existingIds = new Set(matches.map(c => c.id));
      for (const item of govItems) {
        if (!existingIds.has(item.id)) {
          matches.push(item);
          existingIds.add(item.id);
        }
      }
    } catch {
      // ignore
    }
  }

  // Strict Viewport Bounding Box Filtering (화면 바깥 100% 완전 배제)
  if (minLat && maxLat && minLng && maxLng) {
    matches = matches.filter(c =>
      c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng && !isInvalidOceanCoordinate(c.lat, c.lng)
    );
  }

  // Center-priority sorting: 화면 중앙에서 가장 가까운 마커부터 우선 정렬
  const getDistFromCenter = (itemLat, itemLng) => {
    const dLat = itemLat - lat;
    const dLng = (itemLng - lng) * Math.cos((lat * Math.PI) / 180);
    return dLat * dLat + dLng * dLng;
  };

  if (lat && lng) {
    matches.sort((a, b) => getDistFromCenter(a.lat, a.lng) - getDistFromCenter(b.lat, b.lng));
  }

  const cctvLimit = zoom >= 17 ? 150 : 100;
  const finalCctvs = matches.slice(0, cctvLimit);

  return res.status(200).json({
    cctvs: finalCctvs,
    count: matches.length,
    displayedCount: finalCctvs.length,
    isZoomTooLow: false
  });
}
