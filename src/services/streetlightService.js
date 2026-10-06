import rawFallbackStreetlights from '../data/streetlightRealData.json';
import { normalizeFacilityDataset } from '../utils/geoConverter';
import { supabase } from './supabaseClient';

const fallbackStreetlights = normalizeFacilityDataset(rawFallbackStreetlights);

/**
 * Supabase 클라우드 데이터베이스에서 가로등 조회 (1순위 고속 서버 쿼리)
 * @param {Object} [bounds] - { minLat, maxLat, minLng, maxLng }
 * @returns {Promise<Array|null>}
 */
export async function fetchStreetlightsFromSupabase(bounds = null, center = null) {
  try {
    let query = supabase.from('streetlight_locations').select('sl_id, name, address, lat, lng, type, lumens, radius, manager');
    if (bounds) {
      query = query
        .gte('lat', bounds.minLat)
        .lte('lat', bounds.maxLat)
        .gte('lng', bounds.minLng)
        .lte('lng', bounds.maxLng);
    }
    const { data, error } = await query.limit(500);
    if (error || !data || data.length === 0) return null;

    let formatted = data.map(s => ({
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

    const normalized = normalizeFacilityDataset(formatted);

    const cLat = center ? center.lat : (bounds ? (bounds.minLat + bounds.maxLat) / 2 : null);
    const cLng = center ? center.lng : (bounds ? (bounds.minLng + bounds.maxLng) / 2 : null);
    if (cLat != null && cLng != null) {
      normalized.sort((a, b) => {
        const dA = (a.lat - cLat) ** 2 + ((a.lng - cLng) * Math.cos(cLat * Math.PI / 180)) ** 2;
        const dB = (b.lat - cLat) ** 2 + ((b.lng - cLng) * Math.cos(cLat * Math.PI / 180)) ** 2;
        return dA - dB;
      });
    }

    return normalized;
  } catch (err) {
    console.warn('Supabase 가로등 조회 실패 (스마트 폴백 적용):', err);
    return null;
  }
}

/**
 * 가로등/보안등 실시간 및 캐시 데이터 조회 서비스
 */
export async function fetchStreetlightsInViewport(bounds, zoom = 16) {
  const apiKey = import.meta.env.VITE_STREETLIGHT_API_KEY;

  if (zoom < 15) {
    return {
      streetlights: [],
      count: 0,
      isZoomTooLow: true,
      minZoomRequired: 15,
      message: '축척 15 이상 확대 시 표시됩니다.'
    };
  }

  // 1. Supabase 클라우드 데이터베이스 우선 조회
  const supabaseLights = await fetchStreetlightsFromSupabase(bounds);
  if (supabaseLights && supabaseLights.length > 0) {
    return {
      streetlights: supabaseLights,
      count: supabaseLights.length,
      displayedCount: supabaseLights.length,
      isLive: true,
      isSupabase: true,
      isZoomTooLow: false
    };
  }

  // 2. 백엔드 프록시 엔드포인트 호출 시도
  try {
    const centerLat = ((bounds.minLat + bounds.maxLat) / 2).toFixed(6);
    const centerLng = ((bounds.minLng + bounds.maxLng) / 2).toFixed(6);
    const params = new URLSearchParams({
      lat: centerLat,
      lng: centerLng,
      minLat: bounds.minLat.toFixed(6),
      maxLat: bounds.maxLat.toFixed(6),
      minLng: bounds.minLng.toFixed(6),
      maxLng: bounds.maxLng.toFixed(6),
      zoom: String(zoom),
      ...(apiKey ? { key: apiKey } : {})
    });

    const response = await fetch(`/api/streetlight/viewport?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data.streetlights) && data.streetlights.length > 0) {
        return {
          streetlights: data.streetlights,
          count: data.count || data.streetlights.length,
          displayedCount: data.displayedCount || data.streetlights.length,
          isLive: Boolean(data.isLive),
          isZoomTooLow: false
        };
      }
    }
  } catch (err) {
    console.warn('실시간 가로등 API 조회 실패, 스마트 로컬 데이터셋으로 폴백:', err);
  }

  // 2. 스마트 폴백: 현재 뷰포트에 해당하는 가로등 필터링
  const matches = fallbackStreetlights.filter((sl) =>
    sl.lat >= bounds.minLat &&
    sl.lat <= bounds.maxLat &&
    sl.lng >= bounds.minLng &&
    sl.lng <= bounds.maxLng
  );

  return {
    streetlights: matches,
    count: matches.length,
    displayedCount: matches.length,
    isLive: false,
    isZoomTooLow: false
  };
}

/**
 * 두 좌표 간의 거리 (미터) 계산 (Haversine 공식)
 */
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 점 (pLat, pLng)과 선분 (aLat, aLng)-(bLat, bLng) 사이의 최단 거리 (미터)
 */
function distanceToSegmentMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const cosLat = Math.cos((pLat * Math.PI) / 180);
  const px = (pLng - aLng) * 111320 * cosLat;
  const py = (pLat - aLat) * 110574;
  const bx = (bLng - aLng) * 111320 * cosLat;
  const by = (bLat - aLat) * 110574;

  const segLenSq = bx * bx + by * by;
  if (segLenSq < 1e-6) {
    return Math.hypot(px, py);
  }

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  const projX = t * bx;
  const projY = t * by;
  return Math.hypot(px - projX, py - projY);
}

/**
 * 경로 좌표(latlngs)를 따라 안심 조명 범위 내에 배치된 가로등 및 안심 조명 비율 분석
 * (도로 중앙선-보도 이격 거리 및 조명 반경을 고려하여 30m 선분 버퍼 적용)
 * @param {Array<[number, number]>} latlngs 
 * @param {Array<Object>} [availableStreetlights]
 */
export function analyzeRouteStreetlightSafety(latlngs, availableStreetlights = null) {
  if (!latlngs || latlngs.length < 2) {
    return {
      streetlightCount: 0,
      lightCoverageRatio: 0,
      darkZoneMeters: 0,
      matchedLights: []
    };
  }

  const lights = availableStreetlights || fallbackStreetlights;
  const visitedLightIds = new Set();
  const matchedLights = [];

  let litPoints = 0;
  const totalPoints = latlngs.length;

  // 1. 꼭짓점 기준 조명 커버리지 비율
  for (const [lat, lng] of latlngs) {
    let isPointLit = false;
    for (const light of lights) {
      const d = getDistanceMeters(lat, lng, light.lat, light.lng);
      if (d <= 30) {
        isPointLit = true;
        if (!visitedLightIds.has(light.id)) {
          visitedLightIds.add(light.id);
          matchedLights.push(light);
        }
      }
    }
    if (isPointLit) litPoints++;
  }

  // 2. 꼭짓점 간격이 넓은 구간을 위한 선분 기반 추가 매칭
  for (const light of lights) {
    if (visitedLightIds.has(light.id)) continue;
    for (let i = 0; i < latlngs.length - 1; i++) {
      const dist = distanceToSegmentMeters(
        light.lat,
        light.lng,
        latlngs[i][0],
        latlngs[i][1],
        latlngs[i + 1][0],
        latlngs[i + 1][1]
      );
      if (dist <= 30) {
        visitedLightIds.add(light.id);
        matchedLights.push(light);
        break;
      }
    }
  }

  const lightCoverageRatio = Math.min(100, Math.round((litPoints / totalPoints) * 100));

  return {
    streetlightCount: matchedLights.length,
    lightCoverageRatio,
    matchedLights
  };
}
