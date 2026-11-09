// 즐겨찾기 및 자주 찾는 위치 (집, 직장, 학교, 커스텀) 로컬 저장소 유틸리티
// 각 사용자의 브라우저(localStorage)에만 안전하게 보관되며 서버로 전송되지 않습니다.

const FAVORITES_STORAGE_KEY = 'urbanshelter.favorites.v1';

export const PRESET_TYPES = [
  { id: 'home', label: '집', icon: 'Home', defaultDesc: '우리 집' },
  { id: 'work', label: '직장', icon: 'Building2', defaultDesc: '회사 · 직장' },
  { id: 'school', label: '학교', icon: 'GraduationCap', defaultDesc: '학교 · 캠퍼스' }
];

export function loadFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return { home: null, work: null, school: null, custom: [] };
    const parsed = JSON.parse(raw);
    return {
      home: parsed?.home || null,
      work: parsed?.work || null,
      school: parsed?.school || null,
      custom: Array.isArray(parsed?.custom) ? parsed.custom : []
    };
  } catch {
    return { home: null, work: null, school: null, custom: [] };
  }
}

export function saveFavorites(favs) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
  } catch {
    // ignore
  }
}

export function setPresetFavorite(type, place) {
  const current = loadFavorites();
  current[type] = {
    name: place.name,
    roadAddress: place.roadAddress || place.name,
    lat: place.lat,
    lng: place.lng,
    updatedAt: Date.now()
  };
  saveFavorites(current);
  return current;
}

export function removePresetFavorite(type) {
  const current = loadFavorites();
  current[type] = null;
  saveFavorites(current);
  return current;
}

export function addCustomFavorite(place) {
  const current = loadFavorites();
  const id = Date.now().toString();
  const newFav = {
    id,
    name: place.name,
    roadAddress: place.roadAddress || place.name,
    lat: place.lat,
    lng: place.lng,
    updatedAt: Date.now()
  };
  current.custom = [newFav, ...current.custom.filter((p) => p.name !== place.name)];
  saveFavorites(current);
  return current;
}

export function removeCustomFavorite(id) {
  const current = loadFavorites();
  current.custom = current.custom.filter((item) => item.id !== id);
  saveFavorites(current);
  return current;
}

