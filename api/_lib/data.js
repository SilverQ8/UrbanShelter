import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function loadJsonFile(relPathFromDataDir) {
  const candidates = [
    fileURLToPath(new URL(`../../src/data/${relPathFromDataDir}`, import.meta.url)),
    path.join(process.cwd(), 'src', 'data', relPathFromDataDir)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {
      // try next candidate
    }
  }
  return [];
}

const nationwideCctvCache = loadJsonFile('cctvRealData.json');
const nationwideStreetlightCache = loadJsonFile('streetlightRealData.json');
const koreaDistricts = loadJsonFile('koreaDistricts.json');

export function getCctvCache() {
  return nationwideCctvCache;
}

export function getStreetlightCache() {
  return nationwideStreetlightCache;
}

export function resolveNearestDistrict(lat, lng) {
  if (!koreaDistricts || koreaDistricts.length === 0) return null;
  let minD = Infinity, best = null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (const d of koreaDistricts) {
    const dLat = d.lat - lat;
    const dLng = (d.lng - lng) * cosLat;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minD) {
      minD = distSq;
      best = d;
    }
  }
  return best;
}
