import React from 'react';
import {
  Clock,
  Navigation,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Video,
  SunMedium,
  Sparkles,
  CloudRain
} from 'lucide-react';
import { formatDistance, formatDistanceParts, formatDuration, formatDurationParts } from '../utils/format';

export default function Dashboard({
  mode,
  recommendedRoute,
  standardRoute,
  sunPos,
  walkSpeed = 75,
  shadeInfo = '',
  isCar = false,
  travelMode = 'foot'
}) {
  if (!recommendedRoute || !standardRoute) {
    return null;
  }

  // Differences between recommended route and baseline shortest
  const distDiff = recommendedRoute.totalDistance - standardRoute.totalDistance;
  const totalDistParts = formatDistanceParts(recommendedRoute.totalDistance);
  const totalTimeParts = formatDurationParts(recommendedRoute.estimatedMinutes);
  const timeDiff = recommendedRoute.estimatedMinutes - standardRoute.estimatedMinutes;
  const isNight = !sunPos?.isDaylight || recommendedRoute.shadeRatio === null;
  const shadeDiff = (!isNight && typeof recommendedRoute.shadeRatio === 'number' && typeof standardRoute.shadeRatio === 'number')
    ? recommendedRoute.shadeRatio - standardRoute.shadeRatio
    : 0;
  const cctvDiff = (recommendedRoute.cctvCount || 0) - (standardRoute.cctvCount || 0);

  return (
    <div className="glass-panel dashboard-card">
      {/* 대시보드 헤더 */}
      <div className="dashboard-header">
        <div className="route-badge-row">
          {travelMode === 'transit' ? (
            <span className="route-type-badge badge-transit">
              <Navigation size={13} />
              <span>대중교통 최적 경로 (TMAP 실시간 지하철·버스 노선 연동)</span>
            </span>
          ) : (
            <>
              {mode === 'standard' && (
                <span className="route-type-badge badge-standard">
                  <Navigation size={13} />
                  <span>{isCar ? '차량 기준 경로' : '가장 짧은 도보 경로 (비교 기준)'}</span>
                </span>
              )}
              {mode === 'shade' && (
                <span className="route-type-badge badge-shade">
                  <SunMedium size={13} />
                  <span>폭염 안심 그늘 경로 (실시간 태양 위치 및 건물 그늘 분석)</span>
                </span>
              )}
              {mode === 'rain' && (
                <span className="route-type-badge badge-standard">
                  <CloudRain size={13} />
                  <span>악천후 안심 경로 (눈·비를 차단하는 지붕 길·지하 통로·지하철 출입구 경유)</span>
                </span>
              )}
              {mode === 'night' && (
                <span className="route-type-badge badge-night">
                  <ShieldCheck size={13} />
                  <span>야간 안심 추천 경로 (전국 방범 CCTV 안전구역 연계)</span>
                </span>
              )}
            </>
          )}
        </div>

        <div className="dashboard-subtext">
          {travelMode === 'transit'
            ? '실시간 대중교통 배차 및 정류장 기준 · 첫/마지막 도보 구간은 보행자 맞춤 안내'
            : isCar
            ? '자동차 도로 기준 · 소요 시간은 평균 주행 속도로 계산'
            : `도보 속도 기준: ${walkSpeed}m/분 (약 ${(walkSpeed * 0.06).toFixed(1)}km/h)`}
          {!isCar && travelMode !== 'transit' && shadeInfo && <div>그림자 계산: {shadeInfo}</div>}
        </div>
      </div>

      {/* 비교 지표 그리드 (4-Column Comparison Grid) */}
      <div className="metrics-comparison-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {/* 1. 이동 거리 */}
        <div className="metric-box">
          <div className="metric-title">
            <Navigation size={12} />
            <span>총 이동 거리</span>
          </div>
          <div className="metric-value-wrap">
            <span className="metric-value">{totalDistParts.value}</span>
            <span className="metric-unit">{totalDistParts.unit}</span>
          </div>
          <div className="metric-comparison">
            {distDiff === 0 ? (
              <span className="comparison-neutral">최단 거리 동일</span>
            ) : distDiff > 0 ? (
              <span className="comparison-warn">+{formatDistance(distDiff)} 안전 우회</span>
            ) : (
              <span className="comparison-better">{formatDistance(distDiff)} 단축</span>
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
            <span className="metric-value">{totalTimeParts.value}</span>
            <span className="metric-unit">{totalTimeParts.unit}</span>
          </div>
          <div className="metric-comparison">
            {timeDiff === 0 ? (
              <span className="comparison-neutral">추가 시간 없음</span>
            ) : timeDiff > 0 ? (
              <span className="comparison-warn">+{formatDuration(timeDiff)} 우회 소요</span>
            ) : (
              <span className="comparison-better">{formatDuration(Math.abs(timeDiff))} 절약</span>
            )}
          </div>
        </div>

        {!isCar && (<>
        {/* 3. 그늘 보행 비율 & 직사광선 회피 */}
        {mode === 'rain' ? (
          <div className={`metric-box ${recommendedRoute.rainCoverRatio >= 30 ? 'green' : 'amber'}`}>
            <div className="metric-title">
              <CloudRain size={12} />
              <span>눈·비 차단 비율</span>
            </div>
            <div className="metric-value-wrap">
              <span className="metric-value">{recommendedRoute.rainCoverRatio ?? 0}</span>
              <span className="metric-unit">%</span>
            </div>
            <div className="metric-comparison">
              <span className="comparison-neutral">노출 {formatDistance(recommendedRoute.rainExposedDistance ?? 0)}</span>
            </div>
          </div>
        ) : (
        <div className={`metric-box ${isNight ? '' : (recommendedRoute.shadeRatio >= 60 ? 'green' : 'amber')}`}>
          <div className="metric-title">
            <SunMedium size={12} className={isNight ? 'metric-icon-muted' : 'metric-icon-sun'} />
            <span>그늘 보행 비율</span>
          </div>
          <div className="metric-value-wrap">
            {isNight ? (
              <>
                <span className="metric-value" style={{ color: 'var(--text-muted)', fontSize: '1.25rem' }}>-</span>
                <span className="metric-unit" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>일몰 후</span>
              </>
            ) : (
              <>
                <span className="metric-value metric-value-green">{recommendedRoute.shadeRatio ?? 0}</span>
                <span className="metric-unit">%</span>
              </>
            )}
          </div>
          <div className="metric-comparison">
            {isNight ? (
              <span className="comparison-neutral">
                야간에는 햇빛 직사광선이 없습니다
              </span>
            ) : mode === 'shade' && shadeDiff > 0 ? (
              <span className="comparison-better">
                <TrendingUp size={11} style={{ display: 'inline' }} /> +{shadeDiff}% 그늘 증가 (땡볕 {formatDistance(recommendedRoute.exposedDistance)} 최소화)
              </span>
            ) : (
              <span className="comparison-neutral">
                땡볕 노출 {formatDistance(recommendedRoute.exposedDistance)}
              </span>
            )}
          </div>
        </div>
        )}

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
        </>)}
      </div>

      {/* 상황별 맞춤 안내 배너 */}
      <div className="hazard-banner-list">
        <div className="hazard-banner info">
          <div className="hazard-content">
            {mode === 'shade' ? (
              <SunMedium size={16} color="#10b981" />
            ) : mode === 'rain' ? (
              <CloudRain size={16} color="#2563eb" />
            ) : mode === 'night' ? (
              <ShieldCheck size={16} color="#38bdf8" />
            ) : (
              <CheckCircle2 size={16} className="hazard-icon-check" />
            )}
            <span>
              {mode === 'shade'
                ? `☀️ 그늘 ${formatDistance(recommendedRoute.shadedDistance)}${recommendedRoute.shadeRatio != null ? ` (${recommendedRoute.shadeRatio}%)` : ''}`
                : mode === 'rain'
                ? `☂️ 눈·비 차단 ${recommendedRoute.rainCoverRatio ?? 0}% (${formatDistance(recommendedRoute.rainCoveredDistance ?? 0)}) · 노출 ${formatDistance(recommendedRoute.rainExposedDistance ?? 0)}${recommendedRoute.undergroundDistance ? ` · 지하 통로 ${formatDistance(recommendedRoute.undergroundDistance)} 포함` : ''}`
                : mode === 'night'
                ? `🌙 CCTV ${recommendedRoute.cctvCount}대 · 가로등 ${recommendedRoute.streetlightCount || 0}개 · 조명 ${recommendedRoute.lightCoverageRatio || 85}%`
                : isCar
                ? '🚗 차량 기준 경로'
                : '🧭 가장 짧은 길'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
