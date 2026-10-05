import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { NEED_OPTIONS } from '../utils/profile';

export default function Onboarding({ initialNeeds = [], isFirstRun, onConfirm, onSkip }) {
  const [needs, setNeeds] = useState(initialNeeds);

  const toggle = (id) => {
    setNeeds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  };

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card glass-panel">
        <h2 id="onboarding-title" className="onboarding-title">
          이동에 도움이 필요한 부분을 골라 주세요
        </h2>
        <p className="onboarding-desc">
          여러 개를 고를 수 있고, 나중에 상단의 &quot;내 설정&quot;에서 언제든 바꿀 수 있어요.
          선택한 내용은 이 기기에만 저장되고 서버로 보내지 않아요.
        </p>

        <div className="onboarding-options">
          {NEED_OPTIONS.map((opt) => {
            const selected = needs.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={`onboarding-option ${selected ? 'selected' : ''}`}
                onClick={() => opt.available && toggle(opt.id)}
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

        <div className="onboarding-actions">
          <button type="button" className="onboarding-btn secondary" onClick={onSkip}>
            {isFirstRun ? '해당 없음 / 나중에' : '닫기'}
          </button>
          <button type="button" className="onboarding-btn primary" onClick={() => onConfirm(needs)}>
            선택 완료
          </button>
        </div>
      </div>
    </div>
  );
}
