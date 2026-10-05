import React from 'react';
import { Shield, RotateCcw, MapPin, Moon, Sun } from 'lucide-react';

export default function Header({
  onResetPins,
  mapTheme,
  setMapTheme
}) {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <Shield size={22} strokeWidth={2.4} />
        </div>
        <div className="brand-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="brand-title">UrbanShelter</h1>
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
          <span className="brand-tagline">전국 실시간 방범 CCTV 안전구역 기반 도보 안심 스마트 라우팅</span>
        </div>
      </div>

      <div className="header-actions">
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
