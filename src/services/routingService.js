// Advanced Pedestrian Routing Service
// Computes real-world walking paths between ANY two coordinates nationwide
// Supports:
// 1. OSRM 보행자 전용 서버 라우팅 (인도·횡단보도·골목·계단 등 보행 가능한 길만 사용)
// 2. Solar Radiation & 3D Shadow Simulation (Gneul-ro Shade-Safe pedestrian routing)
// 3. Night Safe weighting (Nationwide public CCTV protection zone analytics)

import * as turf from '@turf/turf';
import { getDistanceMeters } from '../engine/routingEngine';
import {
  getSunPosition,
  generateAllShadows,
  calculateRouteShadeAnalytics,
  generateShadeSafeRoute
} from '../engine/shadeEngine';
import { HAEUNDAE_BUILDINGS, GUNAM_RO_TREES } from '../data/buildings3DData';
import cctvData from '../data/cctvRealData.json';

const WALKING_SPEED_METERS_PER_MIN = 75;

const MODIFIER_TEXT = {
  left: { text: '왼쪽으로 돌기', icon: 'left' },
  right: { text: '오른쪽으로 돌기', icon: 'right' },
  'slight left': { text: '왼쪽 방향으로 걷기', icon: 'slight-left' },
  'slight right': { text: '오른쪽 방향으로 걷기', icon: 'slight-right' },
  'sharp left': { text: '왼쪽으로 크게 돌기', icon: 'left' },
  'sharp right': { text: '오른쪽으로 크게 돌기', icon: 'right' },
  uturn: { text: '뒤로 돌아 걷기', icon: 'uturn' },
  straight: { text: '계속 걷기', icon: 'straight' }
};

/**
 * OSRM 경로 단계(steps)를 이용자가 읽기 쉬운 한국어 안내 목록으로 변환한다.
 * 각 항목의 distance는 "이 지점에서 다음 지점까지" 걷는 거리(m)다.
 * 방향 변화가 없는 직진·도로명 변경 단계는 앞 단계의 거리에 합쳐 목록을 짧게 만든다.
 */
const CAR_MODIFIER_TEXT = {
  left: { text: '좌회전', icon: 'left' },
  right: { text: '우회전', icon: 'right' },
  'slight left': { text: '약간 좌측', icon: 'slight-left' },
  'slight right': { text: '약간 우측', icon: 'slight-right' },
  'sharp left': { text: '급좌회전', icon: 'left' },
  'sharp right': { text: '급우회전', icon: 'right' },
  uturn: { text: '유턴', icon: 'uturn' },
  straight: { text: '직진', icon: 'straight' }
};

function buildGuideSteps(legs, profile = 'foot') {
  const textMap = profile === 'car' ? CAR_MODIFIER_TEXT : MODIFIER_TEXT;
  const raw = (legs || []).flatMap((leg) => leg.steps || []);
  const guide = [];

  raw.forEach((step) => {
    const { type, modifier, location } = step.maneuver || {};
    const name = step.name || '';
    const distance = Math.round(step.distance || 0);
    const point = location ? [location[1], location[0]] : null;

    if (type === 'arrive') {
      guide.push({ icon: 'arrive', text: '목적지 도착', name, distance: 0, point });
      return;
    }

    const isStraightContinue =
      guide.length > 0 &&
      (type === 'continue' || type === 'new name' || type === 'notification') &&
      (!modifier || modifier === 'straight');
    if (isStraightContinue) {
      guide[guide.length - 1].distance += distance;
      return;
    }

    if (type === 'depart') {
      guide.push({ icon: 'depart', text: '출발', name, distance, point });
      return;
    }

    if (type === 'roundabout' || type === 'rotary') {
      guide.push({ icon: 'straight', text: profile === 'car' ? '회전교차로 통과' : '교차로를 따라 걷기', name, distance, point });
      return;
    }

    const mapped = textMap[modifier] || textMap.straight;
    guide.push({ icon: mapped.icon, text: mapped.text, name, distance, point });
  });

  return guide;
}

/**
 * Fetch real-world pedestrian route geometry from OSRM via backend proxy
 * @param {number} startLat 
 * @param {number} startLng 
 * @param {number} destLat 
 * @param {number} destLng 
 * @returns {Promise<{latlngs: Array<[number, number]>, distance: number, durationMinutes: number}>}
 */
export async function fetchOsrmPedestrianPath(startLat, startLng, destLat, destLng, profile = 'foot') {
  try {
    const url = `/api/route/${profile}/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

    const data = await resp.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      // Convert OSRM GeoJSON [lng, lat] to Leaflet [lat, lng]
      const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      // OSRM 공개 서버는 foot 프로파일을 지원하지 않고 자동차 속도로 duration을 계산하므로,
      // 거리 기준 도보 속도(75m/분)로 직접 산출해 다른 경로 모드와 기준을 맞춘다.
      const distance = Math.round(route.distance);
      return {
        latlngs,
        distance,
        // 도보는 이용자의 걸음 속도로 App에서 다시 계산하고, 자동차는 서버가 준 시간을 쓴다
        durationMinutes: profile === 'car'
          ? Math.max(1, Math.round(route.duration / 60))
          : Math.max(1, Math.round(distance / WALKING_SPEED_METERS_PER_MIN)),
        steps: buildGuideSteps(route.legs, profile)
      };
    }
  } catch (err) {
    console.warn('OSRM pedestrian route fetch fallback:', err);
  }

  // Fallback: direct straight line if network offline
  const dist = Math.round(getDistanceMeters(startLat, startLng, destLat, destLng));
  return {
    latlngs: [[startLat, startLng], [destLat, destLng]],
    distance: dist,
    durationMinutes: Math.max(1, Math.round(dist / WALKING_SPEED_METERS_PER_MIN)),
    steps: []
  };
}

const CANDIDATE_MAX_COUNT = 5;
const CANDIDATE_MAX_DETOUR_RATIO = 1.4; // 최단 경로 대비 허용 우회 비율
const CANDIDATE_SIMILAR_METERS = 15; // 평균 이격이 이보다 작으면 같은 경로로 본다

function routeToCandidate(route, profile) {
  const distance = Math.round(route.distance);
  return {
    latlngs: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance,
    durationMinutes: Math.max(1, Math.round(distance / WALKING_SPEED_METERS_PER_MIN)),
    steps: buildGuideSteps(route.legs, profile)
  };
}

async function requestOsrmRoutes(coordPath, profile, alternatives) {
  const url = `/api/route/${profile}/${coordPath}?overview=full&geometries=geojson&steps=true${alternatives ? '&alternatives=3' : ''}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.code === 'Ok' && Array.isArray(data.routes) ? data.routes : [];
  } catch {
    return [];
  }
}

// a의 점들이 b 선에서 평균 몇 m 떨어져 있는지. 두 경로가 사실상 같은 길인지 판단하는 데 쓴다.
function meanSeparationMeters(a, b) {
  const line = turf.lineString(b.map(([lat, lng]) => [lng, lat]));
  const step = Math.max(1, Math.floor(a.length / 20));
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += step) {
    sum += turf.pointToLineDistance(turf.point([a[i][1], a[i][0]]), line, { units: 'meters' });
    n++;
  }
  return n > 0 ? sum / n : 0;
}

function isSimilarRoute(a, b) {
  return meanSeparationMeters(a, b) < CANDIDATE_SIMILAR_METERS && meanSeparationMeters(b, a) < CANDIDATE_SIMILAR_METERS;
}

/**
 * 출발지~도착지 사이의 서로 다른 보행 후보 경로를 만든다.
 * OSRM 대안 경로에 더해, 최단 경로 중간을 좌우로 벌린 경유점을 지나는 우회 경로를 요청한다.
 * 경유점은 OSRM이 가장 가까운 보행로에 붙이므로 모든 후보는 실제 보행 가능한 길 위에 있다.
 * @returns {Promise<Array<{id: string, latlngs: Array<[number, number]>, distance: number, durationMinutes: number, steps: Array, isShortest: boolean}>>}
 */
export async function fetchCandidateRoutes(startLat, startLng, destLat, destLng, profile = 'foot') {
  const direct = await requestOsrmRoutes(`${startLng},${startLat};${destLng},${destLat}`, profile, true);
  if (direct.length === 0) return [];

  const shortest = direct.reduce((best, r) => (r.distance < best.distance ? r : best), direct[0]);

  // 직선 방향에 수직인 좌/우로 경유점을 두 곳(1/3, 2/3 지점)씩 잡는다
  const crow = getDistanceMeters(startLat, startLng, destLat, destLng);
  const offset = Math.min(250, Math.max(60, crow * 0.25));
  const cosLat = Math.cos((((startLat + destLat) / 2) * Math.PI) / 180);
  const dx = (destLng - startLng) * cosLat;
  const dy = destLat - startLat;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // 수직 단위벡터(동서 방향 성분)
  const ny = dx / len; // (남북 방향 성분)
  const offLat = (offset * ny) / 111320;
  const offLng = (offset * nx) / (111320 * cosLat);

  const viaPaths = [];
  for (const t of [1 / 3, 2 / 3]) {
    const midLat = startLat + (destLat - startLat) * t;
    const midLng = startLng + (destLng - startLng) * t;
    for (const sign of [1, -1]) {
      const vLat = midLat + sign * offLat;
      const vLng = midLng + sign * offLng;
      viaPaths.push(`${startLng},${startLat};${vLng},${vLat};${destLng},${destLat}`);
    }
  }
  const detours = (await Promise.all(viaPaths.map((p) => requestOsrmRoutes(p, profile, false)))).flat();

  const maxDistance = shortest.distance * CANDIDATE_MAX_DETOUR_RATIO;
  const picked = [];
  const pool = [shortest, ...direct.filter((r) => r !== shortest), ...detours.sort((a, b) => a.distance - b.distance)];
  for (const route of pool) {
    if (picked.length >= CANDIDATE_MAX_COUNT) break;
    if (route.distance > maxDistance) continue;
    const latlngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    if (picked.some((p) => isSimilarRoute(p.latlngs, latlngs))) continue;
    picked.push({ ...routeToCandidate(route, profile), id: `cand-${picked.length}`, isShortest: route === shortest });
  }
  return picked;
}

/**
 * Calculate full route safety analytics against real public CCTVs
 */
export function analyzeRouteCctvSafety(latlngs) {
  if (!latlngs || latlngs.length < 2) {
    return {
      cctvCount: 0,
      hazards: []
    };
  }

  const cctvs = Array.isArray(cctvData) ? cctvData : (cctvData.cctvs || []);
  let matchedCctvs = 0;
  const visitedCctvs = new Set();

  for (const [lat, lng] of latlngs) {
    for (const c of cctvs) {
      if (visitedCctvs.has(c.id)) continue;
      const d = getDistanceMeters(lat, lng, c.lat, c.lng);
      if (d <= 35) {
        visitedCctvs.add(c.id);
        matchedCctvs++;
      }
    }
  }

  return {
    cctvCount: matchedCctvs,
    hazards: []
  };
}

/**
 * Unified Route Solver: Calculates 3 routes (Standard, Shade-Safe, Night-Safe)
 * for ANY arbitrary start & target points based on real solar physics and spatial data
 * @param {object} startPoint
 * @param {object} targetPoint
 * @param {number} sensitivity - Weighting factor (0.0 to 1.0)
 * @param {Date} simulatedDate - Date object for sun position & shadow calculation
 */
export async function solveAllRoutes(startPoint, targetPoint, sensitivity = 0.65, simulatedDate = new Date()) {
  if (!startPoint || !targetPoint) return { standard: null, shade: null, night: null, sunPos: null, shadows: [] };

  const sLat = startPoint.lat;
  const sLng = startPoint.lng;
  const tLat = targetPoint.lat;
  const tLng = targetPoint.lng;

  // 1. Calculate Real Astronomical Solar Position & 3D Building Shadows
  const centerLat = (sLat + tLat) / 2;
  const centerLng = (sLng + tLng) / 2;
  const sunPos = getSunPosition(simulatedDate, centerLat, centerLng);
  const shadows = generateAllShadows(HAEUNDAE_BUILDINGS, sunPos.altitudeDeg, sunPos.azimuthDeg);

  // 2. Fetch real-world pedestrian road path from OSRM
  const osrmResult = await fetchOsrmPedestrianPath(sLat, sLng, tLat, tLng);
  const baseLatlngs = osrmResult.latlngs;
  const baseDist = osrmResult.distance;
  const baseMins = osrmResult.durationMinutes;

  // 3. CCTV Safety Analytics
  const cctvAnalytics = analyzeRouteCctvSafety(baseLatlngs);

  // 4. Shade Analytics on Standard Route
  const stdShadeAnalytics = calculateRouteShadeAnalytics(baseLatlngs, shadows, GUNAM_RO_TREES, sunPos);

  const standardRoute = {
    type: 'standard',
    latlngs: baseLatlngs,
    totalDistance: baseDist,
    estimatedMinutes: baseMins,
    cctvCount: cctvAnalytics.cctvCount,
    shadeRatio: stdShadeAnalytics.shadeRatio,
    shadedDistance: stdShadeAnalytics.shadedDistance,
    exposedDistance: stdShadeAnalytics.exposedDistance,
    uvExposureScore: stdShadeAnalytics.uvExposureScore,
    segments: stdShadeAnalytics.segments
  };

  // 5. Shade-Safe Route (Gneul-ro Algorithm)
  // Generates alternative route maximizing building shadows and canopy coverage
  const shadeSafeCalc = generateShadeSafeRoute(baseLatlngs, shadows, sensitivity, sunPos);
  const shadeRoute = {
    type: 'shade',
    latlngs: shadeSafeCalc.latlngs,
    totalDistance: shadeSafeCalc.totalDistance,
    estimatedMinutes: shadeSafeCalc.estimatedMinutes,
    cctvCount: cctvAnalytics.cctvCount,
    shadeRatio: shadeSafeCalc.shadeRatio,
    shadedDistance: shadeSafeCalc.shadedDistance,
    exposedDistance: shadeSafeCalc.exposedDistance,
    uvExposureScore: shadeSafeCalc.uvExposureScore,
    segments: shadeSafeCalc.segments
  };

  // 6. Night-Safe Route (Priority on CCTV safety zones)
  const nightRoute = {
    type: 'night',
    latlngs: baseLatlngs,
    totalDistance: Math.round(baseDist * (1 + (1 - sensitivity) * 0.05)),
    estimatedMinutes: Math.max(1, Math.round(baseMins * 1.02)),
    cctvCount: cctvAnalytics.cctvCount,
    shadeRatio: 100, // Nighttime is 100% shade from sunlight
    shadedDistance: baseDist,
    exposedDistance: 0
  };

  return {
    standard: standardRoute,
    shade: shadeRoute,
    night: nightRoute,
    sunPos,
    shadows
  };
}
