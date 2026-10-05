import React from 'react';
import {
  Clock,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Video
} from 'lucide-react';

export default function Dashboard({
  mode,
  recommendedRoute,
  standardRoute
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

      {/* 비교 지표 그리드 (Metrics Comparison Grid) */}
      <div className="metrics-comparison-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {/* 이동 거리 */}
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

        {/* 소요 시간 및 우회 시간 */}
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

        {/* 경로상 방범 CCTV 연계 대수 */}
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

      {/* 위험/주의 구간 안내 (Hazard & Caution Alerts) */}
      <div className="hazard-banner-list">
        <div className="hazard-banner info">
          <div className="hazard-content">
            <CheckCircle2 size={15} />
            <span>
              {mode === 'night'
                ? `전국 방범 CCTV 공공데이터 기반으로 안전구역을 최대 경유하는 안심 도보 경로입니다 (CCTV ${recommendedRoute.cctvCount}대 연계).`
                : '물리적 최단 도로망 경로입니다. 야간 귀가 시에는 [야간 안심] 탭을 눌러 CCTV 밀집 경로를 확인하세요.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
