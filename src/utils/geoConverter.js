import proj4 from 'proj4';
import { isInvalidOceanCoordinate } from './geoSanity.js';

// ============================================================================
// 1. 한국 주요 평면직각좌표계 및 타원체 정의 (TOWGS84 7-parameter 보정 포함)
// ============================================================================

// EPSG:4326 (WGS84 타원체 위경도 - GPS 표준)
proj4.defs('EPSG:4326', '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs');

// EPSG:3857 (Web Mercator / 구글·행정안전부 재난안전데이터 DSSP-IF-00084)
proj4.defs('EPSG:3857', '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs');

// EPSG:5179 (UTM-K / 국토교통부·공공데이터포털 표준 / GRS80 타원체)
proj4.defs('EPSG:5179', '+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// EPSG:5174 (Bessel 1841 구형 TM 중부원점 - 한국 지자체 노후 공공데이터에서 빈번히 사용)
// ★ TOWGS84 7-파라미터를 반드시 포함해야 약 300~400m 남동쪽 산/강/바다 밀림 오차가 정밀 교정됨
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs');

// EPSG:2097 (Bessel 1841 동부원점 - 부산, 대구, 경남, 울산, 경북 등 동남권 구형 TM)
proj4.defs('EPSG:2097', '+proj=tmerc +lat_0=38 +lon_0=129.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs');

// EPSG:5181 (Kakao / Kongnamul TM 좌표계)
proj4.defs('EPSG:5181', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// EPSG:5186 (GRS80 중부원점 TM - 신규 공공데이터 표준)
proj4.defs('EPSG:5186', '+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

/**
 * 한국 국토 유효 WGS84 위경도 바운더리 체크
 */
export function isValidKoreaWgs84(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33.0 &&
    lat <= 38.9 &&
    lng >= 124.5 &&
    lng <= 132.0 &&
    !isInvalidOceanCoordinate(lat, lng)
  );
}

/**
 * 좌표계 자동 판별, 위경도 Swap 교정 및 WGS84(EPSG:4326) 정규화 함수
 * 
 * @param {number|string} rawX x좌표 (또는 경도/위도)
 * @param {number|string} rawY y좌표 (또는 위도/경도)
 * @param {string} [identifier='unknown'] 디버깅용 시설 식별자(ID 또는 이름)
 * @returns {{lat: number, lng: number, sourceCrs: string}|null} 정규화된 WGS84 좌표 또는 유효하지 않을 시 null
 */
export function detectAndNormalizeCoordinates(rawX, rawY, identifier = 'unknown') {
  // 1. 빈값 및 이상치 1차 방어
  if (rawX === null || rawX === undefined || rawY === null || rawY === undefined) {
    console.warn(`[GeoSanity] 좌표 누락 (null/undefined): ID=${identifier}`);
    return null;
  }

  const x = typeof rawX === 'string' ? parseFloat(rawX.trim()) : Number(rawX);
  const y = typeof rawY === 'string' ? parseFloat(rawY.trim()) : Number(rawY);

  if (Number.isNaN(x) || Number.isNaN(y) || x === 0 || y === 0) {
    console.warn(`[GeoSanity] 무효한 수치 (NaN 또는 0): ID=${identifier}, x=${rawX}, y=${rawY}`);
    return null;
  }

  // -------------------------------------------------------------------------
  // Case 1. 표준 WGS84 위경도 (x=경도 124~132, y=위도 33~39)
  // -------------------------------------------------------------------------
  if (x >= 124.0 && x <= 132.5 && y >= 33.0 && y <= 39.0) {
    const lat = Number(y.toFixed(6));
    const lng = Number(x.toFixed(6));
    if (!isValidKoreaWgs84(lat, lng)) {
      console.warn(`[GeoSanity] 해상 또는 영토 외 이탈 WGS84: ID=${identifier}, lat=${lat}, lng=${lng}`);
      return null;
    }
    return { lat, lng, sourceCrs: 'EPSG:4326' };
  }

  // -------------------------------------------------------------------------
  // Case 2. 위도/경도 위치가 바뀐 경우 (Swap: x=위도 33~39, y=경도 124~132)
  // -------------------------------------------------------------------------
  if (x >= 33.0 && x <= 39.0 && y >= 124.0 && y <= 132.5) {
    const lat = Number(x.toFixed(6));
    const lng = Number(y.toFixed(6));
    if (!isValidKoreaWgs84(lat, lng)) {
      console.warn(`[GeoSanity] 해상 이탈 Swap WGS84: ID=${identifier}, lat=${lat}, lng=${lng}`);
      return null;
    }
    return { lat, lng, sourceCrs: 'EPSG:4326_SWAPPED' };
  }

  // -------------------------------------------------------------------------
  // Case 3. Web Mercator (EPSG:3857)
  // x: 약 13,000,000 ~ 15,000,000, y: 약 3,500,000 ~ 4,700,000
  // (행정안전부 재난안전데이터 DSSP-IF-00084 기본 좌표계)
  // -------------------------------------------------------------------------
  if (x >= 13000000 && x <= 15000000 && y >= 3500000 && y <= 4800000) {
    try {
      const [wLng, wLat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:3857' };
      }
    } catch (e) {
      console.warn(`[GeoSanity] EPSG:3857 변환 오류: ID=${identifier}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // Case 4. UTM-K (EPSG:5179)
  // x: 약 700,000 ~ 1,300,000, y: 약 1,400,000 ~ 2,200,000
  // (국토교통부 표준 및 공공데이터포털)
  // -------------------------------------------------------------------------
  if (
    (x >= 700000 && x <= 1350000 && y >= 1400000 && y <= 2300000) ||
    (y >= 700000 && y <= 1350000 && x >= 1400000 && x <= 2300000)
  ) {
    const isSwapped = x > y;
    const realX = isSwapped ? y : x;
    const realY = isSwapped ? x : y;

    try {
      const [wLng, wLat] = proj4('EPSG:5179', 'EPSG:4326', [realX, realY]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: isSwapped ? 'EPSG:5179_SWAPPED' : 'EPSG:5179' };
      }
    } catch (e) {
      console.warn(`[GeoSanity] EPSG:5179 변환 오류: ID=${identifier}`, e);
    }
  }

  // -------------------------------------------------------------------------
  // Case 5. 평면직각 TM 좌표계 (Bessel EPSG:5174 / 동부원점 EPSG:2097 / Kakao EPSG:5181)
  // x: 약 100,000 ~ 450,000, y: 약 250,000 ~ 700,000
  // -------------------------------------------------------------------------
  if (
    (x >= 100000 && x <= 500000 && y >= 250000 && y <= 750000) ||
    (y >= 100000 && y <= 500000 && x >= 250000 && x <= 750000)
  ) {
    const isSwapped = x > y;
    const realX = isSwapped ? y : x;
    const realY = isSwapped ? x : y;

    // 후보 1: EPSG:5174 (Bessel 중부원점 + TOWGS84 오차보정)
    try {
      const [wLng, wLat] = proj4('EPSG:5174', 'EPSG:4326', [realX, realY]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:5174_BESSEL' };
      }
    } catch {
      // try next
    }

    // 후보 2: EPSG:2097 (Bessel 동부원점 - 영남/부산/대구/울산권)
    try {
      const [wLng, wLat] = proj4('EPSG:2097', 'EPSG:4326', [realX, realY]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:2097_BESSEL_EAST' };
      }
    } catch {
      // try next
    }

    // 후보 3: EPSG:5181 (Kakao TM)
    try {
      const [wLng, wLat] = proj4('EPSG:5181', 'EPSG:4326', [realX, realY]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:5181' };
      }
    } catch {
      // try next
    }

    // 후보 4: EPSG:5186 (GRS80 신규 중부원점)
    try {
      const [wLng, wLat] = proj4('EPSG:5186', 'EPSG:4326', [realX, realY]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:5186' };
      }
    } catch {
      // try next
    }
  }

  // -------------------------------------------------------------------------
  // Case 6. Kakao 모바일 좌표 (0.4 배율 축척 값: wx, wy 약 300,000 ~ 1,200,000)
  // -------------------------------------------------------------------------
  if (x >= 200000 && x <= 1500000 && y >= 500000 && y <= 2000000) {
    try {
      const [wLng, wLat] = proj4('EPSG:5181', 'EPSG:4326', [x * 0.4, y * 0.4]);
      const lat = Number(wLat.toFixed(6));
      const lng = Number(wLng.toFixed(6));
      if (isValidKoreaWgs84(lat, lng)) {
        return { lat, lng, sourceCrs: 'EPSG:5181_KAKAO_0.4' };
      }
    } catch {
      // ignore
    }
  }

  // 어떤 좌표계에도 매칭되지 않는 이상치(Outlier)
  console.warn(`[GeoSanity] 알 수 없는 좌표계 또는 범위 이탈 이상치: ID=${identifier}, x=${rawX}, y=${rawY}`);
  return null;
}

/**
 * 시설 배열 전체를 방어적으로 파싱하고 정규화된 WGS84 좌표로 변환 및 유효성 필터링
 * 
 * @param {Array<Object>} rawItems 원본 API 응답 객체 배열
 * @param {Object} [options]
 * @param {string} [options.xKey='lng'] x/경도 프로퍼티 키 (x, lng, longitude, XMAP_CRTS 등)
 * @param {string} [options.yKey='lat'] y/위도 프로퍼티 키 (y, lat, latitude, YMAP_CRTS 등)
 * @param {string} [options.idKey='id'] 식별자 프로퍼티 키
 * @returns {Array<Object>} 정규화된 WGS84 lat, lng가 부여된 시설 배열
 */
export function normalizeFacilityDataset(rawItems, options = {}) {
  if (!Array.isArray(rawItems)) return [];

  const {
    xKey = 'lng',
    yKey = 'lat',
    idKey = 'id'
  } = options;

  const validItems = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;

    // 다양한 공공데이터 필드명 유연 지원
    const rawX = item[xKey] ?? item.lng ?? item.x ?? item.longitude ?? item.XMAP_CRTS ?? item.WGS84_LOT ?? item.lot;
    const rawY = item[yKey] ?? item.lat ?? item.y ?? item.latitude ?? item.YMAP_CRTS ?? item.WGS84_LAT ?? item.lat;
    const id = item[idKey] ?? item.id ?? item.SN ?? item.mngNo ?? 'unknown';

    const normalized = detectAndNormalizeCoordinates(rawX, rawY, id);

    if (normalized) {
      validItems.push({
        ...item,
        lat: normalized.lat,
        lng: normalized.lng,
        _crs: normalized.sourceCrs
      });
    }
  }

  return validItems;
}
