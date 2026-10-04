// Urban road network data representing Busan Haeundae (부산 해운대역 ~ 구남로 ~ 해운대해수욕장 ~ 전통시장)
// Realistic pedestrian network with Gunam-ro cultural square, Haeundae Traditional Market covered arcade,
// Haeundae station underground concourse, streetlights (15m buffer), CCTV cameras (20m buffer), and residential dead zones.

export const MAP_CENTER = [35.1610, 129.1600]; // Haeundae Gunam-ro center
export const DEFAULT_ZOOM = 16;

// Graph Nodes in Haeundae, Busan with Official Road Name Addresses (도로명주소)
export const NODES = {
  // 1. Haeundae Subway Station & Underground Concourse
  'N_HAE_STATION_3': {
    id: 'N_HAE_STATION_3',
    roadAddress: '부산광역시 해운대구 구남로 1',
    roadName: '구남로 1',
    name: '부산광역시 해운대구 구남로 1 (해운대역 3번출구)',
    lat: 35.1636,
    lng: 129.1586,
    type: 'exit'
  },
  'N_HAE_STATION_5': {
    id: 'N_HAE_STATION_5',
    roadAddress: '부산광역시 해운대구 해운대로 620',
    roadName: '해운대로 620',
    name: '부산광역시 해운대구 해운대로 620 (해운대역 5번출구)',
    lat: 35.1638,
    lng: 129.1577,
    type: 'exit'
  },
  'N_HAE_STATION_1': {
    id: 'N_HAE_STATION_1',
    roadAddress: '부산광역시 해운대구 해운대로 626',
    roadName: '해운대로 626',
    name: '부산광역시 해운대구 해운대로 626 (해운대역 1번출구)',
    lat: 35.1639,
    lng: 129.1601,
    type: 'exit'
  },
  'N_HAE_UND_CENTER': {
    id: 'N_HAE_UND_CENTER',
    roadAddress: '부산광역시 해운대구 해운대로 지하 620',
    roadName: '해운대로 지하 620',
    name: '부산광역시 해운대구 해운대로 지하 620 (해운대역 지하연결상가)',
    lat: 35.1635,
    lng: 129.1588,
    type: 'underground'
  },
  'N_HAE_UND_EAST': {
    id: 'N_HAE_UND_EAST',
    roadAddress: '부산광역시 해운대구 해운대로 지하 626',
    roadName: '해운대로 지하 626',
    name: '부산광역시 해운대구 해운대로 지하 626 (지하동측 아케이드)',
    lat: 35.1633,
    lng: 129.1608,
    type: 'underground'
  },

  // 2. Gunam-ro Pedestrian Cultural Avenue
  'N_GUNAM_TOP': {
    id: 'N_GUNAM_TOP',
    roadAddress: '부산광역시 해운대구 구남로 9',
    roadName: '구남로 9',
    name: '부산광역시 해운대구 구남로 9 (구남로 상단 입구)',
    lat: 35.1630,
    lng: 129.1589,
    type: 'junction'
  },
  'N_GUNAM_MID_1': {
    id: 'N_GUNAM_MID_1',
    roadAddress: '부산광역시 해운대구 구남로 24',
    roadName: '구남로 24',
    name: '부산광역시 해운대구 구남로 24 (구남로 중앙 분수광장)',
    lat: 35.1618,
    lng: 129.1593,
    type: 'junction'
  },
  'N_GUNAM_MID_2': {
    id: 'N_GUNAM_MID_2',
    roadAddress: '부산광역시 해운대구 구남로 36',
    roadName: '구남로 36',
    name: '부산광역시 해운대구 구남로 36 (구남로 미디어월 광장)',
    lat: 35.1605,
    lng: 129.1598,
    type: 'junction'
  },
  'N_GUNAM_BEACH': {
    id: 'N_GUNAM_BEACH',
    roadAddress: '부산광역시 해운대구 구남로 48',
    roadName: '구남로 48',
    name: '부산광역시 해운대구 구남로 48 (구남로 남단 교차로)',
    lat: 35.1593,
    lng: 129.1602,
    type: 'junction'
  },
  'N_BEACH_EVENT': {
    id: 'N_BEACH_EVENT',
    roadAddress: '부산광역시 해운대구 해운대해변로 264',
    roadName: '해운대해변로 264',
    name: '부산광역시 해운대구 해운대해변로 264 (해수욕장 이벤트광장)',
    lat: 35.1584,
    lng: 129.1605,
    type: 'junction'
  },

  // 3. Haeundae Traditional Market (Covered Arcade)
  'N_MARKET_NORTH': {
    id: 'N_MARKET_NORTH',
    roadAddress: '부산광역시 해운대구 구남로41번길 2',
    roadName: '구남로41번길 2',
    name: '부산광역시 해운대구 구남로41번길 2 (전통시장 북측 아케이드 입구)',
    lat: 35.1623,
    lng: 129.1618,
    type: 'arcade'
  },
  'N_MARKET_MID': {
    id: 'N_MARKET_MID',
    roadAddress: '부산광역시 해운대구 구남로41번길 22',
    roadName: '구남로41번길 22',
    name: '부산광역시 해운대구 구남로41번길 22 (전통시장 비가림 아케이드 중앙)',
    lat: 35.1608,
    lng: 129.1613,
    type: 'arcade'
  },
  'N_MARKET_SOUTH': {
    id: 'N_MARKET_SOUTH',
    roadAddress: '부산광역시 해운대구 중동1로 38',
    roadName: '중동1로 38',
    name: '부산광역시 해운대구 중동1로 38 (전통시장 남측 아케이드 출구)',
    lat: 35.1595,
    lng: 129.1609,
    type: 'arcade'
  },
  'N_MARKET_ALLEY_E': {
    id: 'N_MARKET_ALLEY_E',
    roadAddress: '부산광역시 해운대구 중동1로 42',
    roadName: '중동1로 42',
    name: '부산광역시 해운대구 중동1로 42 (시장 동편 보행로)',
    lat: 35.1606,
    lng: 129.1624,
    type: 'alley'
  },

  // 4. West Side Alleys (우동 주택가 / 모텔 밀집 골목)
  'N_UDONG_DARK_1': {
    id: 'N_UDONG_DARK_1',
    roadAddress: '부산광역시 해운대구 구남로12번길 18',
    roadName: '구남로12번길 18',
    name: '부산광역시 해운대구 구남로12번길 18 (우동 북측 골목)',
    lat: 35.1631,
    lng: 129.1570,
    type: 'alley'
  },
  'N_UDONG_DARK_2': {
    id: 'N_UDONG_DARK_2',
    roadAddress: '부산광역시 해운대구 구남로12번길 34',
    roadName: '구남로12번길 34',
    name: '부산광역시 해운대구 구남로12번길 34 (조명 사각 골목)',
    lat: 35.1617,
    lng: 129.1568,
    type: 'alley'
  },
  'N_UDONG_DARK_3': {
    id: 'N_UDONG_DARK_3',
    roadAddress: '부산광역시 해운대구 구남로12번길 52',
    roadName: '구남로12번길 52',
    name: '부산광역시 해운대구 구남로12번길 52 (모텔촌 후면로)',
    lat: 35.1602,
    lng: 129.1573,
    type: 'alley'
  },
  'N_UDONG_SOUTH': {
    id: 'N_UDONG_SOUTH',
    roadAddress: '부산광역시 해운대구 해운대해변로 237',
    roadName: '해운대해변로 237',
    name: '부산광역시 해운대구 해운대해변로 237 (해변로 서측 입구)',
    lat: 35.1590,
    lng: 129.1581,
    type: 'junction'
  },

  // 5. East Side Alleys & Haeundae District Office
  'N_HOTSPRING_1': {
    id: 'N_HOTSPRING_1',
    roadAddress: '부산광역시 해운대구 온천길 15',
    roadName: '온천길 15',
    name: '부산광역시 해운대구 온천길 15 (온천길 사거리)',
    lat: 35.1632,
    lng: 129.1630,
    type: 'junction'
  },
  'N_SAFE_WAY_MID': {
    id: 'N_SAFE_WAY_MID',
    roadAddress: '부산광역시 해운대구 중동1로 17번길 10',
    roadName: '중동1로 17번길 10',
    name: '부산광역시 해운대구 중동1로 17번길 10 (안심귀갓길 안전폴 앞)',
    lat: 35.1616,
    lng: 129.1635,
    type: 'safe_alley'
  },
  'N_DISTRICT_OFFICE': {
    id: 'N_DISTRICT_OFFICE',
    roadAddress: '부산광역시 해운대구 중동2로 11',
    roadName: '중동2로 11',
    name: '부산광역시 해운대구 중동2로 11 (해운대구청 정문 앞)',
    lat: 35.1600,
    lng: 129.1638,
    type: 'junction'
  },
  'N_BEACH_HOTEL': {
    id: 'N_BEACH_HOTEL',
    roadAddress: '부산광역시 해운대구 해운대해변로 296',
    roadName: '해운대해변로 296',
    name: '부산광역시 해운대구 해운대해변로 296 (파라다이스 호텔 앞)',
    lat: 35.1587,
    lng: 129.1632,
    type: 'junction'
  }
};

// Streetlights in Haeundae (15m radius illumination buffer)
export const STREETLIGHTS = [
  // Gunam-ro Avenue (Extremely bright smart LED pedestrian lights)
  { id: 'SL_G01', lat: 35.1630, lng: 129.1589, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G02', lat: 35.1625, lng: 129.1591, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G03', lat: 35.1620, lng: 129.1592, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G04', lat: 35.1615, lng: 129.1594, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G05', lat: 35.1610, lng: 129.1596, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G06', lat: 35.1605, lng: 129.1598, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G07', lat: 35.1600, lng: 129.1600, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G08', lat: 35.1594, lng: 129.1602, type: 'smart_led', lumens: 9000, radius: 15 },
  { id: 'SL_G09', lat: 35.1586, lng: 129.1604, type: 'smart_led', lumens: 9000, radius: 15 },

  // Haeundae Beach Promenade
  { id: 'SL_B01', lat: 35.1589, lng: 129.1585, type: 'coastal_led', lumens: 7000, radius: 15 },
  { id: 'SL_B02', lat: 35.1585, lng: 129.1618, type: 'coastal_led', lumens: 7000, radius: 15 },
  { id: 'SL_B03', lat: 35.1587, lng: 129.1631, type: 'coastal_led', lumens: 7000, radius: 15 },

  // Haeundae District Office & Safe Way
  { id: 'SL_E01', lat: 35.1631, lng: 129.1629, type: 'standard', lumens: 5500, radius: 15 },
  { id: 'SL_E02', lat: 35.1622, lng: 129.1632, type: 'security', lumens: 6000, radius: 15 },
  { id: 'SL_E03', lat: 35.1615, lng: 129.1635, type: 'smart_security', lumens: 7000, radius: 15 },
  { id: 'SL_E04', lat: 35.1607, lng: 129.1637, type: 'standard', lumens: 5500, radius: 15 },
  { id: 'SL_E05', lat: 35.1600, lng: 129.1638, type: 'standard', lumens: 5500, radius: 15 },

  // Traditional Market Entrance
  { id: 'SL_M01', lat: 35.1623, lng: 129.1617, type: 'standard', lumens: 5000, radius: 15 },
  { id: 'SL_M02', lat: 35.1595, lng: 129.1609, type: 'standard', lumens: 5000, radius: 15 }

  // Note: N_UDONG_DARK_1, DARK_2, DARK_3 have NO municipal lighting (Dead Zone!)
];

import realCctvs from './cctvRealData.json';

// Real Security CCTVs in Haeundae (행정안전부_CCTV정보 조회서비스 - 79개소 연동)
export const CCTVS = realCctvs;

// Pedestrian Road Network Edges in Haeundae
export const EDGES = [
  // 1. Haeundae Station Underground Concourse (100% covered, lit, CCTV protected)
  {
    id: 'E_HAE_UND_1',
    u: 'N_HAE_UND_CENTER',
    v: 'N_HAE_STATION_3',
    name: '해운대역 3번 출구 지하 에스컬레이터 연결통로',
    length: 50,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'underground_passage'
  },
  {
    id: 'E_HAE_UND_2',
    u: 'N_HAE_UND_CENTER',
    v: 'N_HAE_STATION_5',
    name: '해운대역 5번 출구 지하 연결통로',
    length: 75,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 1,
    streetType: 'underground_passage'
  },
  {
    id: 'E_HAE_UND_3',
    u: 'N_HAE_UND_CENTER',
    v: 'N_HAE_UND_EAST',
    name: '해운대역 지하상가 동측 비가림 보행통로',
    length: 170,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 3,
    streetType: 'underground_mall'
  },
  {
    id: 'E_HAE_UND_4',
    u: 'N_HAE_UND_EAST',
    v: 'N_MARKET_NORTH',
    name: '지하상가 동측 출구 ~ 전통시장 북단 캐노피 연결로',
    length: 110,
    covered: true,
    shelterType: 'canopy',
    layer: 0,
    litLengthRatio: 0.95,
    deadZoneLength: 5,
    cctvCount: 1,
    streetType: 'covered_walkway'
  },

  // 2. Haeundae Traditional Market Covered Arcade (비가림 지붕 아케이드 구간!)
  {
    id: 'E_MARKET_1',
    u: 'N_MARKET_NORTH',
    v: 'N_MARKET_MID',
    name: '해운대 전통시장 비가림 아케이드 (북측 구간)',
    length: 180,
    covered: true,
    shelterType: 'covered_arcade',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'arcade'
  },
  {
    id: 'E_MARKET_2',
    u: 'N_MARKET_MID',
    v: 'N_MARKET_SOUTH',
    name: '해운대 전통시장 비가림 아케이드 (남측 구간)',
    length: 155,
    covered: true,
    shelterType: 'covered_arcade',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'arcade'
  },
  {
    id: 'E_MARKET_CONN_1',
    u: 'N_GUNAM_MID_2',
    v: 'N_MARKET_MID',
    name: '구남로 ~ 전통시장 중앙 횡단 연결통로',
    length: 110,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.85,
    deadZoneLength: 16,
    cctvCount: 1,
    streetType: 'safe_alley'
  },
  {
    id: 'E_MARKET_CONN_2',
    u: 'N_GUNAM_BEACH',
    v: 'N_MARKET_SOUTH',
    name: '구남로 남단 ~ 시장 남측 입구 연결보도',
    length: 80,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.90,
    deadZoneLength: 8,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_MARKET_CONN_3',
    u: 'N_GUNAM_TOP',
    v: 'N_MARKET_NORTH',
    name: '해운대역 광장 ~ 전통시장 북측 진입로',
    length: 220,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.80,
    deadZoneLength: 44,
    cctvCount: 1,
    streetType: 'main_street'
  },

  // 3. Gunam-ro Pedestrian Cultural Avenue (Exposed to rain, but 100% lit & full CCTV)
  {
    id: 'E_GUNAM_1',
    u: 'N_HAE_STATION_3',
    v: 'N_GUNAM_TOP',
    name: '해운대역 3번출구 앞 광장 진입로',
    length: 65,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_GUNAM_2',
    u: 'N_GUNAM_TOP',
    v: 'N_GUNAM_MID_1',
    name: '구남로 문화광장 보행전용거리 (북부)',
    length: 140,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_GUNAM_3',
    u: 'N_GUNAM_MID_1',
    v: 'N_GUNAM_MID_2',
    name: '구남로 문화광장 보행전용거리 (중부)',
    length: 150,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 3,
    streetType: 'main_street'
  },
  {
    id: 'E_GUNAM_4',
    u: 'N_GUNAM_MID_2',
    v: 'N_GUNAM_BEACH',
    name: '구남로 문화광장 보행전용거리 (남부)',
    length: 135,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_GUNAM_5',
    u: 'N_GUNAM_BEACH',
    v: 'N_BEACH_EVENT',
    name: '해운대해변로 횡단 및 이벤트광장 진입로',
    length: 95,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'main_street'
  },

  // 4. West Side Dangerous Dead Zone Alleys (우동 원룸·모텔촌 암흑 사각지대)
  {
    id: 'E_DARK_WEST_1',
    u: 'N_HAE_STATION_5',
    v: 'N_UDONG_DARK_1',
    name: '우동 원룸 밀집 북측 좁은 골목길',
    length: 130,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.25,
    deadZoneLength: 98,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_DARK_WEST_2',
    u: 'N_UDONG_DARK_1',
    v: 'N_UDONG_DARK_2',
    name: '보안등 전무 막다른 암흑 사각골목',
    length: 160,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.10,
    deadZoneLength: 144,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_DARK_WEST_3',
    u: 'N_UDONG_DARK_2',
    v: 'N_UDONG_DARK_3',
    name: '모텔촌 후면 야간 취약 보행로',
    length: 175,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.15,
    deadZoneLength: 148,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_DARK_WEST_4',
    u: 'N_UDONG_DARK_3',
    v: 'N_UDONG_SOUTH',
    name: '해안도로 진출 사잇길',
    length: 150,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.40,
    deadZoneLength: 90,
    cctvCount: 0,
    streetType: 'alley'
  },
  {
    id: 'E_DARK_WEST_CONN',
    u: 'N_UDONG_SOUTH',
    v: 'N_BEACH_EVENT',
    name: '해운대해변로 서측 보도 (이벤트광장 방면)',
    length: 220,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.88,
    deadZoneLength: 26,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_DARK_WEST_MIDCONN',
    u: 'N_UDONG_DARK_2',
    v: 'N_GUNAM_MID_1',
    name: '우동 골목 ~ 구남로 분수광장 연결 사잇길',
    length: 170,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.50,
    deadZoneLength: 85,
    cctvCount: 0,
    streetType: 'alley'
  },

  // 5. East Side Safe Alleys & Haeundae District Office (중동 온천길 & 안심귀갓길)
  {
    id: 'E_EAST_SAFE_1',
    u: 'N_HAE_STATION_1',
    v: 'N_HOTSPRING_1',
    name: '해운대역 1번출구 ~ 온천길 상단 보도',
    length: 190,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.85,
    deadZoneLength: 28,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_EAST_SAFE_2',
    u: 'N_HOTSPRING_1',
    v: 'N_SAFE_WAY_MID',
    name: '해운대 여성안심귀갓길 스마트 안전 보행로',
    length: 180,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.95,
    deadZoneLength: 9,
    cctvCount: 2,
    streetType: 'safe_alley'
  },
  {
    id: 'E_EAST_SAFE_3',
    u: 'N_SAFE_WAY_MID',
    v: 'N_DISTRICT_OFFICE',
    name: '해운대구청 앞 안전 보행로',
    length: 175,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.90,
    deadZoneLength: 17,
    cctvCount: 2,
    streetType: 'safe_alley'
  },
  {
    id: 'E_EAST_SAFE_4',
    u: 'N_DISTRICT_OFFICE',
    v: 'N_BEACH_HOTEL',
    name: '구청 앞 ~ 파라다이스 호텔 방면 연결로',
    length: 160,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.85,
    deadZoneLength: 24,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_EAST_BEACH_CONN',
    u: 'N_BEACH_HOTEL',
    v: 'N_BEACH_EVENT',
    name: '해운대 해안 산책로 (파라다이스호텔~이벤트광장)',
    length: 240,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.90,
    deadZoneLength: 24,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_EAST_MARKET_CONN',
    u: 'N_MARKET_SOUTH',
    v: 'N_DISTRICT_OFFICE',
    name: '전통시장 남측 ~ 해운대구청 연결로',
    length: 210,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.80,
    deadZoneLength: 42,
    cctvCount: 1,
    streetType: 'safe_alley'
  }
];

// Preset Scenarios centered on Busan Haeundae
export const PRESET_SCENARIOS = [
  {
    id: 'scenario_1',
    title: '구남로 1 (해운대역) → 해운대해변로 264 (해수욕장)',
    desc: '구남로12번길 암흑 사각골목(Dead Zone 400m) vs 구남로 스마트 LED & CCTV 79개소 집중 안심 보행로',
    startNode: 'N_HAE_STATION_3',
    endNode: 'N_BEACH_EVENT'
  },
  {
    id: 'scenario_2',
    title: '해운대로 지하 620 (해운대역) → 중동1로 38 (전통시장 남측)',
    desc: '비에 노출되는 야외 보행로 vs 지하상가 + 구남로41번길 해운대 전통시장 비가림 아케이드(100% 비 차단) 쉴드 경로',
    startNode: 'N_HAE_UND_CENTER',
    endNode: 'N_MARKET_SOUTH'
  },
  {
    id: 'scenario_3',
    title: '구남로12번길 18 (우동) → 중동2로 11 (해운대구청)',
    desc: '조명 없는 사각 골목길 vs 구남로 및 중동1로 17번길 여성안심귀갓길 스마트 안전부스 경유 안심 우회로',
    startNode: 'N_UDONG_DARK_1',
    endNode: 'N_DISTRICT_OFFICE'
  }
];
