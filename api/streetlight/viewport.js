import { getSupabase } from '../_lib/supabase.js';
import { isInvalidOceanCoordinate, getDistM } from '../_lib/geo.js';
import { getStreetlightCache } from '../_lib/data.js';

function interpolateRoadStreetlights(ways) {
  const lights = [];
  const visitedCoordKeys = new Set();

  for (const w of ways) {
    const geom = w.geometry;
    if (!Array.isArray(geom) || geom.length < 2) continue;

    const roadName = w.tags?.name || '보행로';
    const hwType = w.tags?.highway || '';
    const isMain = ['primary', 'secondary', 'tertiary'].includes(hwType);
    const intervalMeters = isMain ? 35 : 28;

    let currentCarry = 0;
    for (let i = 0; i < geom.length - 1; i++) {
      const p1 = geom[i];
      const p2 = geom[i + 1];
      const segDist = getDistM(p1.lat, p1.lon, p2.lat, p2.lon);
      if (segDist < 5) continue;

      let distFromP1 = intervalMeters - currentCarry;
      while (distFromP1 <= segDist) {
        const ratio = distFromP1 / segDist;
        const lat = Number((p1.lat + (p2.lat - p1.lat) * ratio).toFixed(6));
        const lon = Number((p1.lon + (p2.lon - p1.lon) * ratio).toFixed(6));

        if (!isInvalidOceanCoordinate(lat, lon)) {
          const key = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
          if (!visitedCoordKeys.has(key)) {
            visitedCoordKeys.add(key);
            lights.push({
              id: `SL_ROAD_${w.id}_${lights.length + 1}`,
              name: `${roadName} 가로등 #${lights.length + 1}`,
              address: roadName,
              lat,
              lng: lon,
              type: roadName.includes('해변') ? 'coastal_led' : 'smart_led',
              lumens: isMain ? 9000 : 7000,
              radius: 15,
              manager: '관할 지자체 도로관리과'
            });
          }
        }
        distFromP1 += intervalMeters;
      }
      currentCarry = segDist - (distFromP1 - intervalMeters);
    }
  }
  return lights;
}

const viewportRoadCache = new Map();

async function fetchOsmRoadStreetlights(minLat, minLng, maxLat, maxLng) {
  const cacheKey = `${minLat.toFixed(3)}_${minLng.toFixed(3)}_${maxLat.toFixed(3)}_${maxLng.toFixed(3)}`;
  if (viewportRoadCache.has(cacheKey)) {
    return viewportRoadCache.get(cacheKey);
  }

  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  const ways = [];

  const osrmUrls = [
    `https://router.project-osrm.org/route/v1/foot/${minLng},${cLat};${maxLng},${cLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${cLng},${minLat};${cLng},${maxLat}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${minLng},${minLat};${maxLng},${maxLat}?overview=full&geometries=geojson`
  ];

  for (let i = 0; i < osrmUrls.length; i++) {
    try {
      const resp = await fetch(osrmUrls[i], { signal: AbortSignal.timeout(2200) });
      if (resp.ok) {
        const json = await resp.json();
        const coords = json.routes?.[0]?.geometry?.coordinates;
        const roadName = json.routes?.[0]?.legs?.[0]?.steps?.[0]?.name || '보행로';
        if (Array.isArray(coords) && coords.length > 1) {
          ways.push({
            id: `OSRM_ROAD_${i}`,
            tags: { name: roadName, highway: 'residential' },
            geometry: coords.map(c => ({ lat: c[1], lon: c[0] }))
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (ways.length > 0) {
    const lights = interpolateRoadStreetlights(ways);
    if (lights.length > 0) {
      viewportRoadCache.set(cacheKey, lights);
      return lights;
    }
  }

  return [];
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const zoom = parseInt(req.query.zoom || '16', 10);
  const minLat = parseFloat(req.query.minLat || '0');
  const maxLat = parseFloat(req.query.maxLat || '0');
  const minLng = parseFloat(req.query.minLng || '0');
  const maxLng = parseFloat(req.query.maxLng || '0');
  const lat = parseFloat(req.query.lat || '0');
  const lng = parseFloat(req.query.lng || '0');

  if (zoom < 13) {
    return res.status(200).json({
      streetlights: [],
      count: 0,
      isZoomTooLow: true,
      minZoomRequired: 13,
      message: '일정 축척 이상 확대 시에만 표시됩니다.'
    });
  }

  let matches = [];
  const supabase = getSupabase();

  // 1. Supabase Cloud Database 우선 조회
  if (supabase && minLat && maxLat && minLng && maxLng) {
    try {
      const { data: supaLights } = await supabase
        .from('streetlight_locations')
        .select('sl_id, name, address, lat, lng, type, lumens, radius, manager')
        .gte('lat', minLat)
        .lte('lat', maxLat)
        .gte('lng', minLng)
        .lte('lng', maxLng)
        .limit(300);
      if (supaLights && supaLights.length > 0) {
        matches = supaLights.map(s => ({
          id: s.sl_id,
          name: s.name,
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          type: s.type || 'smart_led',
          lumens: s.lumens || 8000,
          radius: s.radius || 15,
          manager: s.manager || '지자체 도로관리과'
        }));
      }
    } catch {
      // fallback
    }
  }

  // 2. Base cache fallback
  const slCache = getStreetlightCache();
  if (matches.length < 15) {
    const localMatches = slCache.filter(s =>
      s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng && !isInvalidOceanCoordinate(s.lat, s.lng)
    );
    const existingIds = new Set(matches.map(s => s.id));
    for (const m of localMatches) {
      if (!existingIds.has(m.id)) {
        matches.push(m);
        existingIds.add(m.id);
      }
    }
  }

  // 3. OSRM real road walking lights
  if (matches.length < 15 && minLat && minLng && maxLat && maxLng) {
    try {
      const roadLights = await fetchOsmRoadStreetlights(minLat, minLng, maxLat, maxLng);
      if (roadLights && roadLights.length > 0) {
        const existingIds = new Set(matches.map(s => s.id));
        for (const item of roadLights) {
          if (!existingIds.has(item.id)) {
            matches.push(item);
            existingIds.add(item.id);
          }
        }
      }
    } catch (err) {
      console.warn('Road streetlight dynamic interpolation error:', err);
    }
  }

  // Strict Viewport Bounding Box Filtering (화면 바깥 100% 완전 배제)
  if (minLat && maxLat && minLng && maxLng) {
    matches = matches.filter(s =>
      s.lat >= minLat && s.lat <= maxLat && s.lng >= minLng && s.lng <= maxLng && !isInvalidOceanCoordinate(s.lat, s.lng)
    );
  }

  // Center-priority sorting: 화면 중앙에서 가장 가까운 가로등부터 우선 정렬
  const getLightDistFromCenter = (itemLat, itemLng) => {
    const dLat = itemLat - lat;
    const dLng = (itemLng - lng) * Math.cos((lat * Math.PI) / 180);
    return dLat * dLat + dLng * dLng;
  };

  if (lat && lng) {
    matches.sort((a, b) => getLightDistFromCenter(a.lat, a.lng) - getLightDistFromCenter(b.lat, b.lng));
  }

  const slLimit = zoom >= 17 ? 200 : 140;
  const finalLights = matches.slice(0, slLimit);

  return res.status(200).json({
    streetlights: finalLights,
    count: matches.length,
    displayedCount: finalLights.length,
    isZoomTooLow: false
  });
}
