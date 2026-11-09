import React, { useState, useRef, useEffect } from 'react';
import { X, Search, Home, Building2, GraduationCap, Star, MapPin, Loader2, Check } from 'lucide-react';
import { searchAddressLive } from '../services/addressService';
import { setPresetFavorite, addCustomFavorite } from '../utils/favorites';

const TYPE_CONFIG = {
  home: { label: '집', icon: Home, color: '#38bdf8', hint: '우리 집 주소나 아파트·건물명을 검색해 주세요' },
  work: { label: '직장', icon: Building2, color: '#f59e0b', hint: '회사나 직장 건물명, 도로명을 검색해 주세요' },
  school: { label: '학교', icon: GraduationCap, color: '#10b981', hint: '학교나 대학교 캠퍼스 이름을 검색해 주세요' },
  custom: { label: '즐겨찾기', icon: Star, color: '#a78bfa', hint: '자주 찾는 장소 이름이나 주소를 검색해 주세요' }
};

export default function FavoriteRegisterModal({
  presetType = 'home', // 'home' | 'work' | 'school' | 'custom'
  initialPlace = null, // if registering a pre-selected place
  userLocation = null,
  onSaved,
  onClose
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedType, setSelectedType] = useState(presetType);
  const debounceTimerRef = useRef(null);
  const inputRef = useRef(null);

  const cfg = TYPE_CONFIG[selectedType] || TYPE_CONFIG.home;
  const IconComponent = cfg.icon;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // If initialPlace is provided, save directly when choosing type
  const handleSaveInitialPlace = (typeToSave) => {
    if (!initialPlace) return;
    if (typeToSave === 'custom') {
      addCustomFavorite(initialPlace);
    } else {
      setPresetFavorite(typeToSave, initialPlace);
    }
    if (onSaved) onSaved(typeToSave, initialPlace);
    onClose();
  };

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceTimerRef.current);

    if (val.trim().length > 0) {
      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        const res = await searchAddressLive(val, userLocation);
        setResults(res);
        setIsSearching(false);
      }, 180);
    } else {
      setResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place) => {
    if (selectedType === 'custom') {
      addCustomFavorite(place);
    } else {
      setPresetFavorite(selectedType, place);
    }
    if (onSaved) onSaved(selectedType, place);
    onClose();
  };

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="fav-modal-title">
      <div className="onboarding-card glass-panel fav-register-modal">
        {/* Header */}
        <div className="settings-head" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              className="fav-type-badge-icon"
              style={{ background: `${cfg.color}22`, color: cfg.color }}
            >
              <IconComponent size={20} />
            </div>
            <div>
              <h2 id="fav-modal-title" className="onboarding-title" style={{ margin: 0, fontSize: '1.18rem' }}>
                {initialPlace ? '즐겨찾기 장소 등록' : `'${cfg.label}' 위치 등록`}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {initialPlace ? '원하는 항목을 선택하여 등록하세요' : cfg.hint}
              </p>
            </div>
          </div>
          <button type="button" className="settings-close" onClick={onClose} aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        {/* If registering from an existing search result */}
        {initialPlace ? (
          <div className="fav-initial-place-wrap">
            <div className="fav-place-preview-card">
              <MapPin size={16} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
              <div>
                <strong>{initialPlace.name}</strong>
                <p>{initialPlace.roadAddress || initialPlace.name}</p>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '14px 0 8px' }}>
              어떤 장소로 등록할까요?
            </p>

            <div className="fav-type-selection-grid">
              <button
                type="button"
                className="fav-type-select-btn"
                onClick={() => handleSaveInitialPlace('home')}
              >
                <Home size={18} color="#38bdf8" />
                <span>집</span>
              </button>
              <button
                type="button"
                className="fav-type-select-btn"
                onClick={() => handleSaveInitialPlace('work')}
              >
                <Building2 size={18} color="#f59e0b" />
                <span>직장</span>
              </button>
              <button
                type="button"
                className="fav-type-select-btn"
                onClick={() => handleSaveInitialPlace('school')}
              >
                <GraduationCap size={18} color="#10b981" />
                <span>학교</span>
              </button>
              <button
                type="button"
                className="fav-type-select-btn"
                onClick={() => handleSaveInitialPlace('custom')}
              >
                <Star size={18} color="#a78bfa" />
                <span>일반 즐겨찾기</span>
              </button>
            </div>
          </div>
        ) : (
          /* Search to register */
          <>
            {/* Type selector tabs */}
            <div className="fav-tabs-row">
              {['home', 'work', 'school'].map((tKey) => {
                const tCfg = TYPE_CONFIG[tKey];
                const TIcon = tCfg.icon;
                const isActive = selectedType === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    className={`fav-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedType(tKey)}
                  >
                    <TIcon size={14} />
                    <span>{tCfg.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="fav-search-input-box">
              <Search size={16} color="var(--text-muted)" />
              <input
                ref={inputRef}
                type="text"
                placeholder={`${cfg.label} 주소 또는 건물명 검색 (예: 해운대자이, 구남로)`}
                value={query}
                onChange={handleQueryChange}
                className="fav-input"
              />
              {isSearching && <Loader2 size={15} className="spin-anim" color="var(--accent-cyan)" />}
              {query && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                  }}
                  className="fav-input-clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results List */}
            <div className="fav-search-results-list">
              {results.length > 0 ? (
                results.map((place, idx) => (
                  <div
                    key={idx}
                    className="fav-search-result-item"
                    onClick={() => handleSelectPlace(place)}
                  >
                    <MapPin size={16} color={cfg.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span className="fav-item-name">{place.name}</span>
                        {place.distanceText && (
                          <span className="place-item-dist">{place.distanceText}</span>
                        )}
                      </div>
                      <span className="fav-item-addr">{place.roadAddress}</span>
                    </div>
                    <button
                      type="button"
                      className="fav-select-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPlace(place);
                      }}
                    >
                      <Check size={14} /> 선택
                    </button>
                  </div>
                ))
              ) : query.trim().length > 0 && !isSearching ? (
                <div className="fav-empty-hint">
                  <span>검색 결과가 없습니다. 도로명이나 정확한 건물명을 입력해 보세요.</span>
                </div>
              ) : (
                <div className="fav-empty-hint">
                  <span>검색창에 주소나 건물명을 입력하시면 실시간 결과가 나타납니다.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

