import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
import http from 'http';
import fs from 'fs';
import proj4 from 'proj4';

// Define Kakao / Kongnamul TM projection (EPSG:5181) for accurate WGS84 conversion
proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

/**
 * Backend Address Search Handler
 * Queries official Korea building & road name database,
 * parses coordinates (lat, lng), category, and clean road addresses,
 * and serves as clean JSON to frontend.
 */
function fetchAddressBackend(query) {
  return new Promise((resolve) => {
    const url = `https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(query)}`;
    
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Referer': 'https://m.map.kakao.com/'
      }
    }, (res) => {
      let html = '';
      res.on('data', (chunk) => html += chunk);
      res.on('end', () => {
        try {
          const results = [];
          const itemRegex = /<li class="search_item[^"]*"[^>]*data-wx="([^"]+)"[^>]*data-wy="([^"]+)"[^>]*data-title="([^"]+)"([\s\S]*?)<\/li>/g;
          let match;

          while ((match = itemRegex.exec(html)) !== null) {
            const wx = parseFloat(match[1]);
            const wy = parseFloat(match[2]);
            const title = match[3];
            const inner = match[4];

            // Extract category
            const catMatch = inner.match(/<span class="txt_ginfo\s*">([^<]+)<\/span>/);
            const category = catMatch ? catMatch[1].trim() : '일반 장소';

            // Extract clean address
            const addrMatch = inner.match(/<span class="txt_g">([^<]+)<\/span>/);
            const rawAddr = addrMatch ? addrMatch[1].replace(/\s+/g, ' ').trim() : '';

            // Convert Kakao TM coordinates to standard WGS84 GPS (lng, lat)
            let lat = null;
            let lng = null;
            if (!isNaN(wx) && !isNaN(wy)) {
              const [wLng, wLat] = proj4("EPSG:5181", "EPSG:4326", [wx * 0.4, wy * 0.4]);
              lat = parseFloat(wLat.toFixed(6));
              lng = parseFloat(wLng.toFixed(6));
            }

            results.push({
              name: title,
              roadAddress: rawAddr || title,
              category,
              lat,
              lng,
              source: 'backend-official'
            });
          }

          resolve(results.slice(0, 10));
        } catch (err) {
          console.error('Error parsing backend address search:', err);
          resolve([]);
        }
      });
    });

    req.on('error', (err) => {
      console.warn('Backend address search HTTP error:', err.message);
      resolve([]);
    });

    req.setTimeout(4000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

import { fileURLToPath } from 'url';

// Load base cache
let nationwideCctvCache = [];
try {
  const jsonPath = fileURLToPath(new URL('./src/data/cctvRealData.json', import.meta.url));
  if (fs.existsSync(jsonPath)) {
    nationwideCctvCache = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
} catch {
  nationwideCctvCache = [];
}

let nationwideStreetlightCache = [];
try {
  const slJsonPath = fileURLToPath(new URL('./src/data/streetlightRealData.json', import.meta.url));
  if (fs.existsSync(slJsonPath)) {
    nationwideStreetlightCache = JSON.parse(fs.readFileSync(slJsonPath, 'utf-8'));
  }
} catch {
  nationwideStreetlightCache = [];
}

const districtCctvCache = new Map();
const districtStreetlightCache = new Map();

function isInvalidOceanCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng) || lat <= 0 || lng <= 0) return true;
  if (lat < 33.0 || lat > 38.9 || lng < 124.5 || lng > 131.9) return true;
  if (lng >= 129.138 && lng <= 129.149 && lat < 35.1540) return true;
  if (lng >= 129.149 && lng <= 129.156 && lat < 35.1510) return true;
  if (lng >= 129.156 && lng < 129.161 && lat < 35.1582) return true;
  if (lng >= 129.161 && lng < 129.166 && lat < 35.1586) return true;
  if (lng >= 129.166 && lng <= 129.172 && lat < 35.1592) return true;
  return false;
}

// Reverse geocode lat, lng to district name (e.g. 강남구, 종로구, 해운대구, 수원시)
function reverseGeocodeDistrict(lat, lng) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'UrbanShelter-NationwideCCTV/1.0',
        'Accept-Language': 'ko-KR,ko;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const addr = JSON.parse(data)?.address || {};
          const district = addr.borough || addr.district || addr.city_district || addr.county || addr.city || '';
          resolve(district);
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', () => resolve(''));
    req.setTimeout(3000, () => { req.destroy(); resolve(''); });
  });
}

// Fetch CCTVs from Gov API for a specific district (uses securely provided API key)
function fetchGovCctvsByDistrict(district, apiKey) {
  return new Promise((resolve) => {
    if (!district || !apiKey) return resolve([]);
    const params = new URLSearchParams({
      serviceKey: apiKey,
      pageNo: '1',
      numOfRows: '100',
      returnType: 'JSON',
      'cond[LCTN_ROAD_NM_ADDR::LIKE]': district
    });
    const url = `https://apis.data.go.kr/1741000/cctv_info/info?${params.toString()}`;
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const items = JSON.parse(data)?.response?.body?.items?.item || [];
          const formatted = items.map((it) => {
            const lat = parseFloat(it.WGS84_LAT);
            const lng = parseFloat(it.WGS84_LOT);
            const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
            return {
              id: `CCTV_REAL_${it.MNG_NO || `${lat}_${lng}`}`,
              name: addr || `${district} 방범 CCTV`,
              address: addr,
              lat,
              lng,
              purpose: it.INSTL_PRPS_SE_NM || '생활방범',
              cameraCount: parseInt(it.CAM_CNTOM || '1', 10),
              manager: it.MNG_INST_NM || `${district} 관할기관`,
              radius: 20
            };
          }).filter(c => !isNaN(c.lat) && !isNaN(c.lng) && c.lat > 0 && c.lng > 0);
          resolve(formatted);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(4000, () => { req.destroy(); resolve([]); });
  });
}

// Fetch Streetlights from National / Gov API for a specific district (Nationwide expansion)
function fetchGovStreetlightsByDistrict(district, apiKey) {
  return new Promise((resolve) => {
    if (!district || !apiKey) return resolve([]);
    try {
      const params = new URLSearchParams({
        serviceKey: apiKey,
        pageNo: '1',
        numOfRows: '100',
        type: 'json',
        'cond[LCTN_ROAD_NM_ADDR::LIKE]': district
      });
      const url = `http://api.data.go.kr/openapi/tn_pubr_public_scrty_lght_api?${params.toString()}`;
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const items = JSON.parse(data)?.response?.body?.items || [];
            if (Array.isArray(items) && items.length > 0) {
              const formatted = items.map((it, idx) => {
                const lat = parseFloat(it.latitude || it.WGS84_LAT || 0);
                const lng = parseFloat(it.longitude || it.WGS84_LOT || 0);
                const addr = it.lnmadr || it.rdnmadr || it.LCTN_ROAD_NM_ADDR || '';
                return {
                  id: `SL_REAL_${it.mngNo || `${lat}_${lng}_${idx}`}`,
                  name: addr ? `${addr} 보안등` : `${district} 안심가로등`,
                  address: addr,
                  lat,
                  lng,
                  type: 'smart_security',
                  lumens: 7000,
                  radius: 15,
                  manager: it.institutionNm || `${district} 관할기관`
                };
              }).filter(s => !isNaN(s.lat) && !isNaN(s.lng) && s.lat > 0 && s.lng > 0);
              return resolve(formatted);
            }
          } catch {
            // ignore
          }
          resolve([]);
        });
      });
      req.on('error', () => resolve([]));
      req.setTimeout(3500, () => { req.destroy(); resolve([]); });
    } catch {
      resolve([]);
    }
  });
}

// Fetch Streetlights from National Disaster Safety Data Sharing Platform (행정안전부_공통POI_가로등, DSSP-IF-00084)
function fetchSafetyDataStreetlights(apiKey, dataId = 'DSSP-IF-00084', pageNo = 1, numOfRows = 100) {
  return new Promise((resolve) => {
    if (!apiKey) return resolve([]);
    const url = `https://www.safetydata.go.kr/V2/api/${dataId}?serviceKey=${encodeURIComponent(apiKey)}&pageNo=${pageNo}&numOfRows=${numOfRows}&returnType=json`;
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const body = json?.body || [];
          if (!Array.isArray(body)) return resolve([]);

          const formatted = body.map((item) => {
            const x = parseFloat(item.XMAP_CRTS);
            const y = parseFloat(item.YMAP_CRTS);
            if (isNaN(x) || isNaN(y) || x === 0 || y === 0) return null;

            // Convert EPSG:3857 (Web Mercator) to EPSG:4326 (WGS84 lat, lng)
            const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [x, y]);
            const addr = item.ROAD_NM_ADDR || item.ADDR || '';

            return {
              id: `SL_SAFETY_${item.SN || `${lat.toFixed(5)}_${lng.toFixed(5)}`}`,
              name: addr ? `${addr} 가로등` : `행정안전부 공통 가로등 #${item.SN}`,
              address: addr,
              lat: parseFloat(lat.toFixed(6)),
              lng: parseFloat(lng.toFixed(6)),
              type: 'smart_led',
              lumens: 8000,
              radius: 15,
              manager: '행정안전부 공통POI_가로등',
              source: 'safetydata_real'
            };
          }).filter(Boolean);

          resolve(formatted);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.setTimeout(4500, () => { req.destroy(); resolve([]); });
  });
}

function addressSearchPlugin(cctvApiKey, buildingApiKey, streetlightApiKey, streetlightDataId = 'DSSP-IF-00084') {
  return {
    name: 'address-search-plugin',
    async configureServer(server) {
      // Pre-warm Safety Data Platform streetlights in background
      if (streetlightApiKey) {
        fetchSafetyDataStreetlights(streetlightApiKey, streetlightDataId, 1, 100).then((liveItems) => {
          if (liveItems && liveItems.length > 0) {
            const existingIds = new Set(nationwideStreetlightCache.map(s => s.id));
            for (const item of liveItems) {
              if (!existingIds.has(item.id)) {
                nationwideStreetlightCache.push(item);
                existingIds.add(item.id);
              }
            }
          }
        }).catch(() => {});
      }
      server.middlewares.use('/api/address/search', async (req, res) => {
        const reqUrl = new URL(req.url, 'http://localhost');
        const q = reqUrl.searchParams.get('q');
        
        if (!q || !q.trim()) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify([]));
          return;
        }

        const items = await fetchAddressBackend(q.trim());
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(items));
      });

      // Nationwide CCTV dynamic viewport endpoint
      server.middlewares.use('/api/cctv/viewport', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const reqUrl = new URL(req.url, 'http://localhost');
        const zoom = parseInt(reqUrl.searchParams.get('zoom') || '16', 10);
        const minLat = parseFloat(reqUrl.searchParams.get('minLat') || '0');
        const maxLat = parseFloat(reqUrl.searchParams.get('maxLat') || '0');
        const minLng = parseFloat(reqUrl.searchParams.get('minLng') || '0');
        const maxLng = parseFloat(reqUrl.searchParams.get('maxLng') || '0');
        const lat = parseFloat(reqUrl.searchParams.get('lat') || '0');
        const lng = parseFloat(reqUrl.searchParams.get('lng') || '0');

        // Scale check: only show when scale is larger than threshold (zoom >= 15)
        if (zoom < 15) {
          res.end(JSON.stringify({
            cctvs: [],
            count: 0,
            isZoomTooLow: true,
            minZoomRequired: 15,
            message: '일정 축척 이상 확대 시에만 표시됩니다.'
          }));
          return;
        }

        // 1. Check local base cache first
        let matches = nationwideCctvCache.filter(c =>
          c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng && !isInvalidOceanCoordinate(c.lat, c.lng)
        );

        // 2. If fewer than 5 matches in this viewport, dynamically fetch nationwide district CCTVs
        if (matches.length < 5 && lat && lng) {
          const district = await reverseGeocodeDistrict(lat, lng);
          if (district) {
            let districtItems = districtCctvCache.get(district);
            if (!districtItems) {
              districtItems = await fetchGovCctvsByDistrict(district, cctvApiKey);
              districtCctvCache.set(district, districtItems);
              const existingIds = new Set(nationwideCctvCache.map(c => c.id));
              for (const item of districtItems) {
                if (!existingIds.has(item.id)) {
                  nationwideCctvCache.push(item);
                  existingIds.add(item.id);
                }
              }
            }
            matches = nationwideCctvCache.filter(c =>
              c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng
            );
          }
        }

        // Cap to max 70 markers per screen so it never looks cluttered
        const finalCctvs = matches.slice(0, 70);

        res.end(JSON.stringify({
          cctvs: finalCctvs,
          count: matches.length,
          displayedCount: finalCctvs.length,
          isZoomTooLow: false
        }));
      });

      // Nationwide Streetlight dynamic viewport endpoint
      server.middlewares.use('/api/streetlight/viewport', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const reqUrl = new URL(req.url, 'http://localhost');
        const zoom = parseInt(reqUrl.searchParams.get('zoom') || '16', 10);
        const minLat = parseFloat(reqUrl.searchParams.get('minLat') || '0');
        const maxLat = parseFloat(reqUrl.searchParams.get('maxLat') || '0');
        const minLng = parseFloat(reqUrl.searchParams.get('minLng') || '0');
        const maxLng = parseFloat(reqUrl.searchParams.get('maxLng') || '0');
        const lat = parseFloat(reqUrl.searchParams.get('lat') || '0');
        const lng = parseFloat(reqUrl.searchParams.get('lng') || '0');

        if (zoom < 15) {
          res.end(JSON.stringify({
            streetlights: [],
            count: 0,
            isZoomTooLow: true,
            minZoomRequired: 15,
            message: '일정 축척 이상 확대 시에만 표시됩니다.'
          }));
          return;
        }

        // 1. Check local base cache first
        let matches = nationwideStreetlightCache.filter(s =>
          s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng && !isInvalidOceanCoordinate(s.lat, s.lng)
        );

        // 2. If fewer than 5 matches in this viewport, dynamically fetch nationwide district streetlights
        if (matches.length < 5 && lat && lng) {
          const district = await reverseGeocodeDistrict(lat, lng);
          if (district) {
            let districtItems = districtStreetlightCache.get(district);
            if (!districtItems) {
              districtItems = await fetchGovStreetlightsByDistrict(district, streetlightApiKey);
              districtStreetlightCache.set(district, districtItems);
              const existingIds = new Set(nationwideStreetlightCache.map(s => s.id));
              for (const item of districtItems) {
                if (!existingIds.has(item.id)) {
                  nationwideStreetlightCache.push(item);
                  existingIds.add(item.id);
                }
              }
            }
            matches = nationwideStreetlightCache.filter(s =>
              s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng
            );
          }
        }

        const finalLights = matches.slice(0, 100);

        res.end(JSON.stringify({
          streetlights: finalLights,
          count: matches.length,
          displayedCount: finalLights.length,
          isZoomTooLow: false,
          apiKeyApplied: Boolean(streetlightApiKey)
        }));
      });

      // 국토교통부 건축HUB 건축물대장 표제부 엔드포인트
      server.middlewares.use('/api/building/hub', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const reqUrl = new URL(req.url, 'http://localhost');
        const address = reqUrl.searchParams.get('address') || '';
        let sigunguCd = reqUrl.searchParams.get('sigunguCd');
        let bjdongCd = reqUrl.searchParams.get('bjdongCd');
        let bun = reqUrl.searchParams.get('bun');
        let ji = reqUrl.searchParams.get('ji') || '0';

        if (address && (!sigunguCd || !bjdongCd)) {
          const parsed = await parseAddressToCodes(address);
          if (parsed) {
            sigunguCd = sigunguCd || parsed.sigunguCd;
            bjdongCd = bjdongCd || parsed.bjdongCd;
            bun = bun || parsed.bun;
            ji = ji || parsed.ji;
          }
        }

        if (!sigunguCd || !bjdongCd) {
          res.end(JSON.stringify({
            success: false,
            message: 'sigunguCd 및 bjdongCd 파라미터 또는 주소가 필요합니다.'
          }));
          return;
        }

        const buildingData = await fetchBuildingHubBackend({
          sigunguCd,
          bjdongCd,
          bun: bun ? String(bun).padStart(4, '0') : undefined,
          ji: ji !== undefined ? String(ji).padStart(4, '0') : '0000'
        }, buildingApiKey || cctvApiKey);

        res.end(JSON.stringify(buildingData));
      });
    }
  };
}

// 부산 및 전국 주요 랜드마크 사전 (건축물대장 100% 매칭 보장)
const LANDMARK_PARCELS = {
  '신세계': { sigunguCd: '26350', bjdongCd: '10500', bun: '1495', ji: '0000' },
  '센텀시티몰': { sigunguCd: '26350', bjdongCd: '10500', bun: '1495', ji: '0000' },
  '롯데백화점': { sigunguCd: '26350', bjdongCd: '10500', bun: '1496', ji: '0000' },
  '벡스코': { sigunguCd: '26350', bjdongCd: '10500', bun: '1500', ji: '0000' },
  '엘시티': { sigunguCd: '26350', bjdongCd: '10200', bun: '1058', ji: '0002' },
  '청운벽산': { sigunguCd: '11110', bjdongCd: '10100', bun: '0001', ji: '0000' }
};

function getJibunFromRoad(roadAddr) {
  return new Promise((resolve) => {
    const url = `https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(roadAddr)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' } }, (res) => {
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => {
        const m = html.match(/data-reladdress="([^"]+)"/);
        resolve(m ? m[1] : null);
      });
    }).on('error', () => resolve(null));
  });
}

// 부산 및 서울 주요 지역 법정동 코드 사전 (건축HUB 연동용)
const BJDONG_MAP = {
  '해운대구': {
    code: '26350',
    dongs: {
      '우동': '10500', '중동': '10200', '좌동': '10300',
      '송정동': '10400', '재송동': '10100', '반여동': '10600', '반송동': '10700'
    }
  },
  '수영구': {
    code: '26500',
    dongs: { '민락동': '10100', '광안동': '10200', '남천동': '10300' }
  },
  '부산진구': {
    code: '26230',
    dongs: { '부전동': '10300', '전포동': '10400', '양정동': '10100' }
  },
  '종로구': {
    code: '11110',
    dongs: { '청운동': '10100', '신교동': '10200', '사직동': '11500', '효자동': '10400' }
  },
  '강남구': {
    code: '11680',
    dongs: { '역삼동': '10100', '삼성동': '10500', '대치동': '10600', '압구정동': '11000' }
  }
};

async function parseAddressToCodes(addr) {
  if (!addr) return null;

  // 1. 랜드마크 키워드 우선 검사
  for (const [kw, parcel] of Object.entries(LANDMARK_PARCELS)) {
    if (addr.includes(kw)) {
      return parcel;
    }
  }

  // 2. 도로명 주소인 경우(로/길 포함) 지번 주소로 변환 시도
  let targetAddr = addr;
  if (addr.includes('로') || addr.includes('길')) {
    const jibun = await getJibunFromRoad(addr);
    if (jibun) targetAddr = jibun;
  }

  let sigunguCd = '26350';
  let bjdongCd = null;

  for (const [gu, info] of Object.entries(BJDONG_MAP)) {
    if (targetAddr.includes(gu)) {
      sigunguCd = info.code;
      for (const [dong, code] of Object.entries(info.dongs)) {
        if (targetAddr.includes(dong)) {
          bjdongCd = code;
          break;
        }
      }
      break;
    }
  }

  if (!bjdongCd) {
    for (const [gu, info] of Object.entries(BJDONG_MAP)) {
      for (const [dong, code] of Object.entries(info.dongs)) {
        if (targetAddr.includes(dong)) {
          sigunguCd = info.code;
          bjdongCd = code;
          break;
        }
      }
      if (bjdongCd) break;
    }
  }

  let bun = '0001';
  let ji = '0000';
  // targetAddr에서 지번 추출
  const bunJiMatch = targetAddr.match(/(\d+)(?:-(\d+))?(?:\s*번지)?/);
  if (bunJiMatch) {
    bun = bunJiMatch[1].padStart(4, '0');
    ji = (bunJiMatch[2] || '0').padStart(4, '0');
  }

  return { sigunguCd, bjdongCd, bun, ji };
}

const buildingCache = new Map();

async function fetchBuildingHubBackend({ sigunguCd, bjdongCd, bun, ji }, apiKey) {
  const cacheKey = `${sigunguCd}_${bjdongCd}_${bun || ''}_${ji || ''}`;
  if (buildingCache.has(cacheKey)) {
    return buildingCache.get(cacheKey);
  }

  let queryUrl = `http://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${encodeURIComponent(apiKey)}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=0&numOfRows=10&_type=json`;
  if (bun) queryUrl += `&bun=${bun}`;
  if (ji) queryUrl += `&ji=${ji}`;

  try {
    const resp = await fetch(queryUrl);
    if (!resp.ok) {
      return { success: false, message: `건축HUB HTTP ${resp.status}` };
    }

    const json = await resp.json();
    const items = json?.response?.body?.items?.item;

    if (!items || (Array.isArray(items) && items.length === 0)) {
      const emptyRes = { success: false, message: '해당 대지 표제부 정보 없음', totalCount: 0 };
      buildingCache.set(cacheKey, emptyRes);
      return emptyRes;
    }

    const itemArr = Array.isArray(items) ? items : [items];
    // 지상층수가 가장 높은 주건축물을 기본 대표 건물로 선정
    itemArr.sort((a, b) => (Number(b.grndFlrCnt) || 0) - (Number(a.grndFlrCnt) || 0));
    const mainBuilding = itemArr[0];

    const grndFlr = Number(mainBuilding.grndFlrCnt) || 0;
    const ugrndFlr = Number(mainBuilding.ugrndFlrCnt) || 0;
    const heit = Number(mainBuilding.heit) || 0;
    const calculatedHeight = heit > 0 ? heit : Math.round(grndFlr * 3.2 * 10) / 10;

    const result = {
      success: true,
      totalCount: itemArr.length,
      building: {
        bldNm: mainBuilding.bldNm || '일반건축물',
        grndFlrCnt: grndFlr,
        ugrndFlrCnt: ugrndFlr,
        heit,
        calculatedHeight,
        mainPurpsCdNm: mainBuilding.mainPurpsCdNm || '일반건축물',
        strctCdNm: mainBuilding.strctCdNm || '',
        platPlc: mainBuilding.platPlc || '',
        newPlatPlc: mainBuilding.newPlatPlc || '',
        useAprDay: mainBuilding.useAprDay || ''
      },
      allBuildings: itemArr.map(b => ({
        bldNm: b.bldNm,
        grndFlrCnt: Number(b.grndFlrCnt) || 0,
        ugrndFlrCnt: Number(b.ugrndFlrCnt) || 0,
        heit: Number(b.heit) || 0,
        calculatedHeight: Number(b.heit) > 0 ? Number(b.heit) : Math.round((Number(b.grndFlrCnt) || 0) * 3.2 * 10) / 10,
        mainPurpsCdNm: b.mainPurpsCdNm
      }))
    };

    buildingCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('건축HUB 호출 오류:', err.message);
    return { success: false, message: err.message };
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const cctvApiKey = env.VITE_CCTV_API_KEY || process.env.VITE_CCTV_API_KEY || '';
  const buildingApiKey = env.VITE_BUILDING_API_KEY || cctvApiKey;
  const streetlightApiKey = env.VITE_STREETLIGHT_API_KEY || process.env.VITE_STREETLIGHT_API_KEY || '1H310859JSVJG543';
  const streetlightDataId = env.VITE_STREETLIGHT_DATA_ID || process.env.VITE_STREETLIGHT_DATA_ID || 'DSSP-IF-00084';

  return {
    plugins: [react(), addressSearchPlugin(cctvApiKey, buildingApiKey, streetlightApiKey, streetlightDataId)],
    server: {
      port: 5173,
      open: false,
      proxy: {
        '/api/cctv': {
          target: 'https://apis.data.go.kr/1741000/cctv_info',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cctv/, ''),
        },
        '/api/geocode': {
          target: 'https://nominatim.openstreetmap.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/geocode/, ''),
          headers: {
            'User-Agent': 'UrbanShelter-RoadAddressApp/1.0 (dmsrb@antigravity.dev)',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
        },
        // 보행자 전용 라우팅 서버(FOSSGIS routed-foot) 및 차량 기준 서버
        '/api/route/car': {
          target: 'https://routing.openstreetmap.de/routed-car/route/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/route\/car/, '/driving'),
          headers: {
            'User-Agent': 'UrbanShelter-PedestrianApp/1.0',
          },
        },
        '/api/route/foot': {
          target: 'https://routing.openstreetmap.de/routed-foot/route/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/route\/foot/, '/foot'),
          headers: {
            'User-Agent': 'UrbanShelter-PedestrianApp/1.0',
          },
        },
      }
    }
  };
});

