import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, SunMedium, Shield } from 'lucide-react';
import { NODES, MAP_CENTER, DEFAULT_ZOOM } from '../data/urbanNetwork';
import { findNearestNode } from '../engine/routingEngine';

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
  mapTheme = 'dark'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [cctvState, setCctvState] = useState({
    count: 0,
    displayedCount: 0,
    isZoomTooLow: false,
    zoom: 16
  });

  // Layer groups refs (Clean & uncluttered: CCTV, Routes, Markers)
  const routeLayerRef = useRef(null);
  const cctvLayerRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: userGps ? [userGps.lat, userGps.lng] : MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false
    });

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Initialize Layer Groups in proper z-order
    cctvLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
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

    if (recommendedRoute && recommendedRoute.latlngs && recommendedRoute.latlngs.length > 1) {
      const bounds = L.latLngBounds(recommendedRoute.latlngs);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
      return;
    }

    const bounds = L.latLngBounds([[sLat, sLng], [tLat, tLng]]);
    map.fitBounds(bounds, { padding: [100, 100], maxZoom: 17 });
  }, [startPoint?.lat, startPoint?.lng, targetPoint?.lat, targetPoint?.lng, recommendedRoute]);

  // 1. Dynamic CCTV Viewport Rendering (Nationwide Government CCTV Integration)
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

      if (zoom < 15) {
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
        const items = data.cctvs || [];

        setCctvState({
          count: data.count || items.length,
          displayedCount: items.length,
          isZoomTooLow: false,
          zoom
        });

        cctvLayer.clearLayers();

        for (const cam of items) {
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

          const size = zoom >= 16 ? 18 : 13;
          const cctvIcon = L.divIcon({
            className: 'cctv-badge',
            html: `<div style="background: #0284c7; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${zoom >= 16 ? 9 : 7}px; font-weight: bold; border: 1.5px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.8); cursor: pointer;">📹</div>`,
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
          `<strong>기본 최단 도보 경로</strong><br/>거리: ${standardRoute.totalDistance}m | 소요: ${standardRoute.estimatedMinutes}분<br/>그늘 비율: ${standardRoute.shadeRatio}%`,
          { className: 'route-tooltip-custom', sticky: true }
        );
        routeLayer.addLayer(standardPoly);
      } else {
        const standardPoly = L.polyline(stdLatLngs, {
          color: mapTheme === 'dark' ? '#64748b' : '#94a3b8',
          weight: 3.5,
          opacity: 0.55,
          dashArray: '6, 8',
          lineCap: 'round',
          lineJoin: 'round'
        });
        standardPoly.bindTooltip(`기본 최단 경로 (${standardRoute.totalDistance}m)`, { className: 'route-tooltip-custom' });
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
              `건물 및 수목 그늘 차폐 · 체감온도 -2.5℃ 저감<br/>` +
              `<span style="color:#34d399; font-weight:700;">전체 경로 그늘율: ${recommendedRoute.shadeRatio}% (${recommendedRoute.shadedDistance}m)</span>`,
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
              dashArray: '8, 8',
              lineCap: 'round',
              lineJoin: 'round'
            });
            mainPoly.bindTooltip(
              `<strong>☀️ 직사광선 노출 구간 (땡볕)</strong><br/>` +
              `자외선 주의 · 양산/선글라스 착용 권장<br/>` +
              `<span style="color:#fbbf24; font-weight:700;">직사광선 노출 거리: ${recommendedRoute.exposedDistance}m</span>`,
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
          `<strong>야간 안심 추천 경로 (방범 CCTV 안전구역 연계)</strong><br/>거리: ${recommendedRoute.totalDistance}m | 소요: ${recommendedRoute.estimatedMinutes}분`,
          { className: 'route-tooltip-custom', sticky: true }
        );
        routeLayer.addLayer(mainPoly);
      }
    }
  }, [mode, recommendedRoute, standardRoute, mapTheme]);

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
            <span style={{ color: '#34d399', fontWeight: 600 }}>시원한 그늘 구간 (실선)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '22px', height: '4px', borderRadius: '2px', borderBottom: '3px dashed #f59e0b', display: 'inline-block' }}></span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>직사광선 땡볕 구간 (점선)</span>
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

      {/* Floating GPS Button on Map */}
      <button
        className="floating-map-gps-btn"
        onClick={onRequestGps}
        title="내 현재 GPS 위치로 지도 이동"
      >
        <Crosshair size={18} />
      </button>
    </div>
  );
}
