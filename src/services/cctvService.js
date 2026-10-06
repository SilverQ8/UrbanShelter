import fallbackCctvs from '../data/cctvRealData.json';
import { supabase } from './supabaseClient';

const HAEUNDAE_BOUNDS = {
  minLat: 35.155,
  maxLat: 35.170,
  minLng: 129.150,
  maxLng: 129.170
};

/**
 * Supabase 클라우드 PostGIS 데이터베이스에서 CCTV 조회
 * @param {Object} [bounds] - { minLat, maxLat, minLng, maxLng }
 * @returns {Promise<Array|null>}
 */
export async function fetchCctvsFromSupabase(bounds = null, center = null) {
  try {
    let query = supabase.from('cctv_locations').select('cctv_id, name, address, lat, lng, purpose, camera_count, manager');
    if (bounds) {
      query = query
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lng', bounds.minLng)
        .lte('lng', bounds.maxLng);
    }
    const { data, error } = await query.limit(500);
    if (error || !data || data.length === 0) return null;

    const items = data.map(c => ({
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

    const cLat = center ? center.lat : (bounds ? (bounds.minLat + bounds.maxLat) / 2 : null);
    const cLng = center ? center.lng : (bounds ? (bounds.minLng + bounds.maxLng) / 2 : null);
    if (cLat != null && cLng != null) {
      items.sort((a, b) => {
        const dA = (a.lat - cLat) ** 2 + ((a.lng - cLng) * Math.cos(cLat * Math.PI / 180)) ** 2;
        const dB = (b.lat - cLat) ** 2 + ((b.lng - cLng) * Math.cos(cLat * Math.PI / 180)) ** 2;
        return dA - dB;
      });
    }

    return items;
  } catch (err) {
    console.warn('Supabase CCTV fetch failed, using fallback:', err);
    return null;
  }
}

export async function fetchRealTimeCctvs() {
  // 1. Supabase 클라우드 데이터베이스 우선 조회
  const supabaseCctvs = await fetchCctvsFromSupabase();
  if (supabaseCctvs && supabaseCctvs.length > 0) {
    return {
      cctvs: supabaseCctvs,
      isLive: true,
      isSupabase: true,
      count: supabaseCctvs.length,
      lastSync: new Date().toLocaleTimeString('ko-KR')
    };
  }

  const apiKey = import.meta.env.VITE_CCTV_API_KEY;

  if (!apiKey) {
    console.warn('VITE_CCTV_API_KEY not found in environment, using cached real data.');
    return {
      cctvs: fallbackCctvs,
      isLive: false,
      count: fallbackCctvs.length,
      lastSync: new Date().toLocaleTimeString('ko-KR')
    };
  }

  try {
    // Call via Vite development proxy to avoid CORS and browser restrictions
    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: '100',
      returnType: 'JSON',
      'cond[LCTN_ROAD_NM_ADDR::LIKE]': '해운대'
    });

    const response = await fetch(`/api/cctv/info?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`API HTTP Error ${response.status}`);
    }

    const data = await response.json();
    const items = data?.response?.body?.items?.item || [];

    const realCctvs = [];
    for (const it of items) {
      const lat = parseFloat(it.WGS84_LAT || 0);
      const lng = parseFloat(it.WGS84_LOT || 0);
      const addr = it.LCTN_ROAD_NM_ADDR || '';

      if (
        lat >= HAEUNDAE_BOUNDS.minLat &&
        lat <= HAEUNDAE_BOUNDS.maxLat &&
        lng >= HAEUNDAE_BOUNDS.minLng &&
        lng <= HAEUNDAE_BOUNDS.maxLng
      ) {
        realCctvs.push({
          id: `CCTV_LIVE_${it.MNG_NO || realCctvs.length}`,
          name: addr.replace('부산광역시 해운대구 ', '') || '해운대구 방범 CCTV',
          address: addr,
          lat,
          lng,
          purpose: it.INSTL_PRPS_SE_NM || '방범',
          cameraCount: parseInt(it.CAM_CNTOM || '1', 10),
          manager: it.MNG_INST_NM || '부산광역시 해운대구청',
          radius: 20
        });
      }
    }

    if (realCctvs.length > 0) {
      return {
        cctvs: realCctvs,
        isLive: true,
        count: realCctvs.length,
        lastSync: new Date().toLocaleTimeString('ko-KR')
      };
    } else {
      // If bounds had 0 in first 100, merge with cached dataset
      return {
        cctvs: fallbackCctvs,
        isLive: true,
        count: fallbackCctvs.length,
        lastSync: new Date().toLocaleTimeString('ko-KR')
      };
    }
  } catch (err) {
    console.warn('Real-time CCTV fetch error, falling back to verified dataset:', err);
    return {
      cctvs: fallbackCctvs,
      isLive: false,
      count: fallbackCctvs.length,
      lastSync: new Date().toLocaleTimeString('ko-KR'),
      error: err.message
    };
  }
}
