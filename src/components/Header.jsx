import React from 'react';
import { Shield, RotateCcw, MapPin } from 'lucide-react';
import { PRESET_SCENARIOS } from '../data/urbanNetwork';

export default function Header({
  activeScenario,
  onSelectScenario,
  onResetPins
}) {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">
          <Shield size={22} strokeWidth={2.4} />
        </div>
        <div className="brand-title-wrap">
          <h1 className="brand-title">UrbanShelter</h1>
          <span className="brand-tagline">도보 안전 & 우천 회피 스마트 라우팅 엔진</span>
        </div>
      </div>

      <div className="header-actions">
        <select
          className="scenario-select"
          value={activeScenario || ''}
          onChange={(e) => onSelectScenario(e.target.value)}
          title="사전 정의된 시나리오 선택"
        >
          <option value="" disabled>시나리오 프리셋 선택...</option>
          {PRESET_SCENARIOS.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.title}
            </option>
          ))}
        </select>

        <button
          className="reset-btn"
          onClick={onResetPins}
          title="출발/도착지 기본값 초기화"
        >
          <RotateCcw size={14} />
          <span>초기화</span>
        </button>
      </div>
    </header>
  );
}
