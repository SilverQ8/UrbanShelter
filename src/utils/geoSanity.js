/**
 * 위치 무결성 검증 및 해상(바다) 이탈 좌표 필터링 유틸리티
 * 
 * 공공데이터 또는 지오코딩 결과에서 도로선이 아닌 해상(바다), 산지 비접근 구역으로
 * 마커가 이탈하여 지도 바깥에 표시되는 현상을 방지합니다.
 */

/**
 * 해운대/마린시티/동백섬 등 해안선 이남 바다 영역 좌표 판별
 * @param {number} lat 
 * @param {number} lng 
 * @returns {boolean} true: 유효하지 않은 바다 좌표
 */
export function isInvalidOceanCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng) || lat <= 0 || lng <= 0) return true;
  
  // 한국 국토 전체 바운더리 검증
  if (lat < 33.0 || lat > 38.9 || lng < 124.5 || lng > 131.9) return true;

  // 1. 마린시티 남측 바다 구역 (마린시티1로 해안선 이남)
  // 마린시티 해안선 위도는 약 35.1545 이상이어야 육지 도로임
  if (lng >= 129.138 && lng <= 129.149 && lat < 35.1540) {
    return true; // 마린시티 남쪽 바다 한가운데
  }

  // 2. 동백섬 남측 바다 구역
  if (lng >= 129.149 && lng <= 129.156 && lat < 35.1510) {
    return true; // 동백섬 남쪽 먼 바다
  }

  // 3. 해운대 백사장 및 해상 구역 (해운대해변로 보도블록 이남의 모래사장·파도구역 차단)
  if (lng >= 129.156 && lng < 129.161 && lat < 35.1582) {
    return true; // 웨스틴조선~아쿠아리움 서측 백사장 및 바다
  }
  if (lng >= 129.161 && lng < 129.166 && lat < 35.1586) {
    return true; // 아쿠아리움~파라다이스 백사장 및 바다
  }
  if (lng >= 129.166 && lng <= 129.172 && lat < 35.1592) {
    return true; // 엘시티~미포 백사장 및 바다
  }

  // 4. 광안대교 및 수영만 요트경기장 외해 구역
  if (lng >= 129.130 && lng <= 129.140 && lat < 35.1480) {
    return true;
  }

  return false;
}

/**
 * 유효한 도심 인프라(가로등, CCTV) 목록만 필터링
 * @param {Array<Object>} items 
 * @returns {Array<Object>}
 */
export function filterValidUrbanMarkers(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    const lat = Number(item.lat);
    const lng = Number(item.lng);
    return !isInvalidOceanCoordinate(lat, lng);
  });
}
