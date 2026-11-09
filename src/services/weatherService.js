// 현재 날씨 조회: Open-Meteo(API 키 불필요). 경로 모드 자동 선택에 쓴다.

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

function describeWeather(code) {
  if (code === 0) return '맑음';
  if (code === 1 || code === 2) return '대체로 맑음';
  if (code === 3) return '흐림';
  if (code === 45 || code === 48) return '안개';
  if (RAIN_CODES.has(code)) return code >= 95 ? '천둥·번개' : '비';
  if (SNOW_CODES.has(code)) return '눈';
  return '날씨 정보';
}

// 디버그: 주소 뒤에 ?weather=rain 또는 ?weather=snow 를 붙이면 날씨를 강제로 바꾼다.
const FORCED = { rain: { precipitation: 2, isRaining: true, isSnowing: false, label: '비' }, snow: { precipitation: 1, isRaining: false, isSnowing: true, label: '눈' } };

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
    const isRaining = !isSnowing && (c.precipitation > 0 || (c.rain && c.rain > 0) || (c.showers && c.showers > 0) || RAIN_CODES.has(code));
    return {
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      precipitation: c.precipitation,
      uv: c.uv_index,
      isDay: c.is_day === 1,
      isRaining,
      isSnowing,
      label: describeWeather(code)
    };
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('Weather fetch failed:', err);
    return null;
  }
}
