import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ChevronUp,
  ChevronDown,
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
  CornerDownLeft,
  SunMedium,
  Bus,
  Home,
  GraduationCap,
  Star,
  Plus,
  CloudRain
} from 'lucide-react';
import { NODES } from '../data/urbanNetwork';
import { findNearestNode } from '../engine/routingEngine';
import { searchAddressLive } from '../services/addressService';
import { formatDistance, formatDuration } from '../utils/format';
import { SPEED_LEVELS, getAllSpeedLevels } from '../utils/profile';
import {
  loadFavorites,
  setPresetFavorite,
  removePresetFavorite,
  addCustomFavorite,
  removeCustomFavorite
} from '../utils/favorites';
import FavoriteRegisterModal from './FavoriteRegisterModal';
import { HEAT_APPARENT_TEMP, HEAT_UV_INDEX } from '../utils/autoRouting';
import { UMBRELLA_MM } from '../services/weatherService';
import TravelModeToggle from './TravelModeToggle';

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
  nightRoute,
  rainRoute,
  weather = null,
  transitRoutes = [],
  selectedTransitRoute = null,
  selectedTransitIdx = 0,
  onSelectTransit,
  transitLoading = false,
  travelMode = 'foot',
  setTravelMode,
  walkSpeed = 75,
  onChangeWalkSpeed,
  sunPos,
  onShowGuide,
  guideOpen = false,
  onCollapseMobile
}) {
  const [startQuery, setStartQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [startResults, setStartResults] = useState([]);
  const [destResults, setDestResults] = useState([]);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'start' | 'dest' | null
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false);

  const containerRef = useRef(null);
  const startInputRef = useRef(null);
  const destInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync input text with active points or node official road name addresses
  useEffect(() => {
    if (startPoint?.name) {
      setStartQuery(startPoint.name);
    } else if (startNodeId && NODES[startNodeId]) {
      setStartQuery(NODES[startNodeId].roadAddress || NODES[startNodeId].name);
    } else {
      setStartQuery('');
    }
  }, [startPoint, startNodeId]);

  useEffect(() => {
    if (targetPoint?.name) {
      setDestQuery(targetPoint.name);
    } else if (targetNodeId && NODES[targetNodeId]) {
      setDestQuery(NODES[targetNodeId].roadAddress || NODES[targetNodeId].name);
    } else {
      setDestQuery('');
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

  const [favorites, setFavorites] = useState(() => loadFavorites());
  const [favModalData, setFavModalData] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSelectFavorite = (place, targetField) => {
    if (targetField === 'start') {
      handleSelectStart(place);
    } else {
      handleSelectDest(place);
    }
    setActiveDropdown(null);
  };

  const handleDeleteFavorite = (type, customId = null) => {
    if (type === 'custom' && customId) {
      removeCustomFavorite(customId);
    } else {
      removePresetFavorite(type);
    }
    setFavorites(loadFavorites());
    showToast('즐겨찾기에서 삭제되었습니다.');
  };

  const handleOpenFavRegister = (presetType = 'home', initialPlace = null) => {
    setFavModalData({ presetType, initialPlace });
  };

  // Real-time Start search input handler (processed 100% via backend)
  // 거리 기반 검색 정렬을 위한 기준 위치 산출
  const getSearchRefLocation = (type) => {
    if (userGps?.lat && userGps?.lng) {
      return { lat: userGps.lat, lng: userGps.lng };
    }
    if (type === 'dest' && startPoint?.lat && startPoint?.lng) {
      return { lat: startPoint.lat, lng: startPoint.lng };
    }
    if (startPoint?.lat && startPoint?.lng) {
      return { lat: startPoint.lat, lng: startPoint.lng };
    }
    return { lat: 35.1631, lng: 129.1636 };
  };

  // Real-time Start search input handler (processed 100% via backend with distance ranking)
  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartQuery(val);
    clearTimeout(debounceTimerRef.current);
    setSelectedIndex(0);
    setActiveDropdown('start');

    if (val.trim().length > 0) {
      setIsSearching(true);
      const refLoc = getSearchRefLocation('start');
      debounceTimerRef.current = setTimeout(async () => {
        const results = await searchAddressLive(val, refLoc);
        setStartResults(results);
        setIsSearching(false);
      }, 180);
    } else {
      setStartResults([]);
      setIsSearching(false);
    }
  };

  // Real-time Destination search input handler (processed 100% via backend with distance ranking)
  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestQuery(val);
    clearTimeout(debounceTimerRef.current);
    setSelectedIndex(0);
    setActiveDropdown('dest');

    if (val.trim().length > 0) {
      setIsSearching(true);
      const refLoc = getSearchRefLocation('dest');
      debounceTimerRef.current = setTimeout(async () => {
        const results = await searchAddressLive(val, refLoc);
        setDestResults(results);
        setIsSearching(false);
      }, 180);
    } else {
      setDestResults([]);
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

  // Clear queries (clearing re-opens favorites dropdown)
  const handleClearStart = () => {
    setStartQuery('');
    setStartResults([]);
    setActiveDropdown('start');
    if (startInputRef.current) startInputRef.current.focus();
  };

  const handleClearDest = () => {
    setDestQuery('');
    setDestResults([]);
    setActiveDropdown('dest');
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

  // 자주 가는 장소 (즐겨찾기) 드롭다운 뷰
  const renderFavoritesDropdown = (targetField) => {
    return (
      <div className="fav-dropdown-inner">
        <div className="dropdown-native-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Star size={13} color="#f59e0b" fill="#f59e0b" />
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
              자주 가는 장소 (즐겨찾기)
            </span>
          </div>
          <button
            type="button"
            className="dropdown-close-btn"
            onClick={() => setActiveDropdown(null)}
            title="닫기"
          >
            <X size={12} />
          </button>
        </div>

        <div className="fav-presets-list">
          {/* 집 */}
          <div
            className={`fav-preset-row ${favorites.home ? 'registered' : 'empty'}`}
            onClick={() => {
              if (favorites.home) handleSelectFavorite(favorites.home, targetField);
              else handleOpenFavRegister('home');
            }}
          >
            <div className="fav-preset-icon-box home">
              <Home size={15} color="#38bdf8" />
            </div>
            <div className="fav-preset-content">
              <div className="fav-preset-title-row">
                <span className="fav-preset-tag home">집</span>
                <span className="fav-preset-name">
                  {favorites.home ? favorites.home.name : '집 등록하기'}
                </span>
              </div>
              {favorites.home ? (
                <span className="fav-preset-addr">{favorites.home.roadAddress}</span>
              ) : (
                <span className="fav-preset-sub-hint">자주 가는 집 등록</span>
              )}
            </div>
            {favorites.home ? (
              <button
                type="button"
                className="fav-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFavorite('home');
                }}
                title="집 등록 삭제"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="fav-add-badge"><Plus size={11} /> 등록</span>
            )}
          </div>

          {/* 직장 */}
          <div
            className={`fav-preset-row ${favorites.work ? 'registered' : 'empty'}`}
            onClick={() => {
              if (favorites.work) handleSelectFavorite(favorites.work, targetField);
              else handleOpenFavRegister('work');
            }}
          >
            <div className="fav-preset-icon-box work">
              <Building2 size={15} color="#f59e0b" />
            </div>
            <div className="fav-preset-content">
              <div className="fav-preset-title-row">
                <span className="fav-preset-tag work">직장</span>
                <span className="fav-preset-name">
                  {favorites.work ? favorites.work.name : '직장 등록하기'}
                </span>
              </div>
              {favorites.work ? (
                <span className="fav-preset-addr">{favorites.work.roadAddress}</span>
              ) : (
                <span className="fav-preset-sub-hint">자주 가는 직장 등록</span>
              )}
            </div>
            {favorites.work ? (
              <button
                type="button"
                className="fav-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFavorite('work');
                }}
                title="직장 등록 삭제"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="fav-add-badge"><Plus size={11} /> 등록</span>
            )}
          </div>

          {/* 학교 */}
          <div
            className={`fav-preset-row ${favorites.school ? 'registered' : 'empty'}`}
            onClick={() => {
              if (favorites.school) handleSelectFavorite(favorites.school, targetField);
              else handleOpenFavRegister('school');
            }}
          >
            <div className="fav-preset-icon-box school">
              <GraduationCap size={15} color="#10b981" />
            </div>
            <div className="fav-preset-content">
              <div className="fav-preset-title-row">
                <span className="fav-preset-tag school">학교</span>
                <span className="fav-preset-name">
                  {favorites.school ? favorites.school.name : '학교 등록하기'}
                </span>
              </div>
              {favorites.school ? (
                <span className="fav-preset-addr">{favorites.school.roadAddress}</span>
              ) : (
                <span className="fav-preset-sub-hint">자주 가는 학교 등록</span>
              )}
            </div>
            {favorites.school ? (
              <button
                type="button"
                className="fav-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFavorite('school');
                }}
                title="학교 등록 삭제"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="fav-add-badge"><Plus size={11} /> 등록</span>
            )}
          </div>

          {/* 일반 즐겨찾기 목록 */}
          {favorites.custom && favorites.custom.length > 0 && (
            <div className="fav-custom-section">
              <span className="fav-custom-section-title">⭐ 일반 즐겨찾기</span>
              {favorites.custom.map((cust) => (
                <div
                  key={cust.id}
                  className="fav-preset-row registered"
                  onClick={() => handleSelectFavorite(cust, targetField)}
                >
                  <div className="fav-preset-icon-box custom">
                    <Star size={14} color="#a78bfa" />
                  </div>
                  <div className="fav-preset-content">
                    <span className="fav-preset-name">{cust.name}</span>
                    <span className="fav-preset-addr">{cust.roadAddress}</span>
                  </div>
                  <button
                    type="button"
                    className="fav-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFavorite('custom', cust.id);
                    }}
                    title="즐겨찾기 삭제"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="fav-dropdown-footer-hint">
          💡 장소를 검색하고 <strong>⭐(즐겨찾기)</strong>를 누르면 언제든 집, 직장, 학교로 저장할 수 있어요.
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="glass-panel route-search-card">
      {/* Mobile Collapse/Expand Handle Bar */}
      <div
        className="mobile-collapse-handle"
        onClick={onCollapseMobile}
        role="button"
        tabIndex={0}
        aria-label="지도 넓게 보기 (검색창 닫기)"
      >
        <div className="mobile-handle-pill" />
        <div className="mobile-handle-content">
          <span className="mobile-handle-title">지도 넓게 보기 (접기)</span>
          <ChevronDown size={18} />
        </div>
      </div>
      {/* 2. Scrollable Body */}
      <div className="route-search-body">
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
            길찾기
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

      <TravelModeToggle travelMode={travelMode} setTravelMode={setTravelMode} />

      {/* Quick Favorites Shortcut Chips */}
      <div className="fav-quick-chips-bar">
        <span className="fav-quick-label">즐겨찾기:</span>
        <button
          type="button"
          className={`fav-quick-chip ${favorites.home ? 'registered' : ''}`}
          onClick={() => {
            if (favorites.home) handleSelectFavorite(favorites.home, activeDropdown || 'dest');
            else handleOpenFavRegister('home');
          }}
          title={favorites.home ? `집: ${favorites.home.name} (클릭하여 설정)` : '집 등록하기'}
        >
          <Home size={12} color="#38bdf8" />
          <span>{favorites.home ? '집' : '+ 집'}</span>
        </button>

        <button
          type="button"
          className={`fav-quick-chip ${favorites.work ? 'registered' : ''}`}
          onClick={() => {
            if (favorites.work) handleSelectFavorite(favorites.work, activeDropdown || 'dest');
            else handleOpenFavRegister('work');
          }}
          title={favorites.work ? `직장: ${favorites.work.name} (클릭하여 설정)` : '직장 등록하기'}
        >
          <Building2 size={12} color="#f59e0b" />
          <span>{favorites.work ? '직장' : '+ 직장'}</span>
        </button>

        <button
          type="button"
          className={`fav-quick-chip ${favorites.school ? 'registered' : ''}`}
          onClick={() => {
            if (favorites.school) handleSelectFavorite(favorites.school, activeDropdown || 'dest');
            else handleOpenFavRegister('school');
          }}
          title={favorites.school ? `학교: ${favorites.school.name} (클릭하여 설정)` : '학교 등록하기'}
        >
          <GraduationCap size={12} color="#10b981" />
          <span>{favorites.school ? '학교' : '+ 학교'}</span>
        </button>

        {favorites.custom && favorites.custom.length > 0 && (
          <button
            type="button"
            className="fav-quick-chip registered"
            onClick={() => {
              handleSelectFavorite(favorites.custom[0], activeDropdown || 'dest');
            }}
            title={`⭐ ${favorites.custom[0].name} (클릭하여 설정)`}
          >
            <Star size={11} color="#a78bfa" />
            <span>{favorites.custom[0].name.slice(0, 5)}</span>
          </button>
        )}
      </div>

      {/* Origin & Destination Search Rows with Swap Button */}
      <div className="route-inputs-container">
        {/* 1. 출발지 도로명주소 검색 */}
        <div className="route-input-row origin-row">
          <div className="input-indicator green-dot" />
          <div className="input-content" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="input-label">출발지</span>
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
                placeholder="출발지 검색 (건물명·도로명)"
                value={startQuery}
                onChange={handleStartChange}
                onKeyDown={handleStartKeyDown}
                onFocus={() => setActiveDropdown('start')}
                onClick={() => setActiveDropdown('start')}
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
                {!startQuery.trim() ? (
                  renderFavoritesDropdown('start')
                ) : (
                  <>
                    {/* Clean Dropdown Header */}
                    <div className="dropdown-native-header">
                      <div className="dropdown-header-title">
                        <Search size={13} color="var(--accent-cyan)" />
                        <span>검색 결과 ({startResults.length}건)</span>
                      </div>
                      <div className="dropdown-header-actions">
                        <span className="dropdown-hint-text">↑↓ 선택</span>
                        <button
                          type="button"
                          className="dropdown-close-btn"
                          onClick={() => setActiveDropdown(null)}
                          title="닫기"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* High-visibility Results List */}
                    <div className="dropdown-scroll-body">
                      {startResults.length > 0 ? (
                        startResults.map((place, idx) => (
                          <div
                            key={idx}
                            className={`search-dropdown-item ${selectedIndex === idx ? 'highlighted' : ''}`}
                            onClick={() => handleSelectStart(place)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <MapPin size={15} color="var(--accent-emerald)" className="place-item-pin" />
                            <div className="place-item-content">
                              <div className="place-item-main-row">
                                <span className="place-item-name" title={place.name}>{place.name}</span>
                                <div className="place-item-actions">
                                  {place.distanceText && (
                                    <span className="place-item-dist" title="현재 위치로부터의 거리">{place.distanceText}</span>
                                  )}
                                  <button
                                    type="button"
                                    className="place-fav-star-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFavRegister('home', place);
                                    }}
                                    title="즐겨찾기(집·직장·학교)에 저장"
                                  >
                                    <Star size={12} color="#f59e0b" />
                                  </button>
                                </div>
                              </div>
                              <div className="place-item-sub-row">
                                {place.category && (
                                  <span className="place-item-cat">{place.category}</span>
                                )}
                                <span className="place-item-addr" title={place.roadAddress}>{place.roadAddress}</span>
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
                            <div className="dropdown-loading-wrap">
                              <Loader2 size={15} className="spin-anim" />
                              <span>장소 검색 중...</span>
                            </div>
                          ) : (
                            <div className="dropdown-empty-wrap">
                              <p className="empty-title">일치하는 검색 결과가 없습니다.</p>
                              <p className="empty-desc">
                                건물명(예: 해운대자이, 센텀신세계)이나 도로명(구남로 20)을 입력해 보세요.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
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
              <span className="input-label">도착지</span>
            </div>

            <div className="search-input-wrapper">
              <input
                ref={destInputRef}
                type="text"
                placeholder="도착지 검색 (건물명·도로명)"
                value={destQuery}
                onChange={handleDestChange}
                onKeyDown={handleDestKeyDown}
                onFocus={() => setActiveDropdown('dest')}
                onClick={() => setActiveDropdown('dest')}
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
                {!destQuery.trim() ? (
                  renderFavoritesDropdown('dest')
                ) : (
                  <>
                    {/* Clean Dropdown Header */}
                    <div className="dropdown-native-header">
                      <div className="dropdown-header-title">
                        <Search size={13} color="var(--accent-rose)" />
                        <span>검색 결과 ({destResults.length}건)</span>
                      </div>
                      <div className="dropdown-header-actions">
                        <span className="dropdown-hint-text">↑↓ 선택</span>
                        <button
                          type="button"
                          className="dropdown-close-btn"
                          onClick={() => setActiveDropdown(null)}
                          title="닫기"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* High-visibility Results List */}
                    <div className="dropdown-scroll-body">
                      {destResults.length > 0 ? (
                        destResults.map((place, idx) => (
                          <div
                            key={idx}
                            className={`search-dropdown-item ${selectedIndex === idx ? 'highlighted' : ''}`}
                            onClick={() => handleSelectDest(place)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          >
                            <MapPin size={15} color="var(--accent-rose)" className="place-item-pin" />
                            <div className="place-item-content">
                              <div className="place-item-main-row">
                                <span className="place-item-name" title={place.name}>{place.name}</span>
                                <div className="place-item-actions">
                                  {place.distanceText && (
                                    <span className="place-item-dist" title="출발지/현재 위치로부터의 거리">{place.distanceText}</span>
                                  )}
                                  <button
                                    type="button"
                                    className="place-fav-star-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFavRegister('work', place);
                                    }}
                                    title="즐겨찾기(집·직장·학교)에 저장"
                                  >
                                    <Star size={12} color="#f59e0b" />
                                  </button>
                                </div>
                              </div>
                              <div className="place-item-sub-row">
                                {place.category && (
                                  <span className="place-item-cat">{place.category}</span>
                                )}
                                <span className="place-item-addr" title={place.roadAddress}>{place.roadAddress}</span>
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
                            <div className="dropdown-loading-wrap">
                              <Loader2 size={15} className="spin-anim" />
                              <span>장소 검색 중...</span>
                            </div>
                          ) : (
                            <div className="dropdown-empty-wrap">
                              <p className="empty-title">일치하는 검색 결과가 없습니다.</p>
                              <p className="empty-desc">
                                건물명(예: 해운대자이, 센텀신세계)이나 도로명(구남로 20)을 입력해 보세요.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3대 추천 루트 카드 */}
      <div style={{ marginTop: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexWrap: 'wrap',
          gap: '6px'
        }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            경로 비교
          </div>
          {travelMode === 'foot' && onChangeWalkSpeed && (
            <div
              className="walk-speed-quick-selector"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)', padding: '0 4px', fontWeight: 500 }}>
                걸음속도
              </span>
              {getAllSpeedLevels().map((lvl) => {
                const isActive = walkSpeed === lvl.speed;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => onChangeWalkSpeed(lvl.speed)}
                    title={lvl.desc}
                    style={{
                      padding: '2px 6px',
                      fontSize: '0.66rem',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? 'var(--accent-cyan)' : 'transparent',
                      color: isActive ? '#0f172a' : 'var(--text-muted)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {lvl.label} {lvl.kmh}k
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {travelMode !== 'transit' && !standardRoute && (
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            padding: '16px 12px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '8px',
            border: '1px dashed rgba(255, 255, 255, 0.12)'
          }}>
            출발지와 도착지를 설정하면 폭염 그늘 · 야간 안심 맞춤 경로가 비교됩니다.
          </div>
        )}

        {travelMode === 'car' && standardRoute && (
          <div className="recommend-route-card selected standard-active" style={{ cursor: 'default' }}>
            <div className="card-top-row">
              <span className="route-card-title">🚗 차량 기준 경로</span>
            </div>
            <div className="route-card-metrics">
              <strong>{formatDistance(standardRoute.totalDistance)}</strong>
              <span className="route-card-time">{formatDuration(standardRoute.estimatedMinutes)}</span>
            </div>
          </div>
        )}

        {/* 대중교통 경로 목록 (TMAP API 연동) */}
        {travelMode === 'transit' && (
          <div>
            {transitLoading ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '24px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                fontSize: '0.82rem',
                fontWeight: 600
              }}>
                <Loader2 size={16} className="spin-anim" />
                <span>TMAP 실시간 대중교통 경로 탐색 중...</span>
              </div>
            ) : transitRoutes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(transitRoutes.length, 3)}, 1fr)`, gap: '6px' }}>
                  {transitRoutes.map((tr, tIdx) => {
                    const isSelected = selectedTransitIdx === tIdx;
                    return (
                      <div
                        key={tIdx}
                        className={`recommend-route-card ${isSelected ? 'selected standard-active' : ''}`}
                        onClick={() => onSelectTransit && onSelectTransit(tIdx)}
                        style={{
                          borderColor: isSelected ? '#38bdf8' : undefined,
                          background: isSelected ? 'rgba(56, 189, 248, 0.14)' : undefined,
                          cursor: 'pointer'
                        }}
                      >
                        <div className="card-top-row">
                          <span className="route-card-title" style={{ color: isSelected ? '#38bdf8' : undefined }}>
                            🚌 추천 {tIdx + 1}
                          </span>
                          {isSelected && <CheckCircle2 size={12} color="#38bdf8" />}
                        </div>
                        <div className="route-card-metrics">
                          <strong style={{ fontSize: '1.2rem', color: isSelected ? '#38bdf8' : undefined }}>{tr.totalMinutes}분</strong>
                          <span className="route-card-time">{tr.fare ? `${tr.fare.toLocaleString()}원` : '기본요금'}</span>
                        </div>
                        <div className="route-card-desc" style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tr.summary}
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          도보 {tr.totalWalkMinutes}분 · 환승 {tr.transferCount}회
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 선택된 대중교통 경로 구간 세부 안내 */}
                {selectedTransitRoute && Array.isArray(selectedTransitRoute.legs) && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '2px' }}>
                      경로 세부 구간 ({selectedTransitRoute.summary})
                    </div>
                    {selectedTransitRoute.legs.map((leg, lIdx) => (
                      <div key={lIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem' }}>
                        <span style={{
                          background: leg.mode === 'WALK' ? '#475569' : leg.routeColor,
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.66rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          flexShrink: 0
                        }}>
                          {leg.mode === 'WALK' ? '도보' : (leg.mode === 'SUBWAY' ? '지하철' : '버스')}
                        </span>
                        <div style={{ display: 'flex', flex: 1, minWidth: 0, justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#f8fafc', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {leg.startName} ➔ {leg.endName} {leg.routeName !== '도보' ? `(${leg.routeName})` : ''}
                          </span>
                          <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>
                            {leg.sectionMinutes}분 ({formatDistance(leg.distance)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                padding: '16px 12px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                border: '1px dashed rgba(255, 255, 255, 0.12)'
              }}>
                출발지와 도착지 간 운행 중인 대중교통 노선이 없습니다.
              </div>
            )}
          </div>
        )}

        <div className="recommend-routes-grid" style={{ gridTemplateColumns: rainRoute ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', display: travelMode !== 'foot' ? 'none' : undefined }}>
          {/* 1. 일반 최단 경로 */}
          {standardRoute && (
            <div
              className={`recommend-route-card ${mode === 'standard' ? 'selected standard-active' : ''}`}
              onClick={() => setMode('standard')}
            >
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Compass size={14} color="#94a3b8" />
                  <span className="route-card-title">가장 짧은 길</span>
                </div>
                {mode === 'standard' && <CheckCircle2 size={13} color="#94a3b8" />}
              </div>
              <div className="route-card-metrics">
                <strong>{formatDistance(standardRoute.totalDistance)}</strong>
                <span className="route-card-time">{formatDuration(standardRoute.estimatedMinutes)}</span>
              </div>
              <div className="route-card-desc">
                {travelMode === 'car' ? (
                  '자동차 전용 도로 기준'
                ) : !sunPos?.isDaylight || standardRoute.shadeRatio == null ? (
                  '일몰 후 (햇빛 직사광선 없음)'
                ) : (
                  `그늘 ${standardRoute.shadeRatio}% (직사광선 ${formatDistance(standardRoute.exposedDistance)})`
                )}
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
                <strong>{formatDistance(shadeRoute.totalDistance)}</strong>
                <span className="route-card-time">{formatDuration(shadeRoute.estimatedMinutes)}</span>
              </div>
              <div className="route-card-desc">
                {!sunPos?.isDaylight || shadeRoute.shadeRatio == null ? (
                  '일몰 후 (야간 안심 모드 권장)'
                ) : weather && weather.apparent < HEAT_APPARENT_TEMP && !(weather.uv >= HEAT_UV_INDEX) ? (
                  '덥지 않음 · 불필요'
                ) : (
                  <>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>그늘 {shadeRoute.shadeRatio}% 도보</span> (땡볕 최소화)
                  </>
                )}
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
                <strong>{formatDistance(nightRoute.totalDistance)}</strong>
                <span className="route-card-time">{formatDuration(nightRoute.estimatedMinutes)}</span>
              </div>
              <div className="route-card-desc">
                CCTV <span style={{ color: '#38bdf8', fontWeight: 700 }}>{nightRoute.cctvCount}대</span> · 가로등 <span style={{ color: '#f59e0b', fontWeight: 700 }}>{nightRoute.streetlightCount || 0}개소</span>
              </div>
            </div>
          )}

          {/* 4. 비 피하는 길 */}
          {rainRoute && (
            <div
              className={`recommend-route-card ${mode === 'rain' ? 'selected' : ''}`}
              style={{
                borderColor: mode === 'rain' ? '#2563eb' : undefined,
                background: mode === 'rain' ? 'rgba(37, 99, 235, 0.12)' : undefined
              }}
              onClick={() => setMode('rain')}
            >
              <div className="card-top-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CloudRain size={14} color="#2563eb" />
                  <span className="route-card-title" style={{ color: '#2563eb' }}>악천후 안심</span>
                </div>
                {mode === 'rain' && <CheckCircle2 size={13} color="#2563eb" />}
              </div>
              <div className="route-card-metrics">
                <strong>{formatDistance(rainRoute.totalDistance)}</strong>
                <span className="route-card-time">{formatDuration(rainRoute.estimatedMinutes)}</span>
              </div>
              <div className="route-card-desc">
                {weather && !weather.isRaining && !weather.isSnowing ? (
                  '비·눈 없음 · 불필요'
                ) : weather?.isRaining && weather.precipitation >= UMBRELLA_MM ? (
                  <><span style={{ color: '#2563eb', fontWeight: 700 }}>☂ 우산 필수</span> · 가림길 {formatDistance(rainRoute.rainCoveredDistance || 0)}</>
                ) : rainRoute.rainCoveredDistance > 0 ? (
                  <><span style={{ color: '#2563eb', fontWeight: 700 }}>눈·비를 피할 수 있는 길 {formatDistance(rainRoute.rainCoveredDistance)}</span> 포함</>
                ) : (
                  '눈·비를 피할 수 있는 구간이 없어요'
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      </div>{/* end .route-search-body */}

      {/* 3. Fixed Footer Explore Button */}
      <div className="route-search-footer">
        <button
          type="button"
          className="route-explore-btn"
          onClick={onShowGuide}
          disabled={travelMode === 'transit' ? !selectedTransitRoute : !standardRoute}
          aria-pressed={guideOpen}
        >
          <Navigation size={18} />
          길안내
        </button>
      </div>

      {/* Favorite Register Modal */}
      {favModalData && (
        <FavoriteRegisterModal
          presetType={favModalData.presetType}
          initialPlace={favModalData.initialPlace}
          userLocation={getSearchRefLocation('start')}
          onSaved={(type, place) => {
            setFavorites(loadFavorites());
            showToast(`'${place.name}'이(가) 등록되었습니다!`);
          }}
          onClose={() => setFavModalData(null)}
        />
      )}

      {/* Mini Toast */}
      {toastMsg && (
        <div className="fav-mini-toast">
          <CheckCircle2 size={14} color="#10b981" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
