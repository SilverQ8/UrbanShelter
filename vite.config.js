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
    }
  },
});
