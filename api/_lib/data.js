import fs from 'fs';
import { fileURLToPath } from 'url';

let nationwideCctvCache = [];
try {
  const jsonPath = fileURLToPath(new URL('../../src/data/cctvRealData.json', import.meta.url));
  if (fs.existsSync(jsonPath)) {
    nationwideCctvCache = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  }
} catch {
  nationwideCctvCache = [];
}

let nationwideStreetlightCache = [];
try {
  const slJsonPath = fileURLToPath(new URL('../../src/data/streetlightRealData.json', import.meta.url));
  if (fs.existsSync(slJsonPath)) {
    nationwideStreetlightCache = JSON.parse(fs.readFileSync(slJsonPath, 'utf-8'));
  }
} catch {
  nationwideStreetlightCache = [];
}

let koreaDistricts = [];
try {
  const dPath = fileURLToPath(new URL('../../src/data/koreaDistricts.json', import.meta.url));
  if (fs.existsSync(dPath)) {
    koreaDistricts = JSON.parse(fs.readFileSync(dPath, 'utf8'));
  }
} catch {
  koreaDistricts = [];
}

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
