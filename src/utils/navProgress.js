// 실시간 위치(GPS)를 길 안내 단계에 맞추는 계산. 화면과 무관한 순수 함수라 따로 테스트할 수 있다.

export const MIN_ON_ROUTE_M = 40; // 이 거리 안이면 경로 위에 있다고 본다
export const MAX_ON_ROUTE_M = 100; // GPS 오차가 커도 이 이상 벗어나면 경로 이탈로 본다
export const NEAR_DESTINATION_M = 50; // 목적지까지 이 거리 안이면 "이 주변"으로 안내한다

export function distanceM(a, b) {
  const dLat = (b[0] - a[0]) * 111320;
  const dLng = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

// 안내 지점(회전 위치)은 경로의 꼭짓점 위에 있으므로 가장 가까운 꼭짓점 번호를 쓴다
function nearestVertexIndex(point, latlngs) {
  let index = 0;
  let best = Infinity;
  for (let i = 0; i < latlngs.length; i++) {
    const d = distanceM(point, latlngs[i]);
    if (d < best) {
      best = d;
      index = i;
    }
  }
  return index;
}

// 점에서 경로까지의 거리: 꼭짓점이 아니라 선분에 내린 수선 기준(직선 구간이 길어도 정확하다)
// index는 가장 가까운 선분의 시작 꼭짓점 번호다.
function nearestOnRoute(point, latlngs) {
  const kLng = 111320 * Math.cos((point[0] * Math.PI) / 180);
  let index = 0;
  let dist = Infinity;
  for (let i = 0; i < latlngs.length - 1; i++) {
    const ax = (latlngs[i][1] - point[1]) * kLng;
    const ay = (latlngs[i][0] - point[0]) * 111320;
    const bx = (latlngs[i + 1][1] - point[1]) * kLng;
    const by = (latlngs[i + 1][0] - point[0]) * 111320;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < dist) {
      dist = d;
      index = i;
    }
  }
  return { index, dist };
}

/**
 * @param {{lat:number,lng:number,accuracy?:number}} pos 현재 위치
 * @param {Array<[number,number]>} latlngs 안내 기준 경로
 * @param {Array<{point:[number,number]|null}>} steps 길 안내 단계
 * @param {{lat:number,lng:number}} target 목적지
 */
export function computeProgress(pos, latlngs, steps, target) {
  if (!pos || !latlngs || latlngs.length < 2) return null;
  const here = [pos.lat, pos.lng];
  const accuracy = pos.accuracy || 0;

  const { index: routeIndex, dist: offRouteDist } = nearestOnRoute(here, latlngs);
  const threshold = Math.min(MAX_ON_ROUTE_M, Math.max(MIN_ON_ROUTE_M, accuracy));
  const onRoute = offRouteDist <= threshold;

  // 각 단계가 경로의 몇 번째 꼭짓점에 있는지(앞 단계보다 뒤로 가지 않도록 보정)
  let prev = 0;
  const stepRouteIdx = (steps || []).map((s) => {
    const idx = s.point ? nearestVertexIndex(s.point, latlngs) : prev;
    prev = Math.max(prev, idx);
    return prev;
  });
  let stepIndex = 0;
  stepRouteIdx.forEach((idx, i) => {
    if (idx <= routeIndex) stepIndex = i;
  });
  // 도착 단계(마지막)는 목적지 근처에서만 활성화한다
  const last = (steps || []).length - 1;
  const toTarget = target ? distanceM(here, [target.lat, target.lng]) : Infinity;
  const nearDestination = toTarget <= Math.max(NEAR_DESTINATION_M, Math.min(accuracy, 80));
  if (nearDestination) stepIndex = Math.max(0, last);
  else if (stepIndex === last) stepIndex = Math.max(0, last - 1);

  return { onRoute, offRouteDist, routeIndex, stepIndex, distanceToTarget: toTarget, nearDestination };
}
