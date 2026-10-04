import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair } from 'lucide-react';
import { NODES, EDGES, STREETLIGHTS, CCTVS, MAP_CENTER, DEFAULT_ZOOM } from '../data/urbanNetwork';
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
  nightRoute,
  rainRoute,
  layers,
  mapTheme = 'dark'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Layer groups refs
  const networkLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const streetlightsLayerRef = useRef(null);
  const cctvLayerRef = useRef(null);
  const coveredLayerRef = useRef(null);
  const deadZonesLayerRef = useRef(null);
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

    // Layer Groups
    networkLayerRef.current = L.layerGroup().addTo(map);
    coveredLayerRef.current = L.layerGroup().addTo(map);
    deadZonesLayerRef.current = L.layerGroup().addTo(map);
    streetlightsLayerRef.current = L.layerGroup().addTo(map);
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

  // Pan to User GPS location when GPS is updated
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !userGps) return;
    map.flyTo([userGps.lat, userGps.lng], 17, { duration: 1.2 });
  }, [userGps]);

  // Fit bounds when Start and Target change or when Route is updated
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (recommendedRoute && recommendedRoute.latlngs && recommendedRoute.latlngs.length > 1) {
      const bounds = L.latLngBounds(recommendedRoute.latlngs);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17 });
      return;
    }

    const sLat = startPoint?.lat ?? NODES[startNodeId]?.lat;
    const sLng = startPoint?.lng ?? NODES[startNodeId]?.lng;
    const tLat = targetPoint?.lat ?? NODES[targetNodeId]?.lat;
    const tLng = targetPoint?.lng ?? NODES[targetNodeId]?.lng;

    if (sLat && sLng && tLat && tLng && (sLat !== tLat || sLng !== tLng)) {
      const bounds = L.latLngBounds([[sLat, sLng], [tLat, tLng]]);
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 17 });
    }
  }, [startPoint, targetPoint, startNodeId, targetNodeId, recommendedRoute]);

  // Handle map clicks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      const nearestId = findNearestNode(lat, lng);
      if (!nearestId) return;

      if (pinSelectMode === 'start') {
        if (nearestId !== targetNodeId) {
          setStartNodeId(nearestId);
        }
        setPinSelectMode(null);
      } else if (pinSelectMode === 'target') {
        if (nearestId !== startNodeId) {
          setTargetNodeId(nearestId);
        }
        setPinSelectMode(null);
      } else {
        setTargetNodeId(nearestId);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [pinSelectMode, startNodeId, targetNodeId, setStartNodeId, setTargetNodeId, setPinSelectMode]);

  // Render Base Road Network
  useEffect(() => {
    const netLayer = networkLayerRef.current;
    if (!netLayer) return;
    netLayer.clearLayers();

    for (const edge of EDGES) {
      const uNode = NODES[edge.u];
      const vNode = NODES[edge.v];
      if (!uNode || !vNode) continue;

      const poly = L.polyline(
        [[uNode.lat, uNode.lng], [vNode.lat, vNode.lng]],
        {
          color: mapTheme === 'dark' ? '#475569' : '#94a3b8',
          weight: 4,
          opacity: 0.5,
          dashArray: edge.layer === -1 ? '4, 4' : null
        }
      );
      poly.bindTooltip(
        `<strong>${edge.name}</strong><br/>길이: ${edge.length}m | ${edge.covered ? '비가림/지하 통로' : '지상 보도'}<br/>가로등 조명률: ${Math.round((edge.litLengthRatio||0)*100)}% | CCTV: ${edge.cctvCount||0}대`,
        { className: 'route-tooltip-custom', sticky: true }
      );
      netLayer.addLayer(poly);
    }
  }, [mapTheme]);

  // Render 2.3 Layer Toggles: Streetlights, CCTV, Covered Corridors, Dead Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Streetlights & 15m radius buffer
    const slLayer = streetlightsLayerRef.current;
    slLayer.clearLayers();
    if (layers.streetlights) {
      for (const sl of STREETLIGHTS) {
        const circle = L.circle([sl.lat, sl.lng], {
          radius: sl.radius,
          color: '#f59e0b',
          weight: 1.2,
          opacity: 0.7,
          fillColor: '#fde047',
          fillOpacity: 0.22
        });
        circle.bindTooltip(`가로등 (${sl.type})<br/>유효 조명 반경 15m`, { className: 'route-tooltip-custom' });
        slLayer.addLayer(circle);

        const lampIcon = L.divIcon({
          className: 'lamp-marker',
          html: `<div style="width: 8px; height: 8px; border-radius: 50%; background: #fef08a; box-shadow: 0 0 10px #eab308; border: 1px solid #ca8a04;"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4]
        });
        const marker = L.marker([sl.lat, sl.lng], { icon: lampIcon });
        slLayer.addLayer(marker);
      }
    }

    // 2. Real CCTV & 20m safety zone
    const cctvLayer = cctvLayerRef.current;
    cctvLayer.clearLayers();
    if (layers.cctv) {
      for (const cam of CCTVS) {
        const circle = L.circle([cam.lat, cam.lng], {
          radius: cam.radius,
          color: '#0284c7',
          weight: 1.2,
          opacity: 0.6,
          fillColor: '#38bdf8',
          fillOpacity: 0.16
        });

        const tooltipContent = `
          <strong>📹 ${cam.name}</strong><br/>
          <span style="color:#94a3b8; font-size:11px;">${cam.address || ''}</span><br/>
          <div style="margin-top:4px; font-size:11px;">
            설치목적: <span style="color:#38bdf8;">${cam.purpose || '방범'}</span> | 
            카메라: <span style="color:#34d399;">${cam.cameraCount || 1}대</span><br/>
            관리기관: ${cam.manager || '해운대구청'} (안전반경 20m)
          </div>
        `;
        circle.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
        cctvLayer.addLayer(circle);

        const cctvIcon = L.divIcon({
          className: 'cctv-badge',
          html: `<div style="background: #0284c7; color: white; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 1.5px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.8);">📹</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        const marker = L.marker([cam.lat, cam.lng], { icon: cctvIcon });
        marker.bindTooltip(tooltipContent, { className: 'route-tooltip-custom' });
        cctvLayer.addLayer(marker);
      }
    }

    // 3. Covered / Underground Corridors
    const covLayer = coveredLayerRef.current;
    covLayer.clearLayers();
    if (layers.covered) {
      for (const edge of EDGES) {
        if (edge.covered || edge.layer === -1) {
          const uNode = NODES[edge.u];
          const vNode = NODES[edge.v];
          if (!uNode || !vNode) continue;

          const poly = L.polyline([[uNode.lat, uNode.lng], [vNode.lat, vNode.lng]], {
            color: '#10b981',
            weight: 7,
            opacity: 0.65,
            dashArray: '8, 6'
          });
          poly.bindTooltip(`비가림 통로: ${edge.name} (${edge.shelterType})`, { className: 'route-tooltip-custom' });
          covLayer.addLayer(poly);
        }
      }
    }

    // 4. Dead Zones (암흑 구간)
    const deadLayer = deadZonesLayerRef.current;
    deadLayer.clearLayers();
    if (layers.deadZones) {
      for (const edge of EDGES) {
        if (edge.deadZoneLength > 20) {
          const uNode = NODES[edge.u];
          const vNode = NODES[edge.v];
          if (!uNode || !vNode) continue;

          const poly = L.polyline([[uNode.lat, uNode.lng], [vNode.lat, vNode.lng]], {
            color: '#f43f5e',
            weight: 5,
            opacity: 0.85,
            dashArray: '5, 6'
          });
          poly.bindTooltip(`⚠️ 조명 미설치 암흑 사각지대: ${edge.deadZoneLength}m (${edge.name})`, { className: 'route-tooltip-custom' });
          deadLayer.addLayer(poly);
        }
      }
    }
  }, [layers]);

  // Render 2.2 다중 경로 시각화 (Polyline Overlay)
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;
    routeLayer.clearLayers();

    // Helper to get coordinates array from route object
    const getRouteLatLngs = (r) => {
      if (!r) return [];
      if (r.latlngs && r.latlngs.length > 0) return r.latlngs;
      if (r.nodeIds && r.nodeIds.length > 0) {
        return r.nodeIds.filter(id => NODES[id]).map(id => [NODES[id].lat, NODES[id].lng]);
      }
      return [];
    };

    // 1. Standard Shortest Route
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
        standardPoly.bindTooltip(`<strong>기본 최단 도보 경로</strong><br/>거리: ${standardRoute.totalDistance}m | 소요시간: ${standardRoute.estimatedMinutes}분`, { className: 'route-tooltip-custom', sticky: true });
        routeLayer.addLayer(standardPoly);
      } else {
        const standardPoly = L.polyline(stdLatLngs, {
          color: mapTheme === 'dark' ? '#94a3b8' : '#64748b',
          weight: 4,
          opacity: 0.65,
          dashArray: '6, 8',
          lineCap: 'round',
          lineJoin: 'round'
        });
        standardPoly.bindTooltip(`기본 최단 경로 (${standardRoute.totalDistance}m)`, { className: 'route-tooltip-custom' });
        routeLayer.addLayer(standardPoly);
      }
    }

    // 2. Recommended Custom Route (안심/우천 추천 경로)
    const recLatLngs = getRouteLatLngs(recommendedRoute);
    if (recLatLngs.length > 1 && mode !== 'standard') {
      const isNight = mode === 'night';
      const isRain = mode === 'rain';
      const glowColor = isNight ? '#38bdf8' : isRain ? '#10b981' : '#94a3b8';

      // Glow halo
      const glowPoly = L.polyline(recLatLngs, {
        color: glowColor,
        weight: 12,
        opacity: 0.45,
        lineCap: 'round',
        lineJoin: 'round'
      });
      routeLayer.addLayer(glowPoly);

      const mainPoly = L.polyline(recLatLngs, {
        color: glowColor,
        weight: 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });

      mainPoly.bindTooltip(
        `<strong>${
          isNight
            ? '야간 안심 추천 경로 (스마트 가로등·CCTV 보호구역)'
            : isRain
            ? '우천 회피 추천 경로 (비가림 아케이드 및 보도)'
            : '추천 경로'
        }</strong><br/>거리: ${recommendedRoute.totalDistance}m | 소요시간: ${recommendedRoute.estimatedMinutes}분`,
        { className: 'route-tooltip-custom', sticky: true }
      );
      routeLayer.addLayer(mainPoly);
    }

    // 3. Automatically Fit Map Bounds to Show the Whole Route
    const targetLatLngs = (recLatLngs.length > 1 && mode !== 'standard') ? recLatLngs : stdLatLngs;
    const map = mapInstanceRef.current;
    if (map && targetLatLngs.length > 1) {
      try {
        const bounds = L.latLngBounds(targetLatLngs);
        map.fitBounds(bounds, {
          padding: [60, 60],
          maxZoom: 17,
          animate: true
        });
      } catch (err) {
        console.warn('fitBounds error:', err);
      }
    }
  }, [mode, recommendedRoute, standardRoute, mapTheme]);

  // Render 2.1 Interactive Markers (User GPS, Start A, Target B)
  useEffect(() => {
    const markLayer = markersLayerRef.current;
    if (!markLayer) return;
    markLayer.clearLayers();

    // 0. User GPS Dot Marker (Glowing Blue Dot with Pulse)
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

    // 1. Start Pin (A - Emerald)
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

      const startMarker = L.marker([sLat, sLng], {
        icon: startIcon,
        draggable: true
      });

      startMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (setStartPoint) {
          setStartPoint({ name: '선택한 위치 (A)', roadAddress: `위도 ${lat.toFixed(4)}, 경도 ${lng.toFixed(4)}`, lat, lng });
        }
        const nearest = findNearestNode(lat, lng);
        if (nearest) setStartNodeId(nearest);
      });

      startMarker.bindTooltip(
        `<strong>📍 출발지 (A)</strong><br/>` +
        `<span style="color:#34d399; font-weight:700;">${sName}</span><br/>` +
        `<span style="color:#94a3b8; font-size:11px;">(드래그하여 위치 변경 가능)</span>`,
        { className: 'route-tooltip-custom' }
      );
      markLayer.addLayer(startMarker);
    }

    // 2. Target Pin (B - Rose)
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

      const targetMarker = L.marker([tLat, tLng], {
        icon: targetIcon,
        draggable: true
      });

      targetMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (setTargetPoint) {
          setTargetPoint({ name: '선택한 위치 (B)', roadAddress: `위도 ${lat.toFixed(4)}, 경도 ${lng.toFixed(4)}`, lat, lng });
        }
        const nearest = findNearestNode(lat, lng);
        if (nearest) setTargetNodeId(nearest);
      });

      targetMarker.bindTooltip(
        `<strong>📍 도착지 (B)</strong><br/>` +
        `<span style="color:#f43f5e; font-weight:700;">${tName}</span><br/>` +
        `<span style="color:#94a3b8; font-size:11px;">(드래그하여 위치 변경 가능)</span>`,
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
