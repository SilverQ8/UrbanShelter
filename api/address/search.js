import https from 'https';
import { proj4 } from '../_lib/geo.js';

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

            const catMatch = inner.match(/<span class="txt_ginfo\s*">([^<]+)<\/span>/);
            const category = catMatch ? catMatch[1].trim() : '일반 장소';

            const addrMatch = inner.match(/<span class="txt_g">([^<]+)<\/span>/);
            const rawAddr = addrMatch ? addrMatch[1].replace(/\s+/g, ' ').trim() : '';

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

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = req.query.q || '';
  if (!q || !q.trim()) {
    return res.status(200).json([]);
  }

  const items = await fetchAddressBackend(q.trim());
  return res.status(200).json(items);
}
