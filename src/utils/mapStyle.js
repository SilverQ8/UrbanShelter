// 2D·3D 지도가 함께 쓰는 지도 스타일(OpenFreeMap) 준비와 보행자용 조정.
// 병원·편의점 같은 장소 아이콘은 지도 스타일이 이미 갖고 있는 것을 그대로 쓰고, 어떤 종류를 보여줄지만 고른다.
import { POI_CATEGORIES } from '../data/poiCategories';

const STYLE_URLS = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark: 'https://tiles.openfreemap.org/styles/dark'
};

const POI_LAYER_IDS = ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit'];
const CAR_POI_CLASSES = ['parking', 'fuel', 'car_repair', 'car_wash', 'car'];

const styleCache = {};

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`style HTTP ${resp.status}`);
  return resp.json();
}

async function buildStyle(theme) {
  if (theme !== 'dark') return fetchJson(STYLE_URLS.light);

  // 어두운 스타일에는 장소 아이콘 레이어가 없어서, 같은 데이터·같은 아이콘 묶음을 쓰는
  // 밝은 스타일의 장소 레이어를 가져와 붙인다(그래서 테마와 상관없이 같은 아이콘이 나온다).
  const [dark, light] = await Promise.all([fetchJson(STYLE_URLS.dark), fetchJson(STYLE_URLS.light)]);
  const poiLayers = light.layers
    .filter((l) => POI_LAYER_IDS.includes(l.id))
    .map((l) => {
      const copy = JSON.parse(JSON.stringify(l));
      if (copy.layout && copy.layout['text-field']) {
        copy.paint = { ...copy.paint, 'text-color': '#e5e7eb', 'text-halo-color': '#0f172a' };
      }
      return copy;
    });
  dark.sprite = light.sprite;
  const at = dark.layers.findIndex((l) => l.id === 'highway_name_other');
  dark.layers.splice(at >= 0 ? at : dark.layers.length, 0, ...poiLayers);
  return dark;
}

export function loadMapStyle(theme) {
  const key = theme === 'dark' ? 'dark' : 'light';
  if (!styleCache[key]) {
    styleCache[key] = buildStyle(key).catch((err) => {
      delete styleCache[key];
      throw err;
    });
  }
  return styleCache[key].then((s) => JSON.parse(JSON.stringify(s)));
}

// 스타일이 로드될 때마다 호출: 보행자 중심으로 지도를 조정하고, 장소 필터의 기준값을 저장한다.
export function applyPedestrianTweaks(map, theme) {
  // 차량용 요소(도로 번호 표지, 일방통행 화살표, 공항 활주로)를 숨긴다
  [
    'highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us',
    'road_oneway', 'road_oneway_opposite',
    'aeroway_fill', 'aeroway_runway', 'aeroway_taxiway',
    'aeroway-taxiway', 'aeroway-runway-casing', 'aeroway-area', 'aeroway-runway'
  ].forEach((id) => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  });

  // 보행로는 점선 대신 얇은 실선으로
  const pathColor = theme === 'dark' ? '#64748b' : '#c7bfae';
  ['road_path_pedestrian', 'bridge_path_pedestrian', 'tunnel_path_pedestrian', 'highway_path'].forEach((id) => {
    if (!map.getLayer(id)) return;
    map.setPaintProperty(id, 'line-dasharray', [1, 0]);
    map.setPaintProperty(id, 'line-color', pathColor);
    map.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 3]);
  });

  // 주차장·주유소 같은 차량용 장소는 뺀다. 이 값이 장소 필터의 기준이 된다.
  const carFilter = ['!', ['match', ['get', 'class'], CAR_POI_CLASSES, true, false]];
  map.__poiBaseFilters = {};
  POI_LAYER_IDS.forEach((id) => {
    if (!map.getLayer(id)) return;
    const base = ['all', map.getFilter(id), carFilter].filter(Boolean);
    map.__poiBaseFilters[id] = base;
    map.setFilter(id, base);
  });
}

/**
 * 고른 종류의 장소 아이콘만 보여준다. 아무것도 고르지 않으면 지도의 기본 아이콘을 모두 보여준다.
 * @param {Record<string, boolean>} selected 종류 id → 선택 여부
 */
export function applyPoiFilter(map, selected) {
  if (!map || !map.__poiBaseFilters) return;
  const chosen = POI_CATEGORIES.filter((c) => selected && selected[c.id]);
  const classes = [...new Set(chosen.flatMap((c) => c.classes || []))];
  const subclasses = [...new Set(chosen.flatMap((c) => c.subclasses || []))];

  const categoryFilter = [
    'any',
    ['in', ['get', 'class'], ['literal', classes]],
    ['in', ['get', 'subclass'], ['literal', subclasses]]
  ];

  POI_LAYER_IDS.forEach((id) => {
    const base = map.__poiBaseFilters[id];
    if (!base || !map.getLayer(id)) return;
    map.setFilter(id, chosen.length > 0 ? ['all', base, categoryFilter] : base);
    // 고른 종류의 아이콘은 조금 더 크게 보여준다
    const size = map.getLayoutProperty(id, 'icon-size');
    if (typeof size === 'number' || size === undefined) {
      map.setLayoutProperty(id, 'icon-size', chosen.length > 0 ? 1.3 : 1);
    }
  });
}
