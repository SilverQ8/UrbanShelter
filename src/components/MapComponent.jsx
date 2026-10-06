import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SunMedium, Shield } from 'lucide-react';
import { MapLibreBasemap } from '../utils/MapLibreBasemap';
import { NODES, MAP_CENTER, DEFAULT_ZOOM } from '../data/urbanNetwork';
import { formatDistance, formatDuration } from '../utils/format';
import { filterValidUrbanMarkers, isInvalidOceanCoordinate } from '../utils/geoSanity';
import { normalizeFacilityDataset } from '../utils/geoConverter';

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
  sunPos,
  layers,
  mapTheme = 'dark',
  focusPoint = null,
  buildings = [],
  trees = [],
  travelMode = 'foot',
  locateTarget = null,
  poiSelected = {}
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const basemapRef = useRef(null);
  const latestThemeRef = useRef(mapTheme);
  const latestPoiRef = useRef(poiSelected);
  latestThemeRef.current = mapTheme;
  latestPoiRef.current = poiSelected;
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
  const treeLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const cctvLayerRef = useRef(null);
  const streetlightLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

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

    // 이미지 타일 대신 3D 지도와 같은 벡터 지도를 바닥에 깐다(장소 아이콘 선택·테마가 3D와 동일)
    const basemap = new MapLibreBasemap({ theme: latestThemeRef.current, poiSelected: latestPoiRef.current }).addTo(map);
    basemapRef.current = basemap;

    // Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups in proper z-order
    // 건물 윤곽·가로수는 CCTV·가로등·경로보다 아래에 깐다
    buildingLayerRef.current = L.layerGroup().addTo(map);
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

  // 테마가 바뀌면 바닥 지도에 반영한다
  useEffect(() => {
    if (basemapRef.current) basemapRef.current.setTheme(mapTheme);
  }, [mapTheme]);

  useEffect(() => {
    if (basemapRef.current) basemapRef.current.setPoiSelected(poiSelected);
  }, [poiSelected]);

  // 건물 그림자는 2D 지도에서 그리지 않는다. 보행자 시점(3D)에서만 표시한다.

  // 2. Render 3D Building Footprints (Elevated Glowing Blocks)
  useEffect(() => {
    const buildingLayer = buildingLayerRef.current;
    if (!buildingLayer) return;
    buildingLayer.clearLayers();

    if (!layers.buildings) return;

    let badgeCount = 0;
    for (const b of buildings) {
      // 실제 건물이 수백 채일 때는 지도가 파랗게 뒤덮이지 않도록 윤곽선과 채움을 옅게 한다
      const dense = buildings.length > 100;
      const poly = L.polygon(b.polygon, {
        color: '#38bdf8',
        weight: dense ? 1 : 2,
        opacity: dense ? 0.45 : 0.85,
        fillColor: mapTheme === 'dark' ? '#0369a1' : '#0284c7',
        fillOpacity: dense ? 0.18 : 0.45
      });

      const floorText = b.groundFloors
        ? `지상 ${b.groundFloors}층 (공식 표제부)`
        : `~${Math.max(1, Math.round(b.height / 3.2))}층${b.heightSource === 'estimate' ? ' (추정)' : ''}`;

      const sourceTag = b.heightSource === 'official_heit'
        ? ' · 국토교통부 실측'
        : b.heightSource === 'official_floor_calc'
        ? ' · 건축HUB 층수 계산'
        : b.heightSource === 'estimate'
        ? ' · 추정값'
        : '';

      poly.bindTooltip(
        `<strong>🏢 ${b.name}</strong><br/>` +
        `<span style="color:#38bdf8; font-size:11px;">건물 높이: ${b.height}m (${floorText}${sourceTag})</span><br/>` +
        `<span style="color:#34d399; font-size:10px;">실시간 태양 위치 기반 그늘 분석 적용</span>`,
        { className: 'route-tooltip-custom' }
      );
      buildingLayer.addLayer(poly);

      // 높이 라벨은 지도가 복잡해지지 않도록 높이를 확인했거나 높은 건물에만 붙인다
      if (b.heightSource === 'estimate' && b.height < 30) continue;
      if (badgeCount >= 80) continue;
      badgeCount += 1;
      const centerLat = b.polygon.reduce((sum, p) => sum + p[0], 0) / b.polygon.length;
      const centerLng = b.polygon.reduce((sum, p) => sum + p[1], 0) / b.polygon.length;
      const bldIcon = L.divIcon({
        className: 'building-height-badge',
        html: `
          <div style="background: rgba(15, 23, 42, 0.85); color: #38bdf8; padding: 1px 4px; border-radius: 4px; font-size: 9px; font-weight: 700; border: 1px solid rgba(56,189,248,0.5); white-space: nowrap; pointer-events: none; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
            🏢 ${b.height}m
          </div>
        `,
        iconSize: [40, 16],
        iconAnchor: [20, 8]
      });
      const badgeMarker = L.marker([centerLat, centerLng], { icon: bldIcon, interactive: false });
      buildingLayer.addLayer(badgeMarker);
    }
  }, [layers.buildings, mapTheme, buildings]);

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

  // 4. Dynamic CCTV Viewport Rendering (Nationwide Government CCTV Integration)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const cctvLayer = cctvLayerRef.current;
    if (!map || !cctvLayer) return;

    let abortController = null;

    const renderVisibleCctvs = async () => {
      cctvLayer.clearLayers();
      if (!layers.cctv) {
        setCctvState({ count: 0, displayedCount: 0, isZoomTooLow: false, zoom: map.getZoom() });
        return;
      }

      const zoom = map.getZoom();

      if (zoom < 13) {
        setCctvState({ count: 0, displayedCount: 0, isZoomTooLow: true, zoom });
        return;
      }

      const bounds = map.getBounds().pad(0.08);
      const center = map.getCenter();

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
        if (!resp.ok) throw new Error('CCTV viewport HTTP error');

        const data = await resp.json();
        const rawCctvs = data.cctvs || [];
        const items = normalizeFacilityDataset(rawCctvs);

        // 1. 화면 밖 마커 완전 배제 (현재 뷰포트 strictBounds 내 좌표만 필터)
        const currentBounds = map.getBounds();
        const visibleCctvs = items.filter(cam =>
          cam.lat && cam.lng && currentBounds.contains([cam.lat, cam.lng])
        );

        // 2. 화면 중앙(center)과의 거리가 가장 가까운 마커부터 우선 정렬 (Center-First)
        visibleCctvs.sort((a, b) => {
          const dLatA = a.lat - center.lat;
          const dLngA = (a.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
          const dLatB = b.lat - center.lat;
          const dLngB = (b.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
          return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
        });

        // 3. 화면 중앙 우선 표시 한도 적용 (외곽 마커는 한도 초과 시 배제)
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
          if (zoom >= 16) {
            const circle = L.circle([cam.lat, cam.lng], {
              radius: cam.radius || 20,
              color: '#0284c7',
              weight: 1.2,
              opacity: 0.6,
              fillColor: '#38bdf8',
              fillOpacity: 0.16
            });
            circle.bindTooltip(`📹 ${cam.name}<br/>안전반경 20m`, { className: 'route-tooltip-custom' });
            cctvLayer.addLayer(circle);
          }

          const size = zoom >= 16 ? 18 : zoom >= 14 ? 13 : 10;
          const cctvIcon = L.divIcon({
            className: 'cctv-badge',
            html: `<div style="background: #0284c7; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${zoom >= 16 ? 9 : zoom >= 14 ? 7 : 5}px; font-weight: bold; border: 1.5px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.8); cursor: pointer;">📹</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          });

          const tooltipContent = `
            <strong>📹 ${cam.name}</strong><br/>
            <span style="color:#94a3b8; font-size:11px;">${cam.address || ''}</span><br/>
            <div style="margin-top:4px; font-size:11px;">
              설치목적: <span style="color:#38bdf8;">${cam.purpose || '방범'}</span> | 
              카메라: <span style="color:#34d399;">${cam.cameraCount || 1}대</span><br/>
              관리기관: ${cam.manager || '관할구청'} (안전반경 20m)
            </div>
          `;
          const marker = L.marker([cam.lat, cam.lng], { icon: cctvIcon });
          marker.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
          cctvLayer.addLayer(marker);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('CCTV dynamic fetch fallback error:', err);
        }
      }
    };

    renderVisibleCctvs();
    map.on('moveend zoomend', renderVisibleCctvs);

    return () => {
      if (abortController) abortController.abort();
      map.off('moveend zoomend', renderVisibleCctvs);
    };
  }, [layers.cctv]);

  // 5. Dynamic Streetlight Viewport Rendering (15m Illumination Zone)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const streetlightLayer = streetlightLayerRef.current;
    if (!map || !streetlightLayer) return;

    let abortController = null;

    const renderVisibleStreetlights = async () => {
      streetlightLayer.clearLayers();
      if (!layers.streetlight) {
        setStreetlightState({ count: 0, displayedCount: 0, isZoomTooLow: false, zoom: map.getZoom() });
        return;
      }

      const zoom = map.getZoom();

      if (zoom < 13) {
        setStreetlightState({ count: 0, displayedCount: 0, isZoomTooLow: true, zoom });
        return;
      }

      const bounds = map.getBounds().pad(0.08);
      const center = map.getCenter();

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
        if (!resp.ok) throw new Error('Streetlight viewport HTTP error');

        const data = await resp.json();
        const rawLights = data.streetlights || [];
        const items = normalizeFacilityDataset(rawLights);

        // 1. 화면 밖 마커 완전 배제 (현재 뷰포트 strictBounds 내 좌표만 필터)
        const currentBounds = map.getBounds();
        const visibleStreetlights = items.filter(light =>
          light.lat && light.lng && currentBounds.contains([light.lat, light.lng])
        );

        // 2. 화면 중앙(center)과의 거리가 가장 가까운 가로등부터 우선 정렬 (Center-First)
        visibleStreetlights.sort((a, b) => {
          const dLatA = a.lat - center.lat;
          const dLngA = (a.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
          const dLatB = b.lat - center.lat;
          const dLngB = (b.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
          return (dLatA * dLatA + dLngA * dLngA) - (dLatB * dLatB + dLngB * dLngB);
        });

        // 3. 화면 중앙 우선 표시 한도 적용 (외곽 가로등은 한도 초과 시 배제)
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
          if (zoom >= 16) {
            // 15m radius warm illumination buffer (Golden-Amber glow)
            const circle = L.circle([light.lat, light.lng], {
              radius: light.radius || 15,
              color: '#f59e0b',
              weight: 1.2,
              opacity: 0.65,
              fillColor: '#fbbf24',
              fillOpacity: 0.18
            });
            circle.bindTooltip(`💡 ${light.name}<br/>안심 조명반경 15m`, { className: 'route-tooltip-custom' });
            streetlightLayer.addLayer(circle);
          }

          const size = zoom >= 16 ? 18 : zoom >= 14 ? 13 : 10;
          const lightIcon = L.divIcon({
            className: 'streetlight-badge',
            html: `<div style="background: #d97706; color: #fffbeb; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${zoom >= 16 ? 10 : zoom >= 14 ? 7 : 5}px; font-weight: bold; border: 1.5px solid #fef3c7; box-shadow: 0 0 10px rgba(245,158,11,0.9); cursor: pointer;">💡</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          });

          const typeLabel = light.type === 'smart_led' ? '스마트 LED 안심등'
            : light.type === 'coastal_led' ? '해안 보행로 고효율 LED'
            : light.type === 'smart_security' ? '스마트 보안등'
            : light.type === 'security' ? '골목길 안심보안등'
            : light.type === 'solar_led' ? '친환경 태양광 LED'
            : '표준 보행 가로등';

          const tooltipContent = `
            <strong>💡 ${light.name}</strong><br/>
            <span style="color:#94a3b8; font-size:11px;">${light.address || ''}</span><br/>
            <div style="margin-top:4px; font-size:11px;">
              조명종류: <span style="color:#f59e0b;">${typeLabel}</span><br/>
              조명밝기: <span style="color:#fbbf24; font-weight:600;">${light.lumens ? light.lumens.toLocaleString() + ' lm' : '고조도 LED'}</span> | 
              조명반경: <span style="color:#34d399;">15m 안심조명구역</span><br/>
              관리기관: ${light.manager || '관할구청 도로시설과'}
            </div>
          `;
          const marker = L.marker([light.lat, light.lng], { icon: lightIcon });
          marker.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
          streetlightLayer.addLayer(marker);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Streetlight dynamic fetch fallback error:', err);
        }
      }
    };

    renderVisibleStreetlights();
    map.on('moveend zoomend', renderVisibleStreetlights);

    return () => {
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
  }, [mode, recommendedRoute, standardRoute, mapTheme, travelMode]);

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

      {/* Floating Solar Simulation Compass Dial on Map */}
      {sunPos && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '54px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(12px)',
          border: '1.5px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'auto'
        }}>
          {/* Rotating Sun Direction Dial */}
          <div style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.20)',
            border: '2px solid #f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(245,158,11,0.5)'
          }}>
            <div style={{
              transform: `rotate(${sunPos.azimuthDeg}deg)`,
              transition: 'transform 0.15s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', lineHeight: 1 }}>☀️</span>
              <span style={{ width: '2.5px', height: '8px', background: '#f59e0b', borderRadius: '1px' }}></span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>
                태양 고도 {sunPos.altitudeDeg}°
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                방위 {sunPos.azimuthDeg}°
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: sunPos.uvEstimate >= 7 ? '#f43f5e' : '#34d399', fontWeight: 700 }}>
              {sunPos.sunStatus} (자외선 {sunPos.uvEstimate})
            </div>
          </div>
        </div>
      )}

      {/* Real-time CCTV Visible Counter Pill on Map */}
      {layers.cctv && (
        <div className={`map-cctv-counter-pill ${cctvState.isZoomTooLow ? 'zoom-hint' : ''}`}>
          {cctvState.isZoomTooLow ? (
            <span>🔍 지도를 확대하면(골목·거리 축척) 해당 지역의 방범 CCTV가 표시됩니다</span>
          ) : (
            <>
              <span className="live-dot-pulse"></span>
              <span>현재 화면 내 방범 CCTV <strong>{cctvState.count}</strong>개소 안전보호구역 작동 중</span>
            </>
          )}
        </div>
      )}

      {/* Real-time Streetlight Visible Counter Pill on Map */}
      {layers.streetlight && (
        <div className={`map-cctv-counter-pill map-streetlight-counter-pill ${streetlightState.isZoomTooLow ? 'zoom-hint' : ''}`}>
          {streetlightState.isZoomTooLow ? (
            <span>🔍 지도를 확대하면(골목·거리 축척) 가로등/보안등(15m 조명반경)이 표시됩니다</span>
          ) : (
            <>
              <span className="live-dot-pulse-amber"></span>
              <span>현재 화면 내 가로등/보안등 <strong>{streetlightState.count}</strong>개소 (15m 안심조도 작동 중)</span>
            </>
          )}
        </div>
      )}

      {/* Real-time Roadside Trees Visible Counter Pill on Map */}
      {layers.trees && (
        <div className={`map-cctv-counter-pill map-tree-counter-pill ${treeState.isZoomTooLow ? 'zoom-hint' : ''}`}>
          {treeState.isZoomTooLow ? (
            <span>🔍 지도를 확대하면(골목·거리 축척) 가로수 그늘 캐노피가 표시됩니다</span>
          ) : (
            <>
              <span className="live-dot-pulse-emerald"></span>
              <span>현재 화면 내 가로수 그늘 <strong>{treeState.count}</strong>그루 작동 중</span>
            </>
          )}
        </div>
      )}

    </div>
  );
}
