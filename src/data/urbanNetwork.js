// Urban road network data representing a dense urban district (Gangnam Station & Teheran-ro Area)
// Coordinates centered around 37.4980, 127.0280 with realistic pedestrian alleys, main boulevards,
// underground shopping mall arcade passages, streetlights (15m buffer), and CCTV cameras (20m buffer).

export const MAP_CENTER = [37.4981, 127.0278];
export const DEFAULT_ZOOM = 17;

// Nodes representing pedestrian intersections, station exits, alley junctions
export const NODES = {
  // Main Boulevard Intersections & Exits
  'N_STATION_EXT_1': { id: 'N_STATION_EXT_1', name: '강남역 11번 출구', lat: 37.4989, lng: 127.0279, type: 'exit' },
  'N_STATION_EXT_2': { id: 'N_STATION_EXT_2', name: '강남역 12번 출구', lat: 37.4990, lng: 127.0288, type: 'exit' },
  'N_STATION_UND_1': { id: 'N_STATION_UND_1', name: '지하도 중앙광장', lat: 37.4981, lng: 127.0278, type: 'underground' },
  'N_STATION_UND_2': { id: 'N_STATION_UND_2', name: '지하상가 동측통로', lat: 37.4982, lng: 127.0292, type: 'underground' },
  'N_STATION_UND_3': { id: 'N_STATION_UND_3', name: '지하도 서측통로', lat: 37.4975, lng: 127.0268, type: 'underground' },
  'N_STATION_EXT_3': { id: 'N_STATION_EXT_3', name: '강남역 1번 출구', lat: 37.4972, lng: 127.0289, type: 'exit' },
  'N_STATION_EXT_4': { id: 'N_STATION_EXT_4', name: '강남역 2번 출구', lat: 37.4968, lng: 127.0280, type: 'exit' },
  
  // Gangnam-daero Main Avenue (High lighting, multiple CCTVs)
  'N_MAIN_1': { id: 'N_MAIN_1', name: '강남대로 CGV 앞', lat: 37.5015, lng: 127.0262, type: 'junction' },
  'N_MAIN_2': { id: 'N_MAIN_2', name: '강남대로 신논현 방면', lat: 37.5002, lng: 127.0269, type: 'junction' },
  'N_MAIN_3': { id: 'N_MAIN_3', name: '강남역 사거리 북서', lat: 37.4988, lng: 127.0272, type: 'junction' },
  'N_MAIN_4': { id: 'N_MAIN_4', name: '강남역 사거리 남서', lat: 37.4971, lng: 127.0273, type: 'junction' },
  'N_MAIN_5': { id: 'N_MAIN_5', name: '강남대로 남단 입구', lat: 37.4955, lng: 127.0278, type: 'junction' },

  // Teheran-ro Boulevard East-West (Wide, well-lit, covered building passages)
  'N_TEHERAN_1': { id: 'N_TEHERAN_1', name: '테헤란로 국기원입구 삼거리', lat: 37.4996, lng: 127.0315, type: 'junction' },
  'N_TEHERAN_2': { id: 'N_TEHERAN_2', name: '테헤란로 역삼방면 사거리', lat: 37.5002, lng: 127.0335, type: 'junction' },
  'N_TEHERAN_ARCADE_W': { id: 'N_TEHERAN_ARCADE_W', name: '테헤란 아케이드 빌딩 서문', lat: 37.4988, lng: 127.0305, type: 'building' },
  'N_TEHERAN_ARCADE_E': { id: 'N_TEHERAN_ARCADE_E', name: '테헤란 아케이드 빌딩 동문', lat: 37.4990, lng: 127.0322, type: 'building' },

  // Back Alleys & Food Street (Mix of dark dead zones & residential alleys)
  'N_ALLEY_N1': { id: 'N_ALLEY_N1', name: '봉은사로 먹자골목 북측', lat: 37.5020, lng: 127.0282, type: 'alley' },
  'N_ALLEY_N2': { id: 'N_ALLEY_N2', name: '카페거리 갈림길 A', lat: 37.5012, lng: 127.0290, type: 'alley' },
  'N_ALLEY_N3': { id: 'N_ALLEY_N3', name: '원룸 밀집 암흑골목 1', lat: 37.5022, lng: 127.0305, type: 'alley' },
  'N_ALLEY_M1': { id: 'N_ALLEY_M1', name: '먹자골목 중앙 사거리', lat: 37.5005, lng: 127.0283, type: 'alley' },
  'N_ALLEY_M2': { id: 'N_ALLEY_M2', name: '역삼동 먹자골목 동편', lat: 37.5008, lng: 127.0302, type: 'alley' },
  'N_ALLEY_M3': { id: 'N_ALLEY_M3', name: '이면도로 주택가 골목길', lat: 37.5010, lng: 127.0320, type: 'alley' },
  'N_ALLEY_DARK_1': { id: 'N_ALLEY_DARK_1', name: '어두운 구릉지 보행로', lat: 37.5025, lng: 127.0325, type: 'alley' },
  'N_ALLEY_DARK_2': { id: 'N_ALLEY_DARK_2', name: '보안등 사각지대 갈림길', lat: 37.5018, lng: 127.0340, type: 'alley' },

  // South-East Residential / Office Grid
  'N_SOUTH_1': { id: 'N_SOUTH_1', name: '역삼초교 방면 골목 입구', lat: 37.4965, lng: 127.0305, type: 'alley' },
  'N_SOUTH_2': { id: 'N_SOUTH_2', name: '안심귀갓길 표지판 삼거리', lat: 37.4958, lng: 127.0320, type: 'alley' },
  'N_SOUTH_DARK': { id: 'N_SOUTH_DARK', name: '남측 막다른 어두운 골목', lat: 37.4950, lng: 127.0300, type: 'alley' },
  'N_SOUTH_MAIN': { id: 'N_SOUTH_MAIN', name: '역삼로 교차로', lat: 37.4948, lng: 127.0335, type: 'junction' }
};

// Streetlights infrastructure (15m illumination radius)
export const STREETLIGHTS = [
  // Gangnam-daero Main Boulevard (Dense high-output LED)
  { id: 'SL_M01', lat: 37.5014, lng: 127.0263, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M02', lat: 37.5008, lng: 127.0266, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M03', lat: 37.5001, lng: 127.0270, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M04', lat: 37.4994, lng: 127.0271, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M05', lat: 37.4988, lng: 127.0273, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M06', lat: 37.4980, lng: 127.0274, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M07', lat: 37.4971, lng: 127.0274, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M08', lat: 37.4962, lng: 127.0276, type: 'smart_led', lumens: 8000, radius: 15 },
  { id: 'SL_M09', lat: 37.4955, lng: 127.0278, type: 'smart_led', lumens: 8000, radius: 15 },

  // Teheran-ro Streetlights
  { id: 'SL_T01', lat: 37.4989, lng: 127.0285, type: 'standard', lumens: 6000, radius: 15 },
  { id: 'SL_T02', lat: 37.4993, lng: 127.0300, type: 'standard', lumens: 6000, radius: 15 },
  { id: 'SL_T03', lat: 37.4997, lng: 127.0315, type: 'standard', lumens: 6000, radius: 15 },
  { id: 'SL_T04', lat: 37.5000, lng: 127.0328, type: 'standard', lumens: 6000, radius: 15 },
  { id: 'SL_T05', lat: 37.5003, lng: 127.0336, type: 'standard', lumens: 6000, radius: 15 },

  // Safe Alley Streetlights
  { id: 'SL_A01', lat: 37.5006, lng: 127.0282, type: 'security', lumens: 4500, radius: 15 },
  { id: 'SL_A02', lat: 37.5010, lng: 127.0285, type: 'security', lumens: 4500, radius: 15 },
  { id: 'SL_A03', lat: 37.5011, lng: 127.0298, type: 'security', lumens: 4500, radius: 15 },
  { id: 'SL_A04', lat: 37.4964, lng: 127.0308, type: 'security', lumens: 4500, radius: 15 },
  { id: 'SL_A05', lat: 37.4957, lng: 127.0322, type: 'security', lumens: 4500, radius: 15 },
  
  // Note: N_ALLEY_DARK_1 & DARK_2 and N_ALLEY_N3 have NO streetlights, forming prominent Dead Zones!
];

// Security CCTV cameras (20m safety influence buffer)
export const CCTVS = [
  { id: 'CCTV_01', name: '강남역 11번 출구 방범용', lat: 37.4989, lng: 127.0280, type: 'safety_rotary', radius: 20 },
  { id: 'CCTV_02', name: '강남대로 438번지 방범 CCTV', lat: 37.5003, lng: 127.0268, type: 'safety_fixed', radius: 20 },
  { id: 'CCTV_03', name: 'CGV 강남 앞 스마트 안전폴', lat: 37.5016, lng: 127.0262, type: 'smart_pole', radius: 20 },
  { id: 'CCTV_04', name: '테헤란로 102 앞 방범 카메라', lat: 37.4992, lng: 127.0295, type: 'safety_fixed', radius: 20 },
  { id: 'CCTV_05', name: '국기원사거리 방범 안전폴', lat: 37.4998, lng: 127.0318, type: 'smart_pole', radius: 20 },
  { id: 'CCTV_06', name: '먹자골목 중앙 방범 비상벨 CCTV', lat: 37.5005, lng: 127.0284, type: 'sos_cctv', radius: 20 },
  { id: 'CCTV_07', name: '안심귀갓길 스마트 안전지대 CCTV', lat: 37.4959, lng: 127.0320, type: 'smart_pole', radius: 20 },
  { id: 'CCTV_08', name: '강남역 1번 출구 다목적 CCTV', lat: 37.4971, lng: 127.0288, type: 'safety_fixed', radius: 20 }
];

// Edges (Pedestrian Road Segments)
// Length is in meters. litLengthRatio: 0~1 (percentage inside 15m light buffer)
// deadZoneLength: meter length lacking streetlight coverage
// cctvCount: number of CCTVs within 20m
// covered: true for indoor/sheltered, layer: -1 for underground, 0 for surface
export const EDGES = [
  // 1. Underground Shopping Mall Passages (Fully sheltered from rain, 100% lit, fully monitored)
  {
    id: 'E_UND_1',
    u: 'N_STATION_UND_1',
    v: 'N_STATION_EXT_1',
    name: '강남역 지하상가 11번 출구 연결통로',
    length: 95,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 3,
    streetType: 'underground_mall'
  },
  {
    id: 'E_UND_2',
    u: 'N_STATION_UND_1',
    v: 'N_STATION_EXT_2',
    name: '강남역 지하상가 12번 출구 연결통로',
    length: 110,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'underground_mall'
  },
  {
    id: 'E_UND_3',
    u: 'N_STATION_UND_1',
    v: 'N_STATION_UND_2',
    name: '강남역 테헤란 지하상가 중앙 아케이드',
    length: 130,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 3,
    streetType: 'underground_mall'
  },
  {
    id: 'E_UND_4',
    u: 'N_STATION_UND_2',
    v: 'N_TEHERAN_ARCADE_W',
    name: '테헤란 빌딩 지하 직결 통로 (빌딩 아케이드 연결)',
    length: 85,
    covered: true,
    shelterType: 'building_passage',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'underground_passage'
  },
  {
    id: 'E_UND_5',
    u: 'N_STATION_UND_1',
    v: 'N_STATION_EXT_3',
    name: '강남역 지하상가 1번 출구 연결통로',
    length: 120,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'underground_mall'
  },
  {
    id: 'E_UND_6',
    u: 'N_STATION_UND_1',
    v: 'N_STATION_EXT_4',
    name: '강남역 지하상가 2번 출구 연결통로',
    length: 135,
    covered: true,
    shelterType: 'underground',
    layer: -1,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 1,
    streetType: 'underground_mall'
  },

  // 2. Covered Building Arcades & Covered Walkways (Surface layer, covered=yes / covered=arcade)
  {
    id: 'E_ARC_1',
    u: 'N_TEHERAN_ARCADE_W',
    v: 'N_TEHERAN_ARCADE_E',
    name: '테헤란 종합타워 실내 아케이드 보행로',
    length: 160,
    covered: true,
    shelterType: 'covered_arcade',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'arcade'
  },
  {
    id: 'E_ARC_2',
    u: 'N_TEHERAN_ARCADE_E',
    v: 'N_TEHERAN_1',
    name: '테헤란 캐노피 비가림 회랑',
    length: 90,
    covered: true,
    shelterType: 'canopy',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 1,
    streetType: 'covered_walkway'
  },

  // 3. Gangnam-daero Main Avenue (Exposed to rain, but bright & multiple CCTVs)
  {
    id: 'E_MAIN_1',
    u: 'N_MAIN_1',
    v: 'N_MAIN_2',
    name: '강남대로 서측 보도 (CGV~신논현)',
    length: 160,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.95,
    deadZoneLength: 8,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_MAIN_2',
    u: 'N_MAIN_2',
    v: 'N_MAIN_3',
    name: '강남대로 서측 보도 (강남역 방면)',
    length: 155,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.95,
    deadZoneLength: 8,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_MAIN_3',
    u: 'N_MAIN_3',
    v: 'N_STATION_EXT_1',
    name: '강남역 11번 출구 앞 광장 횡단',
    length: 70,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 1.0,
    deadZoneLength: 0,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_MAIN_4',
    u: 'N_MAIN_3',
    v: 'N_MAIN_4',
    name: '강남역 사거리 서측 보도',
    length: 190,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.92,
    deadZoneLength: 15,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_MAIN_5',
    u: 'N_MAIN_4',
    v: 'N_MAIN_5',
    name: '강남대로 남단 보도',
    length: 180,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.90,
    deadZoneLength: 18,
    cctvCount: 1,
    streetType: 'main_street'
  },

  // 4. Teheran-ro Surface Walkways
  {
    id: 'E_TEH_1',
    u: 'N_STATION_EXT_1',
    v: 'N_STATION_EXT_2',
    name: '테헤란로 지상 보도 (11번~12번 출구)',
    length: 85,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.92,
    deadZoneLength: 7,
    cctvCount: 2,
    streetType: 'main_street'
  },
  {
    id: 'E_TEH_2',
    u: 'N_STATION_EXT_2',
    v: 'N_TEHERAN_1',
    name: '테헤란로 지상 보도 (국기원입구 방면)',
    length: 245,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.88,
    deadZoneLength: 30,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_TEH_3',
    u: 'N_TEHERAN_1',
    v: 'N_TEHERAN_2',
    name: '테헤란로 역삼역 방면 광폭 보도',
    length: 190,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.90,
    deadZoneLength: 19,
    cctvCount: 1,
    streetType: 'main_street'
  },

  // 5. Back Alleys (Shortcuts with high risk: dark dead zones, zero CCTV)
  {
    id: 'E_ALLEY_D1',
    u: 'N_MAIN_1',
    v: 'N_ALLEY_N1',
    name: '봉은사로 북단 좁은 골목길',
    length: 190,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.45,
    deadZoneLength: 105,
    cctvCount: 0,
    streetType: 'dark_alley'
  },
  {
    id: 'E_ALLEY_D2',
    u: 'N_ALLEY_N1',
    v: 'N_ALLEY_N2',
    name: '카페거리 후면 어두운 사잇길',
    length: 110,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.50,
    deadZoneLength: 55,
    cctvCount: 0,
    streetType: 'dark_alley'
  },
  {
    id: 'E_ALLEY_D3',
    u: 'N_ALLEY_N2',
    v: 'N_ALLEY_N3',
    name: '원룸 밀집 암흑 골목 (위험 사각지대)',
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
    id: 'E_ALLEY_D4',
    u: 'N_ALLEY_N3',
    v: 'N_ALLEY_DARK_1',
    name: '구릉지 암흑 보행 계단길 (조명 전무)',
    length: 185,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.10,
    deadZoneLength: 166,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_ALLEY_D5',
    u: 'N_ALLEY_DARK_1',
    v: 'N_ALLEY_DARK_2',
    name: '보안등 미설치 사각 골목길',
    length: 155,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.20,
    deadZoneLength: 124,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_ALLEY_D6',
    u: 'N_ALLEY_DARK_2',
    v: 'N_TEHERAN_2',
    name: '이면도로 역삼사거리 진출로',
    length: 180,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.40,
    deadZoneLength: 108,
    cctvCount: 0,
    streetType: 'alley'
  },

  // 6. Safe Alleys with Streetlights & CCTV (Safe detour paths)
  {
    id: 'E_ALLEY_S1',
    u: 'N_MAIN_2',
    v: 'N_ALLEY_M1',
    name: '먹자골목 서측 안전 통로',
    length: 125,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.85,
    deadZoneLength: 18,
    cctvCount: 1,
    streetType: 'safe_alley'
  },
  {
    id: 'E_ALLEY_S2',
    u: 'N_ALLEY_M1',
    v: 'N_ALLEY_M2',
    name: '먹자골목 중앙 안전구역 (CCTV & 가로등 집중)',
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
    id: 'E_ALLEY_S3',
    u: 'N_ALLEY_M2',
    v: 'N_ALLEY_M3',
    name: '역삼동 이면도로 가로등길',
    length: 165,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.75,
    deadZoneLength: 41,
    cctvCount: 1,
    streetType: 'alley'
  },
  {
    id: 'E_ALLEY_S4',
    u: 'N_ALLEY_M3',
    v: 'N_TEHERAN_2',
    name: '테헤란로 연결 이면도로',
    length: 145,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.80,
    deadZoneLength: 29,
    cctvCount: 1,
    streetType: 'safe_alley'
  },
  {
    id: 'E_ALLEY_S5',
    u: 'N_STATION_EXT_1',
    v: 'N_ALLEY_M1',
    name: '강남역 11번 출구~먹자골목 연결로',
    length: 180,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.82,
    deadZoneLength: 32,
    cctvCount: 1,
    streetType: 'safe_alley'
  },
  {
    id: 'E_ALLEY_S6',
    u: 'N_ALLEY_M2',
    v: 'N_TEHERAN_1',
    name: '국기원사거리 진입 보행로',
    length: 175,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.80,
    deadZoneLength: 35,
    cctvCount: 1,
    streetType: 'safe_alley'
  },

  // 7. South-East Neighborhood Paths
  {
    id: 'E_SOUTH_1',
    u: 'N_STATION_EXT_3',
    v: 'N_SOUTH_1',
    name: '역삼초 방면 이면도로',
    length: 160,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.78,
    deadZoneLength: 35,
    cctvCount: 1,
    streetType: 'alley'
  },
  {
    id: 'E_SOUTH_2',
    u: 'N_SOUTH_1',
    v: 'N_SOUTH_2',
    name: '안심귀갓길 스마트 안전 보행로',
    length: 155,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.95,
    deadZoneLength: 8,
    cctvCount: 2,
    streetType: 'safe_alley'
  },
  {
    id: 'E_SOUTH_3',
    u: 'N_SOUTH_2',
    v: 'N_SOUTH_MAIN',
    name: '역삼로 교차로 진입로',
    length: 185,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.88,
    deadZoneLength: 22,
    cctvCount: 1,
    streetType: 'main_street'
  },
  {
    id: 'E_SOUTH_D1',
    u: 'N_MAIN_5',
    v: 'N_SOUTH_DARK',
    name: '남단 어두운 주택가 골목길',
    length: 200,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.20,
    deadZoneLength: 160,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  },
  {
    id: 'E_SOUTH_D2',
    u: 'N_SOUTH_DARK',
    v: 'N_SOUTH_2',
    name: '남측 방범 취약 연결 사잇길',
    length: 190,
    covered: false,
    shelterType: 'none',
    layer: 0,
    litLengthRatio: 0.25,
    deadZoneLength: 142,
    cctvCount: 0,
    streetType: 'dead_zone_alley'
  }
];

// Preset Origin-Destination Scenarios demonstrating the routing engine
export const PRESET_SCENARIOS = [
  {
    id: 'scenario_1',
    title: '강남 CGV → 테헤란로 역삼사거리',
    desc: '어두운 원룸 암흑골목(Dead Zone)을 통과하는 최단 경로 vs 안전조명 및 CCTV 집중 우회 경로',
    startNode: 'N_MAIN_1',
    endNode: 'N_TEHERAN_2'
  },
  {
    id: 'scenario_2',
    title: '강남역 중앙 → 테헤란로 국기원입구',
    desc: '비에 노출되는 지상 보도 vs 지하상가 및 빌딩 아케이드 비가림 쾌적 경로',
    startNode: 'N_STATION_UND_1',
    endNode: 'N_TEHERAN_1'
  },
  {
    id: 'scenario_3',
    title: '강남대로 남단 → 역삼로 교차로',
    desc: '보안등 없는 위험 주택가 골목 vs 스마트 안심귀갓길 표지구간 우회',
    startNode: 'N_MAIN_5',
    endNode: 'N_SOUTH_MAIN'
  }
];
