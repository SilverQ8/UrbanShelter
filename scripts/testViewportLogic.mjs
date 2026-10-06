async function testViewport(label, endpoint, lat, lng, minLat, maxLat, minLng, maxLng, itemKey) {
  const url = `http://localhost:5173${endpoint}?lat=${lat}&lng=${lng}&minLat=${minLat}&maxLat=${maxLat}&minLng=${minLng}&maxLng=${maxLng}&zoom=16`;
  const resp = await fetch(url);
  const data = await resp.json();
  const list = data[itemKey] || [];
  
  console.log(`[${label}]`);
  console.log(`  Total matched in bbox: ${data.count}`);
  console.log(`  Displayed: ${data.displayedCount} (received items: ${list.length})`);
  
  if (list.length > 0) {
    const first = list[0];
    const last = list[list.length - 1];
    const dFirst = Math.hypot(first.lat - lat, first.lng - lng);
    const dLast = Math.hypot(last.lat - lat, last.lng - lng);
    console.log(`  First item dist to center: ${dFirst.toFixed(5)}, Last item dist: ${dLast.toFixed(5)}`);
    console.log(`  Center-first sort valid: ${dFirst <= dLast}`);
    
    const outOfBounds = list.filter(item => item.lat < minLat || item.lat > maxLat || item.lng < minLng || item.lng > maxLng);
    console.log(`  Out of bounds items (MUST BE 0): ${outOfBounds.length}`);
  }
}

async function run() {
  // 부산 광안리 일대 테스트
  await testViewport('Busan Gwangan CCTV', '/api/cctv/viewport', 35.153, 129.118, 35.145, 35.160, 129.110, 129.125, 'cctvs');
  await testViewport('Busan Gwangan Streetlights', '/api/streetlight/viewport', 35.153, 129.118, 35.145, 35.160, 129.110, 129.125, 'streetlights');

  // 서울 강남역 일대 테스트
  await testViewport('Seoul Gangnam CCTV', '/api/cctv/viewport', 37.498, 127.028, 37.490, 37.505, 127.020, 127.035, 'cctvs');
  await testViewport('Seoul Gangnam Streetlights', '/api/streetlight/viewport', 37.498, 127.028, 37.490, 37.505, 127.020, 127.035, 'streetlights');
}

run();
