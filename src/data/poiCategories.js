// 지도에 선택해서 볼 수 있는 주변 장소 종류. 지도 타일(OpenFreeMap)의 poi 레이어 class/subclass로 구분한다.

export const POI_CATEGORIES = [
  { id: 'hospital', label: '병원', emoji: '🏥', color: '#ef4444', classes: ['hospital', 'dentist', 'doctors'], match: (c) => c.class === 'hospital' || c.class === 'dentist' || c.class === 'doctors' },
  { id: 'pharmacy', label: '약국', emoji: '💊', color: '#10b981', classes: ['pharmacy'], match: (c) => c.class === 'pharmacy' },
  { id: 'convenience', label: '편의점·마트', emoji: '🏪', color: '#f59e0b', subclasses: ['convenience', 'supermarket'], match: (c) => c.subclass === 'convenience' || c.subclass === 'supermarket' },
  { id: 'toilets', label: '화장실', emoji: '🚻', color: '#0ea5e9', classes: ['toilets'], match: (c) => c.class === 'toilets' },
  { id: 'shelter', label: '쉼터', emoji: '🛖', color: '#a855f7', classes: ['shelter'], match: (c) => c.class === 'shelter' },
  { id: 'police', label: '경찰서', emoji: '👮', color: '#3b82f6', classes: ['police'], match: (c) => c.class === 'police' },
  { id: 'bus', label: '버스', emoji: '🚌', color: '#64748b', classes: ['bus'], match: (c) => c.class === 'bus' },
  { id: 'subway', label: '지하철', emoji: '🚇', color: '#7c3aed', classes: ['railway'], subclasses: ['subway_entrance'], match: (c) => c.subclass === 'subway_entrance' || c.class === 'railway' },
  { id: 'cafe', label: '카페', emoji: '☕', color: '#92400e', classes: ['cafe'], match: (c) => c.class === 'cafe' }
];

export function categorizePoi(props) {
  const c = { class: props.class, subclass: props.subclass };
  const found = POI_CATEGORIES.find((cat) => cat.match(c));
  return found ? found.id : null;
}
