/**
 * Kakao Maps SDK & Building Information Service
 * Loads Kakao Maps JavaScript SDK and queries real-time official building & landmark POIs
 */

import { HAEUNDAE_PLACES } from '../data/haeundaePlaces';

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_API_KEY || 'c8d493c6110cd5e37a14a82a89e3690e';

let kakaoSdkPromise = null;

function getLocalFallbackBuildings(lat, lng) {
  return HAEUNDAE_PLACES.filter(p => {
    const dLat = p.lat - lat;
    const dLng = (p.lng - lng) * Math.cos(lat * Math.PI / 180);
    return (dLat * dLat + dLng * dLng) < (0.018 * 0.018);
  }).slice(0, 35).map(p => ({
    id: `local_${p.name}`,
    name: p.name,
    category: p.category || '주요 건물',
    address: p.roadAddress || p.name,
    phone: '',
    url: `https://map.kakao.com/link/search/${encodeURIComponent(p.name)}`,
    lat: p.lat,
    lng: p.lng,
    source: 'local'
  }));
}

/**
 * Dynamically loads and initializes Kakao Maps JavaScript SDK (with 1.8s fast timeout)
 * @returns {Promise<boolean>} whether SDK loaded successfully
 */
export function initKakaoSdk() {
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise((resolve) => {
    if (typeof window === 'undefined' || !KAKAO_KEY) return resolve(false);

    if (window.kakao && window.kakao.maps) {
      if (window.kakao.maps.load) {
        window.kakao.maps.load(() => resolve(true));
      } else {
        resolve(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      kakaoSdkPromise = null;
      resolve(false);
    }, 1800);

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services,clusterer&autoload=false`;
    script.async = true;

    script.onload = () => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
        window.kakao.maps.load(() => {
          clearTimeout(timer);
          resolve(true);
        });
      } else {
        clearTimeout(timer);
        kakaoSdkPromise = null;
        resolve(false);
      }
    };

    script.onerror = (err) => {
      clearTimeout(timer);
      kakaoSdkPromise = null;
      console.warn('Kakao Map SDK load failed (확인: 카카오 개발자 콘솔에서 카카오맵 활성화 여부):', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return kakaoSdkPromise;
}

// In-memory cache & in-flight deduplication for queried areas
const buildingCache = new Map();
const inflightSearches = new Map();

/**
 * Get instant synchronous local buildings for immediate 0ms map rendering
 */
export function getInstantLocalBuildings(lat, lng) {
  if (!lat || !lng) return [];
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (buildingCache.has(cacheKey)) {
    return buildingCache.get(cacheKey);
  }
  return getLocalFallbackBuildings(lat, lng);
}

/**
 * Search for buildings, landmarks, and public facilities within a map area
 * @param {{ lat: number, lng: number, bounds?: { south: number, north: number, west: number, east: number } }} options
 * @returns {Promise<Array<{ id: string, name: string, category: string, address: string, phone: string, url: string, lat: number, lng: number }>>}
 */
export async function searchKakaoBuildings({ lat, lng, bounds }) {
  if (!lat || !lng) return [];

  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  if (buildingCache.has(cacheKey)) {
    return buildingCache.get(cacheKey);
  }
  if (inflightSearches.has(cacheKey)) {
    return inflightSearches.get(cacheKey);
  }

  const searchTask = (async () => {
    const localBuildings = getLocalFallbackBuildings(lat, lng);
    const resultsMap = new Map();

    for (const lb of localBuildings) {
      resultsMap.set(lb.id, lb);
    }

    // 1. 백엔드 뷰포트 건물 조회 API 병렬 시작 (도메인 제한 없이 전국 100% 동작 보장)
    const backendViewportPromise = fetch(`/api/building/hub?mode=viewport&lat=${lat}&lng=${lng}`, {
      signal: AbortSignal.timeout(2200)
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.success && Array.isArray(data.buildings)) {
          for (const b of data.buildings) {
            if (!resultsMap.has(b.id)) {
              resultsMap.set(b.id, b);
            }
          }
        }
      })
      .catch(() => {});

    // 2. 브라우저 Kakao SDK가 활성화된 경우 클라이언트 검색 병행
    const isLoaded = await initKakaoSdk();
    if (isLoaded && window.kakao && window.kakao.maps && window.kakao.maps.services) {
      const ps = new window.kakao.maps.services.Places();
      const searchPromises = [backendViewportPromise];
      const searchLocation = new window.kakao.maps.LatLng(lat, lng);
      const options = {
        location: searchLocation,
        radius: 1000,
        size: 15
      };

      const runWithTimeout = (fn) =>
        new Promise((resolve) => {
          const t = setTimeout(resolve, 1200);
          fn(() => {
            clearTimeout(t);
            resolve();
          });
        });

      const buildingKeywords = ['빌딩', '오피스텔', '백화점'];
      for (const kw of buildingKeywords) {
        searchPromises.push(
          runWithTimeout((done) => {
            ps.keywordSearch(kw, (data, status) => {
              if (status === window.kakao.maps.services.Status.OK && Array.isArray(data)) {
                for (const item of data) {
                  const id = `kakao_${item.id}`;
                  if (!resultsMap.has(id)) {
                    resultsMap.set(id, {
                      id,
                      name: item.place_name,
                      category: item.category_name || '주요 건물',
                      address: item.road_address_name || item.address_name,
                      phone: item.phone,
                      url: item.place_url,
                      lat: parseFloat(item.y),
                      lng: parseFloat(item.x),
                      source: 'kakao'
                    });
                  }
                }
              }
              done();
            }, options);
          })
        );
      }

      searchPromises.push(
        runWithTimeout((done) => {
          ps.categorySearch('PO3', (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && Array.isArray(data)) {
              for (const item of data) {
                const id = `kakao_${item.id}`;
                if (!resultsMap.has(id)) {
                  resultsMap.set(id, {
                    id,
                    name: item.place_name,
                    category: item.category_name || '공공/편의시설',
                    address: item.road_address_name || item.address_name,
                    phone: item.phone,
                    url: item.place_url,
                    lat: parseFloat(item.y),
                    lng: parseFloat(item.x),
                    source: 'kakao'
                  });
                }
              }
            }
            done();
          }, options);
        })
      );

      await Promise.allSettled(searchPromises);
    } else {
      await backendViewportPromise;
    }

    if (resultsMap.size > 0) {
      const merged = Array.from(resultsMap.values());
      buildingCache.set(cacheKey, merged);
      return merged;
    }

    return localBuildings;
  })();

  inflightSearches.set(cacheKey, searchTask);
  try {
    return await searchTask;
  } finally {
    inflightSearches.delete(cacheKey);
  }
}

// In-memory cache for individual building details
const buildingDetailCache = new Map();

/**
 * Helper to query nearby building/facility POI around a location
 */
function queryNearbyPoi(places, location, resolve) {
  places.keywordSearch('빌딩', (data, status) => {
    if (status === window.kakao.maps.services.Status.OK && Array.isArray(data) && data.length > 0) {
      resolve(data[0]);
    } else {
      places.categorySearch('PO3', (pData, pStatus) => {
        if (pStatus === window.kakao.maps.services.Status.OK && Array.isArray(pData) && pData.length > 0) {
          resolve(pData[0]);
        } else {
          resolve(null);
        }
      }, { location, radius: 80 });
    }
  }, { location, radius: 80 });
}

/**
 * Fetch detailed building & POI information for a specific building using Kakao Maps SDK & Backend API
 * Queries Kakao Geocoder, Places, and Architectural Registry (건축HUB)
 * @param {{ lat: number, lng: number, name?: string, category?: string }} param0
 * @returns {Promise<Object>} Detailed building info
 */
export async function fetchKakaoBuildingDetail({ lat, lng, name, category }) {
  if (!lat || !lng) return null;

  const cacheKey = `${Number(lat).toFixed(5)}_${Number(lng).toFixed(5)}`;
  if (buildingDetailCache.has(cacheKey)) {
    return buildingDetailCache.get(cacheKey);
  }

  const cleanInitialName = name && name !== '건물' && !name.startsWith('osm_') ? name : '';

  let detail = {
    name: cleanInitialName,
    officialBuildingName: '',
    groundFloors: null,
    undergroundFloors: null,
    buildingHeight: null,
    mainPurps: '',
    roadAddress: '',
    jibunAddress: '',
    zoneNo: '',
    category: category || '',
    phone: '',
    placeUrl: '',
    roadviewUrl: `https://map.kakao.com/link/roadview/${lat},${lng}`,
    searchUrl: `https://map.kakao.com/link/search/${encodeURIComponent(cleanInitialName || `${lat},${lng}`)}`,
    lat,
    lng,
    source: 'kakao'
  };

  // 백엔드 역지오코딩을 Kakao SDK 조회와 병렬로 미리 시작하여 대기 시간 단축
  const reverseApiPromise = fetch(`/api/address/reverse?lat=${lat}&lng=${lng}`, {
    signal: AbortSignal.timeout(2000)
  })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);

  const isLoaded = await initKakaoSdk();
  if (isLoaded && window.kakao?.maps?.services) {
    try {
      // 1. Geocoder 역지오코딩 (공식 도로명주소 및 지번주소)
      const geocoder = new window.kakao.maps.services.Geocoder();
      const addrPromise = new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 1500);
        geocoder.coord2Address(lng, lat, (data, status) => {
          clearTimeout(t);
          if (status === window.kakao.maps.services.Status.OK && Array.isArray(data) && data[0]) {
            const item = data[0];
            resolve({
              roadAddress: item.road_address?.address_name || '',
              buildingName: item.road_address?.building_name || '',
              zoneNo: item.road_address?.zone_no || '',
              jibunAddress: item.address?.address_name || ''
            });
          } else {
            resolve(null);
          }
        });
      });

      // 2. Places 주변 장소 및 POI 검색
      const places = new window.kakao.maps.services.Places();
      const placePromise = new Promise((resolve) => {
        const t = setTimeout(() => resolve(null), 1500);
        const done = (val) => {
          clearTimeout(t);
          resolve(val);
        };
        const searchLocation = new window.kakao.maps.LatLng(lat, lng);
        if (cleanInitialName) {
          places.keywordSearch(cleanInitialName, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && Array.isArray(data) && data.length > 0) {
              done(data[0]);
            } else {
              queryNearbyPoi(places, searchLocation, done);
            }
          }, { location: searchLocation, radius: 120 });
        } else {
          queryNearbyPoi(places, searchLocation, done);
        }
      });

      const [addrRes, placeRes] = await Promise.all([addrPromise, placePromise]);

      if (addrRes) {
        detail.roadAddress = addrRes.roadAddress || detail.roadAddress;
        detail.jibunAddress = addrRes.jibunAddress || detail.jibunAddress;
        detail.zoneNo = addrRes.zoneNo || detail.zoneNo;
        if (addrRes.buildingName) {
          detail.officialBuildingName = addrRes.buildingName;
          if (!detail.name) detail.name = addrRes.buildingName;
        }
      }

      if (placeRes) {
        if (!detail.name) {
          detail.name = placeRes.place_name;
        }
        detail.category = placeRes.category_name || detail.category;
        detail.phone = placeRes.phone || detail.phone;
        detail.placeUrl = placeRes.place_url || detail.placeUrl;
        if (!detail.roadAddress) detail.roadAddress = placeRes.road_address_name;
        if (!detail.jibunAddress) detail.jibunAddress = placeRes.address_name;
      }
    } catch (err) {
      console.warn('Kakao service detail query failed:', err);
    }
  }

  // 3. Backend Reverse Geocoding Fallback 결과 병합 (이미 병렬로 요청됨)
  if (!detail.roadAddress || !detail.jibunAddress) {
    const rev = await reverseApiPromise;
    if (rev && rev.success) {
      if (!detail.roadAddress) detail.roadAddress = rev.roadAddress || '';
      if (!detail.jibunAddress) detail.jibunAddress = rev.jibunAddress || '';
      if (!detail.zoneNo) detail.zoneNo = rev.zoneNo || '';
      if (rev.buildingName && !detail.officialBuildingName) {
        detail.officialBuildingName = rev.buildingName;
        if (!detail.name) detail.name = rev.buildingName;
      }
    }
  }

  // 4. 건축HUB 건축물대장 표제부 연동 (지상 층수, 높이, 공식 건물명, 용도)
  const targetAddressForHub = detail.roadAddress || detail.jibunAddress;
  if (targetAddressForHub) {
    try {
      const hubRes = await fetch(`/api/building/hub?address=${encodeURIComponent(targetAddressForHub)}`, {
        signal: AbortSignal.timeout(2500)
      });
      if (hubRes.ok) {
        const hubData = await hubRes.json();
        const b = hubData?.building || hubData?.data;
        if (hubData?.success && b) {
          detail.groundFloors = b.grndFlrCnt || detail.groundFloors;
          detail.undergroundFloors = b.ugrndFlrCnt || detail.undergroundFloors;
          detail.buildingHeight = b.calculatedHeight || b.heit || detail.buildingHeight;
          detail.mainPurps = b.mainPurpsCdNm || detail.mainPurps;
          if (b.bldNm && b.bldNm !== '일반건축물' && b.bldNm !== '건축물') {
            detail.officialBuildingName = b.bldNm;
            if (!detail.name) detail.name = b.bldNm;
          }
        }
      }
    } catch {
      // ignore hub error
    }
  }

  // 5. Fallback to local landmark if nearby
  if (!detail.name) {
    try {
      const { HAEUNDAE_PLACES } = await import('../data/haeundaePlaces');
      const nearest = HAEUNDAE_PLACES.find(p => {
        const dLat = p.lat - lat;
        const dLng = (p.lng - lng) * Math.cos(lat * Math.PI / 180);
        return (dLat * dLat + dLng * dLng) < (0.001 * 0.001);
      });
      if (nearest) {
        detail.name = nearest.name;
        if (!detail.roadAddress) detail.roadAddress = nearest.roadAddress || nearest.name;
        if (!detail.category) detail.category = nearest.category;
      }
    } catch {
      // ignore
    }
  }

  if (!detail.name) {
    detail.name = detail.officialBuildingName || (detail.roadAddress ? detail.roadAddress.split(' ').slice(-2).join(' ') + ' 건물' : '도심 빌딩');
  }
  if (!detail.category) {
    detail.category = '일반 건축물';
  }

  // Strip any corrupt unicode replacement characters
  detail.name = (detail.name || '').replace(/[\uFFFD\uFFFE\uFEFF]/g, '').trim();
  detail.roadAddress = (detail.roadAddress || '').replace(/[\uFFFD\uFFFE\uFEFF]/g, '').trim();
  detail.jibunAddress = (detail.jibunAddress || '').replace(/[\uFFFD\uFFFE\uFEFF]/g, '').trim();
  detail.category = (detail.category || '').replace(/[\uFFFD\uFFFE\uFEFF]/g, '').trim();

  detail.searchUrl = `https://map.kakao.com/link/search/${encodeURIComponent(detail.name)}`;

  buildingDetailCache.set(cacheKey, detail);
  return detail;
}


