-- ============================================================================
-- Supabase Streetlight Infrastructure Schema
-- 가로등/보안등(15m 안심조도) 클라우드 데이터베이스 테이블 및 인덱스 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.streetlight_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sl_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    type VARCHAR(50) DEFAULT 'smart_led',
    lumens INTEGER DEFAULT 8000,
    radius INTEGER DEFAULT 15,
    manager VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 위경도 바운딩 박스(Bounding Box) 범위 검색을 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_streetlight_coords ON public.streetlight_locations (lat, lng);

-- RLS (Row Level Security) 설정
ALTER TABLE public.streetlight_locations ENABLE ROW LEVEL SECURITY;

-- 익명(anon) 사용자 읽기 권한 허용
CREATE POLICY "Allow public read access on streetlights"
ON public.streetlight_locations
FOR SELECT
USING (true);

-- 데이터 초기 업로드 및 동기화를 위한 전체 권한 허용
CREATE POLICY "Allow full access on streetlights for anon"
ON public.streetlight_locations
FOR ALL
USING (true)
WITH CHECK (true);
