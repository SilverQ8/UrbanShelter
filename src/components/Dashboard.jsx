import React from 'react';
import {
  Clock,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Video,
  SunMedium,
  Sparkles
} from 'lucide-react';

export default function Dashboard({
  mode,
  recommendedRoute,
  standardRoute,
  sunPos
}) {
  if (!recommendedRoute || !standardRoute) {
    return (
      <div className="glass-panel dashboard-card">
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          경로를 계산할 수 없습니다. 출발지와 도착지를 다른 지점으로 선택해 주세요.
        </div>
      </div>
    );
  }

  // Differences between recommended route and baseline shortest
  const distDiff = recommendedRoute.totalDistance - standardRoute.totalDistance;
  const timeDiff = recommendedRoute.estimatedMinutes - standardRoute.estimatedMinutes;
  const cctvDiff = recommendedRoute.cctvCount - standardRoute.cctvCount;
  const shadeDiff = (recommendedRoute.shadeRatio || 0) - (standardRoute.shadeRatio || 0);

  return (
    <div className="glass-panel dashboard-card">
      {/* 대시보드 헤더 */}
      <div className="dashboard-header">
        <div className="route-badge-row">
          {mode === 'standard' && (
            <span className="route-type-badge badge-standard">
              <Navigation size={13} />
              <span>일반 최단 경로 (대조군 기준)</span>
            </span>
          )}
          {mode === 'shade' && (
            <span className="route-type-badge badge-rain" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              <SunMedium size={13} />
              <span>폭염 안심 그늘 경로 (그늘로 3D 태양광 시뮬레이션 적용)</span>
            </span>
          )}
          {mode === 'night' && (
            <span className="route-type-badge badge-night">
              <ShieldCheck size={13} />
              <span>야간 안심 추천 경로 (전국 방범 CCTV 안전구역 연계)</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          도보 속도 기준: 75m/분 (약 4.5km/h)
        </div>
      </div>

      {/* 비교 지표 그리드 (4-Column Comparison Grid) */}
      <div className="metrics-comparison-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* 1. 이동 거리 */}
        <div className="metric-box">
          <div className="metric-title">
            <Navigation size={12} />
            <span>총 이동 거리</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{recommendedRoute.totalDistance.toLocaleString()}</span>
            <span className="metric-unit">m</span>
          </div>
          <div className="metric-comparison">
            {distDiff === 0 ? (
              <span className="comparison-neutral">최단 거리 동일</span>
            ) : distDiff > 0 ? (
              <span className="comparison-warn">+{distDiff}m 안전 우회</span>
            ) : (
              <span className="comparison-better">{distDiff}m 단축</span>
            )}
          </div>
        </div>

        {/* 2. 소요 시간 */}
        <div className="metric-box">
          <div className="metric-title">
            <Clock size={12} />
            <span>예상 소요 시간</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{recommendedRoute.estimatedMinutes}</span>
            <span className="metric-unit">분</span>
          </div>
          <div className="metric-comparison">
            {timeDiff === 0 ? (
              <span className="comparison-neutral">추가 시간 없음</span>
            ) : timeDiff > 0 ? (
              <span className="comparison-warn">+{timeDiff}분 우회 소요</span>
            ) : (
              <span className="comparison-better">{timeDiff}분 절약</span>
            )}
          </div>
        </div>

        {/* 3. 그늘 보행 비율 & 직사광선 회피 (그늘로 핵심 지표) */}
        <div className={`metric-box ${recommendedRoute.shadeRatio >= 60 ? 'green' : 'amber'}`}>
          <div className="metric-title">
            <SunMedium size={12} color="#10b981" />
            <span>그늘 보행 비율</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value" style={{ color: '#10b981' }}>{recommendedRoute.shadeRatio || 0}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-comparison">
            {mode === 'shade' && shadeDiff > 0 ? (
              <span className="comparison-better">
                <TrendingUp size={11} style={{ display: 'inline' }} /> +{shadeDiff}% 그늘 증가 (땡볕 {recommendedRoute.exposedDistance}m 최소화)
              </span>
            ) : (
              <span className="comparison-neutral">
                땡볕 노출 {recommendedRoute.exposedDistance || 0}m
              </span>
            )}
          </div>
        </div>

        {/* 4. 경로상 방범 CCTV 연계 대수 */}
        <div className={`metric-box ${recommendedRoute.cctvCount > 0 ? 'green' : 'amber'}`}>
          <div className="metric-title">
            <Video size={12} />
            <span>경로상 방범 CCTV</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{recommendedRoute.cctvCount}</span>
            <span className="metric-unit">대</span>
          </div>
          <div className="metric-comparison">
            {mode === 'night' && cctvDiff > 0 ? (
              <span className="comparison-better">
                <TrendingUp size={11} style={{ display: 'inline' }} /> +{cctvDiff}대 추가 안전 확보
              </span>
            ) : (
              <span className="comparison-neutral">
                {recommendedRoute.cctvCount > 0 ? '실시간 공공 CCTV 연계' : 'CCTV 미탐지 구간'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 상황별 맞춤 안내 배너 */}
      <div className="hazard-banner-list">
        <div className="hazard-banner info">
          <div className="hazard-content">
            {mode === 'shade' ? (
              <SunMedium size={16} color="#10b981" />
            ) : mode === 'night' ? (
              <ShieldCheck size={16} color="#38bdf8" />
            ) : (
              <CheckCircle2 size={16} color="var(--accent-cyan)" />
            )}
            <span>
              {mode === 'shade'
                ? `☀️ [그늘로 폭염 안심]: 태양 고도(${sunPos?.altitudeDeg || 65}°)와 3D 건물 그림자를 실시간 시뮬레이션하여 ${recommendedRoute.shadedDistance}m(${recommendedRoute.shadeRatio}%)를 그늘로 보행합니다. 체감 온도 약 2.5℃ 저감 및 자외선 노출을 대폭 줄여줍니다.`
                : mode === 'night'
                ? `🌙 [야간 안심 경로]: 전국 실시간 방범 CCTV 공공데이터 기반으로 안전구역을 최대 경유하는 안심 도보 경로입니다 (CCTV ${recommendedRoute.cctvCount}대 연계).`
                : '🧭 [일반 최단 경로]: 물리적 최단 도로망 경로입니다. 한여름 한낮에는 [폭염 그늘], 야간에는 [야간 안심] 탭을 눌러 특화 경로를 확인하세요.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
