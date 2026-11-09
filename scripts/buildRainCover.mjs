// Overpass 원본(out geom + node)을 앱용 compact JSON으로 변환한다.
// 사용: node scripts/buildRainCover.mjs <overpass.json>
// 원본 쿼리: 부산(area 3602396450) 안의 covered 길, building_passage, 지하 보행로, corridor(way, out geom)와
//           지하철 출입구, 승강장 지붕(node). Overpass는 User-Agent 헤더가 없으면 406을 낸다.
import fs from 'fs';

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const lines = [];
const points = [];

for (const e of raw.elements) {
  if (e.type === 'way' && e.geometry?.length > 1) lines.push(e.geometry.map((g) => [r5(g.lat), r5(g.lon)]));
  // 지점: [위도, 경도, 종류(s=지하철 출입구, b=승강장 지붕), 이름(있으면)]
  else if (e.type === 'node') {
    const t = e.tags || {};
    const subway = t.railway === 'subway_entrance';
    const label = (t['description:ko'] || t.name || '').trim();
    points.push(label ? [r5(e.lat), r5(e.lon), subway ? 's' : 'b', label] : [r5(e.lat), r5(e.lon), subway ? 's' : 'b']);
  }
}

console.assert(lines.length > 0 && points.length > 0, '데이터가 비어 있음');
fs.writeFileSync(new URL('../src/data/busanRainCover.json', import.meta.url), JSON.stringify({ lines, points }));
console.log(`길 ${lines.length}개, 지점 ${points.length}개`);
