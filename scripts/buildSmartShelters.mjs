// 부산광역시_스마트 버스쉘터 설치 현황(공공데이터포털 15154539, CSV·CP949)을 앱용 JSON으로 변환한다.
// 사용: node scripts/buildSmartShelters.mjs "<스마트 버스쉘터 설치 현황.csv>"
import fs from 'fs';

const text = new TextDecoder('euc-kr').decode(fs.readFileSync(process.argv[2])).replace(/^﻿/, '');

// 따옴표 안의 쉼표를 지키는 최소 CSV 파서
const rows = [];
let cell = '', row = [], quoted = false;
for (const ch of text) {
  if (ch === '"') quoted = !quoted;
  else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
  else if ((ch === '\n' || ch === '\r') && !quoted) { if (cell || row.length) { row.push(cell); rows.push(row); } row = []; cell = ''; }
  else cell += ch;
}
if (cell || row.length) { row.push(cell); rows.push(row); }

const head = rows[0].map((s) => s.trim());
const col = (name) => head.indexOf(name);
const shelters = rows.slice(1)
  .filter((r) => +r[col('x좌표')] > 0 && +r[col('y좌표')] > 0)
  .map((r) => ({
    name: r[col('정류소명')].replace(/\s+/g, ' ').trim(),
    place: r[col('위치')].trim(),
    facilities: r[col('부대시설')].replace(/\s+/g, ' ').trim(),
    lat: +(+r[col('y좌표')]).toFixed(6),
    lng: +(+r[col('x좌표')]).toFixed(6)
  }));

console.assert(shelters.length > 0, '변환 결과가 비어 있음');
fs.writeFileSync(new URL('../src/data/smartBusShelters.json', import.meta.url), JSON.stringify(shelters));
console.log(`스마트 버스쉘터 ${shelters.length}곳`);
