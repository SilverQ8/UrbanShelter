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

          resolve(results.slice(0, 25));
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

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const q = req.query.q || '';
  if (!q || !q.trim()) {
    return res.status(200).json([]);
  }

  const queryTrimmed = q.trim();
  const rawLat = parseFloat(req.query.lat);
  const rawLng = parseFloat(req.query.lng);
  const hasUserLoc = !isNaN(rawLat) && !isNaN(rawLng);

  let items = await fetchAddressBackend(queryTrimmed);

  if (hasUserLoc && items.length > 0) {
    items = items.map((item) => {
      if (item.lat && item.lng) {
        const distKm = calcDistanceKm(rawLat, rawLng, item.lat, item.lng);
        return {
          ...item,
          distanceKm: parseFloat(distKm.toFixed(2)),
          distanceText: distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)}km`
        };
      }
      return item;
    });

    // 거리 및 질의 일치도 기반 정렬: 현재 위치에 가까운 장소 상단 배치
    const qLower = queryTrimmed.toLowerCase();
    items.sort((a, b) => {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();

      let aScore = 0;
      let bScore = 0;

      if (aName === qLower) aScore += 100;
      else if (aName.startsWith(qLower)) aScore += 50;

      if (bName === qLower) bScore += 100;
      else if (bName.startsWith(qLower)) bScore += 50;

      const aDist = a.distanceKm !== undefined ? a.distanceKm : 999999;
      const bDist = b.distanceKm !== undefined ? b.distanceKm : 999999;

      // 같은 급의 일치도면 가까운 순서로 정렬
      if (aScore === bScore) {
        return aDist - bDist;
      }

      // 일치도가 약간 달라도 거리가 훨씬 가까우면(예: 수백km 차이) 가까운 곳 우선
      return (bScore - bDist * 0.15) - (aScore - aDist * 0.15);
    });
  }

  return res.status(200).json(items.slice(0, 15));
}
