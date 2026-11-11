import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import proj4 from 'proj4';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = '1H310859JSVJG543';
const DATA_ID = 'DSSP-IF-00084';
const BJD_URL = 'https://gist.githubusercontent.com/FinanceData/4b0a6e1818cea9e77496e57b84bb4565/raw/1120cf8e0b94fd74863d3c8799aa353e194e828d/%EB%B2%95%EC%A0%95%EB%8F%99%EC%BD%94%EB%93%9C%EC%A0%84%EC%B2%B4%EC%9E%90%EB%A3%8C.txt';

// EPSG:3857 -> EPSG:4326 변환
function toWgs84(x, y) {
  try {
    const [lng, lat] = proj4('EPSG:3857', 'EPSG:4326', [parseFloat(x), parseFloat(y)]);
    if (isNaN(lat) || isNaN(lng)) return null;
    // 부산 광역 범위 검증 (위도 34.8 ~ 35.5, 경도 128.7 ~ 129.4)
    if (lat < 34.8 || lat > 35.5 || lng < 128.7 || lng > 129.4) return null;
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6))
    };
  } catch {
    return null;
  }
}

async function fetchBusanEmdList() {
  console.log('1. 부산광역시 법정동 8자리 코드 목록 다운로드 중...');
  const resp = await fetch(BJD_URL);
  if (!resp.ok) throw new Error('Failed to fetch legal dong list');
  const text = await resp.text();
  const lines = text.split('\n');

  const emdMap = new Map();
  for (const line of lines) {
    if (!line.startsWith('26') || !line.includes('존재')) continue;
    const parts = line.split('\t');
    const code = parts[0]?.trim();
    const name = parts[1]?.trim();
    if (code && code.length === 10 && code.slice(5) !== '00000') {
      const emd8 = code.slice(0, 8);
      if (!emdMap.has(emd8)) {
        emdMap.set(emd8, { emdCd: emd8, name });
      }
    }
  }

  const list = Array.from(emdMap.values());
  console.log(`부산광역시 총 ${list.length}개 법정동 코드 준비 완료.`);
  return list;
}

async function fetchEmdStreetlights(emdCd, dongName) {
  const items = [];
  let pageNo = 1;
  const numOfRows = 1000;

  while (true) {
    try {
      const params = new URLSearchParams({
        serviceKey: API_KEY,
        pageNo: String(pageNo),
        numOfRows: String(numOfRows),
        returnType: 'json',
        emdCd
      });

      const url = `https://www.safetydata.go.kr/V2/api/${DATA_ID}?${params.toString()}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) break;

      const data = await res.json();
      const body = data.body || [];
      const totalCount = data.totalCount || 0;

      if (!Array.isArray(body) || body.length === 0) break;

      for (const it of body) {
        if (!it.XMAP_CRTS || !it.YMAP_CRTS) continue;
        const coords = toWgs84(it.XMAP_CRTS, it.YMAP_CRTS);
        if (!coords) continue;

        const roadAddr = it.ROAD_NM_ADDR || it.ADDR || '';
        const id = `SL_SAFETY_${it.SN || `${coords.lat}_${coords.lng}`}`;

        items.push({
          id,
          name: roadAddr ? `${roadAddr} 안심가로등` : `${dongName} 안심가로등`,
          address: roadAddr || dongName,
          lat: coords.lat,
          lng: coords.lng,
          type: 'smart_led',
          lumens: 7500,
          radius: 15,
          manager: it.FCLT_GVMNFC_NM || '부산광역시 도로관리청'
        });
      }

      if (items.length >= totalCount || body.length < numOfRows) break;
      pageNo++;
      if (pageNo > 10) break; // 과도한 반복 방지 (동당 최대 10,000개)
    } catch (err) {
      console.warn(`[${dongName}(${emdCd})] page ${pageNo} fetch error:`, err.message);
      break;
    }
  }

  return items;
}

async function run() {
  const emdList = await fetchBusanEmdList();
  console.log(`2. 행정안전부 재난안전데이터공유플랫폼(DSSP-IF-00084)에서 부산 가로등 다운로드 시작...`);

  const allStreetlights = [];
  const seenIds = new Set();

  const concurrency = 6;
  for (let i = 0; i < emdList.length; i += concurrency) {
    const chunk = emdList.slice(i, i + concurrency);
    const results = await Promise.all(
      chunk.map(c => fetchEmdStreetlights(c.emdCd, c.name))
    );

    for (const group of results) {
      for (const item of group) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allStreetlights.push(item);
        }
      }
    }

    const progress = Math.min(100, Math.round(((i + chunk.length) / emdList.length) * 100));
    process.stdout.write(`\r진행률: ${progress}% (${i + chunk.length}/${emdList.length}개 동 완료) - 수집된 가로등: ${allStreetlights.length}개`);
  }

  console.log('\n\n수집 완료! 총 고유 부산 가로등 수:', allStreetlights.length);

  if (allStreetlights.length === 0) {
    console.error('❌ 수집된 가로등 데이터가 없습니다.');
    return;
  }

  const targetPath = path.resolve(__dirname, '../src/data/streetlightRealData.json');
  const backupPath = path.resolve(__dirname, '../src/data/streetlightRealData.backup.json');

  if (fs.existsSync(targetPath)) {
    fs.copyFileSync(targetPath, backupPath);
    console.log(`기존 파일 백업 완료: ${backupPath}`);
  }

  fs.writeFileSync(targetPath, JSON.stringify(allStreetlights, null, 2), 'utf-8');
  console.log(`✅ 부산 전체 실제 가로등 저장 완료: ${targetPath}`);
}

run().catch(console.error);

