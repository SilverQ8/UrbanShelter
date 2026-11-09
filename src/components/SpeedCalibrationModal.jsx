import React, { useState, useEffect, useRef } from 'react';
import { X, Play, RotateCcw, Check, Footprints, AlertTriangle, Compass, Sparkles, Navigation, Timer } from 'lucide-react';

const TARGET_DISTANCE = 200; // 200m

// Haversine distance in meters
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SpeedCalibrationModal({ currentSpeed, onApply, onClose }) {
  // step: 'intro' (안내창) | 'measuring' (걷는 중) | 'done' (자동 측정완료 창)
  const [step, setStep] = useState('intro');

  // Measurements
  const [distance, setDistance] = useState(0); // in meters
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // total walking seconds
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0); // instant speed km/h

  // Tracking refs
  const lastPosRef = useRef(null);
  const watchIdRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Stop all tracking on unmount
  useEffect(() => {
    return () => {
      cleanupWatchers();
    };
  }, []);

  const cleanupWatchers = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // 200m 도달 시 자동으로 측정완료 창 팝업!
  useEffect(() => {
    if (distance >= TARGET_DISTANCE && step === 'measuring') {
      cleanupWatchers();
      setStep('done');
    }
  }, [distance, step]);

  // 실제 GPS 측정 시작
  const startRealMeasurement = () => {
    if (!navigator.geolocation) {
      alert('현재 기기에서 위치 서비스를 지원하지 않습니다.');
      return;
    }

    setDistance(0);
    setElapsedSeconds(0);
    setCurrentSpeedKmh(0);
    lastPosRef.current = null;
    setIsSimulating(false);
    setStep('measuring');

    // 시간 타이머 시작
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, speed } = pos.coords;
        const now = Date.now();

        // 오차 35m 이상인 부정확한 GPS 신호는 무시
        if (accuracy > 35) return;

        if (!lastPosRef.current) {
          lastPosRef.current = { lat: latitude, lng: longitude, time: now };
          return;
        }

        const dt = (now - lastPosRef.current.time) / 1000;
        if (dt < 0.8) return; // 0.8초 이상 간격

        const dDist = getHaversineDistance(
          lastPosRef.current.lat,
          lastPosRef.current.lng,
          latitude,
          longitude
        );

        // 순간 속도 계산 (km/h)
        let instantKmh = speed !== null && speed >= 0 ? speed * 3.6 : (dDist / dt) * 3.6;
        if (instantKmh < 0.2) instantKmh = 0;
        setCurrentSpeedKmh(parseFloat(instantKmh.toFixed(1)));

        // 200m 누적
        setDistance((prev) => {
          const next = Math.min(TARGET_DISTANCE, Math.round((prev + dDist) * 10) / 10);
          return next;
        });

        lastPosRef.current = { lat: latitude, lng: longitude, time: now };
      },
      (err) => {
        console.warn('GPS Error:', err);
        cleanupWatchers();
        setStep('intro');
        alert('GPS 위치를 확인할 수 없습니다. 스마트폰 위치 권한을 확인하고 야외에서 다시 시도해 주세요.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
    );
  };

  // 측정 취소 및 초기화
  const handleCancel = () => {
    cleanupWatchers();
    setDistance(0);
    setElapsedSeconds(0);
    setCurrentSpeedKmh(0);
    setStep('intro');
  };

  // 최종 계산 (m/분, km/h)
  const measuredSpeedMPerMin =
    elapsedSeconds > 0 ? Math.round((distance / elapsedSeconds) * 60) : 75;
  const measuredSpeedKmh =
    elapsedSeconds > 0 ? ((distance / elapsedSeconds) * 3.6).toFixed(1) : '4.5';

  const progressPercent = Math.min(100, Math.round((distance / TARGET_DISTANCE) * 100));

  const formatSec = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}분 ${String(s).padStart(2, '0')}초`;
  };

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="speed-cal-title">
      <div className="onboarding-card glass-panel speed-calibration-modal">
        {/* 헤더 */}
        <div className="settings-head" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="speed-cal-icon-wrap">
              <Footprints size={22} color="var(--accent-green, #10b981)" />
            </div>
            <div>
              <h2 id="speed-cal-title" className="onboarding-title" style={{ margin: 0, fontSize: '1.2rem' }}>
                내 걸음속도 측정 (200m)
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {step === 'done' ? '측정이 완료되었습니다!' : '200m를 걸어 나만의 정확한 도보 시간을 계산해요'}
              </p>
            </div>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {/* 1단계: 측정 전 안내창 */}
        {step === 'intro' && (
          <div className="speed-cal-intro-wrap">
            {/* 횡단보도 회피 핵심 안내 */}
            <div className="speed-cal-alert-card">
              <div className="speed-cal-alert-icon">
                <AlertTriangle size={20} color="#f59e0b" />
              </div>
              <div className="speed-cal-alert-body">
                <strong>가급적 횡단보도는 피해서 걸어주세요!</strong>
                <p>
                  신호 대기로 멈춰 서면 실제 걸음보다 느리게 측정될 수 있습니다.
                  <strong> 횡단보도가 없는 연속된 보도나 직선 보행로</strong>에서 평소 걸음대로 걸어주세요.
                </p>
              </div>
            </div>

            <div className="speed-cal-flow-info">
              <div className="speed-cal-flow-item">
                <span className="speed-cal-step-num">1</span>
                <span>아래 <strong>[측정 시작]</strong> 버튼을 누르고 평소대로 걷습니다.</span>
              </div>
              <div className="speed-cal-flow-item">
                <span className="speed-cal-step-num">2</span>
                <span>앱이 <strong>200m를 걸었다고 판단하면 자동으로 완료 창</strong>이 뜹니다.</span>
              </div>
            </div>

            <div className="speed-cal-actions" style={{ marginTop: '18px' }}>
              <button
                type="button"
                className="speed-cal-btn primary"
                onClick={startRealMeasurement}
              >
                <Play size={18} />
                횡단보도 피해서 200m 걷기 시작
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 200m 측정 진행 중 화면 */}
        {step === 'measuring' && (
          <div className="speed-cal-measuring-wrap">
            <div className="speed-cal-dashboard">
              {/* 진행률 바 */}
              <div className="speed-cal-progress-wrap">
                <div className="speed-cal-progress-meta">
                  <span className="speed-cal-dist-label">이동한 거리</span>
                  <span className="speed-cal-dist-value">
                    <strong>{distance.toFixed(0)}</strong> / {TARGET_DISTANCE}m
                  </span>
                </div>
                <div className="speed-cal-bar-track">
                  <div
                    className="speed-cal-bar-fill"
                    style={{
                      width: `${progressPercent}%`,
                      transition: 'width 0.8s ease'
                    }}
                  />
                </div>
                <div className="speed-cal-bar-foot">
                  <span>시작 (0m)</span>
                  <span className="speed-cal-pct">{progressPercent}%</span>
                  <span>완료 (200m)</span>
                </div>
              </div>

              {/* 안내 뱃지 */}
              <div className="speed-cal-status-row">
                <span className="speed-cal-badge walking">
                  <span className="pulse-dot green" />
                  200m 도달 시 자동으로 완료창이 뜹니다
                </span>
              </div>

              {/* 실시간 지표 */}
              <div className="speed-cal-metrics-grid">
                <div className="speed-cal-metric-card">
                  <span className="speed-cal-metric-title">현재 보행 속도</span>
                  <span className="speed-cal-metric-val">
                    {currentSpeedKmh} <small>km/h</small>
                  </span>
                </div>
                <div className="speed-cal-metric-card">
                  <span className="speed-cal-metric-title">걸은 시간</span>
                  <span className="speed-cal-metric-val">
                    {formatSec(elapsedSeconds)}
                  </span>
                </div>
                <div className="speed-cal-metric-card">
                  <span className="speed-cal-metric-title">남은 거리</span>
                  <span className="speed-cal-metric-val">
                    {Math.max(0, Math.round(TARGET_DISTANCE - distance))} <small>m</small>
                  </span>
                </div>
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px' }}>
              💡 스마트폰을 들고 평소 걷는 편안한 속도로 걸어주세요.
            </p>

            <button
              type="button"
              className="speed-cal-btn reset"
              onClick={handleCancel}
              style={{ width: '100%' }}
            >
              측정 취소하고 돌아가기
            </button>
          </div>
        )}

        {/* 3단계: 자동 팝업 측정 완료 창 */}
        {step === 'done' && (
          <div className="speed-cal-result-wrap">
            <div className="speed-cal-result-icon">
              <Sparkles size={38} color="#10b981" />
            </div>
            <h3 className="speed-cal-result-title">🎯 200m 보행 측정 완료!</h3>
            <p className="speed-cal-result-sub">
              200m를 걸어 측정한 나만의 실제 보행 속도입니다.
            </p>

            <div className="speed-cal-result-box">
              <div className="speed-cal-result-main">
                <span className="speed-cal-result-num">{measuredSpeedKmh}</span>
                <span className="speed-cal-result-unit">km/h</span>
              </div>
              <div className="speed-cal-result-detail">
                <span>분당 약 <strong>{measuredSpeedMPerMin}m</strong> 걷는 속도</span>
                <span className="speed-cal-result-time">
                  (200m 완보 시간: {formatSec(elapsedSeconds)})
                </span>
              </div>
            </div>

            <p className="speed-cal-compare-text">
              {measuredSpeedMPerMin > 75 ? (
                <>일반 성인 표준(4.5km/h)보다 <strong>약 {Math.round(((measuredSpeedMPerMin - 75) / 75) * 100)}% 빠릅니다!</strong> 길찾기 소요 시간이 알맞게 단축됩니다.</>
              ) : measuredSpeedMPerMin < 75 ? (
                <>일반 성인 표준(4.5km/h)보다 <strong>여유로운 걸음</strong>입니다. 지각하지 않도록 여유 있는 도착 시간을 안내해 드려요.</>
              ) : (
                <>일반 성인 표준(4.5km/h)과 <strong>완벽히 일치</strong>하는 표준 걸음걸이입니다.</>
              )}
            </p>

            <div className="speed-cal-result-actions">
              <button
                type="button"
                className="speed-cal-btn primary"
                onClick={() => {
                  onApply(measuredSpeedMPerMin, parseFloat(measuredSpeedKmh));
                  onClose();
                }}
              >
                <Check size={18} />
                내 맞춤 보행속도로 적용하기 ({measuredSpeedKmh}km/h)
              </button>
              <button
                type="button"
                className="speed-cal-btn secondary"
                onClick={handleCancel}
              >
                <RotateCcw size={16} />
                다시 측정하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
