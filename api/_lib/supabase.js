import { createClient } from '@supabase/supabase-js';

let supabaseClient = null;
let supabaseDisabled = false;

export function getSupabase() {
  if (supabaseDisabled) return null;
  if (supabaseClient) return supabaseClient;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  // 비활성화/만료된 기본 프로젝트 URL인 경우 DNS 타임아웃 방지를 위해 즉시 스킵
  if (!url || !key || url.includes('ltrfldvppqjodetnuwum')) {
    supabaseDisabled = true;
    return null;
  }

  try {
    supabaseClient = createClient(url, key);
  } catch (err) {
    supabaseDisabled = true;
    console.warn('Supabase client creation error:', err);
  }

  return supabaseClient;
}
