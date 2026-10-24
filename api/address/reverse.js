import https from 'https';

const KAKAO_KEY = process.env.VITE_KAKAO_MAP_API_KEY || 'c8d493c6110cd5e37a14a82a89e3690e';

function callKakaoRest(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_KEY}`,
        'KA': 'sdk/1.0.0 os/javascript lang/ko-KR device/pc origin/http://localhost:5173'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'lat and lng required' });
  }

  try {
    // 1. 카카오 공식 좌표계 역지오코딩
    const coordUrl = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${encodeURIComponent(lng)}&y=${encodeURIComponent(lat)}`;
    const coordRes = await callKakaoRest(coordUrl);
    const doc = coordRes?.documents?.[0];

    let roadAddress = doc?.road_address?.address_name || '';
    let buildingName = doc?.road_address?.building_name || '';
    let zoneNo = doc?.road_address?.zone_no || '';
    let jibunAddress = doc?.address?.address_name || '';
    let bCode = doc?.address?.b_code || '';

    // 2. 도로명 주소가 비어있는 경우 지번 주소로 재검색하여 도로명 추출
    if (!roadAddress && jibunAddress) {
      const addrSearchUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(jibunAddress)}`;
      const searchRes = await callKakaoRest(addrSearchUrl);
      const searchDoc = searchRes?.documents?.[0];
      if (searchDoc) {
        roadAddress = searchDoc.road_address?.address_name || roadAddress;
        buildingName = searchDoc.road_address?.building_name || buildingName;
        zoneNo = searchDoc.road_address?.zone_no || zoneNo;
        bCode = searchDoc.address?.b_code || bCode;
      }
    }

    return res.status(200).json({
      success: true,
      roadAddress,
      buildingName,
      zoneNo,
      jibunAddress,
      bCode,
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
