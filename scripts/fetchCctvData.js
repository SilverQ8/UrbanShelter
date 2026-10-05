import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const key = '156104a45590707c1dad884a0d5f8ba1d17ffe27573fb3adcccfcdcd0f861cea';

function fetchGov(params) {
  return new Promise((resolve) => {
    const qs = new URLSearchParams({
      serviceKey: key,
      numOfRows: '100',
      returnType: 'JSON',
      ...params
    }).toString();
    const url = 'https://apis.data.go.kr/1741000/cctv_info/info?' + qs;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({
            items: json?.response?.body?.items?.item || [],
            total: json?.response?.body?.totalCount || 0
          });
        } catch (e) {
          resolve({ items: [], total: 0 });
        }
      });
    }).on('error', () => resolve({ items: [], total: 0 }));
  });
}

async function run() {
  console.log('Fetching Haeundae-gu CCTVs from Public Data Portal...');
  const allRaw = [];

  // Haeundae pages 1 to 9 (806 items)
  for (let p = 1; p <= 9; p++) {
    const res = await fetchGov({ pageNo: String(p), 'cond[MNG_INST_NM::LIKE]': '해운대' });
    allRaw.push(...res.items);
  }
  console.log('Haeundae fetched:', allRaw.length);

  // Suyeong-gu (Gwangalli/Centum border) pages 1 to 10 (1000 items)
  console.log('Fetching Suyeong-gu CCTVs...');
  for (let p = 1; p <= 10; p++) {
    const res = await fetchGov({ pageNo: String(p), 'cond[MNG_INST_NM::LIKE]': '수영구' });
    allRaw.push(...res.items);
  }
  console.log('Total raw fetched:', allRaw.length);

  const formatted = [];
  const seen = new Set();

  for (const it of allRaw) {
    const lat = parseFloat(it.WGS84_LAT);
    const lng = parseFloat(it.WGS84_LOT);
    const mngNo = it.MNG_NO || `${lat}_${lng}`;

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0 || seen.has(mngNo)) continue;
    seen.add(mngNo);

    const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
    const cleanName = addr.replace(/^부산광역시\s*(해운대구|수영구)?\s*/, '') || '생활방범 CCTV';

    formatted.push({
      id: 'CCTV_REAL_' + mngNo,
      name: cleanName,
      address: addr || cleanName,
      lat,
      lng,
      purpose: it.INSTL_PRPS_SE_NM || '생활방범',
      cameraCount: parseInt(it.CAM_CNTOM || '1', 10),
      manager: it.MNG_INST_NM || '부산광역시 관할구청',
      radius: 20
    });
  }

  console.log('Total formatted valid GPS CCTVs:', formatted.length);
  const targetPath = path.resolve(__dirname, '../src/data/cctvRealData.json');
  fs.writeFileSync(targetPath, JSON.stringify(formatted, null, 2), 'utf-8');
  console.log('Successfully saved to', targetPath);
}

run();
