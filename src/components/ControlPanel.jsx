import React from 'react';
import {
  Compass,
  Moon,
  CloudRain,
  Sliders,
  Layers,
  Lightbulb,
  Video,
  Umbrella,
  AlertOctagon,
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
  startNodeId,
  targetNodeId,
  pinSelectMode,
  setPinSelectMode
}) {
  const toggleLayer = (layerKey) => {
    setLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const startNodeName = NODES[startNodeId]?.name || '미지정';
  const targetNodeName = NODES[targetNodeId]?.name || '미지정';

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      {/* 2.1 출발지 / 도착지 선택 현황 */}
      <div style={{ marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            경로 설정 (2.1 출발/도착지)
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
            지도 클릭으로 핀 이동
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
              <strong style={{ fontWeight: 600 }}>{startNodeName}</strong>
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
              <strong style={{ fontWeight: 600 }}>{targetNodeName}</strong>
            </div>
            {pinSelectMode === 'target' && (
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-rose)', fontWeight: 600 }}>선택 대기중</span>
            )}
          </button>
        </div>
      </div>

      {/* 1.4 모드 선택 탭 (Standard / Night / Rain) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Compass size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            라우팅 모드 (1.4 모드 선택)
          </span>
        </div>

        <div className="mode-tabs">
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
            <span>야간 안심</span>
          </button>
          <button
            className={`mode-tab-btn mode-rain ${mode === 'rain' ? 'active' : ''}`}
            onClick={() => setMode('rain')}
          >
            <CloudRain size={16} />
            <span>우천 회피</span>
          </button>
        </div>
      </div>

      {/* 1.4 민감도 슬라이더 (Custom Weighting) */}
      {mode !== 'standard' && (
        <div className="slider-control-group">
          <div className="slider-label-row">
            <span className="slider-title">
              <Sliders size={13} color="var(--accent-cyan)" />
              <span>{mode === 'night' ? '야간 안심 가중치' : '우천 회피 가중치'}</span>
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
            <span>{mode === 'night' ? '안전 우회(100%)' : '비가림 우선(100%)'}</span>
          </div>
        </div>
      )}

      {/* 2.3 안전 인프라 시각화 레이어 토글 */}
      <div style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Layers size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            시각화 레이어 (2.3 토글 레이어)
          </span>
        </div>

        <div className="layer-toggle-grid">
          {/* 가로등 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('streetlights')}>
            <div className={`toggle-info ${layers.streetlights ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <Lightbulb size={13} />
              </div>
              <span>가로등 & 조명 유효반경 (15m)</span>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.streetlights}
                onChange={() => toggleLayer('streetlights')}
              />
              <span className="switch-slider" />
            </label>
          </div>

          {/* 방범 CCTV 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('cctv')}>
            <div className={`toggle-info ${layers.cctv ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Video size={13} />
              </div>
              <span>방범 CCTV 마커 & 20m 버퍼</span>
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

          {/* 비가림 & 지하통로 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('covered')}>
            <div className={`toggle-info ${layers.covered ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                <Umbrella size={13} />
              </div>
              <span>비가림 아케이드 & 지하보도</span>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.covered}
                onChange={() => toggleLayer('covered')}
              />
              <span className="switch-slider" />
            </label>
          </div>

          {/* 암흑 구간 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('deadZones')}>
            <div className={`toggle-info ${layers.deadZones ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
                <AlertOctagon size={13} />
              </div>
              <span>암흑 사각지대 (Dead Zone)</span>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.deadZones}
                onChange={() => toggleLayer('deadZones')}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
