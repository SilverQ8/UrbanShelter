import React, { useState } from 'react';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { POI_CATEGORIES } from '../data/poiCategories';

export default function PoiPanel({ selected, onToggle, counts, status }) {
  const [open, setOpen] = useState(false);
  const selectedCount = POI_CATEGORIES.filter((c) => selected[c.id]).length;

  return (
    <aside className="glass-panel poi-panel" aria-label="주변 장소">
      <button type="button" className="poi-panel-header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="poi-panel-title">
          <MapPin size={16} />
          주변 장소
          {selectedCount > 0 && <span className="poi-panel-badge">{selectedCount}</span>}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <>
          <div className="poi-chip-grid">
            {POI_CATEGORIES.map((cat) => {
              const on = Boolean(selected[cat.id]);
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`poi-chip ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onToggle(cat.id)}
                  style={{ '--c': cat.color }}
                >
                  <span className="poi-chip-emoji" aria-hidden="true">{cat.emoji}</span>
                  <span className="poi-chip-label">{cat.label}</span>
                  <span className="poi-chip-count">{counts[cat.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <p className="poi-panel-note">
            {status === 'loading' && '주변 장소를 불러오는 중…'}
            {status === 'error' && '장소 정보를 불러오지 못했어요'}
            {status === 'skipped' && '경로가 길어 장소를 표시하지 않아요'}
            {status === 'ok' && '지도에 이미 표시된 아이콘 중 고른 종류만 보여줘요. 아무것도 고르지 않으면 모두 보여요. (개수는 경로 주변 약 450m 기준)'}
          </p>
        </>
      )}
    </aside>
  );
}
