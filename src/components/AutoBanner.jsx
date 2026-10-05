import React from 'react';
import { MODE_LABELS } from '../utils/autoRouting';

const MODE_EMOJI = { standard: '🧭', shade: '☀️', night: '🌙' };

export default function AutoBanner({ weather, mode, isAuto, reason, onResetAuto, isCar = false }) {
  if (isCar) {
    return (
      <div className="glass-panel auto-banner" role="status">
        <span className="auto-banner-icon" aria-hidden="true">🚗</span>
        <div className="auto-banner-text">
          <strong>차량 기준 길찾기</strong>
          <span>그늘·안심 경로는 걷는 길 기준 기능이라 차량에서는 쓰지 않아요</span>
        </div>
      </div>
    );
  }

  const emoji = weather?.isRaining ? '🌧️' : weather?.isSnowing ? '❄️' : MODE_EMOJI[mode];

  return (
    <div className="glass-panel auto-banner" role="status" aria-live="polite">
      <span className="auto-banner-icon" aria-hidden="true">{emoji}</span>
      <div className="auto-banner-text">
        <strong>
          {weather
            ? `${weather.label} ${Math.round(weather.temperature)}°C (체감 ${Math.round(weather.apparent)}°C)`
            : '날씨 확인 중'}
          {' · '}
          {MODE_LABELS[mode]}
        </strong>
        <span>{isAuto ? reason : '직접 고른 경로 방식으로 안내 중이에요'}</span>
      </div>
      {!isAuto && (
        <button type="button" className="auto-banner-reset" onClick={onResetAuto}>
          자동으로
        </button>
      )}
    </div>
  );
}
