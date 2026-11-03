export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, appKey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let startX, startY, endX, endY, count;

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      startX = body.startX;
      startY = body.startY;
      endX = body.endX;
      endY = body.endY;
      count = body.count || 3;
    } else {
      const reqUrl = new URL(req.url, 'http://localhost');
      startX = reqUrl.searchParams.get('startX');
      startY = reqUrl.searchParams.get('startY');
      endX = reqUrl.searchParams.get('endX');
      endY = reqUrl.searchParams.get('endY');
      count = reqUrl.searchParams.get('count') || 3;
    }

    if (!startX || !startY || !endX || !endY) {
      return res.status(400).json({ error: 'startX, startY, endX, endY coordinates are required.' });
    }

    const appKey = process.env.TMAP_APP_KEY || process.env.VITE_TMAP_APP_KEY || 'SwziAaNX2x4LattRuXxpa3BgkZXm1E3X3vgknMrP';

    const tmapResp = await fetch('https://apis.openapi.sk.com/transit/routes', {
      method: 'POST',
      headers: {
        'appKey': appKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startX: String(startX),
        startY: String(startY),
        endX: String(endX),
        endY: String(endY),
        count: Number(count) || 3,
        lang: 0,
        format: 'json'
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!tmapResp.ok) {
      const errorText = await tmapResp.text();
      return res.status(tmapResp.status).json({
        error: 'TMAP Transit API error',
        details: errorText
      });
    }

    const data = await tmapResp.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('Transit API internal error:', err);
    return res.status(500).json({ error: 'Transit route service temporarily unavailable', message: err.message });
  }
}
