// 현재 날씨 조회: Open-Meteo(API 키 불필요). 경로 모드 자동 선택에 쓴다.

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

// 시간당 강수량(mm) 기준: 0.5 이상이면 비로 보고(효과·악천후 추천), 1 이상이면 우산이 필요한 비로 본다.
export const RAIN_MIN_MM = 0.5;
export const UMBRELLA_MM = 1;

function describeWeather(code) {
  if (code === 0) return '맑음';
  if (code === 1 || code === 2) return '대체로 맑음';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (RAIN_CODES.has(code)) return code >= 95 ? '천둥·번개' : '비';
  if (SNOW_CODES.has(code)) return '눈';
  return '날씨 정보';
}

// 디버그: 주소 뒤에 ?weather=rain / drizzle(0.7mm) / snow / hot 을 붙이면 날씨를 강제로 바꾼다.
const FORCED = {
  rain: { precipitation: 2, isRaining: true, isSnowing: false, label: '비' },
  drizzle: { precipitation: 0.7, isRaining: true, isSnowing: false, label: '비' },
  storm: { precipitation: 8, isRaining: true, isSnowing: false, label: '비' },
  snow: { precipitation: 1, isRaining: false, isSnowing: true, label: '눈' },
  hot: { temperature: 31, apparent: 34, uv: 8, precipitation: 0, isRaining: false, isSnowing: false, label: '맑음' }
};

export async function fetchCurrentWeather(lat, lng, signal) {
  const forced = FORCED[new URLSearchParams(window.location.search).get('weather')];
  if (forced) return { temperature: 8, apparent: 6, uv: 0, isDay: true, ...forced };
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,is_day,uv_index',
    timezone: 'auto'
  });
  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
    if (!resp.ok) throw new Error(`weather HTTP ${resp.status}`);
    const c = (await resp.json()).current;
    if (!c) return null;
    const code = c.weather_code;
    const isSnowing = SNOW_CODES.has(code) || (c.snowfall && c.snowfall > 0);
    // 강수량 값이 있으면 그 값으로만 판정하고, 값이 없을 때만 날씨 코드를 쓴다.
    const amount = typeof c.precipitation === 'number' ? Math.max(c.precipitation, c.rain || 0, c.showers || 0) : null;
    const isRaining = !isSnowing && (amount !== null ? amount >= RAIN_MIN_MM : RAIN_CODES.has(code));
    const drizzle = !isSnowing && !isRaining && RAIN_CODES.has(code);
    return {
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      precipitation: c.precipitation,
      uv: c.uv_index,
      isDay: c.is_day === 1,
      isRaining,
      isSnowing,
      label: drizzle ? '이슬비' : describeWeather(code)
    };
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('Weather fetch failed:', err);
    return null;
  }
}
