import React, { useState } from 'react';
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
  Footprints,
  ChevronLeft,
  ChevronRight,
  Square
} from 'lucide-react';
import { formatDistance, formatDuration } from '../utils/format';

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
  isCar = false,
  onClose,
  liveStatus = 'off',
  nearDestination = false
}) {
  const [open, setOpen] = useState(true);
  const [activeIdx, setActiveIdx] = useState(null);

  const hasSteps = Array.isArray(steps) && steps.length > 0;
  // 걸음 수 추정: 느린 걸음(50m/분)은 보폭 0.5m, 보통 걸음은 0.7m 정도로 본다
  const stride = walkSpeed <= 50 ? 0.5 : 0.7;
  const stepCount = Math.round((totalDistance || 0) / stride);

  const currentStep = navigating && hasSteps ? steps[navIndex] : null;
  const nextStep = navigating && hasSteps ? steps[navIndex + 1] : null;

  const handleSelect = (idx, step) => {
    if (navigating) {
      onSelectNavStep?.(idx);
      return;
    }
    setActiveIdx(idx);
    if (step.point && onFocusStep) onFocusStep({ lat: step.point[0], lng: step.point[1], key: `${idx}-${Date.now()}` });
  };

  return (
    <aside className="glass-panel route-guide" aria-label="길 안내">
      <div className="route-guide-headrow">
        <button
          type="button"
          className="route-guide-header"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="route-guide-title">
            <ListOrdered size={16} />
            길 안내
          </span>
          <span className="route-guide-summary">
            {formatDistance(totalDistance)} · 약 {formatDuration(totalMinutes)}
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button type="button" className="route-guide-close" onClick={onClose} aria-label="길 안내 닫기" title="닫기">
          <X size={18} />
        </button>
      </div>

      {open && (
        <>
          {!isCar && <div className="route-guide-steps-count">👣 약 {stepCount.toLocaleString()}걸음</div>}

          {/* 탐색 시작 / 보행자 시점 안내 */}
          {hasSteps && !navigating && !isCar && (
            <div className="route-guide-startbar">
              <button type="button" className="route-guide-start" onClick={onStartNav}>
                <Footprints size={20} />
                보행자 시점으로 걷기
              </button>
            </div>
          )}

          {navigating && currentStep && (
            <div className="route-guide-nav">
              {nearDestination && (
                <div className="route-guide-arrival" role="status">
                  📍 목적지 이 주변이에요
                </div>
              )}
              <div className={`route-guide-live live-${liveStatus}`} role="status">
                {liveStatus === 'following' && '📡 내 위치를 따라가는 중'}
                {liveStatus === 'searching' && '📡 내 위치 확인 중…'}
                {liveStatus === 'off-route' && '⚠️ 경로에서 떨어져 있어요 · 아래 버튼으로 직접 넘겨 보세요'}
                {liveStatus === 'manual' && '위치를 쓸 수 없어요 · 아래 버튼으로 직접 넘겨 주세요'}
              </div>
              <div className="route-guide-nav-now">
                <span className="route-guide-nav-count">{navIndex + 1} / {steps.length}</span>
                <strong>{currentStep.text}</strong>
                {currentStep.name && <span>{currentStep.name}</span>}
                {currentStep.distance > 0 && (
                  <span className="route-guide-nav-dist">{formatDistance(currentStep.distance)} 걷기</span>
                )}
                {nextStep && <span className="route-guide-nav-next">다음: {nextStep.text}</span>}
              </div>
              <div className="route-guide-nav-buttons">
                <button
                  type="button"
                  onClick={() => onSelectNavStep?.(Math.max(0, navIndex - 1))}
                  disabled={navIndex === 0 || liveStatus === 'following'}
                  aria-label="이전 안내"
                >
                  <ChevronLeft size={22} /> 이전
                </button>
                <button
                  type="button"
                  onClick={() => onSelectNavStep?.(Math.min(steps.length - 1, navIndex + 1))}
                  disabled={navIndex >= steps.length - 1 || liveStatus === 'following'}
                  aria-label="다음 안내"
                >
                  다음 <ChevronRight size={22} />
                </button>
              </div>
              <button type="button" className="route-guide-stop" onClick={onStopNav}>
                <Square size={14} /> 탐색 종료
              </button>
            </div>
          )}

          {hasSteps ? (
            <ol className="route-guide-list">
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
                        <Icon size={22} strokeWidth={2.4} />
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
              상세 길 안내를 불러오지 못했어요. 네트워크 연결을 확인하고 출발·도착지를 다시 선택해 주세요.
            </div>
          )}
          {mode === 'shade' && hasSteps && (
            <div className="route-guide-note">안내는 보행로 기준이며, 그늘 경로는 같은 길 위에서 보정됩니다.</div>
          )}
        </>
      )}
    </aside>
  );
}
