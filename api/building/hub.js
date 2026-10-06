import https from 'https';

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

  for (const [kw, parcel] of Object.entries(LANDMARK_PARCELS)) {
    if (addr.includes(kw)) {
      return parcel;
    }
  }

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

  if (!apiKey) {
    return {
      success: false,
      message: '건축물대장 공공데이터 API 키가 설정되지 않았습니다.',
      data: null
    };
  }

  try {
    const params = new URLSearchParams({
      serviceKey: apiKey,
      sigunguCd,
      bjdongCd,
      platGbCd: '0',
      bun: bun || '0001',
      ji: ji || '0000',
      numOfRows: '10',
      pageNo: '1',
      _type: 'json'
    });

    const apiUrl = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?${params.toString()}`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);

    const json = await resp.json();
    const items = json?.response?.body?.items?.item;

    if (!items || (Array.isArray(items) && items.length === 0)) {
      return { success: false, message: '해당 지번의 건축물대장 표제부 정보가 없습니다.', data: null };
    }

    const item = Array.isArray(items) ? items[0] : items;
    const result = {
      success: true,
      data: {
        bldNm: item.bldNm || '건축물',
        mainPurpsCdNm: item.mainPurpsCdNm || '일반건축물',
        etcPurps: item.etcPurps || '',
        strctCdNm: item.strctCdNm || '철근콘크리트구조',
        grndFlrCnt: item.grndFlrCnt || 1,
        ugrndFlrCnt: item.ugrndFlrCnt || 0,
        heit: item.heit || 0,
        archArea: item.archArea || 0,
        totArea: item.totArea || 0,
        useAprDay: item.useAprDay || '',
        platPlc: item.platPlc || '',
        newPlatPlc: item.newPlatPlc || ''
      }
    };

    buildingCache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { success: false, message: err.message, data: null };
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const address = req.query.address || '';
  let sigunguCd = req.query.sigunguCd;
  let bjdongCd = req.query.bjdongCd;
  let bun = req.query.bun;
  let ji = req.query.ji || '0';

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
    return res.status(200).json({
      success: false,
      message: 'sigunguCd 및 bjdongCd 파라미터 또는 주소가 필요합니다.'
    });
  }

  const apiKey = process.env.VITE_BUILDING_API_KEY || process.env.BUILDING_API_KEY || process.env.VITE_CCTV_API_KEY;
  const buildingData = await fetchBuildingHubBackend({
    sigunguCd,
    bjdongCd,
    bun: bun ? String(bun).padStart(4, '0') : undefined,
    ji: ji !== undefined ? String(ji).padStart(4, '0') : '0000'
  }, apiKey);

  return res.status(200).json(buildingData);
}
