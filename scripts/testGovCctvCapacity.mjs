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

console.log('Testing Public CCTV API...');

async function testCctvApi() {
  const params = new URLSearchParams({
    serviceKey: cctvApiKey,
    pageNo: '1',
    numOfRows: '10',
    returnType: 'JSON'
  });
  const url = `https://apis.data.go.kr/1741000/cctv_info/info?${params.toString()}`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    console.log('Total count in Gov API:', json?.response?.body?.totalCount);
    console.log('Items returned in page 1:', json?.response?.body?.items?.item?.length);
    console.log('Sample item:', json?.response?.body?.items?.item?.[0]);
  } catch (e) {
    console.error('API Error:', e.message);
  }
}

testCctvApi();
