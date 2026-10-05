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

export async function fetchCurrentWeather(lat, lng, signal) {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,is_day,uv_index',
    timezone: 'auto'
  });
  try {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal });
    if (!resp.ok) throw new Error(`weather HTTP ${resp.status}`);
    const c = (await resp.json()).current;
    if (!c) return null;
    const code = c.weather_code;
    return {
      temperature: c.temperature_2m,
      apparent: c.apparent_temperature,
      precipitation: c.precipitation,
      uv: c.uv_index,
      isDay: c.is_day === 1,
      isRaining: c.precipitation > 0 || RAIN_CODES.has(code),
      isSnowing: SNOW_CODES.has(code),
      label: describeWeather(code)
    };
  } catch (err) {
    if (err?.name !== 'AbortError') console.warn('Weather fetch failed:', err);
    return null;
  }
}
