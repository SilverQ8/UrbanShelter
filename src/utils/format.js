// 거리 표기 유틸: 1km 이상은 km(소수점 최대 2자리), 미만은 m 단위로 표시한다.

export function formatDistanceParts(meters) {
  const m = Math.abs(Number(meters) || 0);
  if (m >= 1000) {
    return { value: String(Number((m / 1000).toFixed(2))), unit: 'km' };
  }
  return { value: String(Number(m.toFixed(2))), unit: 'm' };
}

export function formatDistance(meters) {
  const { value, unit } = formatDistanceParts(meters);
  return `${value}${unit}`;
}

// 시간 표기 유틸: 60분 미만은 "19분", 1시간 이상은 "1시간00분"처럼 표시한다.
export function formatDurationParts(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total >= 60) {
    const h = Math.floor(total / 60);
    const m = String(total % 60).padStart(2, '0');
    return { value: `${h}시간${m}`, unit: '분' };
  }
  return { value: String(total), unit: '분' };
}

export function formatDuration(minutes) {
  const { value, unit } = formatDurationParts(minutes);
  return `${value}${unit}`;
}
