import React from 'react';
import {
  Compass,
  Moon,
  Sliders,
  Layers,
  Video,
  MapPin
} from 'lucide-react';
import { NODES } from '../data/urbanNetwork';

export default function ControlPanel({
  mode,
  setMode,
  sensitivity,
  setSensitivity,
  layers,
  setLayers,
  startPoint,
  targetPoint,
  startNodeId,
  targetNodeId,
  pinSelectMode,
  setPinSelectMode
}) {
  const toggleLayer = (layerKey) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const startName = startPoint?.name || NODES[startNodeId]?.roadAddress || NODES[startNodeId]?.name || '출발지 미지정';
  const targetName = targetPoint?.name || NODES[targetNodeId]?.roadAddress || NODES[targetNodeId]?.name || '도착지 미지정';

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      {/* 2.1 출발지 / 도착지 선택 현황 */}
      <div style={{ marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            경로 설정 (출발/도착지)
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            지도 클릭 또는 검색으로 설정
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setPinSelectMode('start')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              background: pinSelectMode === 'start' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${pinSelectMode === 'start' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.06)'}`,
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>출발(A):</span>
              <strong style={{ fontWeight: 600 }}>{startName}</strong>
            </div>
            {pinSelectMode === 'start' && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>선택 대기중</span>
            )}
          </button>

          <button
            onClick={() => setPinSelectMode('target')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              borderRadius: '8px',
              background: pinSelectMode === 'target' ? 'rgba(244, 63, 94, 0.18)' : 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${pinSelectMode === 'target' ? 'var(--accent-rose)' : 'rgba(255,255,255,0.06)'}`,
              color: 'var(--text-main)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-rose)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>도착(B):</span>
              <strong style={{ fontWeight: 600 }}>{targetName}</strong>
            </div>
            {pinSelectMode === 'target' && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', fontWeight: 600 }}>선택 대기중</span>
            )}
          </button>
        </div>
      </div>

      {/* 라우팅 모드 선택 탭 (Standard / Night) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Compass size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            라우팅 모드 선택
          </span>
        </div>

        <div className="mode-tabs" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            className={`mode-tab-btn mode-standard ${mode === 'standard' ? 'active' : ''}`}
            onClick={() => setMode('standard')}
          >
            <Compass size={16} />
            <span>일반 최단</span>
          </button>
          <button
            className={`mode-tab-btn mode-night ${mode === 'night' ? 'active' : ''}`}
            onClick={() => setMode('night')}
          >
            <Moon size={16} />
            <span>야간 안심 (CCTV 우선)</span>
          </button>
        </div>
      </div>

      {/* 야간 안심 가중치 슬라이더 (Custom Weighting) */}
      {mode === 'night' && (
        <div className="slider-control-group">
          <div className="slider-label-row">
            <span className="slider-title">
              <Sliders size={13} color="var(--accent-cyan)" />
              <span>야간 안심 가중치</span>
            </span>
            <span className="slider-value-badge">
              {Math.round(sensitivity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="custom-range-slider"
          />
          <div className="slider-endpoints">
            <span>최단 거리(0%)</span>
            <span>안전 우회(100%)</span>
          </div>
        </div>
      )}

      {/* 안전 인프라 시각화 레이어 토글 */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Layers size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            시각화 레이어 설정
          </span>
        </div>

        <div className="layer-toggle-grid">
          {/* 방범 CCTV 레이어 (전국 실시간 공공데이터) */}
          <div className="toggle-item" onClick={() => toggleLayer('cctv')}>
            <div className={`toggle-info ${layers.cctv ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Video size={13} />
              </div>
              <div>
                <div>방범 CCTV (전국 실시간 공공데이터)</div>
                <div style={{ fontSize: '10px', color: '#38bdf8', opacity: 0.85 }}>행정안전부 실시간 API 연동</div>
              </div>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.cctv}
                onChange={() => toggleLayer('cctv')}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

