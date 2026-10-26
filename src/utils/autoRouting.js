// 날씨·시간대에 따라 경로 모드를 자동으로 고른다.
import { getDefaultMode } from './profile';

export const HEAT_APPARENT_TEMP = 28; // 체감온도(℃) 이상이면 그늘 경로
export const HEAT_UV_INDEX = 6; // 낮 자외선 지수 이상이면 그늘 경로

export function decideAutoMode(weather, needs) {
  if (!weather) {
    return { mode: getDefaultMode(needs), reason: '날씨 정보를 불러오지 못해 기본 경로로 안내해요' };
  }
  if (!weather.isDay) {
    return { mode: 'night', reason: '밤이라 CCTV가 많은 안심 경로로 안내해요' };
  }
  if (weather.isRaining || weather.isSnowing) {
    const amountText = weather.precipitation > 0 ? ` (시간당 ${Number(weather.precipitation.toFixed(1))}mm)` : '';
    return {
      mode: 'standard',
      reason: `${weather.label}${amountText} 중이라 이동 시간을 줄이는 가장 짧은 길로 안내해요`
    };
  }
  if (weather.apparent >= HEAT_APPARENT_TEMP || weather.uv >= HEAT_UV_INDEX) {
    return { mode: 'shade', reason: '더운 날씨라 그늘이 많은 경로로 안내해요' };
  }
  return { mode: 'standard', reason: '쾌적한 날씨라 가장 짧은 길로 안내해요' };
}

export const MODE_LABELS = {
  standard: '가장 짧은 길',
  shade: '폭염 그늘',
  night: '야간 안심'
};
