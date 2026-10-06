import React from 'react';

// 2D(Leaflet)·3D(MapLibre) 지도가 함께 쓰는 화면 위 표시들.
// 두 지도에서 같은 모양으로 보이도록 한곳에서 관리한다.

/** 그늘 경로의 초록/주황 구간 색 안내 */
export function ShadeLegend() {
  return (
    <div style={{
      position: 'absolute',
      bottom: '24px',
      left: '20px',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.12)',
      borderRadius: '10px',
      padding: '8px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      pointerEvents: 'auto',
      fontSize: '0.74rem'
    }}>
      <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)' }}>
        보행로 일조/그늘 상태 구분
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '22px', height: '5px', borderRadius: '3px', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }}></span>
        <span style={{ color: '#34d399', fontWeight: 600 }}>시원한 그늘 구간 (초록)</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '22px', height: '4px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }}></span>
        <span style={{ color: '#fbbf24', fontWeight: 600 }}>직사광선 땡볕 구간 (주황)</span>
      </div>
    </div>
  );
}

/** 태양 방위와 고도, 자외선 상태 */
export function SunDial({ sunPos }) {
  if (!sunPos) return null;
  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '54px',
      zIndex: 1000,
      background: 'rgba(15, 23, 42, 0.90)',
      backdropFilter: 'blur(12px)',
      border: '1.5px solid rgba(245, 158, 11, 0.4)',
      borderRadius: '12px',
      padding: '8px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      pointerEvents: 'auto'
    }}>
      {/* Rotating Sun Direction Dial */}
      <div style={{
        position: 'relative',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.20)',
        border: '2px solid #f59e0b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 12px rgba(245,158,11,0.5)'
      }}>
        <div style={{
          transform: `rotate(${sunPos.azimuthDeg}deg)`,
          transition: 'transform 0.15s ease-out',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '11px', lineHeight: 1 }}>☀️</span>
          <span style={{ width: '2.5px', height: '8px', background: '#f59e0b', borderRadius: '1px' }}></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>
            태양 고도 {sunPos.altitudeDeg}°
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            방위 {sunPos.azimuthDeg}°
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: sunPos.uvEstimate >= 7 ? '#f43f5e' : '#34d399', fontWeight: 700 }}>
          {sunPos.sunStatus} (자외선 {sunPos.uvEstimate})
        </div>
      </div>
    </div>
  );
}

const COUNTER_KINDS = {
  cctv: {
    extraClass: '',
    dotClass: 'live-dot-pulse',
    hint: '🔍 지도를 확대하면(골목·거리 축척) 해당 지역의 방범 CCTV가 표시됩니다',
    label: (count) => (<>현재 화면 내 방범 CCTV <strong>{count}</strong>개소 안전보호구역 작동 중</>)
  },
  streetlight: {
    extraClass: 'map-streetlight-counter-pill',
    dotClass: 'live-dot-pulse-amber',
    hint: '🔍 지도를 확대하면(골목·거리 축척) 가로등/보안등(15m 조명반경)이 표시됩니다',
    label: (count) => (<>현재 화면 내 가로등/보안등 <strong>{count}</strong>개소 (15m 안심조도 작동 중)</>)
  },
  tree: {
    extraClass: 'map-tree-counter-pill',
    dotClass: 'live-dot-pulse-emerald',
    hint: '🔍 지도를 확대하면(골목·거리 축척) 가로수 그늘 캐노피가 표시됩니다',
    label: (count) => (<>현재 화면 내 가로수 그늘 <strong>{count}</strong>그루 작동 중</>)
  }
};

/** 화면 안 CCTV·가로등·가로수 개수. 축척이 낮으면 확대 안내를 보여준다. */
export function CounterPill({ kind, count, isZoomTooLow }) {
  const cfg = COUNTER_KINDS[kind];
  return (
    <div className={`map-cctv-counter-pill ${cfg.extraClass} ${isZoomTooLow ? 'zoom-hint' : ''}`}>
      {isZoomTooLow ? (
        <span>{cfg.hint}</span>
      ) : (
        <>
          <span className={cfg.dotClass}></span>
          <span>{cfg.label(count)}</span>
        </>
      )}
    </div>
  );
}
