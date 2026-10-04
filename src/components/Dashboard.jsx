import React from 'react';
import {
  Clock,
  Navigation,
  ShieldCheck,
  Umbrella,
  AlertTriangle,
  Info,
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
  const litRatioDiff = recommendedRoute.litRatio - standardRoute.litRatio;
  const coveredRatioDiff = recommendedRoute.coveredRatio - standardRoute.coveredRatio;
  const cctvDiff = recommendedRoute.cctvCount - standardRoute.cctvCount;

  return (
    <div className="glass-panel dashboard-card">
      {/* 3.1 대시보드 헤더 */}
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
              <span>야간 안심 추천 경로 (조명·CCTV 최적화)</span>
            </span>
          )}
          {mode === 'rain' && (
            <span className="route-type-badge badge-rain">
              <Umbrella size={13} />
              <span>우천 회피 추천 경로 (지하·아케이드 우선)</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          도보 속도 기준: 75m/분 (약 4.5km/h)
        </div>
      </div>

      {/* 3.1 비교 지표 그리드 (Metrics Comparison Grid) */}
      <div className="metrics-comparison-grid">
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
              <span className="comparison-warn">+{distDiff}m 우회</span>
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

        {/* 야간 안심 지수 (가로등 커버리지) */}
        <div className={`metric-box ${recommendedRoute.litRatio >= 85 ? 'green' : 'amber'}`}>
          <div className="metric-title">
            <ShieldCheck size={12} />
            <span>야간 안심 조명도</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{recommendedRoute.litRatio}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-comparison">
            {mode !== 'standard' && litRatioDiff > 0 ? (
              <span className="comparison-better">
                <TrendingUp size={11} style={{ display: 'inline' }} /> +{litRatioDiff}%p 향상 (CCTV {recommendedRoute.cctvCount}대)
              </span>
            ) : (
              <span className="comparison-neutral">
                CCTV {recommendedRoute.cctvCount}대 연계
              </span>
            )}
          </div>
        </div>

        {/* 우천 비가림 비율 */}
        <div className={`metric-box ${recommendedRoute.coveredRatio >= 50 ? 'green' : 'rose'}`}>
          <div className="metric-title">
            <Umbrella size={12} />
            <span>우천 비가림 비율</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{recommendedRoute.coveredRatio}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-comparison">
            {mode !== 'standard' && coveredRatioDiff > 0 ? (
              <span className="comparison-better">
                <TrendingUp size={11} style={{ display: 'inline' }} /> +{coveredRatioDiff}%p 지붕·지하 확보
              </span>
            ) : (
              <span className="comparison-neutral">
                {recommendedRoute.coveredRatio > 0 ? '일부 구간 비가림' : '전구간 지상 노출'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3.2 위험/주의 구간 안내 (Hazard & Caution Alerts) */}
      <div className="hazard-banner-list">
        {recommendedRoute.hazards && recommendedRoute.hazards.length > 0 ? (
          recommendedRoute.hazards.map((hz, idx) => (
            <div key={idx} className={`hazard-banner ${hz.severity}`}>
              <div className="hazard-content">
                <AlertTriangle size={15} />
                <span>{hz.message}</span>
              </div>
              <span style={{ fontSize: '0.7rem', opacity: 0.85, whiteSpace: 'nowrap' }}>
                주의 구간
              </span>
            </div>
          ))
        ) : (
          <div className="hazard-banner info">
            <div className="hazard-content">
              <CheckCircle2 size={15} />
              <span>
                {mode === 'night'
                  ? '위험 암흑 구간(Dead Zone) 없이 가로등 및 방범 CCTV가 확보된 안전 경로입니다.'
                  : mode === 'rain'
                  ? '비가림 아케이드 및 지하보도를 최대로 활용하여 쾌적하게 이동할 수 있습니다.'
                  : '물리적 최단 직선 경로입니다. 야간이나 우천 시에는 상단 탭에서 맞춤 경로를 확인하세요.'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
