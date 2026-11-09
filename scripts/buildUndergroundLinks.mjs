// 카카오 로컬 검색으로 부산 지하상가 출구를 모아, 출구들이 늘어선 직선 통로(axis)를 만들어 src/data/undergroundLinks.json에 저장한다.
// 사용: KAKAO_REST_API_KEY=... node scripts/buildUndergroundLinks.mjs   (키는 저장하지 않는다)
// 가정: 한 상가의 출구는 모두 하나의 직선 통로로 이어진다. 통로에서 40m 넘게 벗어난 출구는 뺀다. 실제 통로 모양은 현장 확인 필요.
import fs from 'fs';

const key = process.env.KAKAO_REST_API_KEY;
if (!key) throw new Error('KAKAO_REST_API_KEY 환경변수가 필요함');

const MALLS = ['광복지하쇼핑센터', '국제지하쇼핑센터', '남포지하쇼핑센터', '부산역지하쇼핑센터'];
const MIN_EXITS = 3;
const MAX_OFFSET_M = 40;
const KX = 111320 * Math.cos((35.1 * Math.PI) / 180), KY = 110540;

async function fetchExits(mall) {
  const found = new Map();
  for (const suffix of ['출구', '출입구', '입구']) {
    for (let page = 1; page <= 3; page++) {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?size=15&page=${page}&query=${encodeURIComponent(`${mall} ${suffix}`)}`;
      const j = await (await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) })).json();
      for (const d of j.documents || []) {
        const m = d.place_name.match(/^(.+?)\s*(\d+)번(출구|출입구|입구)/);
        if (m && m[1] === mall && /입출구/.test(d.category_name)) found.set(m[2], { ref: m[2], lat: +d.y, lng: +d.x });
      }
      if (j.meta?.is_end) break;
    }
  }
  return [...found.values()];
}

// 점들을 지나는 최적 직선(주성분)을 구하고, 축에서 MAX_OFFSET_M 넘게 벗어난 점은 한 번 빼고 다시 맞춘다.
function fitAxis(exits) {
  let pts = exits;
  for (let round = 0; round < 2; round++) {
    const xy = pts.map((e) => [(e.lng - 129) * KX, (e.lat - 35) * KY]);
    const cx = xy.reduce((s, p) => s + p[0], 0) / xy.length, cy = xy.reduce((s, p) => s + p[1], 0) / xy.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const [x, y] of xy) { sxx += (x - cx) ** 2; sxy += (x - cx) * (y - cy); syy += (y - cy) ** 2; }
    const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(th), uy = Math.sin(th);
    const along = xy.map(([x, y]) => (x - cx) * ux + (y - cy) * uy);
    const perp = xy.map(([x, y]) => Math.abs(-(x - cx) * uy + (y - cy) * ux));
    const kept = pts.filter((_, i) => perp[i] <= MAX_OFFSET_M);
    if (kept.length === pts.length || kept.length < MIN_EXITS) {
      const toLatLng = (t) => [+(35 + (cy + uy * t) / KY).toFixed(5), +(129 + (cx + ux * t) / KX).toFixed(5)];
      return { axis: [toLatLng(Math.min(...along)), toLatLng(Math.max(...along))], exits: pts, dropped: exits.length - pts.length };
    }
    pts = kept;
  }
}

// 출구 검색이 안 되는 상가: 지하 점포(주소에 "<도로> 지하 N")들의 위치로 통로를 맞추고, 통로 40m 안의 지하철 출입구(OSM)를 출구로 쓴다.
// 가정: 이 출입구들은 통로로 이어져 있다. 점포가 한 점에 몰려 방향을 알 수 없는 곳(서면 중앙몰)과 통로가 짧은 곳(수영 71m)은 뺐다.
const SHOP_CORRIDORS = [
  { name: '서면지하도상가(중앙대로)', x: 129.0585, y: 35.157, radius: 450, road: '중앙대로' },
  { name: '덕천지하상가', x: 129.0058, y: 35.2108, radius: 250, road: '금곡대로' }
];
const SHOP_WORDS = ['의류', '화장품', '안경', '카페', '신발', '액세서리', '음식점', '약국', '휴대폰', '가방', '속옷', '네일', '미용실', '분식', '잡화', '시계', '은행', '편의점', '다이소', '지하상가'];

async function fetchShops({ x, y, radius, road }) {
  const found = new Map();
  for (const w of SHOP_WORDS) {
    for (let page = 1; page <= 3; page++) {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?size=15&page=${page}&x=${x}&y=${y}&radius=${radius}&query=${encodeURIComponent(w)}`;
      const j = await (await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(10000) })).json();
      for (const d of j.documents || []) {
        if (new RegExp(`${road}\\s*지하\\s*\\d`).test(d.road_address_name || '')) found.set(d.id, { lat: +d.y, lng: +d.x });
      }
      if (j.meta?.is_end) break;
    }
  }
  return [...found.values()];
}

// 통로(axis) 선분에서 점까지 거리(m)
function distToAxis([a, b], p) {
  const px = (p.lng - 129) * KX, py = (p.lat - 35) * KY, ax = (a[1] - 129) * KX, ay = (a[0] - 35) * KY, bx = (b[1] - 129) * KX, by = (b[0] - 35) * KY;
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

async function fetchSubwayEntrances(axis) {
  const [s, n] = [Math.min(axis[0][0], axis[1][0]) - 0.0007, Math.max(axis[0][0], axis[1][0]) + 0.0007];
  const [w, e] = [Math.min(axis[0][1], axis[1][1]) - 0.0007, Math.max(axis[0][1], axis[1][1]) + 0.0007];
  const q = `[out:json][timeout:60];node["railway"="subway_entrance"](${s},${w},${n},${e});out;`;
  for (let attempt = 1; attempt <= 4; attempt++) { // 공개 Overpass는 502·504가 잦다
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', // Overpass는 User-Agent가 없으면 406
        headers: { 'User-Agent': 'UrbanShelter-research/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(70000)
      });
      return (await r.json()).elements.map((el) => ({ ref: el.tags.ref, label: el.tags['description:ko'], lat: el.lat, lng: el.lon }));
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((res) => setTimeout(res, 8000));
    }
  }
}

const out = [];
for (const sc of SHOP_CORRIDORS) {
  const shops = await fetchShops(sc);
  if (shops.length < 4) { console.error(`${sc.name}: 점포 ${shops.length}개 → 제외`); continue; }
  const { axis } = fitAxis(shops);
  const near = (await fetchSubwayEntrances(axis)).filter((e) => distToAxis(axis, e) <= MAX_OFFSET_M);
  if (near.length < MIN_EXITS) { console.error(`${sc.name}: 통로 근처 출입구 ${near.length}개 → 제외`); continue; }
  out.push({
    name: sc.name,
    note: '통로는 지하 점포 위치로, 출구는 통로 40m 안의 지하철 출입구(OSM)로 추정한 값. 이어져 있다는 것은 가정이며 현장 확인 필요.',
    axis,
    exits: near.map((e, i) => ({ ref: e.label || e.ref || String(i + 1), lat: e.lat, lng: e.lng }))
  });
  console.error(`${sc.name}: 점포 ${shops.length}개로 통로, 출입구 ${near.length}개 사용`);
}

for (const mall of MALLS) {
  const exits = await fetchExits(mall);
  if (exits.length < MIN_EXITS) { console.error(`${mall}: 출구 ${exits.length}개 → 제외`); continue; }
  const { axis, exits: kept, dropped } = fitAxis(exits);
  out.push({
    name: mall,
    note: '출구 좌표는 카카오 장소 검색, 통로(axis)는 출구들이 늘어선 직선으로 가정한 값. 현장 확인 필요.',
    axis,
    exits: kept.sort((a, b) => +a.ref - +b.ref)
  });
  console.error(`${mall}: 출구 ${kept.length}개 사용${dropped ? ` (통로에서 벗어난 ${dropped}개 제외)` : ''}`);
}
fs.writeFileSync(new URL('../src/data/undergroundLinks.json', import.meta.url), JSON.stringify(out, null, 1));
