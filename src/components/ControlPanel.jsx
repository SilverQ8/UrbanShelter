import React from 'react';
import {
  Compass,
  Moon,
  Sun,
  SunMedium,
  Sliders,
  Layers,
  Video,
  Building,
  Trees,
  Clock,
  RotateCcw
} from 'lucide-react';
import { NODES } from '../data/urbanNetwork';

export default function ControlPanel({
  mode,
  setMode,
  sensitivity,
  setSensitivity,
  simulatedHour,
  setSimulatedHour,
  isLiveTime,
  setIsLiveTime,
  sunPos,
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

  const formatHourString = (val) => {
    const h = Math.floor(val);
    const m = Math.round((val % 1) * 60);
    const period = h < 12 ? '오전' : '오후';
    const displayH = h <= 12 ? h : h - 12;
    return `${period} ${displayH}시 ${m > 0 ? `${m}분` : ''} (${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')})`;
  };

  return (
    <div className="glass-panel" style={{ width: '100%' }}>
      {/* 1. 출발지 / 도착지 선택 현황 */}
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

      {/* 2. 3대 라우팅 모드 선택 탭 (Standard / Shade Gneul-ro / Night CCTV) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Compass size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            스마트 라우팅 모드 선택
          </span>
        </div>

        <div className="mode-tabs" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button
            className={`mode-tab-btn mode-standard ${mode === 'standard' ? 'active' : ''}`}
            onClick={() => setMode('standard')}
          >
            <Compass size={14} />
            <span>일반 최단</span>
          </button>
          <button
            className={`mode-tab-btn mode-rain ${mode === 'shade' ? 'active' : ''}`}
            style={{
              borderColor: mode === 'shade' ? '#10b981' : undefined,
              color: mode === 'shade' ? '#10b981' : undefined,
              background: mode === 'shade' ? 'rgba(16, 185, 129, 0.15)' : undefined
            }}
            onClick={() => setMode('shade')}
          >
            <SunMedium size={14} />
            <span>폭염 그늘 (그늘로)</span>
          </button>
          <button
            className={`mode-tab-btn mode-night ${mode === 'night' ? 'active' : ''}`}
            onClick={() => setMode('night')}
          >
            <Moon size={14} />
            <span>야간 안심 (CCTV)</span>
          </button>
        </div>
      </div>

      {/* 3. 태양광 시뮬레이터 시간대 컨트롤러 (Gneul-ro Solar Shadow Engine) */}
      <div style={{
        marginTop: '14px',
        padding: '10px',
        borderRadius: '10px',
        background: 'rgba(245, 158, 11, 0.07)',
        border: '1px solid rgba(245, 158, 11, 0.22)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sun size={13} color="#f59e0b" />
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f59e0b' }}>
              태양광 & 그림자 시뮬레이션
            </span>
          </div>
          <button
            onClick={() => {
              if (!isLiveTime) {
                const now = new Date();
                const curHour = now.getHours() + now.getMinutes() / 60;
                setSimulatedHour(Math.min(19, Math.max(8, curHour)));
                setIsLiveTime(true);
              } else {
                setIsLiveTime(false);
              }
            }}
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: isLiveTime ? '#f59e0b' : 'rgba(255,255,255,0.06)',
              color: isLiveTime ? '#000' : 'var(--text-muted)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Clock size={10} />
            {isLiveTime ? '실시간 연동중' : '현재 시각 동기화'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-main)', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600 }}>{formatHourString(simulatedHour)}</span>
          {sunPos && (
            <span style={{ color: 'var(--text-muted)' }}>
              고도 <strong style={{ color: '#f59e0b' }}>{sunPos.altitudeDeg}°</strong> · 방위 {sunPos.azimuthDeg}°
            </span>
          )}
        </div>

        <input
          type="range"
          min="8"
          max="19"
          step="0.5"
          value={simulatedHour}
          onChange={(e) => {
            setIsLiveTime(false);
            setSimulatedHour(parseFloat(e.target.value));
          }}
          className="custom-range-slider"
          style={{ width: '100%', accentColor: '#f59e0b' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '2px' }}>
          <span>아침 08시</span>
          <span>정오 12시</span>
          <span>오후 14시(최대일조)</span>
          <span>저녁 19시</span>
        </div>
      </div>

      {/* 4. 가중치 슬라이더 (그늘 선호도 α 또는 야간 CCTV 가중치) */}
      {mode === 'shade' && (
        <div className="slider-control-group" style={{ marginTop: '12px' }}>
          <div className="slider-label-row">
            <span className="slider-title">
              <Sliders size={13} color="#10b981" />
              <span>그늘 선호도 가중치 (α)</span>
            </span>
            <span className="slider-value-badge" style={{ color: '#10b981', borderColor: 'rgba(16,185,129,0.3)' }}>
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
            style={{ accentColor: '#10b981' }}
          />
          <div className="slider-endpoints">
            <span>최단 거리(0%)</span>
            <span>그늘 극대화 우회(100%)</span>
          </div>
        </div>
      )}

      {mode === 'night' && (
        <div className="slider-control-group" style={{ marginTop: '12px' }}>
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
            <span>CCTV 보호구역 우회(100%)</span>
          </div>
        </div>
      )}

      {/* 5. 안전 & 그늘 인프라 시각화 레이어 토글 */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Layers size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            시각화 레이어 설정
          </span>
        </div>

        <div className="layer-toggle-grid">
          {/* 3D 건물 그림자 레이어 (그늘로 핵심) */}
          <div className="toggle-item" onClick={() => toggleLayer('shadows')}>
            <div className={`toggle-info ${layers.shadows ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <Sun size={13} />
              </div>
              <div>
                <div>실시간 3D 건물 그림자 (그늘로 엔진)</div>
                <div style={{ fontSize: '10px', color: '#f59e0b', opacity: 0.85 }}>태양 고도/방위각 기반 투영 연산</div>
              </div>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.shadows}
                onChange={() => toggleLayer('shadows')}
              />
              <span className="switch-slider" />
            </label>
          </div>

          {/* 3D 건물 외곽 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('buildings')}>
            <div className={`toggle-info ${layers.buildings ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Building size={13} />
              </div>
              <div>
                <div>3D 건물 폴리곤 및 높이 데이터</div>
                <div style={{ fontSize: '10px', color: '#38bdf8', opacity: 0.85 }}>높이(H) 기반 그림자 길이 계산</div>
              </div>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.buildings}
                onChange={() => toggleLayer('buildings')}
              />
              <span className="switch-slider" />
            </label>
          </div>

          {/* 가로수 그늘 캐노피 레이어 */}
          <div className="toggle-item" onClick={() => toggleLayer('trees')}>
            <div className={`toggle-info ${layers.trees ? 'active' : ''}`}>
              <div className="toggle-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                <Trees size={13} />
              </div>
              <div>
                <div>가로수 그늘 캐노피 (보행로 차양)</div>
                <div style={{ fontSize: '10px', color: '#10b981', opacity: 0.85 }}>반경 4.5m 수목 자연 그늘</div>
              </div>
            </div>
            <label className="switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={layers.trees}
                onChange={() => toggleLayer('trees')}
              />
              <span className="switch-slider" />
            </label>
          </div>

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
