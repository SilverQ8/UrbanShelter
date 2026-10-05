import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.warn('⚠️ Supabase anon key가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * Supabase 연결 상태 확인 함수
 * @returns {Promise<boolean>}
 */
export async function checkSupabaseConnection() {
  try {
    const { error } = await supabase.from('_dummy_ping').select('*').limit(1);
    // 테이블이 없더라도 연결 자체(인증 통과)는 성공
    if (!error || error.code === 'PGRST116' || error.code === '42P01') {
      return true;
    }
    return false;
  } catch (err) {
    console.error('Supabase ping failed:', err);
    return false;
  }
}
