import React from 'react';
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Undo2,
  Flag,
  MapPin,
  ChevronLeft,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { formatDistance } from '../utils/format';

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

export default function NavTopBanner({
  step,
  nextStep,
  startPoint,
  targetPoint,
  onStopNav,
  voiceOn = true,
  onToggleVoice
}) {
  if (!step) return null;

  const IconComponent = ICONS[step.icon] || ArrowUp;
  const startName = startPoint?.name || startPoint?.roadAddress || '출발지';
  const targetName = targetPoint?.name || targetPoint?.roadAddress || '도착지';

  return (
    <div className="nav-top-banner" role="region" aria-label="실시간 길안내 상단 안내바">
      <div className="nav-top-banner-header">
        <button
          type="button"
          className="nav-top-btn nav-top-back"
          onClick={onStopNav}
          aria-label="길안내 종료"
          title="안내 종료"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="nav-top-route-title">
          <span className="nav-dot-start">●</span>
          <span className="nav-point-name">{startName}</span>
          <span className="nav-arrow">➔</span>
          <span className="nav-dot-target">●</span>
          <span className="nav-point-name">{targetName}</span>
        </div>

        {onToggleVoice && (
          <button
            type="button"
            className="nav-top-btn nav-top-voice"
            onClick={onToggleVoice}
            aria-label={voiceOn ? '음성 안내 끄기' : '음성 안내 켜기'}
            title={voiceOn ? '음성 안내 켜짐' : '음성 안내 꺼짐'}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        )}
      </div>

      <div className="nav-top-banner-body">
        <div className="nav-turn-badge">
          <IconComponent size={28} strokeWidth={2.6} />
          {step.distance > 0 && (
            <span className="nav-turn-distance">{formatDistance(step.distance)}</span>
          )}
        </div>

        <div className="nav-turn-info">
          <strong className="nav-turn-instruction">{step.text}</strong>
          {step.name && <span className="nav-turn-road">{step.name} 방면</span>}
        </div>
      </div>

      {nextStep && (
        <div className="nav-top-banner-footer">
          <span className="nav-next-badge">다음</span>
          <span className="nav-next-text">{nextStep.text}</span>
        </div>
      )}
    </div>
  );
}

