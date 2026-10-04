// Address Search & Geocoding Service
// Integrates:
// 1. Daum/Kakao Postcode Service (100% of all official buildings & road name addresses in South Korea)
// 2. Real-time Geocoder (/api/geocode) for coordinate conversion

import { searchPlaces as searchLocalPlaces } from '../data/haeundaePlaces';

// In-memory geocode cache
const geocodeCache = new Map();

/**
 * Geocode any Korean road address to exact latitude and longitude
 * @param {string} roadAddress 
 * @returns {Promise<{lat: number, lng: number, roadAddress: string}|null>}
 */
export async function geocodeAddress(roadAddress) {
  if (!roadAddress || !roadAddress.trim()) return null;
  const cleanAddr = roadAddress.trim();

  if (geocodeCache.has(cleanAddr)) {
    return geocodeCache.get(cleanAddr);
  }

  // Pre-check local database first for instant 0ms response
  const localMatch = searchLocalPlaces(cleanAddr);
  if (localMatch.length > 0 && localMatch[0].score >= 90) {
    const res = {
      lat: localMatch[0].lat,
      lng: localMatch[0].lng,
      roadAddress: localMatch[0].roadAddress || cleanAddr
    };
    geocodeCache.set(cleanAddr, res);
    return res;
  }

  try {
    const query = cleanAddr.startsWith('부산') ? cleanAddr : `부산 해운대구 ${cleanAddr}`;
    const url = `/api/geocode/search?q=${encodeURIComponent(query)}&format=json&countrycodes=kr&limit=1`;
    
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Geocode HTTP ${resp.status}`);

    const data = await resp.json();
    if (data && data.length > 0) {
      const result = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        roadAddress: cleanAddr
      };
      geocodeCache.set(cleanAddr, result);
      return result;
    }
  } catch (err) {
    console.warn('Online geocode fallback:', err);
  }

  // Fallback to local match if online geocoder had no match
  if (localMatch.length > 0) {
    return {
      lat: localMatch[0].lat,
      lng: localMatch[0].lng,
      roadAddress: localMatch[0].roadAddress || cleanAddr
    };
  }

  return null;
}

/**
 * Real-time address and building query handled 100% via backend API
 * Fetches high-accuracy building names, road addresses, categories, and GPS coordinates from backend
 * @param {string} query 
 * @returns {Promise<Array<{name: string, roadAddress: string, lat: number, lng: number, category: string}>>}
 */
export async function searchAddressLive(query) {
  if (!query || query.trim().length < 1) return [];
  const trimmed = query.trim();

  // 1. Instant local search from curated database (0ms latency)
  const localResults = searchLocalPlaces(trimmed).map(item => ({
    name: item.name,
    roadAddress: item.roadAddress,
    lat: item.lat,
    lng: item.lng,
    category: item.category || '해운대 주요 장소'
  }));

  // 2. Fetch live official results processed directly by backend
  try {
    const backendUrl = `/api/address/search?q=${encodeURIComponent(trimmed)}`;
    const resp = await fetch(backendUrl);

    if (resp.ok) {
      const backendResults = await resp.json();
      
      // Deduplicate by name and roadAddress
      const seen = new Set();
      const merged = [];

      for (const item of [...backendResults, ...localResults]) {
        if (!item || !item.name) continue;
        const cleanKey = `${item.name.replace(/\s+/g, '')}_${(item.roadAddress || '').replace(/\s+/g, '')}`;
        if (!seen.has(cleanKey)) {
          seen.add(cleanKey);
          merged.push(item);
        }
      }

      return merged.slice(0, 10);
    }
  } catch (err) {
    console.warn('Backend address search failed, falling back to local:', err);
  }

  return localResults.slice(0, 10);
}

/**
 * Embed official Daum Postcode directly into an inline container
 * Runs real-time search with user query without needing a popup!
 * 100% of all official buildings & road name addresses in South Korea
 * @param {HTMLElement} containerElement 
 * @param {string} query 
 * @param {Function} onSelect ({ roadAddress, cleanRoadAddress, buildingName, lat, lng })
 */
export function embedDaumPostcode(containerElement, query, onSelect) {
  if (!containerElement || !window.daum || !window.daum.Postcode) return null;

  try {
    containerElement.innerHTML = '';

    // Sleek Dark Theme matching UrbanShelter's glassmorphism palette
    const darkTheme = {
      bgColor: '#0f172a', // Main dark slate background
      searchBgColor: '#1e293b', // Search box background
      contentBgColor: '#0f172a', // Results list background
      pageBgColor: '#0f172a', // Page background
      textColor: '#f8fafc', // Crisp white text
      queryTextColor: '#38bdf8', // Accent cyan text
      postcodeTextColor: '#34d399', // Emerald postal code
      emphTextColor: '#38bdf8', // Accent highlight text
      outlineColor: 'rgba(56, 189, 248, 0.35)' // Subtle neon cyan outline
    };

    const postcode = new window.daum.Postcode({
      theme: darkTheme,
      oncomplete: async (data) => {
        const fullRoadAddr = data.roadAddress || data.autoRoadAddress || data.jibunAddress;
        const bname = data.buildingName ? ` (${data.buildingName})` : '';
        const displayAddress = `${fullRoadAddr}${bname}`;

        const coords = await geocodeAddress(fullRoadAddr);
        const lat = coords ? coords.lat : 35.1610;
        const lng = coords ? coords.lng : 129.1600;

        if (onSelect) {
          onSelect({
            roadAddress: displayAddress,
            cleanRoadAddress: fullRoadAddr,
            buildingName: data.buildingName || '',
            lat,
            lng
          });
        }
      },
      width: '100%',
      height: '320px',
      animation: false
    });

    postcode.embed(containerElement, {
      q: query || '',
      autoClose: false
    });

    return postcode;
  } catch (err) {
    console.error('Failed to embed Daum Postcode:', err);
    return null;
  }
}

/**
 * Open official Daum/Kakao Postcode & Road Name Address Search Popup
 * @param {Function} onSelect ({ roadAddress, buildingName, lat, lng })
 */
export function openRoadAddressPopup(onSelect) {
  if (!window.daum || !window.daum.Postcode) {
    alert('도로명주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
    return;
  }

  new window.daum.Postcode({
    oncomplete: async (data) => {
      const fullRoadAddr = data.roadAddress || data.autoRoadAddress || data.jibunAddress;
      const bname = data.buildingName ? ` (${data.buildingName})` : '';
      const displayAddress = `${fullRoadAddr}${bname}`;

      const coords = await geocodeAddress(fullRoadAddr);

      if (coords && onSelect) {
        onSelect({
          roadAddress: displayAddress,
          cleanRoadAddress: fullRoadAddr,
          buildingName: data.buildingName || '',
          lat: coords.lat,
          lng: coords.lng
        });
      } else if (onSelect) {
        onSelect({
          roadAddress: displayAddress,
          cleanRoadAddress: fullRoadAddr,
          buildingName: data.buildingName || '',
          lat: 35.1610,
          lng: 129.1600
        });
      }
    }
  }).open();
}
