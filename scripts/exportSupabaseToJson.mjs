import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = trimmed.replace('VITE_SUPABASE_URL=', '').trim();
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseAnonKey = trimmed.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
  }
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function exportSupabaseToJson() {
  console.log('Exporting Supabase data to local JSON caches...');

  // 1. Export CCTVs (up to 10000)
  const { data: cctvs, error: cErr } = await supabase.from('cctv_locations').select('*').limit(10000);
  if (!cErr && cctvs && cctvs.length > 0) {
    const formattedCctvs = cctvs.map(c => ({
      id: c.cctv_id,
      name: c.name,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      purpose: c.purpose,
      cameraCount: c.camera_count,
      manager: c.manager,
      radius: 20
    }));
    fs.writeFileSync(path.resolve(__dirname, '../src/data/cctvRealData.json'), JSON.stringify(formattedCctvs, null, 2), 'utf8');
    console.log(`Saved ${formattedCctvs.length} CCTVs to src/data/cctvRealData.json!`);
  }

  // 2. Export Streetlights (up to 10000)
  const { data: lights, error: sErr } = await supabase.from('streetlight_locations').select('*').limit(10000);
  if (!sErr && lights && lights.length > 0) {
    const formattedLights = lights.map(s => ({
      id: s.sl_id,
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      type: s.type,
      lumens: s.lumens,
      radius: s.radius,
      manager: s.manager
    }));
    fs.writeFileSync(path.resolve(__dirname, '../src/data/streetlightRealData.json'), JSON.stringify(formattedLights, null, 2), 'utf8');
    console.log(`Saved ${formattedLights.length} Streetlights to src/data/streetlightRealData.json!`);
  }

  console.log('Export finished!');
}

exportSupabaseToJson();
