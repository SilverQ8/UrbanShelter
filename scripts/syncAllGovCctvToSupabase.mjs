import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';
let cctvApiKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = trimmed.replace('VITE_SUPABASE_URL=', '').trim();
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnonKey = trimmed.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
    if (trimmed.startsWith('VITE_CCTV_API_KEY=')) cctvApiKey = trimmed.replace('VITE_CCTV_API_KEY=', '').trim();
  }
}

if (!supabaseUrl || !supabaseAnonKey || !cctvApiKey) {
  console.error('❌ Missing credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function isInvalidCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng) || lat <= 0 || lng <= 0) return true;
  if (lat < 33.0 || lat > 38.9 || lng < 124.5 || lng > 131.9) return true;
  return false;
}

async function fetchPage(pageNo, filterDistrict = null) {
  const params = new URLSearchParams({
    serviceKey: cctvApiKey,
    pageNo: String(pageNo),
    numOfRows: '100',
    returnType: 'JSON'
  });
  if (filterDistrict) {
    params.set('cond[LCTN_ROAD_NM_ADDR::LIKE]', filterDistrict);
  }
  const url = `https://apis.data.go.kr/1741000/cctv_info/info?${params.toString()}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const json = await resp.json();
    return json?.response?.body?.items?.item || [];
  } catch {
    return [];
  }
}

async function syncCctvs() {
  console.log('🚀 Starting Nationwide CCTV Sync to Supabase...');

  // Initial count
  const { count: initialCount } = await supabase.from('cctv_locations').select('*', { count: 'exact', head: true });
  console.log(`Current Supabase cctv_locations count: ${initialCount} rows.`);

  const districts = ['해운대', '수영구', '부산진구', '남구', '동래구', '강남구', '서초구', '송파구', '마포구', '종로구', '중구'];
  let totalUploaded = 0;

  // 1. Fetch targeted major districts first
  for (const dist of districts) {
    console.log(`\nFetching district: ${dist}...`);
    for (let page = 1; page <= 3; page++) {
      const items = await fetchPage(page, dist);
      if (!items || items.length === 0) break;

      const validRows = [];
      for (const it of items) {
        const lat = parseFloat(it.WGS84_LAT);
        const lng = parseFloat(it.WGS84_LOT);
        if (isInvalidCoordinate(lat, lng)) continue;

        const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
        const mngNo = it.MNG_NO || `${lat}_${lng}`;
        validRows.push({
          cctv_id: `CCTV_REAL_${mngNo}`,
          name: addr ? `${addr} 방범 CCTV` : `${it.MNG_INST_NM || dist} CCTV`,
          address: addr,
          lat,
          lng,
          purpose: it.INSTL_PRPS_SE_NM || '생활방범',
          camera_count: parseInt(it.CAM_CNTOM || '1', 10) || 1,
          manager: it.MNG_INST_NM || `${dist} 관할청`
        });
      }

      if (validRows.length > 0) {
        const { error } = await supabase.from('cctv_locations').upsert(validRows, { onConflict: 'cctv_id' });
        if (!error) {
          totalUploaded += validRows.length;
          process.stdout.write(`+${validRows.length} `);
        }
      }
    }
  }

  // 2. Fetch nationwide sequence pages (pages 1 to 25)
  console.log('\n\nFetching general nationwide batch (Pages 1 to 25)...');
  for (let page = 1; page <= 25; page++) {
    const items = await fetchPage(page);
    if (!items || items.length === 0) continue;

    const validRows = [];
    for (const it of items) {
      const lat = parseFloat(it.WGS84_LAT);
      const lng = parseFloat(it.WGS84_LOT);
      if (isInvalidCoordinate(lat, lng)) continue;

      const addr = it.LCTN_ROAD_NM_ADDR || it.LCTN_LOTNO_ADDR || '';
      const mngNo = it.MNG_NO || `${lat}_${lng}`;
      validRows.push({
        cctv_id: `CCTV_REAL_${mngNo}`,
        name: addr ? `${addr} 방범 CCTV` : `${it.MNG_INST_NM || '공공'} CCTV`,
        address: addr,
        lat,
        lng,
        purpose: it.INSTL_PRPS_SE_NM || '생활방범',
        camera_count: parseInt(it.CAM_CNTOM || '1', 10) || 1,
        manager: it.MNG_INST_NM || '관할 지자체'
      });
    }

    if (validRows.length > 0) {
      const { error } = await supabase.from('cctv_locations').upsert(validRows, { onConflict: 'cctv_id' });
      if (!error) {
        totalUploaded += validRows.length;
        process.stdout.write(`Page ${page}(+${validRows.length}) `);
      }
    }
  }

  const { count: finalCount } = await supabase.from('cctv_locations').select('*', { count: 'exact', head: true });
  console.log(`\n\n🎉 CCTV Sync Completed! Final Supabase cctv_locations Count: ${finalCount} rows! (Uploaded/Updated: ${totalUploaded})`);
}

syncCctvs();
