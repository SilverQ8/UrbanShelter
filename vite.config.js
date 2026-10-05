import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import https from 'https';
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

const CCTV_API_KEY = '156104a45590707c1dad884a0d5f8ba1d17ffe27573fb3adcccfcdcd0f861cea';

// Load base cache
let nationwideCctvCache = [];
try {
  const jsonPath = new URL('./src/data/cctvRealData.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  if (fs.existsSync(jsonPath)) {
    nationwideCctvCache = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
} catch {
  nationwideCctvCache = [];
}

const districtCctvCache = new Map();

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

// Fetch CCTVs from Gov API for a specific district
function fetchGovCctvsByDistrict(district) {
  return new Promise((resolve) => {
    if (!district) return resolve([]);
    const params = new URLSearchParams({
      serviceKey: CCTV_API_KEY,
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

function addressSearchPlugin() {
  return {
    name: 'address-search-plugin',
    configureServer(server) {
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
          c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng
        );

        // 2. If fewer than 5 matches in this viewport, dynamically fetch nationwide district CCTVs
        if (matches.length < 5 && lat && lng) {
          const district = await reverseGeocodeDistrict(lat, lng);
          if (district) {
            let districtItems = districtCctvCache.get(district);
            if (!districtItems) {
              districtItems = await fetchGovCctvsByDistrict(district);
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
    }
  };
}

export default defineConfig({
  plugins: [react(), addressSearchPlugin()],
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
      '/api/route/foot': {
        target: 'https://router.project-osrm.org/route/v1/foot',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/route\/foot/, ''),
        headers: {
          'User-Agent': 'UrbanShelter-PedestrianApp/1.0',
        },
      },
    }
  },
});

