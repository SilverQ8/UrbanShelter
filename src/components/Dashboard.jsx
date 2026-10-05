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
import { formatDistance, formatDistanceParts, formatDuration, formatDurationParts } from '../utils/format';

export default function Dashboard({
  mode,
  recommendedRoute,
  standardRoute,
  sunPos,
  walkSpeed = 75,
  shadeInfo = '',
  isCar = false
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
          {mode === 'standard' && (
            <span className="route-type-badge badge-standard">
              <Navigation size={13} />
              <span>{isCar ? '차량 기준 경로' : '가장 짧은 도보 경로 (비교 기준)'}</span>
            </span>
          )}
          {mode === 'shade' && (
            <span className="route-type-badge badge-rain" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              <SunMedium size={13} />
              <span>폭염 안심 그늘 경로 (실시간 태양 위치 및 건물 그늘 분석)</span>
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
          {isCar ? '자동차 도로 기준 · 소요 시간은 평균 주행 속도로 계산' : `도보 속도 기준: ${walkSpeed}m/분 (약 ${(walkSpeed * 0.06).toFixed(1)}km/h)`}
          {!isCar && shadeInfo && <div>그림자 계산: {shadeInfo}</div>}
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
        <div className={`metric-box ${isNight ? '' : (recommendedRoute.shadeRatio >= 60 ? 'green' : 'amber')}`}>
          <div className="metric-title">
            <SunMedium size={12} color={isNight ? 'var(--text-muted)' : '#10b981'} />
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
                <span className="metric-value" style={{ color: '#10b981' }}>{recommendedRoute.shadeRatio ?? 0}</span>
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
            ) : mode === 'night' ? (
              <ShieldCheck size={16} color="#38bdf8" />
            ) : (
              <CheckCircle2 size={16} color="var(--accent-cyan)" />
            )}
            <span>
              {mode === 'shade'
                ? `☀️ [폭염 안심 그늘]: 현재 태양 고도(${sunPos?.altitudeDeg || 65}°)와 주변 건물 그늘을 분석하여 ${formatDistance(recommendedRoute.shadedDistance)}${recommendedRoute.shadeRatio != null ? `(${recommendedRoute.shadeRatio}%)` : ''}를 그늘로 보행합니다. 체감 온도 저감 및 자외선 노출을 최소화합니다.`
                : mode === 'night'
                ? `🌙 [야간 안심 경로]: 전국 실시간 방범 CCTV 공공데이터 기반으로 안전구역을 최대 경유하는 안심 도보 경로입니다 (CCTV ${recommendedRoute.cctvCount}대 연계).`
                : isCar
                ? '🚗 [차량 기준]: 자동차가 다닐 수 있는 도로를 따라가는 경로입니다. 걸어갈 때는 설정에서 [도보(보도 기준)]로 바꿔 주세요.'
                : '🧭 [가장 짧은 길]: 걸어서 갈 수 있는 가장 짧은 보행 경로입니다. 한여름 한낮에는 [폭염 그늘], 야간에는 [야간 안심] 탭을 눌러 특화 경로를 확인하세요.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
