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

async function checkTables() {
  console.log('Testing Supabase connection:', supabaseUrl);
  
  // 1. Check cctv_locations count
  const { count: cctvCount, error: cctvErr } = await supabase.from('cctv_locations').select('*', { count: 'exact', head: true });
  console.log('CCTV count:', cctvCount, 'err:', cctvErr?.message);

  // 2. Check streetlight_locations
  const { count: slCount, error: slErr } = await supabase.from('streetlight_locations').select('*', { count: 'exact', head: true });
  console.log('Streetlight count:', slCount, 'err:', slErr?.message);
}

checkTables();
