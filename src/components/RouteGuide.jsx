import React, { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Undo2,
  Flag,
  MapPin,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  X,
  ChevronLeft,
  ChevronRight,
  Square,
  Volume2,
  VolumeX,
  RotateCw,
  Clock,
  Navigation
} from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';
import { speakGuide, isTtsEnabled, toggleTts } from '../utils/ttsService';
import { SPEED_LEVELS, getAllSpeedLevels } from '../utils/profile';

const ICONS = {
  depart: MapPin,
  arrive: Flag,
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  'slight-left': ArrowUpLeft,
  'slight-right': ArrowUpRight,
  uturn: Undo2
};

export default function RouteGuide({
  steps,
  totalDistance,
  totalMinutes,
  onFocusStep,
  mode,
  navigating = false,
  navIndex = 0,
  onStartNav,
  onStopNav,
  onSelectNavStep,
  walkSpeed = 75,
  onChangeWalkSpeed,
  isCar = false,
  onClose,
  liveStatus = 'off',
  nearDestination = false,
  onReroute
}) {
  // 길안내(내비게이션) 중에는 기본적으로 하단으로 접혀(collapsed) 지도 화면을 시원하게 보여준다
  const [isCollapsed, setIsCollapsed] = useState(Boolean(navigating));
  const [activeIdx, setActiveIdx] = useState(null);
  const [voiceOn, setVoiceOn] = useState(isTtsEnabled());
  const [currentTime, setCurrentTime] = useState(() => new Date());

  // 길안내 시작 시 자동으로 하단으로 접힘
  useEffect(() => {
    if (navigating) {
      setIsCollapsed(true);
    }
  }, [navigating]);

  // 실시간 예상 도착 시각(ETA)을 위해 매 초마다 현재 시각을 갱신
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasSteps = Array.isArray(steps) && steps.length > 0;
  // 남은 거리 및 실시간 남은 소요 시간 계산
  const remainingDistance = navigating && hasSteps
    ? steps.slice(navIndex).reduce((sum, s) => sum + (s.distance || 0), 0)
    : (totalDistance || 0);
  const remainingMinutes = Math.max(1, Math.round(remainingDistance / (walkSpeed || 75)));

  // 예상 도착 시각
  const etaDate = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000);
  const formatEta = (d) => {
    let h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? '오후' : '오전';
    h = h % 12;
    if (h === 0) h = 12;
    const mStr = String(m).padStart(2, '0');
    return `${ampm} ${h}:${mStr}`;
  };
  const etaText = formatEta(etaDate);

  const currentStep = navigating && hasSteps ? steps[navIndex] : null;

  // 음성 안내 토글
  const handleToggleVoice = (e) => {
    e.stopPropagation();
    const next = toggleTts();
    setVoiceOn(next);
    if (next) speakGuide('음성 안내를 켭니다.');
  };

  // 단계 변경 시 자동 음성 안내
  useEffect(() => {
    if (navigating && currentStep) {
      let speechText = navIndex === 0 ? '길안내를 시작합니다. ' : '';
      if (currentStep.distance > 0) speechText += `${formatDistance(currentStep.distance)} 앞, `;
      speechText += currentStep.text;
      if (currentStep.name) speechText += `, ${currentStep.name} 방면`;
      speakGuide(speechText);
    }
  }, [navIndex, navigating]);

  // 목적지 부근 도착 시 안내
  useEffect(() => {
    if (navigating && nearDestination) {
      speakGuide('목적지 부근에 도착했습니다. 안내를 종료합니다.');
    }
  }, [nearDestination, navigating]);

  const handleSelect = (idx, step) => {
    if (navigating) {
      onSelectNavStep?.(idx);
      return;
    }
    setActiveIdx(idx);
    if (step.point && onFocusStep) onFocusStep({ lat: step.point[0], lng: step.point[1], key: `${idx}-${Date.now()}` });
  };

  return (
    <aside className={`glass-panel route-guide ${isCollapsed ? 'is-collapsed' : 'is-expanded'}`} aria-label="길안내">
      {/* 바텀시트 슬라이드 핸들 바 */}
      <div
        className="route-guide-drag-handle"
        onClick={() => setIsCollapsed((v) => !v)}
        role="button"
        tabIndex={0}
        title={isCollapsed ? '상세 길안내 펼치기' : '요약 보기로 접기'}
        aria-label={isCollapsed ? '상세 길안내 펼치기' : '요약 보기로 접기'}
      >
        <div className="route-guide-handle-pill" />
      </div>

      {isCollapsed ? (
        /* 1. 요약 모드 (축소 상태): 우상단에서 한눈에 보는 초슬림 요약 바 */
        <div
          className="route-guide-collapsed-bar"
          onClick={() => setIsCollapsed(false)}
          role="button"
          tabIndex={0}
          title="클릭하여 상세 길안내 펼치기"
        >
          <div className="collapsed-time-info">
            <span className="collapsed-duration">
              약 {formatDuration(totalMinutes || remainingMinutes)}
            </span>
            <span className="collapsed-divider">·</span>
            <span className="collapsed-distance">
              {formatDistance(remainingDistance)}
            </span>
            <span className="collapsed-divider">·</span>
            <span className="collapsed-eta">
              {etaText} 도착
            </span>
          </div>

          <div className="collapsed-actions">
            <button
              type="button"
              className="collapsed-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(false);
              }}
              title="상세 목록 펼치기"
            >
              <span>상세보기</span>
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="route-guide-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              aria-label="닫기"
              title="닫기"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* 2. 펼쳐진 상태: 화면을 가리지 않도록 콤팩트하게 압축된 상세 정보 */
        <>
          <div className="route-guide-headrow">
            <button
              type="button"
              className="route-guide-header"
              onClick={() => setIsCollapsed(true)}
              aria-expanded={!isCollapsed}
              title="요약 보기로 접기"
            >
              <span className="route-guide-title">
                <ListOrdered size={16} />
                길안내
              </span>
              <span className="route-guide-summary">
                {etaText} 도착 · {formatDistance(remainingDistance)}
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="route-guide-close route-guide-collapse-trigger"
                onClick={() => setIsCollapsed(true)}
                aria-label="요약 보기로 접기"
                title="요약 보기로 접기"
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                className="route-guide-close"
                onClick={handleToggleVoice}
                aria-label={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
                title={voiceOn ? '음성 안내 켜짐' : '음성 안내 꺼짐'}
                style={{ color: voiceOn ? '#34d399' : '#94a3b8' }}
              >
                {voiceOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button type="button" className="route-guide-close" onClick={onClose} aria-label="길안내 닫기" title="닫기">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* 길안내 중일 때 실시간 ETA 및 조작 바 */}
          {navigating && currentStep && (
            <div className="compact-nav-wrapper">
              <div className="compact-eta-row">
                <div className="compact-eta-time">
                  <strong>{etaText}</strong> 도착
                  <span className="compact-eta-rem"> (약 {formatDuration(remainingMinutes)} · {formatDistance(remainingDistance)})</span>
                </div>

                {!isCar && onChangeWalkSpeed && (
                  <div className="compact-speed-group">
                    {getAllSpeedLevels().map((lvl) => {
                      const isActive = walkSpeed === lvl.speed;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          className={`compact-speed-btn ${isActive ? 'active' : ''}`}
                          onClick={() => onChangeWalkSpeed(lvl.speed)}
                          title={lvl.desc}
                        >
                          {lvl.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {nearDestination && (
                <div className="route-guide-arrival" role="status">
                  📍 목적지 이 주변이에요
                </div>
              )}

              {/* 이전 / 다음 / 단계 수 / 안내 종료 한 줄 바 */}
              <div className="compact-nav-controls">
                <button
                  type="button"
                  className="compact-nav-btn"
                  onClick={() => onSelectNavStep?.(Math.max(0, navIndex - 1))}
                  disabled={navIndex === 0 || liveStatus === 'following'}
                  aria-label="이전 안내"
                >
                  <ChevronLeft size={16} /> 이전
                </button>
                <span className="compact-step-counter">
                  {navIndex + 1} / {steps.length} 단계
                </span>
                <button
                  type="button"
                  className="compact-nav-btn"
                  onClick={() => onSelectNavStep?.(Math.min(steps.length - 1, navIndex + 1))}
                  disabled={navIndex >= steps.length - 1 || liveStatus === 'following'}
                  aria-label="다음 안내"
                >
                  다음 <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="compact-nav-stop-btn"
                  onClick={onStopNav}
                  title="길안내 종료"
                >
                  <Square size={12} /> 안내종료
                </button>
              </div>
            </div>
          )}

          {/* 길안내 시작 버튼 (안내 중이 아닐 때만 노출) */}
          {hasSteps && !navigating && (
            <div className="route-guide-startbar">
              <button
                type="button"
                className="route-guide-start"
                onClick={() => {
                  onStartNav();
                  speakGuide(mode === 'transit' ? '대중교통 길안내를 시작합니다.' : isCar ? '차량 길안내를 시작합니다.' : '도보 길안내를 시작합니다.');
                }}
              >
                <Navigation size={16} />
                길안내 시작
              </button>
            </div>
          )}

          {/* 스크롤 가능한 단계 목록 */}
          {hasSteps ? (
            <ol className="route-guide-list compact-step-list">
              {steps.map((step, idx) => {
                const Icon = ICONS[step.icon] || ArrowUp;
                const isEdge = step.icon === 'depart' || step.icon === 'arrive';
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      className={`route-guide-step ${(navigating ? navIndex : activeIdx) === idx ? 'active' : ''} ${isEdge ? 'edge' : ''}`}
                      onClick={() => handleSelect(idx, step)}
                    >
                      <span className="route-guide-icon">
                        <Icon size={18} strokeWidth={2.4} />
                      </span>
                      <span className="route-guide-text">
                        <strong>{step.text}</strong>
                        {step.name && <span className="route-guide-road">{step.name}</span>}
                      </span>
                      {step.distance > 0 && (
                        <span className="route-guide-dist">{formatDistance(step.distance)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="route-guide-empty">
              상세 길안내를 불러오지 못했어요.
            </div>
          )}
        </>
      )}
    </aside>
  );
}
