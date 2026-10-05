import React from 'react';
import { Shield, RotateCcw, MapPin, Moon, Sun, SunMoon, SunMedium, Settings, Box, Map as MapIcon } from 'lucide-react';

export default function Header({
  onResetPins,
  onOpenSettings,
  viewMode,
  setViewMode,
  mapThemeSetting = 'auto',
  setMapThemeSetting,
  sunPos,
  simulatedHour,
  isLiveTime = true,
  onResetLive
}) {
  const formattedHour = `${String(Math.floor(simulatedHour)).padStart(2, '0')}:${String(Math.round((simulatedHour % 1) * 60)).padStart(2, '0')}`;

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #059669 100%)' }}>
          <Shield size={22} strokeWidth={2.4} />
        </div>
        <div className="brand-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 className="brand-title">UrbanShelter</h1>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <SunMedium size={10} />
              그늘로 (Gneul-ro) 엔진 탑재
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.18)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}>
              <MapPin size={10} />
              전국 실시간 서비스
            </span>
          </div>
          <span className="brand-tagline">
            실시간 건물 그늘 분석 기반 폭염 회피 & 방범 CCTV 안심 스마트 도보 라우팅
          </span>
        </div>
      </div>

      <div className="header-actions">
        {/* Real-time Sun Condition Quick Pill */}
        {sunPos && !isLiveTime && (
          <button type="button" onClick={onResetLive} title="미리 보기를 끝내고 현재 시각으로" aria-label="미리 보기를 끝내고 현재 시각으로" style={{
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '0.74rem'
          }}>
            <SunMedium size={13} color="#f59e0b" />
            <span style={{ color: 'var(--text-muted)' }}>미리 보기</span>
            <strong style={{ color: '#f59e0b' }}>{formattedHour}</strong>
            <span style={{ color: 'var(--text-dim)' }}>|</span>
            <span style={{ color: 'var(--text-main)', fontSize: '0.72rem' }}>
              {sunPos.isDaylight ? `고도 ${sunPos.altitudeDeg}° (자외선 ${sunPos.uvEstimate})` : '해 없음'}
            </span>
            <span style={{ color: 'var(--text-dim)' }}>✕</span>
          </button>
        )}

        {/* 2D / 3D 지도 전환 */}
        <button
          className="reset-btn"
          onClick={() => setViewMode(viewMode === '3d' ? '2d' : '3d')}
          title={viewMode === '3d' ? '2D 지도로 전환' : '입체(3D) 지도로 전환'}
          aria-label={viewMode === '3d' ? '2D 지도로 전환' : '입체(3D) 지도로 전환'}
          aria-pressed={viewMode === '3d'}
        >
          {viewMode === '3d' ? <MapIcon size={18} color="#38bdf8" /> : <Box size={18} color="#10b981" />}
        </button>

        {/* Map Theme Toggle */}
        <button
          className="reset-btn"
          onClick={() => setMapThemeSetting({ auto: 'light', light: 'dark', dark: 'auto' }[mapThemeSetting])}
          title={`지도 테마: ${{ auto: '자동(시간에 따라)', light: '밝게', dark: '어둡게' }[mapThemeSetting]} (누르면 변경)`}
          aria-label={`지도 테마: ${{ auto: '자동(시간에 따라)', light: '밝게', dark: '어둡게' }[mapThemeSetting]}`}
        >
          {mapThemeSetting === 'auto' ? <SunMoon size={18} color="#a78bfa" /> : mapThemeSetting === 'light' ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#38bdf8" />}
        </button>

        {/* 이용자 맞춤 설정 */}
        <button
          className="reset-btn"
          onClick={onOpenSettings}
          title="내 설정 (이동에 필요한 도움 변경)"
          aria-label="내 설정 (이동에 필요한 도움 변경)"
        >
          <Settings size={18} />
        </button>

        {/* Reset Button */}
        <button
          className="reset-btn"
          onClick={onResetPins}
          title="출발/도착지 기본값 초기화"
          aria-label="출발/도착지 기본값 초기화"
        >
          <RotateCcw size={18} />
        </button>
      </div>
    </header>
  );
}
