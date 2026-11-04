import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SunMedium, Shield } from 'lucide-react';
import { MapLibreBasemap } from '../utils/MapLibreBasemap';
import { NODES, MAP_CENTER, DEFAULT_ZOOM } from '../data/urbanNetwork';
import { formatDistance, formatDuration } from '../utils/format';
import { filterValidUrbanMarkers, isInvalidOceanCoordinate } from '../utils/geoSanity';
import { normalizeFacilityDataset } from '../utils/geoConverter';
import { searchKakaoBuildings, fetchKakaoBuildingDetail, getInstantLocalBuildings } from '../services/kakaoService';
import { getTransitArrivalInfo } from '../services/transitService';
import { POI_CATEGORIES } from '../data/poiCategories';
import rawFallbackCctvs from '../data/cctvRealData.json';
import rawFallbackStreetlights from '../data/streetlightRealData.json';

const LOCAL_CCTVS = normalizeFacilityDataset(rawFallbackCctvs);
const LOCAL_STREETLIGHTS = normalizeFacilityDataset(rawFallbackStreetlights);
const CLIENT_CCTV_CACHE = new Map(LOCAL_CCTVS.map(c => [c.id, c]));
const CLIENT_STREETLIGHT_CACHE = new Map(LOCAL_STREETLIGHTS.map(s => [s.id, s]));

export default function MapComponent({
  userGps,
  onRequestGps,
  startPoint,
  setStartPoint,
  targetPoint,
  setTargetPoint,
  startNodeId,
  setStartNodeId,
  targetNodeId,
  setTargetNodeId,
  pinSelectMode,
  setPinSelectMode,
  mode,
  recommendedRoute,
  standardRoute,
  shadeRoute,
  nightRoute,
  transitRoute = null,
  sunPos,
  layers,
  mapTheme = 'dark',
  focusPoint = null,
  buildings = [],
  trees = [],
  travelMode = 'foot',
  locateTarget = null,
  poiSelected = {},
  pois = []
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const basemapRef = useRef(null);
  const poiLayerRef = useRef(null);
  const latestThemeRef = useRef(mapTheme);
  const latestPoiRef = useRef(poiSelected);
  latestThemeRef.current = mapTheme;
  latestPoiRef.current = poiSelected;
  const latestSunPosRef = useRef(sunPos);
  latestSunPosRef.current = sunPos;
  const [cctvState, setCctvState] = useState({
    count: 0,
    displayedCount: 0,
    isZoomTooLow: false,
    zoom: 16
  });

  const [streetlightState, setStreetlightState] = useState({
    count: 0,
    displayedCount: 0,
    isZoomTooLow: false,
    zoom: 16
  });

  const [treeState, setTreeState] = useState({
    count: 0,
    displayedCount: 0,
    isZoomTooLow: false,
    zoom: 16
  });

  // Layer groups refs (Clean & uncluttered: CCTV, Streetlights, Routes, Markers)
  const buildingLayerRef = useRef(null);
  const kakaoBuildingLayerRef = useRef(null);
  const treeLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const cctvLayerRef = useRef(null);
  const streetlightLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const fallbackTileLayerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: userGps ? [userGps.lat, userGps.lng] : MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false, // 바닥 벡터 지도가 같은 시점에 맞춰 바뀌도록
      fadeAnimation: false,
      markerZoomAnimation: false
    });

    // 1. 기본 고품질 배경 타일 레이어 (OpenStreetMap 공식 타일): API 키가 전혀 필요 없는 전 세계 표준 타일
    const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const tileLayer = L.tileLayer(osmUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    fallbackTileLayerRef.current = tileLayer;

    // 2. 3D 지도와 연동되는 고해상도 벡터 지도 (OpenFreeMap MapLibre)
    try {
      const basemap = new MapLibreBasemap({ theme: latestThemeRef.current, poiSelected: latestPoiRef.current }).addTo(map);
      basemapRef.current = basemap;
    } catch (err) {
      console.warn('MapLibre basemap init fallback:', err);
    }

    // Controls
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups in proper z-order
    // 건물 윤곽·가로수는 CCTV·가로등·경로보다 아래에 깐다
    buildingLayerRef.current = L.layerGroup().addTo(map);
    kakaoBuildingLayerRef.current = L.layerGroup().addTo(map);
    poiLayerRef.current = L.layerGroup().addTo(map);
    treeLayerRef.current = L.layerGroup().addTo(map);

    cctvLayerRef.current = L.layerGroup().addTo(map);
    streetlightLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    const sizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(sizeTimer); // 지도가 정리된 뒤에 크기 보정이 호출되지 않도록
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const lastFittedKeyRef = useRef('');

  // Fit bounds ONLY when Start and Target endpoints change (prevents map from jumping when sliding time/sensitivity!)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const sLat = startPoint?.lat;
    const sLng = startPoint?.lng;
    const tLat = targetPoint?.lat;
    const tLng = targetPoint?.lng;

    if (!sLat || !sLng || !tLat || !tLng) return;

    const currentKey = `${sLat.toFixed(4)}_${sLng.toFixed(4)}_${tLat.toFixed(4)}_${tLng.toFixed(4)}`;
    if (lastFittedKeyRef.current === currentKey) return; // Skip if already fitted for this origin-destination pair!
    lastFittedKeyRef.current = currentKey;
    // 컨테이너 크기가 확정되기 전에 맞추면 축척이 너무 작게 잡히는 경우가 있다.
    // 지도가 아직 준비되지 않았거나 이미 정리된 경우에는 건너뛴다.
    try {
      if (map._loaded) map.invalidateSize();
    } catch {
      // 크기 보정은 보조 동작이라 실패해도 지도를 계속 쓸 수 있다
    }

    if (recommendedRoute && recommendedRoute.latlngs && recommendedRoute.latlngs.length > 1) {
      const bounds = L.latLngBounds(recommendedRoute.latlngs);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
      return;
    }

    const bounds = L.latLngBounds([[sLat, sLng], [tLat, tLng]]);
    map.fitBounds(bounds, { padding: [100, 100], maxZoom: 17 });
  }, [startPoint?.lat, startPoint?.lng, targetPoint?.lat, targetPoint?.lng, recommendedRoute]);

  // 오른쪽 아래 '내 위치' 버튼: 출발지는 바꾸지 않고 지도만 현재 위치로 옮긴다.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !locateTarget) return;
    map.setView([locateTarget.lat, locateTarget.lng], Math.max(map.getZoom(), 17), { animate: true });
  }, [locateTarget]);

  // 길 안내 목록에서 단계를 누르면 해당 지점으로 이동하고 강조 표시한다.
  const focusMarkerRef = useRef(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusPoint) return;

    if (focusMarkerRef.current) {
      focusMarkerRef.current.remove();
      focusMarkerRef.current = null;
    }
    focusMarkerRef.current = L.circleMarker([focusPoint.lat, focusPoint.lng], {
      radius: 14,
      color: '#f59e0b',
      weight: 4,
      fillColor: '#fbbf24',
      fillOpacity: 0.35
    }).addTo(map);
    map.setView([focusPoint.lat, focusPoint.lng], Math.max(map.getZoom(), 18), { animate: true });
  }, [focusPoint]);

  // 출발지·도착지를 정하면 그 위치가 화면 안에 오도록 지도가 따라간다(이미 잘 보이면 가만히 둔다).
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    [startPoint, targetPoint].forEach((pt) => {
      if (!pt || pt.lat == null || pt.lng == null) return;
      if (map.getBounds().pad(-0.2).contains([pt.lat, pt.lng])) return;
      map.setView([pt.lat, pt.lng], Math.max(map.getZoom(), 16), { animate: true });
    });
  }, [startPoint?.lat, startPoint?.lng, targetPoint?.lat, targetPoint?.lng]);

  // 테마가 바뀌면 바닥 지도에 반영한다
  useEffect(() => {
    if (basemapRef.current) basemapRef.current.setTheme(mapTheme);
  }, [mapTheme]);

  useEffect(() => {
    if (basemapRef.current) basemapRef.current.setPoiSelected(poiSelected);
  }, [poiSelected]);

  // 건물 그림자는 2D 지도에서 그리지 않는다. 보행자 시점(3D)에서만 표시한다.

  // 2. 건물 클릭 시 카카오 API 연동 상세 정보 및 높이/그늘 분석 팝업 표시 함수
  const openBuildingDetailPopup = (bld, clickLatLng) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let centerLat = clickLatLng ? (clickLatLng.lat ?? clickLatLng[0]) : null;
    let centerLng = clickLatLng ? (clickLatLng.lng ?? clickLatLng[1]) : null;

    if ((centerLat == null || centerLng == null) && Array.isArray(bld.polygon) && bld.polygon.length > 0) {
      centerLat = bld.polygon.reduce((sum, p) => sum + p[0], 0) / bld.polygon.length;
      centerLng = bld.polygon.reduce((sum, p) => sum + p[1], 0) / bld.polygon.length;
    }

    if (centerLat == null || centerLng == null) {
      centerLat = bld.lat;
      centerLng = bld.lng;
    }

    if (centerLat == null || centerLng == null) return;

    const popupLatLng = [centerLat, centerLng];
    const popupId = `bld-${bld.id || Math.random().toString(36).slice(2, 8)}`;

    const height = bld.height || 18;
    const floorText = bld.groundFloors
      ? `지상 ${bld.groundFloors}층 (공식 표제부)`
      : `~${Math.max(1, Math.round(height / 3.2))}층${bld.heightSource === 'estimate' ? ' (추정)' : ''}`;

    const initialTitle = (bld.name && bld.name !== '건물' && !bld.name.startsWith('osm_')
      ? bld.name
      : '도심 건축물').replace(/[\uFFFD\uFFFE\uFEFF]/g, '').trim();

    const renderHtml = (detail, loading = false) => {
      const title = detail?.name || initialTitle;
      const officialName = detail?.officialBuildingName && detail.officialBuildingName !== title
        ? detail.officialBuildingName
        : '';
      const category = detail?.category || bld.category || (bld.height ? `건물 · 높이 ${height}m` : '도심 시설');
      const road = detail?.roadAddress || bld.address || '';
      const jibun = detail?.jibunAddress || '';
      const zoneNo = detail?.zoneNo || '';
      const phone = detail?.phone || bld.phone || '';

      const groundFlrs = detail?.groundFloors || bld.groundFloors;
      const underFlrs = detail?.undergroundFloors;
      const bHeight = detail?.buildingHeight || height;
      const flrBadge = groundFlrs
        ? `지상 ${groundFlrs}층${underFlrs ? ` · 지하 ${underFlrs}층` : ''} (${bHeight}m)`
        : (bld.height ? floorText : '');

      const roadviewUrl = detail?.roadviewUrl || `https://map.kakao.com/link/roadview/${centerLat},${centerLng}`;
      const kakaoMapUrl = detail?.placeUrl || detail?.searchUrl || `https://map.kakao.com/link/search/${encodeURIComponent(title)}`;

      return `
        <div class="kakao-card-popup" id="card-${popupId}">
          <!-- Kakao Header: Title + Circular Arrow Link -->
          <div class="kakao-card-header">
            <a href="${kakaoMapUrl}" target="_blank" rel="noopener noreferrer" class="kakao-title-link" title="카카오맵에서 상세보기">
              <span class="kakao-title-text">${title}</span>
              <span class="kakao-circle-arrow">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            </a>
          </div>

          <!-- Official Building Name & Floors if Available -->
          ${officialName ? `
            <div style="font-size:12px; font-weight:700; color:#0284c7; margin-top:-2px;">
              🏢 ${officialName}
            </div>
          ` : ''}

          <!-- Category & Height Meta -->
          <div class="kakao-category-row">
            <span class="kakao-category-text">${category}</span>
            ${flrBadge ? `<span class="kakao-floor-badge">${flrBadge}</span>` : ''}
          </div>

          <!-- Address & Phone Info Body -->
          <div class="kakao-body-info">
            ${loading ? `
              <div class="kakao-loading-row">
                <span class="kakao-spinner"></span>
                <span>실시간 공식 건물 정보 및 주소 조회 중...</span>
              </div>
            ` : `
              ${road ? `
                <div class="kakao-road-line">
                  📍 ${road} ${zoneNo ? `<span class="kakao-zone-no">(우 ${zoneNo})</span>` : ''}
                </div>
              ` : ''}
              ${jibun ? `
                <div class="kakao-jibun-line">
                  <span class="kakao-jibun-addr">(지번) ${jibun}</span>
                </div>
              ` : ''}
              ${phone ? `
                <div class="kakao-phone-line">
                  <a href="tel:${phone}" class="kakao-phone-link" title="전화 걸기">
                    <span class="kakao-phone-icon">📞</span>
                    <span class="kakao-phone-num">${phone}</span>
                  </a>
                </div>
              ` : ''}
              ${!road && !jibun ? `
                <div class="kakao-coord-line">위치: ${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}</div>
              ` : ''}
            `}
          </div>

          <!-- Sub Links: 상세보기 | 로드뷰 | 주소 복사 -->
          <div class="kakao-sublinks-bar">
            <a href="${kakaoMapUrl}" target="_blank" rel="noopener noreferrer" class="kakao-sublink">상세보기</a>
            <span class="kakao-sublink-div">|</span>
            <a href="${roadviewUrl}" target="_blank" rel="noopener noreferrer" class="kakao-sublink">로드뷰</a>
            <span class="kakao-sublink-div">|</span>
            <button id="btn-copy-${popupId}" class="kakao-sublink-btn">주소 복사</button>
          </div>

          <!-- Action Footer: [출발지로] & [도착지 길찾기] -->
          <div class="kakao-footer-actions">
            <button id="btn-start-${popupId}" class="kakao-action-start" title="출발지로 설정">
              <span>출발지로</span>
            </button>
            <button id="btn-target-${popupId}" class="kakao-action-directions" title="도착지로 설정하고 길찾기">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>길찾기</span>
            </button>
          </div>
        </div>
      `;
    };

    const initialHtml = renderHtml(null, true);

    const popup = L.popup({
      maxWidth: 350,
      minWidth: 280,
      className: 'custom-building-popup',
      autoPan: true,
      autoPanPadding: [20, 20]
    })
      .setLatLng(popupLatLng)
      .setContent(initialHtml)
      .openOn(map);

    const bindButtons = (currentTitle, detail) => {
      const startBtn = document.getElementById(`btn-start-${popupId}`);
      const targetBtn = document.getElementById(`btn-target-${popupId}`);
      const copyBtn = document.getElementById(`btn-copy-${popupId}`);

      if (startBtn) {
        startBtn.onclick = () => {
          setStartPoint({ lat: centerLat, lng: centerLng, name: currentTitle || initialTitle });
          map.closePopup();
        };
      }
      if (targetBtn) {
        targetBtn.onclick = () => {
          setTargetPoint({ lat: centerLat, lng: centerLng, name: currentTitle || initialTitle });
          map.closePopup();
        };
      }
      if (copyBtn) {
        copyBtn.onclick = () => {
          const textToCopy = detail?.roadAddress || detail?.jibunAddress || currentTitle || '';
          if (navigator.clipboard && textToCopy) {
            navigator.clipboard.writeText(textToCopy);
            copyBtn.innerText = '복사됨 ✓';
            setTimeout(() => {
              const el = document.getElementById(`btn-copy-${popupId}`);
              if (el) el.innerText = '주소 복사';
            }, 2000);
          }
        };
      }
    };

    bindButtons(initialTitle, null);

    // Fetch Kakao & 건축HUB detail in background
    fetchKakaoBuildingDetail({
      lat: centerLat,
      lng: centerLng,
      name: bld.name,
      category: bld.category
    }).then((detail) => {
      if (!popup.isOpen()) return;
      const resolvedTitle = detail?.name || initialTitle;
      popup.setContent(renderHtml(detail, false));
      bindButtons(resolvedTitle, detail);
    }).catch((err) => {
      console.warn('Failed to load Kakao building detail:', err);
      if (popup.isOpen()) {
        popup.setContent(renderHtml(null, false));
        bindButtons(initialTitle, null);
      }
    });
  };

  // 대중교통 정류장/지하철역 실시간 도착 정보 팝업
  const openTransitArrivalPopup = (poi, popupLatLng) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const arrivalInfo = getTransitArrivalInfo(poi);
    if (!arrivalInfo) return;

    const popupId = `transit-pop-${Date.now()}`;
    const [centerLat, centerLng] = popupLatLng;

    let arrivalHtml = '';
    if (arrivalInfo.type === 'subway') {
      arrivalHtml = `
        <div style="margin-top: 8px;">
          ${arrivalInfo.directions.map(dir => `
            <div style="background: rgba(255, 255, 255, 0.05); padding: 7px 9px; border-radius: 6px; margin-bottom: 6px; border-left: 3.5px solid ${arrivalInfo.lineColor};">
              <div style="font-size: 0.74rem; font-weight: 700; color: #cbd5e1; margin-bottom: 4px;">${dir.dir}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${dir.trains.map(tr => `
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.73rem;">
                    <span style="color: #f8fafc; font-weight: 600;">🚇 ${tr.dest}</span>
                    <div style="display: flex; align-items: center; gap: 5px;">
                      <span style="color: ${tr.min === '곧 도착' ? '#ef4444' : '#38bdf8'}; font-weight: 700;">${tr.min}</span>
                      <span style="font-size: 0.66rem; color: #94a3b8; background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px;">${tr.status}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // bus stop
      arrivalHtml = `
        <div style="margin-top: 8px; max-height: 170px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
          ${arrivalInfo.buses.slice(0, 5).map(b => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.05); padding: 5px 8px; border-radius: 6px; font-size: 0.73rem;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="background: ${b.color}; color: #ffffff; font-weight: 700; font-size: 0.68rem; padding: 1px 5px; border-radius: 4px;">${b.no}</span>
                <span style="color: #94a3b8; font-size: 0.66rem;">${b.type}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 5px;">
                <span style="color: ${b.minText === '곧 도착' ? '#ef4444' : '#38bdf8'}; font-weight: 700;">${b.minText}</span>
                <span style="font-size: 0.66rem; color: #64748b;">(${b.remStops})</span>
                <span style="font-size: 0.65rem; color: ${b.crowd === '여유' ? '#10b981' : (b.crowd === '보통' ? '#f59e0b' : '#ef4444')};">${b.crowd}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    const contentHtml = `
      <div style="padding: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif; color: #ffffff;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 10px; font-size: 0.66rem; color: #10b981; font-weight: 700;">
            <span style="width: 5px; height: 5px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
            실시간 도착 정보
          </div>
          ${arrivalInfo.arsId ? `<span style="font-size: 0.68rem; color: #94a3b8;">정류소ID: ${arrivalInfo.arsId}</span>` : ''}
          ${arrivalInfo.line ? `<span style="font-size: 0.70rem; color: ${arrivalInfo.lineColor}; font-weight: 700;">${arrivalInfo.line}</span>` : ''}
        </div>

        <h4 style="margin: 0; font-size: 1.02rem; font-weight: 800; color: #f8fafc; letter-spacing: -0.3px;">
          ${arrivalInfo.type === 'subway' ? '🚇' : '🚌'} ${arrivalInfo.title}
        </h4>

        ${arrivalHtml}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <button id="btn-start-${popupId}" style="background: #10b981; color: #ffffff; border: none; padding: 6px; border-radius: 6px; font-size: 0.73rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s ease;">
            출발지로 설정 (A)
          </button>
          <button id="btn-target-${popupId}" style="background: #f43f5e; color: #ffffff; border: none; padding: 6px; border-radius: 6px; font-size: 0.73rem; font-weight: 700; cursor: pointer; transition: opacity 0.15s ease;">
            도착지로 설정 (B)
          </button>
        </div>
      </div>
    `;

    const popup = L.popup({
      maxWidth: 320,
      minWidth: 270,
      className: 'custom-building-popup',
      autoPan: true,
      autoPanPadding: [20, 20]
    })
      .setLatLng(popupLatLng)
      .setContent(contentHtml)
      .openOn(map);

    setTimeout(() => {
      const startBtn = document.getElementById(`btn-start-${popupId}`);
      const targetBtn = document.getElementById(`btn-target-${popupId}`);
      if (startBtn) {
        startBtn.onclick = () => {
          if (setStartPoint) {
            setStartPoint({ lat: centerLat, lng: centerLng, name: arrivalInfo.title, roadAddress: arrivalInfo.title });
          }
          map.closePopup();
        };
      }
      if (targetBtn) {
        targetBtn.onclick = () => {
          if (setTargetPoint) {
            setTargetPoint({ lat: centerLat, lng: centerLng, name: arrivalInfo.title, roadAddress: arrivalInfo.title });
          }
          map.closePopup();
        };
      }
    }, 50);
  };

  // 주변 장소 (병원, 약국, 편의점, 지하철 등) 선택된 칩에 따른 실시간 지도 핀 렌더링
  useEffect(() => {
    const poiLayer = poiLayerRef.current;
    if (!poiLayer) return;
    poiLayer.clearLayers();

    if (!pois || pois.length === 0) return;

    // 활성화된 카테고리 확인
    const activeCategories = Object.keys(poiSelected).filter(k => poiSelected[k]);
    if (activeCategories.length === 0) return;

    const catMap = new Map(POI_CATEGORIES.map(c => [c.id, c]));

    for (const p of pois) {
      if (!poiSelected[p.category]) continue;
      const catInfo = catMap.get(p.category) || { emoji: '📍', color: '#38bdf8', label: '장소' };

      const isSubway = p.category === 'subway';
      const markerSize = isSubway ? 30 : 28;
      const poiIcon = L.divIcon({
        className: 'poi-custom-marker',
        html: `
          <div style="background: ${catInfo.color}; color: #ffffff; width: ${markerSize}px; height: ${markerSize}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isSubway ? 15 : 13}px; box-shadow: 0 3px 8px rgba(0,0,0,0.5); border: 2.2px solid #ffffff; cursor: pointer; transition: transform 0.15s ease;">
            ${catInfo.emoji}
          </div>
        `,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerSize / 2, markerSize / 2]
      });

      const marker = L.marker([p.lat, p.lng], { icon: poiIcon });
      const placeName = p.name || catInfo.label;

      const tooltipText = isSubway
        ? `<strong>${catInfo.emoji} ${placeName}</strong><br/><span style="color:#a78bfa; font-size:11px; font-weight:700;">지하철역${p.entranceCount > 1 ? ` · ${p.entranceCount}개 출구 연결` : ''}</span>`
        : `<strong>${catInfo.emoji} ${placeName}</strong><br/><span style="color:${catInfo.color}; font-size:11px; font-weight:700;">${catInfo.label}</span>`;

      marker.bindTooltip(tooltipText, {
        className: 'route-tooltip-custom',
        offset: [0, -10]
      });

      // 클릭 시 실시간 정류장/지하철 도착 정보 팝업 (또는 일반 건물 상세 팝업)
      marker.on('click', () => {
        if (p.category === 'bus' || p.category === 'subway') {
          openTransitArrivalPopup(p, [p.lat, p.lng]);
        } else {
          openBuildingDetailPopup({
            id: p.id,
            name: placeName,
            category: catInfo.label,
            lat: p.lat,
            lng: p.lng
          }, [p.lat, p.lng]);
        }
      });

      poiLayer.addLayer(marker);
    }
  }, [pois, poiSelected, setStartPoint, setTargetPoint]);

  // 2-1. 건물 높이 배지 및 폴리곤은 지도에 표기하지 않음 (그늘 분석용으로만 백그라운드 활용)
  useEffect(() => {
    if (buildingLayerRef.current) buildingLayerRef.current.clearLayers();
  }, [buildings]);

  // 2-2. Render Kakao Real-time Building & Landmark Information (Instant Local Render + Debounced Sync)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const kakaoLayer = kakaoBuildingLayerRef.current;
    if (!map || !kakaoLayer) return;

    const showKakaoLayer = layers.buildingInfo !== false && (layers.buildingInfo || layers.buildings);
    if (!showKakaoLayer) {
      kakaoLayer.clearLayers();
      return;
    }

    let abort = false;
    let debounceTimer = null;

    const drawBuildingMarkers = (blds, zoom, bounds) => {
      kakaoLayer.clearLayers();

      const placedPoints = [];
      const isDetailedZoom = zoom >= 17;
      const maxMarkers = isDetailedZoom ? 30 : 16;
      const minDx = isDetailedZoom ? 85 : 45;
      const minDy = isDetailedZoom ? 28 : 22;

      for (const b of blds) {
        if (!bounds.contains([b.lat, b.lng])) continue;
        if (placedPoints.length >= maxMarkers) break;

        const pt = map.latLngToContainerPoint([b.lat, b.lng]);
        let collided = false;
        for (const p of placedPoints) {
          if (Math.abs(pt.x - p.x) < minDx && Math.abs(pt.y - p.y) < minDy) {
            collided = true;
            break;
          }
        }
        if (collided) continue;
        placedPoints.push(pt);

        const displayName = b.name.length > 12 ? b.name.slice(0, 11) + '…' : b.name;

        const bldIcon = L.divIcon({
          className: 'kakao-building-marker',
          html: isDetailedZoom ? `
            <div class="kakao-map-badge" title="${b.name}">
              <span class="kakao-badge-icon">🏢</span>
              <span class="kakao-badge-text">${displayName}</span>
            </div>
          ` : `
            <div class="kakao-map-dot" title="${b.name}">
              <span class="kakao-dot-inner"></span>
            </div>
          `,
          iconSize: isDetailedZoom ? [0, 0] : [14, 14],
          iconAnchor: isDetailedZoom ? [0, 0] : [7, 7]
        });

        const marker = L.marker([b.lat, b.lng], { icon: bldIcon });

        if (!isDetailedZoom) {
          marker.bindTooltip(b.name, {
            direction: 'top',
            offset: [0, -8],
            className: 'custom-map-tooltip'
          });
        }

        marker.on('click', () => {
          const matchedBld = buildings.find(bldg => {
            if (!Array.isArray(bldg.polygon) || bldg.polygon.length === 0) return false;
            const bLat = bldg.polygon[0][0];
            const bLng = bldg.polygon[0][1];
            const dist = Math.hypot(bLat - b.lat, (bLng - b.lng) * 0.8);
            return dist < 0.0006;
          });
          const enriched = {
            ...b,
            height: matchedBld?.height || 28,
            groundFloors: matchedBld?.groundFloors,
            heightSource: matchedBld?.heightSource || 'official_floor_calc'
          };
          openBuildingDetailPopup(enriched, [b.lat, b.lng]);
        });

        kakaoLayer.addLayer(marker);
      }
    };

    const loadBuildings = () => {
      const zoom = map.getZoom();
      if (zoom < 15) {
        kakaoLayer.clearLayers();
        return;
      }

      const center = map.getCenter();
      const bounds = map.getBounds();

      // 1. 0ms 즉시 렌더링: 로컬/캐시 건물 데이터를 먼저 화면에 표시
      const instantBlds = getInstantLocalBuildings(center.lat, center.lng);
      if (instantBlds.length > 0) {
        drawBuildingMarkers(instantBlds, zoom, bounds);
      }

      // 2. 디바운스 후 카카오 실시간 건물 데이터 백그라운드 병합
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const blds = await searchKakaoBuildings({
            lat: center.lat,
            lng: center.lng,
            bounds: {
              south: bounds.getSouth(),
              north: bounds.getNorth(),
              west: bounds.getWest(),
              east: bounds.getEast()
            }
          });
          if (abort) return;
          drawBuildingMarkers(blds, map.getZoom(), map.getBounds());
        } catch (err) {
          console.warn('Kakao building fetch error:', err);
        }
      }, 120);
    };

    loadBuildings();

    const handleMove = () => {
      loadBuildings();
    };

    map.on('moveend zoomend', handleMove);

    return () => {
      abort = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      map.off('moveend zoomend', handleMove);
    };
  }, [layers.buildings, layers.buildingInfo, buildings, setStartPoint, setTargetPoint]);


  // 3. Render Roadside Trees & Dynamic Canopy Shadows (Zoom-dependent, consistent with CCTV & Streetlights)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const treeLayer = treeLayerRef.current;
    if (!map || !treeLayer) return;

    const renderTrees = () => {
      treeLayer.clearLayers();

      if (!layers.trees) {
        setTreeState({ count: 0, displayedCount: 0, isZoomTooLow: false, zoom: map.getZoom() });
        return;
      }

      const zoom = map.getZoom();

      // CCTV, 가로등과 동일한 축척 제한: zoom < 13 일 때 숨김 처리
      if (zoom < 13) {
        setTreeState({ count: 0, displayedCount: 0, isZoomTooLow: true, zoom });
        return;
      }

      const bounds = map.getBounds().pad(0.08);
      const center = map.getCenter();
      const visibleTrees = (trees || []).filter(t => {
        const lat = Number(t.lat);
        const lng = Number(t.lng);
        return bounds.contains([lat, lng]) && !isInvalidOceanCoordinate(lat, lng);
      });

      // Center-priority sorting: sort trees by distance to screen center
      visibleTrees.sort((a, b) => {
        const dLatA = a.lat - center.lat;
        const dLngA = (a.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        const dLatB = b.lat - center.lat;
        const dLngB = (b.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
      });

      setTreeState({
        count: visibleTrees.length,
        displayedCount: visibleTrees.length,
        isZoomTooLow: false,
        zoom
      });

      // Shift tree shadow slightly according to sun azimuth
      const shadowAzimuthDeg = sunPos ? (sunPos.azimuthDeg + 180) % 360 : 0;
      const shadowRad = (shadowAzimuthDeg * Math.PI) / 180;
      const treeShadowDist = sunPos && sunPos.altitudeDeg > 0 ? Math.min(18, 7.5 / Math.tan(Math.max(10, sunPos.altitudeDeg) * Math.PI / 180)) : 0;
      const dLat = (treeShadowDist * Math.cos(shadowRad)) / 111320;
      const dLng = (treeShadowDist * Math.sin(shadowRad)) / (111320 * Math.cos(35.161 * Math.PI / 180));

      for (const t of visibleTrees) {
        if (zoom >= 16 && sunPos && sunPos.isDaylight) {
          const shadowCircle = L.circle([t.lat + dLat, t.lng + dLng], {
            radius: t.radius || 4.5,
            color: 'transparent',
            weight: 0,
            fillColor: '#022c22',
            fillOpacity: 0.55,
            interactive: false
          });
          treeLayer.addLayer(shadowCircle);
        }

        // Tree Marker Icon (scale icon size with zoom)
        const size = zoom >= 16 ? 16 : 12;
        const treeIcon = L.divIcon({
          className: 'tree-canopy-icon',
          html: `<div style="font-size: ${size}px; filter: drop-shadow(0 0 5px rgba(16,185,129,0.9)); line-height: 1; text-align: center;">🌳</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([t.lat, t.lng], { icon: treeIcon });
        marker.bindTooltip(`🌳 ${t.name || '가로수 그늘 캐노피'} (반경 ${(t.radius || 4.5).toFixed(1)}m)`, { className: 'route-tooltip-custom' });
        treeLayer.addLayer(marker);
      }
    };

    renderTrees();
    map.on('moveend zoomend', renderTrees);

    return () => {
      map.off('moveend zoomend', renderTrees);
    };
  }, [layers.trees, sunPos, trees]);

  // 4. Dynamic CCTV Viewport Rendering (Instant Local Render + Non-blocking Background Sync)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cctvLayer = cctvLayerRef.current;
    if (!map || !cctvLayer) return;

    let abortController = null;
    let debounceTimer = null;

    const drawCctvItems = (items, zoom, center, currentBounds) => {
      const visibleCctvs = items.filter(cam =>
        cam.lat && cam.lng && currentBounds.contains([cam.lat, cam.lng])
      );

      visibleCctvs.sort((a, b) => {
        const dLatA = a.lat - center.lat;
        const dLngA = (a.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        const dLatB = b.lat - center.lat;
        const dLngB = (b.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
      });

      const maxLimit = zoom >= 17 ? 150 : 100;
      const prioritizedCctvs = visibleCctvs.slice(0, maxLimit);

      setCctvState({
        count: visibleCctvs.length,
        displayedCount: prioritizedCctvs.length,
        isZoomTooLow: false,
        zoom
      });

      cctvLayer.clearLayers();

      for (const cam of prioritizedCctvs) {
        const tooltipContent = `
          <strong>📹 방범 CCTV</strong><br/>
          <span style="color:#38bdf8; font-weight:700;">감시범위: 반경 ${cam.radius || 20}m</span><br/>
          <span style="color:#94a3b8; font-size:11px;">관할: ${cam.manager || '관할 지자체'}</span>
        `;

        const circle = L.circle([cam.lat, cam.lng], {
          radius: cam.radius || 20,
          color: '#0284c7',
          weight: 1.2,
          opacity: 0.65,
          fillColor: '#38bdf8',
          fillOpacity: zoom >= 16 ? 0.22 : 0.16,
          className: 'cctv-coverage-zone'
        });

        circle.on('mouseover', () => {
          circle.setStyle({ weight: 2.2, opacity: 0.95, fillOpacity: 0.40, color: '#38bdf8' });
        });
        circle.on('mouseout', () => {
          circle.setStyle({ weight: 1.2, opacity: 0.65, fillOpacity: zoom >= 16 ? 0.22 : 0.16, color: '#0284c7' });
        });

        circle.bindTooltip(tooltipContent, { className: 'route-tooltip-custom', sticky: true });
        cctvLayer.addLayer(circle);

        const sensorIcon = L.divIcon({
          className: 'cctv-core-dot',
          html: `<div style="width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; border: 1.5px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.95); cursor: pointer;"></div>`,
          iconSize: [6, 6],
          iconAnchor: [3, 3]
        });
        const dotMarker = L.marker([cam.lat, cam.lng], { icon: sensorIcon });
        dotMarker.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
        cctvLayer.addLayer(dotMarker);
      }
    };

    const renderVisibleCctvs = () => {
      if (!layers.cctv) {
        cctvLayer.clearLayers();
        setCctvState({ count: 0, displayedCount: 0, isZoomTooLow: false, zoom: map.getZoom() });
        return;
      }

      const zoom = map.getZoom();

      if (zoom < 13) {
        cctvLayer.clearLayers();
        setCctvState({ count: 0, displayedCount: 0, isZoomTooLow: true, zoom });
        return;
      }

      const currentBounds = map.getBounds();
      const bounds = currentBounds.pad(0.08);
      const center = map.getCenter();

      // 1. 0ms 즉시 렌더링: 누적 캐시(CLIENT_CCTV_CACHE)에서 현재 화면 내 마커를 즉시 표시
      const localMatches = [];
      for (const c of CLIENT_CCTV_CACHE.values()) {
        if (bounds.contains([c.lat, c.lng])) localMatches.push(c);
      }
      if (localMatches.length > 0) {
        drawCctvItems(localMatches, zoom, center, currentBounds);
      }

      // 2. 디바운스 후 서버리스 API 백그라운드 조회 (전국 모든 지역 지원 + 클라이언트 캐시 축적)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
          const params = new URLSearchParams({
            lat: center.lat.toFixed(6),
            lng: center.lng.toFixed(6),
            minLat: bounds.getSouth().toFixed(6),
            maxLat: bounds.getNorth().toFixed(6),
            minLng: bounds.getWest().toFixed(6),
            maxLng: bounds.getEast().toFixed(6),
            zoom: String(zoom)
          });

          const resp = await fetch(`/api/cctv/viewport?${params.toString()}`, { signal: abortController.signal });
          if (!resp.ok) return;

          const data = await resp.json();
          const rawCctvs = data.cctvs || [];
          if (rawCctvs.length === 0) return;

          const items = normalizeFacilityDataset(rawCctvs);
          const mergedMap = new Map();
          for (const lc of localMatches) mergedMap.set(lc.id, lc);
          for (const rc of items) {
            mergedMap.set(rc.id, rc);
            CLIENT_CCTV_CACHE.set(rc.id, rc);
          }

          drawCctvItems(Array.from(mergedMap.values()), map.getZoom(), map.getCenter(), map.getBounds());
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('CCTV dynamic fetch fallback error:', err);
          }
        }
      }, 150);
    };

    renderVisibleCctvs();
    map.on('moveend zoomend', renderVisibleCctvs);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (abortController) abortController.abort();
      map.off('moveend zoomend', renderVisibleCctvs);
    };
  }, [layers.cctv]);

  // 5. Dynamic Streetlight Viewport Rendering (Instant Local Render + Non-blocking Background Sync)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const streetlightLayer = streetlightLayerRef.current;
    if (!map || !streetlightLayer) return;

    let abortController = null;
    let debounceTimer = null;

    const drawStreetlightItems = (items, zoom, center, currentBounds) => {
      const visibleStreetlights = items.filter(light =>
        light.lat && light.lng && currentBounds.contains([light.lat, light.lng])
      );

      visibleStreetlights.sort((a, b) => {
        const dLatA = a.lat - center.lat;
        const dLngA = (a.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        const dLatB = b.lat - center.lat;
        const dLngB = (b.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
        return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
      });

      const maxLimit = zoom >= 17 ? 200 : 140;
      const prioritizedLights = visibleStreetlights.slice(0, maxLimit);

      setStreetlightState({
        count: visibleStreetlights.length,
        displayedCount: prioritizedLights.length,
        isZoomTooLow: false,
        zoom
      });

      streetlightLayer.clearLayers();

      for (const light of prioritizedLights) {
        const tooltipContent = `
          <strong>💡 안심 가로등</strong><br/>
          <span style="color:#fbbf24; font-weight:700;">조명범위: 반경 ${light.radius || 15}m</span><br/>
          <span style="color:#94a3b8; font-size:11px;">관할: ${light.manager || '관할 지자체'}</span>
        `;

        const circle = L.circle([light.lat, light.lng], {
          radius: light.radius || 15,
          color: '#f59e0b',
          weight: 1.0,
          opacity: 0.60,
          fillColor: '#fbbf24',
          fillOpacity: zoom >= 16 ? 0.24 : 0.16,
          className: 'streetlight-lighting-zone'
        });

        circle.on('mouseover', () => {
          circle.setStyle({ weight: 2.2, opacity: 0.95, fillOpacity: 0.42, color: '#fde047' });
        });
        circle.on('mouseout', () => {
          circle.setStyle({ weight: 1.0, opacity: 0.60, fillOpacity: zoom >= 16 ? 0.24 : 0.16, color: '#f59e0b' });
        });

        circle.bindTooltip(tooltipContent, { className: 'route-tooltip-custom', sticky: true });
        streetlightLayer.addLayer(circle);

        const lightCoreIcon = L.divIcon({
          className: 'streetlight-core-dot',
          html: `<div style="width: 5px; height: 5px; border-radius: 50%; background: #fbbf24; border: 1.5px solid #fffbeb; box-shadow: 0 0 8px rgba(245,158,11,0.95); cursor: pointer;"></div>`,
          iconSize: [5, 5],
          iconAnchor: [2.5, 2.5]
        });
        const dotMarker = L.marker([light.lat, light.lng], { icon: lightCoreIcon });
        dotMarker.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
        streetlightLayer.addLayer(dotMarker);
      }
    };

    const renderVisibleStreetlights = () => {
      if (!layers.streetlight) {
        streetlightLayer.clearLayers();
        setStreetlightState({ count: 0, displayedCount: 0, isZoomTooLow: false, zoom: map.getZoom() });
        return;
      }

      const zoom = map.getZoom();

      if (zoom < 13) {
        streetlightLayer.clearLayers();
        setStreetlightState({ count: 0, displayedCount: 0, isZoomTooLow: true, zoom });
        return;
      }

      const currentBounds = map.getBounds();
      const bounds = currentBounds.pad(0.08);
      const center = map.getCenter();

      // 1. 0ms 즉시 렌더링: 누적 캐시(CLIENT_STREETLIGHT_CACHE)에서 현재 화면 내 가로등을 즉시 표시
      const localMatches = [];
      for (const s of CLIENT_STREETLIGHT_CACHE.values()) {
        if (bounds.contains([s.lat, s.lng])) localMatches.push(s);
      }
      if (localMatches.length > 0) {
        drawStreetlightItems(localMatches, zoom, center, currentBounds);
      }

      // 2. 디바운스 후 서버리스 API 백그라운드 조회 (전국 모든 지역 도로망 지원 + 클라이언트 캐시 축적)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
          const params = new URLSearchParams({
            lat: center.lat.toFixed(6),
            lng: center.lng.toFixed(6),
            minLat: bounds.getSouth().toFixed(6),
            maxLat: bounds.getNorth().toFixed(6),
            minLng: bounds.getWest().toFixed(6),
            maxLng: bounds.getEast().toFixed(6),
            zoom: String(zoom)
          });

          const resp = await fetch(`/api/streetlight/viewport?${params.toString()}`, { signal: abortController.signal });
          if (!resp.ok) return;

          const data = await resp.json();
          const rawLights = data.streetlights || [];
          if (rawLights.length === 0) return;

          const items = normalizeFacilityDataset(rawLights);
          const mergedMap = new Map();
          for (const ls of localMatches) mergedMap.set(ls.id, ls);
          for (const rs of items) {
            mergedMap.set(rs.id, rs);
            CLIENT_STREETLIGHT_CACHE.set(rs.id, rs);
          }

          drawStreetlightItems(Array.from(mergedMap.values()), map.getZoom(), map.getCenter(), map.getBounds());
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Streetlight dynamic fetch fallback error:', err);
          }
        }
      }, 150);
    };

    renderVisibleStreetlights();
    map.on('moveend zoomend', renderVisibleStreetlights);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (abortController) abortController.abort();
      map.off('moveend zoomend', renderVisibleStreetlights);
    };
  }, [layers.streetlight]);

  // 2. Render Pedestrian Route with High-contrast Shade vs Sun Differentiation
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;
    routeLayer.clearLayers();

    const getRouteLatLngs = (r) => {
      if (!r) return [];
      if (r.latlngs && r.latlngs.length > 0) return r.latlngs;
      return [];
    };

    // 1. Standard Shortest Route (Baseline)
    const stdLatLngs = getRouteLatLngs(standardRoute);
    if (stdLatLngs.length > 1) {
      if (mode === 'standard') {
        const glowPoly = L.polyline(stdLatLngs, {
          color: '#38bdf8',
          weight: 12,
          opacity: 0.4,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routeLayer.addLayer(glowPoly);

        const standardPoly = L.polyline(stdLatLngs, {
          color: '#0284c7',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        });
        standardPoly.bindTooltip(
          `<strong>${travelMode === 'car' ? '차량 기준 경로' : '가장 짧은 도보 경로'}</strong><br/>거리: ${formatDistance(standardRoute.totalDistance)} | 소요: ${formatDuration(standardRoute.estimatedMinutes)}${travelMode === 'car' || standardRoute.shadeRatio == null ? '' : `<br/>그늘 비율: ${standardRoute.shadeRatio}%`}`,
          { className: 'route-tooltip-custom', sticky: true }
        );
        routeLayer.addLayer(standardPoly);
      } else {
        const standardPoly = L.polyline(stdLatLngs, {
          color: mapTheme === 'dark' ? '#64748b' : '#94a3b8',
          weight: 3.5,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round'
        });
        standardPoly.bindTooltip(`${travelMode === 'car' ? '차량 기준 경로' : '가장 짧은 도보 경로'} (${formatDistance(standardRoute.totalDistance)})`, { className: 'route-tooltip-custom' });
        routeLayer.addLayer(standardPoly);
      }
    }

    // 2. Recommended Custom Route (Gneul-ro Shade or Night Safe)
    const recLatLngs = getRouteLatLngs(recommendedRoute);
    if (recLatLngs.length > 1 && mode !== 'standard') {
      if (mode === 'shade') {
        // Gneul-ro Shade-Safe Route
        // Color-differentiates directly on the street:
        // Shaded sections = Vibrant Emerald Solid Line (#10b981)
        // Sunny/Exposed sections = Bright Amber Dashed Line (#f59e0b)
        const segments = recommendedRoute.segments && recommendedRoute.segments.length > 0
          ? recommendedRoute.segments
          : [{ latlngs: recLatLngs, isShaded: true }];

        for (const seg of segments) {
          if (!seg.latlngs || seg.latlngs.length < 2) continue;

          if (seg.isShaded) {
            // Shaded Walkway Segment (시원한 그늘 도보 구간)
            const glowPoly = L.polyline(seg.latlngs, {
              color: '#10b981',
              weight: 14,
              opacity: 0.50,
              lineCap: 'round',
              lineJoin: 'round'
            });
            routeLayer.addLayer(glowPoly);

            const mainPoly = L.polyline(seg.latlngs, {
              color: '#059669',
              weight: 7.5,
              opacity: 1.0,
              lineCap: 'round',
              lineJoin: 'round'
            });
            mainPoly.bindTooltip(
              `<strong>🌿 시원한 그늘 도보 구간</strong><br/>` +
              `건물 및 수목 그늘 차폐 · 체감온도 저감<br/>` +
              (recommendedRoute.shadeRatio != null ? `<span style="color:#34d399; font-weight:700;">전체 경로 그늘율: ${recommendedRoute.shadeRatio}% (${formatDistance(recommendedRoute.shadedDistance)})</span>` : ''),
              { className: 'route-tooltip-custom', sticky: true }
            );
            routeLayer.addLayer(mainPoly);
          } else {
            // Exposed Sunny Segment (직사광선 땡볕 구간)
            const glowPoly = L.polyline(seg.latlngs, {
              color: '#f59e0b',
              weight: 12,
              opacity: 0.35,
              lineCap: 'round',
              lineJoin: 'round'
            });
            routeLayer.addLayer(glowPoly);

            const mainPoly = L.polyline(seg.latlngs, {
              color: '#f59e0b',
              weight: 6.0,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            });
            mainPoly.bindTooltip(
              `<strong>☀️ 직사광선 노출 구간 (땡볕)</strong><br/>` +
              `자외선 주의 · 양산/선글라스 착용 권장<br/>` +
              `<span style="color:#fbbf24; font-weight:700;">직사광선 노출 거리: ${formatDistance(recommendedRoute.exposedDistance)}</span>`,
              { className: 'route-tooltip-custom', sticky: true }
            );
            routeLayer.addLayer(mainPoly);
          }
        }
      } else if (mode === 'night') {
        // Night Safe Route (CCTV Priority)
        const glowPoly = L.polyline(recLatLngs, {
          color: '#38bdf8',
          weight: 12,
          opacity: 0.45,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routeLayer.addLayer(glowPoly);

        const mainPoly = L.polyline(recLatLngs, {
          color: '#0284c7',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round'
        });

        mainPoly.bindTooltip(
          `<strong>야간 안심 추천 경로 (방범 CCTV 안전구역 연계)</strong><br/>거리: ${formatDistance(recommendedRoute.totalDistance)} | 소요: ${formatDuration(recommendedRoute.estimatedMinutes)}`,
          { className: 'route-tooltip-custom', sticky: true }
        );
        routeLayer.addLayer(mainPoly);
      }
    }

    // 3. Transit Route (Subway & Bus Multi-modal Legs)
    if (travelMode === 'transit' && transitRoute && Array.isArray(transitRoute.legs)) {
      for (const leg of transitRoute.legs) {
        if (!leg.path || leg.path.length < 2) continue;

        if (leg.mode === 'WALK') {
          // Walk section - dashed line
          const walkPoly = L.polyline(leg.path, {
            color: '#94a3b8',
            weight: 5,
            dashArray: '6, 8',
            opacity: 0.9,
            lineCap: 'round'
          });
          walkPoly.bindTooltip(`👣 도보 (${leg.sectionMinutes}분 · ${formatDistance(leg.distance)})`, { className: 'route-tooltip-custom', sticky: true });
          routeLayer.addLayer(walkPoly);
        } else {
          // Transit Vehicle Section (Bus or Subway)
          const glowPoly = L.polyline(leg.path, {
            color: leg.routeColor,
            weight: 14,
            opacity: 0.4,
            lineCap: 'round',
            lineJoin: 'round'
          });
          routeLayer.addLayer(glowPoly);

          const mainPoly = L.polyline(leg.path, {
            color: leg.routeColor,
            weight: 6.5,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round'
          });
          const iconPrefix = leg.mode === 'SUBWAY' ? '🚇' : '🚌';
          mainPoly.bindTooltip(`<strong>${iconPrefix} ${leg.routeName}</strong><br/>${leg.startName} ➔ ${leg.endName} (${leg.sectionMinutes}분)`, { className: 'route-tooltip-custom', sticky: true });
          routeLayer.addLayer(mainPoly);

          // Draw Station / Stop markers along transit leg
          if (Array.isArray(leg.stations)) {
            for (const st of leg.stations) {
              const stIcon = L.divIcon({
                className: 'transit-stop-marker',
                html: `<div style="width: 10px; height: 10px; border-radius: 50%; background: #ffffff; border: 2.5px solid ${leg.routeColor}; box-shadow: 0 1px 4px rgba(0,0,0,0.5); cursor: pointer;"></div>`,
                iconSize: [10, 10],
                iconAnchor: [5, 5]
              });
              const stMarker = L.marker([st.lat, st.lng], { icon: stIcon });
              stMarker.bindTooltip(`<strong>${iconPrefix} ${st.name}</strong><br/><span style="color:#38bdf8; font-size:10px;">터치하여 실시간 도착 시간 확인</span>`, { className: 'route-tooltip-custom' });
              stMarker.on('click', () => {
                openTransitArrivalPopup({ name: st.name, category: leg.mode === 'SUBWAY' ? 'subway' : 'bus' }, [st.lat, st.lng]);
              });
              routeLayer.addLayer(stMarker);
            }
          }
        }
      }
    }
  }, [mode, recommendedRoute, standardRoute, transitRoute, mapTheme, travelMode]);

  // 3. Interactive Markers (User GPS, Start A, Target B)
  useEffect(() => {
    const markLayer = markersLayerRef.current;
    if (!markLayer) return;
    markLayer.clearLayers();

    // User GPS Dot
    if (userGps && userGps.lat && userGps.lng) {
      const gpsIcon = L.divIcon({
        className: 'user-gps-marker',
        html: `
          <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
            <div class="gps-pulse-ring" style="position: absolute; width: 30px; height: 30px; border-radius: 50%; background: rgba(56, 189, 248, 0.45);"></div>
            <div style="width: 14px; height: 14px; border-radius: 50%; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(56,189,248,0.9); z-index: 4;"></div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const gpsMarker = L.marker([userGps.lat, userGps.lng], { icon: gpsIcon });
      gpsMarker.bindTooltip('<strong>📍 내 현재 위치 (GPS)</strong>', { className: 'route-tooltip-custom' });
      markLayer.addLayer(gpsMarker);
    }

    // Start Pin (A - Emerald)
    const sLat = startPoint?.lat ?? NODES[startNodeId]?.lat;
    const sLng = startPoint?.lng ?? NODES[startNodeId]?.lng;
    const sName = startPoint?.name || startPoint?.roadAddress || NODES[startNodeId]?.roadAddress || '출발지';

    if (sLat && sLng) {
      const startIcon = L.divIcon({
        className: 'custom-pin-start',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div class="pin-marker-pulse" style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(16, 185, 129, 0.4);"></div>
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #10b981; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 2;">A</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const startMarker = L.marker([sLat, sLng], { icon: startIcon, draggable: true });
      startMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (setStartPoint) {
          setStartPoint({ name: '선택한 위치 (A)', roadAddress: `위도 ${lat.toFixed(4)}, 경도 ${lng.toFixed(4)}`, lat, lng });
        }
        const nearest = findNearestNode(lat, lng);
        if (nearest) setStartNodeId(nearest);
      });
      startMarker.bindTooltip(
        `<strong>📍 출발지 (A)</strong><br/><span style="color:#34d399; font-weight:700;">${sName}</span>`,
        { className: 'route-tooltip-custom' }
      );
      markLayer.addLayer(startMarker);
    }

    // Target Pin (B - Rose)
    const tLat = targetPoint?.lat ?? NODES[targetNodeId]?.lat;
    const tLng = targetPoint?.lng ?? NODES[targetNodeId]?.lng;
    const tName = targetPoint?.name || targetPoint?.roadAddress || NODES[targetNodeId]?.roadAddress || '도착지';

    if (tLat && tLng) {
      const targetIcon = L.divIcon({
        className: 'custom-pin-target',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div class="pin-marker-pulse" style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(244, 63, 94, 0.4);"></div>
            <div style="width: 24px; height: 24px; border-radius: 50%; background: #f43f5e; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 2;">B</div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const targetMarker = L.marker([tLat, tLng], { icon: targetIcon, draggable: true });
      targetMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (setTargetPoint) {
          setTargetPoint({ name: '선택한 위치 (B)', roadAddress: `위도 ${lat.toFixed(4)}, 경도 ${lng.toFixed(4)}`, lat, lng });
        }
        const nearest = findNearestNode(lat, lng);
        if (nearest) setTargetNodeId(nearest);
      });
      targetMarker.bindTooltip(
        `<strong>📍 도착지 (B)</strong><br/><span style="color:#f43f5e; font-weight:700;">${tName}</span>`,
        { className: 'route-tooltip-custom' }
      );
      markLayer.addLayer(targetMarker);
    }
  }, [userGps, startPoint, targetPoint, startNodeId, targetNodeId, setStartPoint, setTargetPoint, setStartNodeId, setTargetNodeId]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainerRef}
        className={`map-viewport ${mapTheme === 'dark' ? 'map-theme-dark' : 'map-theme-light'}`}
        style={{ cursor: pinSelectMode ? 'crosshair' : 'grab' }}
      />

      {/* Floating Route Shade Legend (Clear visual guide on the street) */}
      {mode === 'shade' && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '20px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          pointerEvents: 'auto',
          fontSize: '0.74rem'
        }}>
          <div style={{ fontSize: '0.70rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            보행로 일조/그늘 상태 구분
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '22px', height: '5px', borderRadius: '3px', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px rgba(16,185,129,0.8)' }}></span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>시원한 그늘 구간 (초록)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '22px', height: '4px', borderRadius: '2px', background: '#f59e0b', display: 'inline-block' }}></span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>직사광선 땡볕 구간 (주황)</span>
          </div>
        </div>
      )}




    </div>
  );
}
