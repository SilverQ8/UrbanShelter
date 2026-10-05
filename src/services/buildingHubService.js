// 국토교통부 건축HUB 건축물대장 표제부 연동 서비스
// 공공데이터포털(data.go.kr) 공식 건축물대장 API를 통해 실측 층수 및 높이를 정밀 계산합니다.

const memoryCache = new Map();

/**
 * 층수로부터 건물 물리적 높이(m)를 정밀 계산
 * @param {number} groundFloors - 지상 층수
 * @param {string} [purpose] - 건물 주용도 (예: 아파트, 단독주택, 상업시설)
 * @returns {number} 미터 단위 높이
 */
export function calculateHeightFromFloors(groundFloors, purpose = '') {
  if (!groundFloors || groundFloors <= 0) return 12.8; // 기본 4층 기준
  
  // 용도별 층고 차이 반영 (오피스·상업시설 3.5m~3.8m, 일반 주거 3.0m~3.2m)
  let floorHeight = 3.2;
  if (purpose.includes('판매') || purpose.includes('업무') || purpose.includes('상가') || purpose.includes('근린')) {
    floorHeight = 3.5;
  } else if (purpose.includes('창고') || purpose.includes('공장')) {
    floorHeight = 4.5;
  }

  return Math.round(groundFloors * floorHeight * 10) / 10;
}

/**
 * 건축HUB 건축물대장 표제부 조회
 * 지번/주소 또는 시군구·법정동 코드로 건물의 공식 지상층수, 지하층수, 실측 높이를 가져옵니다.
 * @param {Object} params
 * @param {string} [params.address] - 도로명 또는 지번 주소 (예: '부산 해운대구 우동 1495')
 * @param {string} [params.sigunguCd] - 시군구코드 (예: '26350')
 * @param {string} [params.bjdongCd] - 법정동코드 (예: '10500')
 * @param {string|number} [params.bun] - 지번 본번
 * @param {string|number} [params.ji] - 지번 부번
 * @returns {Promise<Object|null>}
 */
export async function getBuildingHubInfo(params = {}) {
  const queryKey = JSON.stringify(params);
  if (memoryCache.has(queryKey)) {
    return memoryCache.get(queryKey);
  }

  try {
    const searchParams = new URLSearchParams();
    if (params.address) searchParams.set('address', params.address);
    if (params.sigunguCd) searchParams.set('sigunguCd', params.sigunguCd);
    if (params.bjdongCd) searchParams.set('bjdongCd', params.bjdongCd);
    if (params.bun !== undefined) searchParams.set('bun', String(params.bun));
    if (params.ji !== undefined) searchParams.set('ji', String(params.ji));

    const response = await fetch(`/api/building/hub?${searchParams.toString()}`);
    if (!response.ok) {
      console.warn(`건축HUB API 응답 실패 (${response.status})`);
      return null;
    }

    const data = await response.json();
    if (!data || !data.success || !data.building) {
      return null;
    }

    const b = data.building;
    const groundFloors = Number(b.grndFlrCnt) || 0;
    const undergroundFloors = Number(b.ugrndFlrCnt) || 0;
    const exactHeight = Number(b.heit) || 0;

    // 공식 높이(heit)가 있으면 실측 높이 우선 사용, 없으면 층수 기반 정밀 계산
    const calculatedHeight = exactHeight > 0
      ? exactHeight
      : calculateHeightFromFloors(groundFloors, b.mainPurpsCdNm || '');

    const result = {
      name: b.bldNm || '건물',
      groundFloors,
      undergroundFloors,
      exactHeight,
      calculatedHeight,
      heightSource: exactHeight > 0 ? 'official_heit' : 'official_floor_calc',
      purpose: b.mainPurpsCdNm || '일반건축물',
      structure: b.strctCdNm || '',
      platPlc: b.platPlc || '',
      raw: b
    };

    memoryCache.set(queryKey, result);
    return result;
  } catch (err) {
    console.error('건축HUB 연동 오류:', err);
    return null;
  }
}
