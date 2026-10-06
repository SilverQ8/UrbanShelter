import fallbackStreetlights from '../data/streetlightRealData.json';

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

  // 1. API 키 또는 백엔드 프록시 엔드포인트 호출 시도
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

const SAMPLE_INTERVAL_METERS = 5; // 경로를 이 간격으로 나눠 조명 여부를 본다
const LIGHT_SEARCH_MARGIN_DEG = 0.0006; // 경로 범위 바깥 약 65m까지의 가로등만 후보로 본다

/**
 * 경로를 따라 일정 간격(m)마다 점을 만든다. 경로 꼭짓점 간격에 결과가 좌우되지 않게 하기 위함이다.
 */
function sampleAlongRoute(latlngs, intervalMeters) {
  const samples = [latlngs[0]];
  for (let i = 0; i < latlngs.length - 1; i++) {
    const [lat1, lng1] = latlngs[i];
    const [lat2, lng2] = latlngs[i + 1];
    const segLen = getDistanceMeters(lat1, lng1, lat2, lng2);
    const steps = Math.max(1, Math.round(segLen / intervalMeters));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      samples.push([lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]);
    }
  }
  return samples;
}

/**
 * 경로를 5m 간격으로 나눠, 가로등 조명 반경(기본 15m) 안에 드는 구간의 비율을 분석한다.
 * @param {Array<[number, number]>} latlngs
 * @param {Array<Object>} [availableStreetlights]
 * @returns {{ streetlightCount: number, lightCoverageRatio: number, darkZoneMeters: number, matchedLights: Array<Object> }}
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

  const allLights = availableStreetlights || fallbackStreetlights;

  // 전국 가로등 중 경로 근처 것만 추려 거리 계산 횟수를 줄인다
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of latlngs) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  const lights = allLights.filter(
    (l) =>
      l.lat >= minLat - LIGHT_SEARCH_MARGIN_DEG && l.lat <= maxLat + LIGHT_SEARCH_MARGIN_DEG &&
      l.lng >= minLng - LIGHT_SEARCH_MARGIN_DEG && l.lng <= maxLng + LIGHT_SEARCH_MARGIN_DEG
  );

  const samples = sampleAlongRoute(latlngs, SAMPLE_INTERVAL_METERS);
  const visitedLightIds = new Set();
  const matchedLights = [];
  let litSamples = 0;

  for (const [lat, lng] of samples) {
    let isLit = false;
    for (const light of lights) {
      const radius = light.radius || 15; // 15m 조명 반경
      if (getDistanceMeters(lat, lng, light.lat, light.lng) <= radius) {
        isLit = true;
        if (!visitedLightIds.has(light.id)) {
          visitedLightIds.add(light.id);
          matchedLights.push(light);
        }
      }
    }
    if (isLit) litSamples++;
  }

  const litRatio = litSamples / samples.length;

  return {
    streetlightCount: matchedLights.length,
    lightCoverageRatio: Math.round(litRatio * 100),
    darkZoneMeters: Math.round((1 - litRatio) * samples.length * SAMPLE_INTERVAL_METERS),
    matchedLights
  };
}
