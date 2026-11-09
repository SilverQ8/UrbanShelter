// 우천·우설 쉘터 경로: 부산 OSM 비 가림 데이터(지붕 있는 길, 지하 통로, 지하철 출입구, 승강장 지붕)로
// 경로의 비 가림 비율을 계산하고, 비 가림 지점을 경유하는 우회 후보를 고른다.
import cover from '../data/busanRainCover.json';
import links from '../data/undergroundLinks.json';
import { getDistanceMeters } from '../engine/routingEngine';

const LINE_RADIUS_M = 8; // 덮인 길에서 이 거리 안이면 가려진 구간
const POINT_RADIUS_M = 12; // 출입구·승강장 지붕은 점이라 조금 넓게 본다
const CANDIDATE_RADIUS_M = 150; // 기준 경로에서 이 거리 안의 지점만 경유 후보
const SAMPLE_STEP_M = 5;
const MAX_TRIES = 4;

// 점 p에서 선분 a-b까지 거리(m). 경로 길이 규모에서는 평면 근사로 충분하다.
function distToSegment(p, a, b) {
  const kx = 111320 * Math.cos((p[0] * Math.PI) / 180);
  const ky = 110540;
  const ax = (a[1] - p[1]) * kx, ay = (a[0] - p[0]) * ky;
  const bx = (b[1] - p[1]) * kx, by = (b[0] - p[0]) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function isCovered(p) {
  for (const line of cover.lines) {
    for (let i = 1; i < line.length; i++) {
      if (distToSegment(p, line[i - 1], line[i]) <= LINE_RADIUS_M) return true;
    }
  }
  return cover.points.some((q) => getDistanceMeters(p[0], p[1], q[0], q[1]) <= POINT_RADIUS_M);
}

/** 경로를 5m 간격으로 훑어 비 가림 비율(%)·가려진/노출 거리(m)를 구한다. */
export function analyzeRouteRainCover(latlngs) {
  if (!latlngs || latlngs.length < 2) return { rainCoverRatio: 0, rainCoveredDistance: 0, rainExposedDistance: 0, rainSegments: [] };
  let covered = 0;
  let total = 0;
  const segments = []; // 지도 표시용: 같은 상태가 이어지는 구간끼리 묶는다
  for (let i = 1; i < latlngs.length; i++) {
    const [a, b] = [latlngs[i - 1], latlngs[i]];
    const len = getDistanceMeters(a[0], a[1], b[0], b[1]);
    const n = Math.max(1, Math.round(len / SAMPLE_STEP_M));
    let hit = 0;
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      if (isCovered([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])) hit++;
    }
    covered += (len * hit) / n;
    total += len;
    const isCov = hit * 2 > n;
    const last = segments[segments.length - 1];
    if (last && last.covered === isCov) last.latlngs.push(b);
    else segments.push({ covered: isCov, latlngs: [a, b] });
  }
  return {
    rainCoverRatio: total ? Math.round((covered / total) * 100) : 0,
    rainCoveredDistance: Math.round(covered),
    rainExposedDistance: Math.round(total - covered),
    rainSegments: segments
  };
}

/** 시간당 강수량(mm)에 따라 최단 대비 허용 우회 비율. 초안 값이라 실측 후 조정한다. */
export function rainDetourAllowance(precipitation = 0) {
  if (precipitation < 1) return 0.15;
  if (precipitation <= 4) return 0.3;
  return 0.5;
}

// 지붕 있는 길은 가장 가까운 꼭짓점 하나만 경유 후보로 쓴다.
const allCandidates = [
  ...cover.points,
  ...cover.lines.map((l) => l[Math.floor(l.length / 2)])
];

/**
 * 기준 경로에서 가까운 비 가림 지점을 경유 후보로 돌려준다. (가까운 순, 서로 60m 이상 떨어진 것만, 최대 MAX_TRIES개)
 * 이미 12m 안이면 경로가 그 지점을 지나는 것이라 후보가 아니다.
 * 직선 왕복(옆으로 갔다 오기)이 허용 우회를 넘는 지점도 뺀다. 실제 거리는 OSRM 호출 뒤에 다시 확인한다.
 */
export function findRainWaypoints(baseLatlngs, baseDistance, allowance) {
  if (!baseLatlngs || baseLatlngs.length < 2) return [];
  const maxOffset = Math.min(CANDIDATE_RADIUS_M, (baseDistance * allowance) / 2);
  const found = [];
  for (const [lat, lng] of allCandidates) {
    let nearest = Infinity;
    for (let i = 1; i < baseLatlngs.length; i++) {
      nearest = Math.min(nearest, distToSegment([lat, lng], baseLatlngs[i - 1], baseLatlngs[i]));
      if (nearest <= POINT_RADIUS_M) break;
    }
    if (nearest > POINT_RADIUS_M && nearest <= maxOffset) found.push({ lat, lng, nearest });
  }
  found.sort((a, b) => a.nearest - b.nearest);
  const picked = [];
  for (const c of found) {
    if (picked.every((p) => getDistanceMeters(p.lat, p.lng, c.lat, c.lng) >= 60)) picked.push(c);
    if (picked.length === MAX_TRIES) break;
  }
  return picked;
}

// ---- 지하 연결: 같은 지하상가의 출구끼리 통로(axis)로 이어져 있다고 보고 지하 구간을 만든다. ----
// shortcut: 통로를 직선 하나로 가정, 여러 갈래·층 구조가 필요하면 axis를 꺾은선으로 확장.
const MIN_UNDERGROUND_M = 100; // 이보다 짧은 지하 구간은 갈아타는 수고만 늘린다
const WALK_DETOUR_FACTOR = 1.2; // 직선거리 → 실제 도보 거리 보정(후보 거르기용)

const pathLength = (pts) => pts.reduce((s, p, i) => (i ? s + getDistanceMeters(pts[i - 1][0], pts[i - 1][1], p[0], p[1]) : 0), 0);

// 출구 위치에서 통로(직선) 위 가장 가까운 점
function snapToAxis([a, b], p) {
  const dy = b[0] - a[0], dx = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dy + (p[1] - a[1]) * dx) / (dy * dy + dx * dx)));
  return [a[0] + dy * t, a[1] + dx * t];
}

/** 출구 a → 통로 → 출구 b 로 걷는 지하 구간의 좌표 목록 */
export function undergroundLeg(mall, a, b) {
  return [[a.lat, a.lng], snapToAxis(mall.axis, [a.lat, a.lng]), snapToAxis(mall.axis, [b.lat, b.lng]), [b.lat, b.lng]];
}

/** 지상 구간과 지하 구간(underground: true)이 섞인 legs의 눈·비 차단 지표 */
export function analyzeRainLegs(legs) {
  let covered = 0, total = 0, underground = 0;
  const segments = [];
  for (const leg of legs) {
    if (leg.underground) {
      const len = pathLength(leg.latlngs);
      covered += len; total += len; underground += len;
      segments.push({ covered: true, latlngs: leg.latlngs });
    } else {
      const r = analyzeRouteRainCover(leg.latlngs);
      covered += r.rainCoveredDistance; total += r.rainCoveredDistance + r.rainExposedDistance;
      segments.push(...r.rainSegments);
    }
  }
  return {
    rainCoverRatio: total ? Math.round((covered / total) * 100) : 0,
    rainCoveredDistance: Math.round(covered),
    rainExposedDistance: Math.round(total - covered),
    undergroundDistance: Math.round(underground),
    rainSegments: segments
  };
}

/**
 * 지하 통로를 끼운 경로를 찾는다: 출발지 →(도보) 출구 a →(지하) 출구 b →(도보) 도착지.
 * 지하 구간이 긴 후보부터 최대 3개를 OSRM(fetchPath)으로 확인하고, 허용 우회 안에서 차단 비율이 가장 높은 것을 돌려준다.
 * 없으면 null. 돌려주는 값: { latlngs, distance, legs }
 */
export async function findUndergroundRoute(start, target, base, allowance, fetchPath) {
  const limit = base.distance * (1 + allowance);
  const cands = [];
  for (const mall of links) {
    for (const a of mall.exits) {
      for (const b of mall.exits) {
        if (a === b) continue;
        const leg = undergroundLeg(mall, a, b);
        const ug = pathLength(leg);
        const est = WALK_DETOUR_FACTOR * (getDistanceMeters(start.lat, start.lng, a.lat, a.lng) + getDistanceMeters(b.lat, b.lng, target.lat, target.lng)) + ug;
        if (ug >= MIN_UNDERGROUND_M && est <= limit) cands.push({ leg, ug, est, a, b });
      }
    }
  }
  cands.sort((x, y) => y.ug - x.ug || x.est - y.est);
  let best = null;
  let bestRatio = analyzeRouteRainCover(base.latlngs).rainCoverRatio;
  for (const c of cands.slice(0, 3)) {
    const [s1, s2] = await Promise.all([fetchPath(start, c.a), fetchPath(c.b, target)]);
    const distance = s1.distance + c.ug + s2.distance;
    if (distance > limit) continue;
    const legs = [{ latlngs: s1.latlngs }, { latlngs: c.leg, underground: true }, { latlngs: s2.latlngs }];
    const ratio = analyzeRainLegs(legs).rainCoverRatio;
    if (ratio > bestRatio) { bestRatio = ratio; best = { latlngs: legs.flatMap((l) => l.latlngs), distance: Math.round(distance), legs }; }
  }
  return best;
}
