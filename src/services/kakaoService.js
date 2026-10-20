/**
 * Kakao Maps SDK & Building Information Service
 * Loads Kakao Maps JavaScript SDK and queries real-time official building & landmark POIs
 */

const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_API_KEY || '';

let kakaoSdkPromise = null;

/**
 * Dynamically loads and initializes Kakao Maps JavaScript SDK
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

    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services,clusterer&autoload=false`;
    script.async = true;

    script.onload = () => {
      if (window.kakao && window.kakao.maps && window.kakao.maps.load) {
        window.kakao.maps.load(() => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    };

    script.onerror = (err) => {
      console.warn('Kakao Map SDK load failed (확인: 카카오 개발자 콘솔에서 카카오맵 활성화 여부):', err);
      resolve(false);
    };

    document.head.appendChild(script);
  });

  return kakaoSdkPromise;
}

// In-memory cache for queried areas to prevent duplicate API hits
const buildingCache = new Map();

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

  const isLoaded = await initKakaoSdk();
  if (!isLoaded || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
    try {
      const { HAEUNDAE_PLACES } = await import('../data/haeundaePlaces');
      const localBuildings = HAEUNDAE_PLACES.filter(p => {
        const dLat = p.lat - lat;
        const dLng = (p.lng - lng) * Math.cos(lat * Math.PI / 180);
        return (dLat * dLat + dLng * dLng) < (0.015 * 0.015);
      }).slice(0, 30).map(p => ({
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
      return localBuildings;
    } catch {
      return [];
    }
  }


  const ps = new window.kakao.maps.services.Places();
  const searchPromises = [];
  const resultsMap = new Map();

  const searchLocation = new window.kakao.maps.LatLng(lat, lng);
  const options = {
    location: searchLocation,
    radius: 1200, // 1.2km 주변 건물
    size: 15
  };

  // 1. 주요 빌딩 및 타워 키워드 검색
  const buildingKeywords = ['빌딩', '타워', '센텀', '오피스텔', '주민센터', '백화점'];
  for (const kw of buildingKeywords) {
    searchPromises.push(new Promise((resolve) => {
      ps.keywordSearch(kw, (data, status) => {
        if (status === window.kakao.maps.services.Status.OK && Array.isArray(data)) {
          for (const item of data) {
            const itemLat = parseFloat(item.y);
            const itemLng = parseFloat(item.x);
            if (!resultsMap.has(item.id)) {
              resultsMap.set(item.id, {
                id: `kakao_${item.id}`,
                name: item.place_name,
                category: item.category_name || '주요 건물',
                address: item.road_address_name || item.address_name,
                phone: item.phone,
                url: item.place_url,
                lat: itemLat,
                lng: itemLng,
                source: 'kakao'
              });
            }
          }
        }
        resolve();
      }, options);
    }));
  }

  // 2. 카테고리 검색 (공공기관 PO3, 병원 HP8, 문화시설 CT1)
  const categories = ['PO3', 'HP8', 'CT1'];
  for (const cat of categories) {
    searchPromises.push(new Promise((resolve) => {
      ps.categorySearch(cat, (data, status) => {
        if (status === window.kakao.maps.services.Status.OK && Array.isArray(data)) {
          for (const item of data) {
            const itemLat = parseFloat(item.y);
            const itemLng = parseFloat(item.x);
            if (!resultsMap.has(item.id)) {
              resultsMap.set(item.id, {
                id: `kakao_${item.id}`,
                name: item.place_name,
                category: item.category_name || '공공/편의시설',
                address: item.road_address_name || item.address_name,
                phone: item.phone,
                url: item.place_url,
                lat: itemLat,
                lng: itemLng,
                source: 'kakao'
              });
            }
          }
        }
        resolve();
      }, options);
    }));
  }

  await Promise.allSettled(searchPromises);

  // If Kakao returns results, cache and return
  if (resultsMap.size > 0) {
    const buildings = Array.from(resultsMap.values());
    buildingCache.set(cacheKey, buildings);
    return buildings;
  }

  // Fallback: If Kakao SDK is not yet activated in console, load local landmark buildings
  try {
    const { HAEUNDAE_PLACES } = await import('../data/haeundaePlaces');
    const localBuildings = HAEUNDAE_PLACES.filter(p => {
      const dLat = p.lat - lat;
      const dLng = (p.lng - lng) * Math.cos(lat * Math.PI / 180);
      return (dLat * dLat + dLng * dLng) < (0.015 * 0.015);
    }).slice(0, 30).map(p => ({
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
    return localBuildings;
  } catch {
    return [];
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
 * Fetch detailed building & POI information for a specific building using Kakao Maps SDK
 * Queries Kakao Geocoder (reverse geocoding) and Places (keyword & category)
 * @param {{ lat: number, lng: number, name?: string }} param0
 * @returns {Promise<Object>} Detailed building info
 */
export async function fetchKakaoBuildingDetail({ lat, lng, name }) {
  if (!lat || !lng) return null;

  const cacheKey = `${Number(lat).toFixed(5)}_${Number(lng).toFixed(5)}`;
  if (buildingDetailCache.has(cacheKey)) {
    return buildingDetailCache.get(cacheKey);
  }

  const cleanInitialName = name && name !== '건물' && !name.startsWith('osm_') ? name : '';

  let detail = {
    name: cleanInitialName,
    roadAddress: '',
    jibunAddress: '',
    zoneNo: '',
    category: '',
    phone: '',
    placeUrl: '',
    roadviewUrl: `https://map.kakao.com/link/roadview/${lat},${lng}`,
    searchUrl: `https://map.kakao.com/link/search/${encodeURIComponent(cleanInitialName || `${lat},${lng}`)}`,
    lat,
    lng,
    source: 'kakao'
  };

  const isLoaded = await initKakaoSdk();
  if (isLoaded && window.kakao?.maps?.services) {
    try {
      // 1. Geocoder 역지오코딩 (공식 도로명주소 및 지번주소)
      const geocoder = new window.kakao.maps.services.Geocoder();
      const addrPromise = new Promise((resolve) => {
        geocoder.coord2Address(lng, lat, (data, status) => {
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
        const searchLocation = new window.kakao.maps.LatLng(lat, lng);
        if (cleanInitialName) {
          places.keywordSearch(cleanInitialName, (data, status) => {
            if (status === window.kakao.maps.services.Status.OK && Array.isArray(data) && data.length > 0) {
              resolve(data[0]);
            } else {
              queryNearbyPoi(places, searchLocation, resolve);
            }
          }, { location: searchLocation, radius: 120 });
        } else {
          queryNearbyPoi(places, searchLocation, resolve);
        }
      });

      const [addrRes, placeRes] = await Promise.all([addrPromise, placePromise]);

      if (addrRes) {
        detail.roadAddress = addrRes.roadAddress || detail.roadAddress;
        detail.jibunAddress = addrRes.jibunAddress || detail.jibunAddress;
        detail.zoneNo = addrRes.zoneNo || detail.zoneNo;
        if (addrRes.buildingName && !detail.name) {
          detail.name = addrRes.buildingName;
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

  // Fallback to backend address search if roadAddress or name still missing
  if (!detail.roadAddress || !detail.name) {
    try {
      const q = detail.name || detail.roadAddress || `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const res = await fetch(`/api/address/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const match = items[0];
          if (!detail.name) detail.name = match.name;
          if (!detail.roadAddress) detail.roadAddress = match.roadAddress;
          if (!detail.category) detail.category = match.category;
        }
      }
    } catch {
      // ignore fallback error
    }
  }

  // Fallback to local landmark if nearby
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
    detail.name = detail.roadAddress ? detail.roadAddress.split(' ').slice(-2).join(' ') + ' 건물' : '도심 빌딩';
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


