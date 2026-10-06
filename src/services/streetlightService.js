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

/**
 * 경로 좌표(latlngs)를 따라 15m 버퍼 내에 배치된 가로등 및 안심 조명 비율 분석
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

  for (const [lat, lng] of latlngs) {
    let isPointLit = false;
    for (const light of lights) {
      const d = getDistanceMeters(lat, lng, light.lat, light.lng);
      const radius = light.radius || 15; // 15m 조명 반경
      if (d <= radius) {
        isPointLit = true;
        if (!visitedLightIds.has(light.id)) {
          visitedLightIds.add(light.id);
          matchedLights.push(light);
        }
      }
    }
    if (isPointLit) litPoints++;
  }

  const lightCoverageRatio = Math.round((litPoints / totalPoints) * 100);

  return {
    streetlightCount: matchedLights.length,
    lightCoverageRatio,
    matchedLights
  };
}
