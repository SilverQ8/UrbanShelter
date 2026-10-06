export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL 파싱: /api/route/foot/129.15,35.15;129.16,35.16?overview=full...
  const reqUrl = new URL(req.url, 'http://localhost');
  const pathname = reqUrl.pathname; // e.g. /api/route/foot/129.11,35.15;...
  const search = reqUrl.search; // e.g. ?overview=full&geometries=geojson&steps=true

  const match = pathname.match(/\/api\/route\/(foot|car)\/([^?]+)/);
  if (!match) {
    return res.status(400).json({ code: 'InvalidPath', message: '올바른 경로 형식이 아닙니다.' });
  }

  const profile = match[1];
  const coords = match[2];

  const targetUrls = profile === 'car'
    ? [
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}${search}`,
        `https://router.project-osrm.org/route/v1/driving/${coords}${search}`
      ]
    : [
        `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}${search}`,
        `https://router.project-osrm.org/route/v1/foot/${coords}${search}`,
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coords}${search}`
      ];

  for (const url of targetUrls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'UrbanShelter-PedestrianApp/1.0 (dmsrb@antigravity.dev)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.code === 'Ok') {
          return res.status(200).json(data);
        }
      }
    } catch {
      // try next mirror
    }
  }

  return res.status(502).json({ code: 'RoutingError', message: '경로 서버 응답 실패' });
}
