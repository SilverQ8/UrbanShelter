// 후보 경로들의 쾌적도 점수를 매겨 가장 좋은 경로를 고른다.
// 점수 = 민감도 × 쾌적도(그늘·조명·CCTV 가중합) − (1 − 민감도) × 우회 페널티

// 모드별로 어떤 요소를 얼마나 중요하게 볼지. 합은 1이다.
export const COMFORT_WEIGHTS = {
  shade: { shade: 0.8, light: 0.1, cctv: 0.1 },
  night: { shade: 0, light: 0.55, cctv: 0.45 }
};

const MAX_DETOUR_RATIO = 0.4; // 최단 경로보다 이만큼(40%) 더 돌면 우회 페널티가 최대
const CCTV_PER_100M_CAP = 2; // 100m당 CCTV가 이만큼 이상이면 만점

const METRIC_LABELS = { shade: '그늘', light: '가로등 조명', cctv: 'CCTV' };

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * 후보 하나의 요소별 0~1 값. 값을 알 수 없는 요소(예: 밤의 그늘)는 null이다.
 */
function metricsOf(candidate) {
  const distance = Math.max(1, candidate.totalDistance);
  return {
    shade: typeof candidate.shadeRatio === 'number' ? clamp01(candidate.shadeRatio / 100) : null,
    light: typeof candidate.lightCoverageRatio === 'number' ? clamp01(candidate.lightCoverageRatio / 100) : null,
    cctv: clamp01((candidate.cctvCount || 0) / (distance / 100) / CCTV_PER_100M_CAP)
  };
}

/**
 * @param {Array<object>} candidates totalDistance, shadeRatio, lightCoverageRatio, cctvCount를 가진 후보들
 * @param {'shade'|'night'} mode
 * @param {number} sensitivity 0(시간 절약)~1(쾌적 우선)
 * @returns {{ bestIndex: number, scores: number[], weights: object } | null}
 */
export function scoreCandidates(candidates, mode, sensitivity) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const profile = COMFORT_WEIGHTS[mode];
  if (!profile) return null;

  const minDistance = Math.min(...candidates.map((c) => c.totalDistance));
  const all = candidates.map(metricsOf);

  // 값을 알 수 없는 요소는 빼고 나머지 가중치를 다시 1로 맞춘다
  const usable = Object.keys(profile).filter((k) => profile[k] > 0 && all.every((m) => m[k] !== null));
  const weightSum = usable.reduce((sum, k) => sum + profile[k], 0);
  const weights = {};
  usable.forEach((k) => {
    weights[k] = profile[k] / weightSum;
  });
  // 이 모드에서 중요하게 보려 했지만 값을 알 수 없어 빠진 요소(예: 밤의 그늘)
  const excluded = Object.keys(profile).filter((k) => profile[k] > 0 && !usable.includes(k));

  const scores = all.map((m, i) => {
    const comfort = usable.reduce((sum, k) => sum + weights[k] * m[k], 0);
    const detour = clamp01((candidates[i].totalDistance / minDistance - 1) / MAX_DETOUR_RATIO);
    return sensitivity * comfort - (1 - sensitivity) * detour;
  });

  let bestIndex = 0;
  scores.forEach((s, i) => {
    if (s > scores[bestIndex]) bestIndex = i;
  });
  return { bestIndex, scores, weights, excluded };
}

/**
 * 왜 이 경로를 골랐는지 한 문장으로 설명한다.
 * @param {object} chosen 고른 경로
 * @param {object} shortest 가장 짧은 경로
 * @param {object} weights scoreCandidates가 돌려준 가중치
 * @param {number} walkSpeed m/분
 * @param {string[]} excluded scoreCandidates가 돌려준, 계산할 수 없어 빠진 요소
 */
export function explainChoice(chosen, shortest, weights, walkSpeed, excluded = []) {
  const keys = Object.keys(weights);
  if (keys.length === 0) return '비교할 정보가 부족해 가장 짧은 길로 안내해요';

  const basis = keys
    .sort((a, b) => weights[b] - weights[a])
    .map((k) => `${METRIC_LABELS[k]} ${Math.round(weights[k] * 100)}%`)
    .join('·');
  // 그늘은 해가 있을 때만 계산되므로, 빠졌다면 밤이라서다
  const skipNote = excluded.includes('shade') ? '지금은 해가 없어 그늘은 따지지 않고, ' : '';

  if (chosen === shortest) {
    return `${skipNote}${basis}를 기준으로 비교했더니 가장 짧은 길이 가장 좋아요`;
  }

  const extra = chosen.totalDistance - shortest.totalDistance;
  const extraMin = Math.max(1, Math.round(extra / walkSpeed));
  // 최단 경로와 값이 달라진 요소만 보여준다
  const gains = [];
  const addIfChanged = (key, label, from, to, unit) => {
    if (weights[key] && typeof from === 'number' && typeof to === 'number' && from !== to) {
      gains.push(`${label} ${from}${unit}→${to}${unit}`);
    }
  };
  addIfChanged('shade', '그늘', shortest.shadeRatio, chosen.shadeRatio, '%');
  addIfChanged('light', '조명', shortest.lightCoverageRatio, chosen.lightCoverageRatio, '%');
  addIfChanged('cctv', 'CCTV', shortest.cctvCount || 0, chosen.cctvCount || 0, '대');
  const tail = gains.length > 0 ? ` 더 걷지만 ${gains.join(', ')}` : ' 더 걸어요';
  return `${skipNote}${basis}를 기준으로 골랐어요. 최단 경로보다 ${extra}m(약 ${extraMin}분)${tail}`;
}
