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

const out = [];
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
