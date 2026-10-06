import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = process.env.VITE_SUPABASE_URL || '';
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      supabaseUrl = trimmed.replace('VITE_SUPABASE_URL=', '').trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = trimmed.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
    }
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ .env.local에서 VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY를 찾을 수 없습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function uploadStreetlights() {
  const jsonPath = path.resolve(__dirname, '../src/data/streetlightRealData.json');
  console.log('Reading Streetlight data from:', jsonPath);
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const items = JSON.parse(raw);
  console.log(`Total Streetlights to upload: ${items.length}`);

  const batchSize = 100;
  let totalUploaded = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize).map(s => ({
      sl_id: s.id,
      name: s.name,
      address: s.address || '',
      lat: s.lat,
      lng: s.lng,
      type: s.type || 'smart_led',
      lumens: s.lumens || 8000,
      radius: s.radius || 15,
      manager: s.manager || '지자체 도로관리과'
    }));

    const { error } = await supabase.from('streetlight_locations').upsert(chunk, { onConflict: 'sl_id' });
    if (error) {
      console.error(`Batch ${i / batchSize + 1} error:`, error.message);
      if (error.code === 'PGRST205') {
        console.error('\n⚠️ Supabase에 "streetlight_locations" 테이블이 아직 없습니다.');
        console.error('👉 Supabase 대시보드(SQL Editor)에서 scripts/create_streetlight_table.sql 쿼리를 실행한 후 다시 시도해 주세요.');
        process.exit(1);
      }
    } else {
      totalUploaded += chunk.length;
      process.stdout.write(`Uploaded ${totalUploaded}/${items.length} Streetlights...\r`);
    }
  }

  console.log('\nUpload completed!');

  // Verify total count in Supabase DB
  const { count, error } = await supabase.from('streetlight_locations').select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Count verification failed:', error.message);
  } else {
    console.log(`🎉 Supabase streetlight_locations DB Total Count: ${count} rows!`);
  }
}

uploadStreetlights();
