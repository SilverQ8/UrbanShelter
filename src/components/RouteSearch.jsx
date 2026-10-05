import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  MapPin,
  Crosshair,
  Compass,
  Moon,
  Navigation,
  ArrowUpDown,
  CheckCircle2,
  Building2,
  Loader2,
  X,
  Sparkles,
  CornerDownLeft,
  SunMedium
} from 'lucide-react';
import { NODES } from '../data/urbanNetwork';
import { findNearestNode } from '../engine/routingEngine';
import { searchAddressLive } from '../services/addressService';

export default function RouteSearch({
  userGps,
  onRequestGps,
  gpsStatus,
  startPoint,
  setStartPoint,
  targetPoint,
  setTargetPoint,
  startNodeId,
  setStartNodeId,
  targetNodeId,
  setTargetNodeId,
  mode,
  setMode,
  standardRoute,
  shadeRoute,
  nightRoute
}) {
  const [startQuery, setStartQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'start' | 'dest' | null
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef(null);
  const startInputRef = useRef(null);
  const destInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync input text with active points or node official road name addresses
  useEffect(() => {
    if (startPoint?.name) {
      setStartQuery(startPoint.name);
    } else if (NODES[startNodeId]) {
      setStartQuery(NODES[startNodeId].roadAddress || NODES[startNodeId].name);
    }
  }, [startPoint, startNodeId]);

  useEffect(() => {
    if (targetPoint?.name) {
      setDestQuery(targetPoint.name);
    } else if (NODES[targetNodeId]) {
      setDestQuery(NODES[targetNodeId].roadAddress || NODES[targetNodeId].name);
    }
  }, [targetPoint, targetNodeId]);

  // Handle outside click to close dropdowns
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Real-time Start search input handler (processed 100% via backend)
  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartQuery(val);
    clearTimeout(debounceTimerRef.current);
    setSelectedIndex(0);

    if (val.trim().length > 0) {
      setActiveDropdown('start');
      setIsSearching(true);

      // Instant search with debounce to backend
      debounceTimerRef.current = setTimeout(async () => {
        const results = await searchAddressLive(val);
        setStartResults(results);
        setIsSearching(false);
      }, 180);
    } else {
      setStartResults([]);
      setActiveDropdown(null);
      setIsSearching(false);
    }
  };

  // Real-time Destination search input handler (processed 100% via backend)
  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestQuery(val);
    clearTimeout(debounceTimerRef.current);
    setSelectedIndex(0);

    if (val.trim().length > 0) {
      setActiveDropdown('dest');
      setIsSearching(true);

      // Instant search with debounce to backend
      debounceTimerRef.current = setTimeout(async () => {
        const results = await searchAddressLive(val);
        setDestResults(results);
        setIsSearching(false);
      }, 180);
    } else {
      setDestResults([]);
      setActiveDropdown(null);
      setIsSearching(false);
    }
  };

  // Select place for Start
  const handleSelectStart = (place) => {
    const displayName = place.roadAddress ? `${place.name} (${place.roadAddress})` : place.name;
    setStartQuery(displayName);
    setActiveDropdown(null);

    if (setStartPoint) {
      setStartPoint({
        name: place.name,
        roadAddress: place.roadAddress || place.name,
        lat: place.lat,
        lng: place.lng
      });
    }

    if (place.lat && place.lng) {
      const nearestNodeId = findNearestNode(place.lat, place.lng);
      if (nearestNodeId) {
        setStartNodeId(nearestNodeId);
      }
    }
  };

  // Select place for Destination
  const handleSelectDest = (place) => {
    const displayName = place.roadAddress ? `${place.name} (${place.roadAddress})` : place.name;
    setDestQuery(displayName);
    setActiveDropdown(null);

    if (setTargetPoint) {
      setTargetPoint({
        name: place.name,
        roadAddress: place.roadAddress || place.name,
        lat: place.lat,
        lng: place.lng
      });
    }

    if (place.lat && place.lng) {
      const nearestNodeId = findNearestNode(place.lat, place.lng);
      if (nearestNodeId) {
        setTargetNodeId(nearestNodeId);
      }
    }
  };

  // Keyboard navigation & submission for Start
  const handleStartKeyDown = (e) => {
    if (!activeDropdown && e.key === 'ArrowDown') {
      setActiveDropdown('start');
      return;
    }

    if (activeDropdown === 'start' && startResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % startResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + startResults.length) % startResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = startResults[selectedIndex] || startResults[0];
        if (selected) {
          handleSelectStart(selected);
        }
      }
    }
  };

  // Keyboard navigation & submission for Destination
  const handleDestKeyDown = (e) => {
    if (!activeDropdown && e.key === 'ArrowDown') {
      setActiveDropdown('dest');
      return;
    }

    if (activeDropdown === 'dest' && destResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % destResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + destResults.length) % destResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = destResults[selectedIndex] || destResults[0];
        if (selected) {
          handleSelectDest(selected);
        }
      }
    }
  };

  // Clear queries
  const handleClearStart = () => {
    setStartQuery('');
    setStartResults([]);
    setActiveDropdown(null);
    if (startInputRef.current) startInputRef.current.focus();
  };

  const handleClearDest = () => {
    setDestQuery('');
    setDestResults([]);
    setActiveDropdown(null);
    if (destInputRef.current) destInputRef.current.focus();
  };

  // Swap Start and Destination
  const handleSwapLocations = () => {
    const prevStart = startPoint;
    const prevTarget = targetPoint;
    if (setStartPoint && setTargetPoint && prevStart && prevTarget) {
      setStartPoint(prevTarget);
      setTargetPoint(prevStart);
    }
    const prevStartId = startNodeId;
    const prevTargetId = targetNodeId;
    setStartNodeId(prevTargetId);
    setTargetNodeId(prevStartId);
  };

  // Reset Start to User GPS
  const handleUseGpsAsStart = () => {
    if (userGps) {
      if (setStartPoint) {
        setStartPoint({
          name: '내 현재 위치 (GPS)',
          roadAddress: '실시간 GPS 위치',
          lat: userGps.lat,
          lng: userGps.lng
        });
      }
      const nearestId = findNearestNode(userGps.lat, userGps.lng);
      if (nearestId) {
        setStartNodeId(nearestId);
        setStartQuery(NODES[nearestId]?.roadAddress || '내 현재 위치 (GPS)');
        setActiveDropdown(null);
      }
    } else {
      onRequestGps();
    }
  };

  return (
    <div ref={containerRef} className="glass-panel route-search-card">
      {/* Search Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Navigation size={13} />
          </div>
          <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
            도보 길찾기 (실시간 주소·건물 자동 검색)
          </span>
        </div>

        <button
          onClick={onRequestGps}
          className="gps-refresh-btn"
          title="GPS 위치 새로고침"
        >
          <Crosshair size={13} className={gpsStatus === 'loading' ? 'spin-anim' : ''} />
          <span>{gpsStatus === 'active' ? 'GPS 연동됨' : '내 위치'}</span>
        </button>
      </div>

      {/* Origin & Destination Search Rows with Swap Button */}
      <div className="route-inputs-container">
        {/* 1. 출발지 도로명주소 검색 */}
        <div className="route-input-row origin-row">
          <div className="input-indicator green-dot" />
          <div className="input-content" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="input-label">출발지 (건물명 또는 도로명 입력 시 자동 검색)</span>
              <button
                onClick={handleUseGpsAsStart}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-cyan)',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <Crosshair size={10} />
                <span>GPS 내 위치</span>
              </button>
            </div>

            <div className="search-input-wrapper">
              <input
                ref={startInputRef}
                type="text"
                placeholder="출발 건물명 또는 도로명 (예: 해운대자이, 구남로 20)"
                value={startQuery}
                onChange={handleStartChange}
                onKeyDown={handleStartKeyDown}
                onFocus={() => {
                  if (startQuery.trim().length > 0) setActiveDropdown('start');
                }}
                className="dest-search-input"
              />
              <div className="input-right-actions">
                {isSearching && activeDropdown === 'start' ? (
                  <Loader2 size={14} color="var(--accent-cyan)" className="spin-anim" />
                ) : startQuery ? (
                  <X
                    size={14}
                    className="clear-icon"
                    onClick={handleClearStart}
                    title="입력 지우기"
                  />
                ) : (
                  <Search size={14} color="var(--text-muted)" />
                )}
              </div>
            </div>

            {/* Start Live Auto-search Dropdown Panel (100% Native High Visibility) */}
            {activeDropdown === 'start' && (
              <div className="search-dropdown-menu">
                {/* Clean Dropdown Header */}
                <div className="dropdown-native-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Search size={12} color="var(--accent-cyan)" />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      백엔드 실시간 검색결과 ({startResults.length}건)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="dropdown-hint-text">↑↓ 이동 · Enter 선택</span>
                    <button
                      className="dropdown-close-btn"
                      onClick={() => setActiveDropdown(null)}
                      title="닫기"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* High-visibility Results List (100% Pure React Native UI) */}
                <div className="dropdown-scroll-body">
                  {startResults.length > 0 ? (
                    startResults.map((place, idx) => (
                      <div
                        key={idx}
                        className={`search-dropdown-item ${selectedIndex === idx ? 'highlighted' : ''}`}
                        onClick={() => handleSelectStart(place)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <MapPin size={15} color="#34d399" style={{ flexShrink: 0, marginTop: '3px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span className="badge-road">도로명</span>
                              <span className="place-item-name">{place.name}</span>
                            </div>
                            {place.category && (
                              <span className="place-item-cat">{place.category}</span>
                            )}
                          </div>
                          <div className="place-item-addr-row">
                            <span className="place-item-addr">{place.roadAddress}</span>
                            {selectedIndex === idx && (
                              <span className="select-enter-hint">
                                <CornerDownLeft size={10} /> 선택
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="dropdown-empty-state">
                      {isSearching ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Loader2 size={15} className="spin-anim" color="var(--accent-cyan)" />
                          <span>백엔드에서 실시간 건물 및 도로명주소 검색 중...</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>일치하는 검색 결과가 없습니다.</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                            건물명(예: 해운대자이, 센텀신세계)이나 도로명(구남로 20)을 입력해 보세요.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button (⇅) */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
          <button
            onClick={handleSwapLocations}
            className="swap-locations-btn"
            title="출발지와 도착지 위치 바꾸기"
          >
            <ArrowUpDown size={13} />
            <span>출발·도착지 맞바꾸기</span>
          </button>
        </div>

        {/* 2. 도착지 도로명주소 검색 */}
        <div className="route-input-row dest-row">
          <div className="input-indicator red-dot" />
          <div className="input-content" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="input-label">도착지 (건물명 또는 도로명 입력 시 자동 검색)</span>
            </div>

            <div className="search-input-wrapper">
              <input
                ref={destInputRef}
                type="text"
                placeholder="도착 건물명 또는 도로명 (예: 센텀 신세계, 해운대자이)"
                value={destQuery}
                onChange={handleDestChange}
                onKeyDown={handleDestKeyDown}
                onFocus={() => {
                  if (destQuery.trim().length > 0) setActiveDropdown('dest');
                }}
                className="dest-search-input"
              />
              <div className="input-right-actions">
                {isSearching && activeDropdown === 'dest' ? (
                  <Loader2 size={14} color="var(--accent-cyan)" className="spin-anim" />
                ) : destQuery ? (
                  <X
                    size={14}
                    className="clear-icon"
                    onClick={handleClearDest}
                    title="입력 지우기"
                  />
                ) : (
                  <Search size={14} color="var(--text-muted)" />
                )}
              </div>
            </div>

            {/* Destination Live Auto-search Dropdown Panel (100% Native High Visibility) */}
            {activeDropdown === 'dest' && (
              <div className="search-dropdown-menu">
                {/* Clean Dropdown Header */}
                <div className="dropdown-native-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Search size={12} color="var(--accent-rose)" />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      백엔드 실시간 검색결과 ({destResults.length}건)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="dropdown-hint-text">↑↓ 이동 · Enter 선택</span>
                    <button
                      className="dropdown-close-btn"
                      onClick={() => setActiveDropdown(null)}
                      title="닫기"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* High-visibility Results List (100% Pure React Native UI) */}
                <div className="dropdown-scroll-body">
                  {destResults.length > 0 ? (
                    destResults.map((place, idx) => (
                      <div
                        key={idx}
                        className={`search-dropdown-item ${selectedIndex === idx ? 'highlighted' : ''}`}
                        onClick={() => handleSelectDest(place)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      >
                        <MapPin size={15} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '3px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span className="badge-road badge-dest">도로명</span>
                              <span className="place-item-name">{place.name}</span>
                            </div>
                            {place.category && (
                              <span className="place-item-cat">{place.category}</span>
                            )}
                          </div>
                          <div className="place-item-addr-row">
                            <span className="place-item-addr">{place.roadAddress}</span>
                            {selectedIndex === idx && (
                              <span className="select-enter-hint">
                                <CornerDownLeft size={10} /> 선택
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="dropdown-empty-state">
                      {isSearching ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Loader2 size={15} className="spin-anim" color="var(--accent-cyan)" />
                          <span>백엔드에서 실시간 건물 및 도로명주소 검색 중...</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>일치하는 검색 결과가 없습니다.</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                            건물명(예: 해운대자이, 센텀신세계)이나 도로명(구남로 36)을 입력해 보세요.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time search hint badge */}
      <div className="live-search-hint">
        <Sparkles size={11} color="var(--accent-cyan)" />
        <span>백엔드 검색엔진을 통해 전국의 모든 건물명과 도로명주소를 실시간으로 검색하여 노출합니다.</span>
      </div>

      {/* 3대 추천 루트 카드 */}
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          추천 경로 비교 (클릭하여 선택)
        </div>

        <div className="recommend-routes-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {/* 1. 일반 최단 경로 */}
          {standardRoute && (
            <div
              className={`recommend-route-card ${mode === 'standard' ? 'selected standard-active' : ''}`}
              onClick={() => setMode('standard')}
            >
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Compass size={14} color="#94a3b8" />
                  <span className="route-card-title">일반 최단</span>
                </div>
                {mode === 'standard' && <CheckCircle2 size={13} color="#94a3b8" />}
              </div>
              <div className="route-card-metrics">
                <strong>{standardRoute.totalDistance}m</strong> · {standardRoute.estimatedMinutes}분
              </div>
              <div className="route-card-desc">
                그늘 {standardRoute.shadeRatio || 35}% (직사광선 {standardRoute.exposedDistance || Math.round(standardRoute.totalDistance * 0.65)}m)
              </div>
            </div>
          )}

          {/* 2. 폭염 안심 그늘 경로 (그늘로) */}
          {shadeRoute && (
            <div
              className={`recommend-route-card ${mode === 'shade' ? 'selected rain-active' : ''}`}
              style={{
                borderColor: mode === 'shade' ? '#10b981' : undefined,
                background: mode === 'shade' ? 'rgba(16, 185, 129, 0.12)' : undefined
              }}
              onClick={() => setMode('shade')}
            >
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <SunMedium size={14} color="#10b981" />
                  <span className="route-card-title" style={{ color: '#10b981' }}>폭염 그늘</span>
                </div>
                {mode === 'shade' && <CheckCircle2 size={13} color="#10b981" />}
              </div>
              <div className="route-card-metrics">
                <strong>{shadeRoute.totalDistance}m</strong> · {shadeRoute.estimatedMinutes}분
              </div>
              <div className="route-card-desc">
                <span style={{ color: '#10b981', fontWeight: 700 }}>그늘 {shadeRoute.shadeRatio}% 도보</span> (땡볕 최소화)
              </div>
            </div>
          )}

          {/* 3. 야간 안심 경로 */}
          {nightRoute && (
            <div
              className={`recommend-route-card ${mode === 'night' ? 'selected night-active' : ''}`}
              onClick={() => setMode('night')}
            >
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Moon size={14} color="#38bdf8" />
                  <span className="route-card-title" style={{ color: '#38bdf8' }}>야간 안심</span>
                </div>
                {mode === 'night' && <CheckCircle2 size={13} color="#38bdf8" />}
              </div>
              <div className="route-card-metrics">
                <strong>{nightRoute.totalDistance}m</strong> · {nightRoute.estimatedMinutes}분
              </div>
              <div className="route-card-desc">
                CCTV <span style={{ color: '#38bdf8', fontWeight: 700 }}>{nightRoute.cctvCount}대</span> 안전존
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
