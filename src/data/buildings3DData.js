// 3D Building & Street Tree Dataset for Solar Shadow Simulation
// Based on actual building footprints and heights along Haeundae Gunam-ro cultural avenue
// Includes building heights (meters), polygon coordinates, and roadside tree canopies

export const HAEUNDAE_BUILDINGS = [
  // 1. Haeundae Station Complex & Plaza Buildings (North Gunam-ro)
  {
    id: 'bld_hae_station',
    name: '해운대역 복합역사 및 부속건물',
    height: 24, // meters (~6 stories)
    polygon: [
      [35.1643, 129.1578],
      [35.1645, 129.1593],
      [35.1638, 129.1594],
      [35.1637, 129.1579]
    ]
  },
  {
    id: 'bld_ramada_encore',
    name: '라마다 앙코르 해운대 호텔 타워',
    height: 78, // ~25 stories
    polygon: [
      [35.1633, 129.1574],
      [35.1635, 129.1582],
      [35.1627, 129.1584],
      [35.1625, 129.1576]
    ]
  },
  {
    id: 'bld_felix_stx',
    name: '펠릭스 바이 STX 호텔 & CGV 복합빌딩',
    height: 82, // ~26 stories
    polygon: [
      [35.1633, 129.1589],
      [35.1635, 129.1598],
      [35.1626, 129.1600],
      [35.1624, 129.1591]
    ]
  },

  // 2. Gunam-ro Mid-Section Avenue Buildings (West & East commercial blocks)
  {
    id: 'bld_gunam_west_block1',
    name: '구남로 서측 상가거리 타워 1',
    height: 38, // ~10 stories
    polygon: [
      [35.1623, 129.1578],
      [35.1624, 129.1585],
      [35.1616, 129.1587],
      [35.1615, 129.1580]
    ]
  },
  {
    id: 'bld_gunam_east_block1',
    name: '구남로 동측 메디컬 & 쇼핑몰 1',
    height: 42, // ~12 stories
    polygon: [
      [35.1622, 129.1592],
      [35.1623, 129.1601],
      [35.1615, 129.1603],
      [35.1614, 129.1594]
    ]
  },
  {
    id: 'bld_gunam_west_block2',
    name: '구남로 서측 상가거리 타워 2',
    height: 32, // ~9 stories
    polygon: [
      [35.1613, 129.1582],
      [35.1614, 129.1589],
      [35.1606, 129.1591],
      [35.1605, 129.1584]
    ]
  },
  {
    id: 'bld_market_arcade',
    name: '해운대 전통시장 아케이드 상가동',
    height: 16, // ~4 stories with covered arcade roof
    polygon: [
      [35.1612, 129.1596],
      [35.1613, 129.1607],
      [35.1604, 129.1609],
      [35.1603, 129.1598]
    ]
  },

  // 3. Gunam-ro South & Beachfront High-Rise Hotels
  {
    id: 'bld_ms_hotel',
    name: '해운대 MS 호텔 타워',
    height: 55, // ~16 stories
    polygon: [
      [35.1603, 129.1586],
      [35.1604, 129.1594],
      [35.1596, 129.1596],
      [35.1595, 129.1588]
    ]
  },
  {
    id: 'bld_seacloud_hotel',
    name: '씨클라우드 호텔 타워',
    height: 92, // ~30 stories
    polygon: [
      [35.1602, 129.1600],
      [35.1603, 129.1612],
      [35.1594, 129.1614],
      [35.1593, 129.1602]
    ]
  },
  {
    id: 'bld_grand_chosun',
    name: '그랜드 조선 부산 호텔',
    height: 65, // ~18 stories
    polygon: [
      [35.1593, 129.1592],
      [35.1595, 129.1603],
      [35.1587, 129.1605],
      [35.1585, 129.1594]
    ]
  },
  {
    id: 'bld_paradise_hotel',
    name: '파라다이스 호텔 부산 본관',
    height: 60, // ~17 stories
    polygon: [
      [35.1592, 129.1608],
      [35.1594, 129.1624],
      [35.1586, 129.1626],
      [35.1584, 129.1610]
    ]
  },
  {
    id: 'bld_aquarium_pavilion',
    name: 'SEA LIFE 부산아쿠아리움 지상 파빌리온',
    height: 14,
    polygon: [
      [35.1589, 129.1599],
      [35.1591, 129.1610],
      [35.1586, 129.1611],
      [35.1584, 129.1600]
    ]
  }
];

// Roadside Tree Canopies along Gunam-ro pedestrian promenade
// Trees provide natural shade canopy with radius ~4.5m and height ~7m
export const GUNAM_RO_TREES = [
  { id: 'tree_1', lat: 35.1633, lng: 129.1585, height: 7.5, radius: 4.5 },
  { id: 'tree_2', lat: 35.1629, lng: 129.1587, height: 7.5, radius: 4.5 },
  { id: 'tree_3', lat: 35.1625, lng: 129.1588, height: 8.0, radius: 5.0 },
  { id: 'tree_4', lat: 35.1621, lng: 129.1590, height: 8.0, radius: 5.0 },
  { id: 'tree_5', lat: 35.1617, lng: 129.1592, height: 7.5, radius: 4.5 },
  { id: 'tree_6', lat: 35.1613, lng: 129.1593, height: 8.0, radius: 5.0 },
  { id: 'tree_7', lat: 35.1609, lng: 129.1595, height: 7.5, radius: 4.5 },
  { id: 'tree_8', lat: 35.1605, lng: 129.1597, height: 8.0, radius: 5.0 },
  { id: 'tree_9', lat: 35.1601, lng: 129.1599, height: 7.5, radius: 4.5 },
  { id: 'tree_10', lat: 35.1597, lng: 129.1601, height: 8.0, radius: 5.0 },
  // East sidewalk row
  { id: 'tree_11', lat: 35.1632, lng: 129.1589, height: 7.5, radius: 4.5 },
  { id: 'tree_12', lat: 35.1628, lng: 129.1591, height: 7.5, radius: 4.5 },
  { id: 'tree_13', lat: 35.1624, lng: 129.1593, height: 8.0, radius: 5.0 },
  { id: 'tree_14', lat: 35.1620, lng: 129.1595, height: 8.0, radius: 5.0 },
  { id: 'tree_15', lat: 35.1616, lng: 129.1596, height: 7.5, radius: 4.5 },
  { id: 'tree_16', lat: 35.1612, lng: 129.1598, height: 8.0, radius: 5.0 },
  { id: 'tree_17', lat: 35.1608, lng: 129.1600, height: 7.5, radius: 4.5 },
  { id: 'tree_18', lat: 35.1604, lng: 129.1602, height: 8.0, radius: 5.0 },
  { id: 'tree_19', lat: 35.1600, lng: 129.1604, height: 7.5, radius: 4.5 }
];
