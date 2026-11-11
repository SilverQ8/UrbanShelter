import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function distM(lat1, lng1, lat2, lng2) {
  const dLat = (lat1 - lat2) * 111000;
  const dLng = (lng1 - lng2) * 88000;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 1. Streetlights Deduplication (Spatial hash grid with 6m threshold)
const slPath = path.resolve(__dirname, '../src/data/streetlightRealData.json');
if (fs.existsSync(slPath)) {
  const lights = JSON.parse(fs.readFileSync(slPath, 'utf8'));
  console.log(`[Streetlights] 원본 데이터 수: ${lights.length}`);

  const cellSize = 0.0001; // ~11m lat, ~8.8m lng
  const grid = new Map();
  const cleanedLights = [];

  for (const light of lights) {
    const cx = Math.floor(light.lat / cellSize);
    const cy = Math.floor(light.lng / cellSize);
    let duplicate = false;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = grid.get(`${cx + dx}_${cy + dy}`);
        if (cell) {
          for (const existing of cell) {
            if (distM(light.lat, light.lng, existing.lat, existing.lng) < 6) {
              duplicate = true;
              // 더 구체적인 도로명/관리번호가 있는 것을 유지
              if (light.manager && !light.manager.includes('도로관리청') && existing.manager?.includes('도로관리청')) {
                existing.name = light.name;
                existing.address = light.address;
                existing.manager = light.manager;
              }
              break;
            }
          }
        }
        if (duplicate) break;
      }
      if (duplicate) break;
    }

    if (!duplicate) {
      cleanedLights.push(light);
      const key = `${cx}_${cy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(light);
    }
  }

  console.log(`[Streetlights] 6m 이내 동일 기둥/중복 제거: ${lights.length - cleanedLights.length}개`);
  console.log(`[Streetlights] 최종 정제 완료 수: ${cleanedLights.length}개`);

  fs.writeFileSync(slPath, JSON.stringify(cleanedLights, null, 2), 'utf8');
}

// 2. CCTV Deduplication (5m threshold)
const cctvPath = path.resolve(__dirname, '../src/data/cctvRealData.json');
if (fs.existsSync(cctvPath)) {
  const cctvs = JSON.parse(fs.readFileSync(cctvPath, 'utf8'));
  console.log(`\n[CCTV] 원본 데이터 수: ${cctvs.length}`);

  const cleanedCctvs = [];
  for (const c of cctvs) {
    const dup = cleanedCctvs.find(existing => distM(c.lat, c.lng, existing.lat, existing.lng) < 5);
    if (!dup) {
      cleanedCctvs.push(c);
    } else {
      // 카메라 수 집계 보존
      dup.cameraCount = (dup.cameraCount || 1) + 1;
    }
  }

  console.log(`[CCTV] 5m 이내 동일 폴대 다방향 카메라 통합: ${cctvs.length - cleanedCctvs.length}개`);
  console.log(`[CCTV] 최종 정제 완료 수: ${cleanedCctvs.length}개`);

  fs.writeFileSync(cctvPath, JSON.stringify(cleanedCctvs, null, 2), 'utf8');
}

