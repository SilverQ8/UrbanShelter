import React, { useState } from 'react';
import { X, Check, Sun, Building, Trees, Video, Clock, Lightbulb } from 'lucide-react';
import { NEED_OPTIONS } from '../utils/profile';
import { MODE_LABELS } from '../utils/autoRouting';
import TravelModeToggle from './TravelModeToggle';

const LAYER_ITEMS = [
  { key: 'buildings', label: '건물 및 빌딩 정보 (카카오 연동)', icon: Building, color: '#38bdf8' },
  { key: 'trees', label: '가로수 그늘', icon: Trees, color: '#10b981' },
  { key: 'cctv', label: '방범 CCTV', icon: Video, color: '#38bdf8' },
  { key: 'streetlight', label: '가로등 / 보안등 (15m)', icon: Lightbulb, color: '#f59e0b' }
];


const MODE_CHOICES = [
  { id: 'auto', label: '자동' },
  { id: 'standard', label: MODE_LABELS.standard },
  { id: 'shade', label: MODE_LABELS.shade },
  { id: 'night', label: MODE_LABELS.night }
];

function formatHour(val) {
  const h = Math.floor(val);
  const m = Math.round((val % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function SettingsPanel({
  needs,
  onChangeNeeds,
  modeOverride,
  setModeOverride,
  autoDecision,
  mode,
  sensitivity,
  setSensitivity,
  simulatedHour,
  setSimulatedHour,
  isLiveTime,
  setIsLiveTime,
  layers,
  setLayers,
  travelMode = 'foot',
  setTravelMode,
  mapThemeSetting = 'auto',
  setMapThemeSetting,
  onClose
}) {
  // 다른 시간대 미리 보기는 요청했을 때만 펼친다
  const [showPreview, setShowPreview] = useState(!isLiveTime);

  const toggleNeed = (id) => {
    onChangeNeeds(needs.includes(id) ? needs.filter((n) => n !== id) : [...needs, id]);
  };

  const sensitivityLabel =
    mode === 'night' ? 'CCTV 많은 길 선호도' : '그늘 많은 길 선호도';
  const sensitivityHint =
    mode === 'night' ? 'CCTV가 많은 길이면 더 돌아가도 괜찮은 정도' : '그늘이 많은 길이면 더 돌아가도 괜찮은 정도';

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="onboarding-card glass-panel settings-card">
        <div className="settings-head">
          <h2 id="settings-title" className="onboarding-title" style={{ marginBottom: 0 }}>설정</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="설정 닫기" title="닫기">
            <X size={22} />
          </button>
        </div>

        {/* 0. 이동 수단 */}
        <section className="settings-section" style={{ borderTop: 'none', paddingTop: 0 }}>
          <h3>길찾기 기준</h3>
          <TravelModeToggle travelMode={travelMode} setTravelMode={setTravelMode} />
          <p className="settings-help">
            {travelMode === 'foot'
              ? '보도·횡단보도 등 걸을 수 있는 길만 사용해요.'
              : '자동차가 다닐 수 있는 도로 기준이에요. 그늘·안심 경로는 도보에서만 쓸 수 있어요.'}
          </p>
        </section>

        {/* 1. 이동 도움 */}
        <section className="settings-section">
          <h3>이동에 필요한 도움</h3>
          <div className="onboarding-options">
            {NEED_OPTIONS.map((opt) => {
              const selected = needs.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`onboarding-option ${selected ? 'selected' : ''}`}
                  onClick={() => opt.available && toggleNeed(opt.id)}
                  disabled={!opt.available}
                  aria-pressed={selected}
                >
                  <span className="onboarding-check">{selected && <Check size={18} strokeWidth={3} />}</span>
                  <span className="onboarding-option-text">
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. 경로 방식 + 가중치 */}
        <section className="settings-section">
          <h3>경로 방식</h3>
          <div className="settings-segment" role="group" aria-label="경로 방식">
            {MODE_CHOICES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={modeOverride === c.id ? 'active' : ''}
                aria-pressed={modeOverride === c.id}
                onClick={() => setModeOverride(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="settings-help">
            {modeOverride === 'auto'
              ? `지금은 '${MODE_LABELS[autoDecision.mode]}' · ${autoDecision.reason}`
              : `직접 고른 '${MODE_LABELS[modeOverride]}' 경로로 안내해요. 날씨에 맞춰 바꾸려면 '자동'을 누르세요.`}
          </p>

          {mode !== 'standard' && (
            <div className="slider-control-group" style={{ marginTop: '14px' }}>
              <div className="slider-label-row">
                <span className="slider-title">{sensitivityLabel}</span>
                <span className="slider-value-badge">{Math.round(sensitivity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sensitivity}
                onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                className="custom-range-slider"
                aria-label={sensitivityLabel}
              />
              <div className="slider-endpoints">
                <span>가장 짧은 길</span>
                <span>많이 돌아가도 OK</span>
              </div>
              <p className="settings-help">{sensitivityHint}</p>
            </div>
          )}
        </section>

        {/* 3. 다른 시간대 미리 보기 (요청할 때만 펼침) */}
        <section className="settings-section">
          <h3>햇빛 시간대</h3>
          {!showPreview ? (
            <>
              <p className="settings-help" style={{ marginTop: 0 }}>
                지금 시각의 햇빛 기준으로 안내해요. 그림자는 보행자 시점에서만 보여요.
              </p>
              <button type="button" className="settings-chip" onClick={() => setShowPreview(true)}>
                <Clock size={14} />
                다른 시간대 미리 보기
              </button>
            </>
          ) : (
            <>
              <div className="settings-time-row">
                <strong>{formatHour(simulatedHour)}</strong>
                <button
                  type="button"
                  className="settings-chip"
                  onClick={() => {
                    setIsLiveTime(true);
                    setShowPreview(false);
                  }}
                >
                  <Clock size={14} />
                  현재 시각으로 돌아가기
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="23.5"
                step="0.5"
                value={simulatedHour}
                onChange={(e) => {
                  setIsLiveTime(false);
                  setSimulatedHour(parseFloat(e.target.value));
                }}
                className="custom-range-slider"
                style={{ width: '100%', accentColor: '#f59e0b' }}
                aria-label="미리 볼 시간대"
              />
              <div className="slider-endpoints">
                <span>0시</span>
                <span>12시</span>
                <span>23시 30분</span>
              </div>
            </>
          )}
        </section>

        {/* 4. 지도 표시 */}
        <section className="settings-section">
          <h3>지도 테마</h3>
          <div className="settings-segment" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }} role="group" aria-label="지도 테마">
            {[
              { id: 'auto', label: '자동(시간)' },
              { id: 'light', label: '밝게' },
              { id: 'dark', label: '어둡게' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={mapThemeSetting === t.id ? 'active' : ''}
                aria-pressed={mapThemeSetting === t.id}
                onClick={() => setMapThemeSetting(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="settings-help">자동은 해가 떠 있으면 밝게, 해가 없으면 어둡게 바뀌어요. 2D와 3D 지도에 모두 적용돼요.</p>
        </section>

        <section className="settings-section">
          <h3>지도에 표시</h3>
          <div className="layer-toggle-grid">
            {LAYER_ITEMS.map(({ key, label, icon: Icon, color }) => (
              <div
                key={key}
                className="toggle-item"
                onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                <div className={`toggle-info ${layers[key] ? 'active' : ''}`}>
                  <div className="toggle-icon-wrap" style={{ background: `${color}26`, color }}>
                    <Icon size={15} />
                  </div>
                  <div>{label}</div>
                </div>
                <label className="switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                    aria-label={label}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            ))}
          </div>
        </section>

        <div className="onboarding-actions">
          <button type="button" className="onboarding-btn primary" onClick={onClose}>
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
