import React from 'react';
import { Shield, RotateCcw, MapPin, Moon, Sun, SunMedium } from 'lucide-react';

export default function Header({
  onResetPins,
  mapTheme,
  setMapTheme,
  sunPos,
  simulatedHour
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
            3D 건물 그림자 시뮬레이션 기반 폭염 그늘 회피 & 방범 CCTV 안심 스마트 도보 라우팅
          </span>
        </div>
      </div>

      <div className="header-actions">
        {/* Real-time Sun Condition Quick Pill */}
        {sunPos && (
          <div style={{
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
            <span style={{ color: 'var(--text-muted)' }}>시뮬레이션:</span>
            <strong style={{ color: '#f59e0b' }}>{formattedHour}</strong>
            <span style={{ color: 'var(--text-dim)' }}>|</span>
            <span style={{ color: 'var(--text-main)', fontSize: '0.72rem' }}>
              고도 {sunPos.altitudeDeg}° (자외선 {sunPos.uvEstimate})
            </span>
          </div>
        )}

        {/* Map Theme Toggle */}
        <button
          className="reset-btn"
          onClick={() => setMapTheme(mapTheme === 'dark' ? 'light' : 'dark')}
          title={mapTheme === 'dark' ? '밝은 일반 지도로 전환' : '다크 모드 지도로 전환'}
        >
          {mapTheme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#38bdf8" />}
          <span>{mapTheme === 'dark' ? '밝은 지도' : '다크 지도'}</span>
        </button>

        {/* Reset Button */}
        <button
          className="reset-btn"
          onClick={onResetPins}
          title="출발/도착지 기본값 초기화"
        >
          <RotateCcw size={14} />
          <span>초기화</span>
        </button>
      </div>
    </header>
  );
}
