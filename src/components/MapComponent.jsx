import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { NODES, EDGES, STREETLIGHTS, CCTVS, MAP_CENTER, DEFAULT_ZOOM } from '../data/urbanNetwork';
import { findNearestNode } from '../engine/routingEngine';

export default function MapComponent({
  startNodeId,
  setStartNodeId,
  targetNodeId,
  setTargetNodeId,
  pinSelectMode,
  setPinSelectMode,
  mode,
  recommendedRoute,
  standardRoute,
  layers
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  // Layer groups refs to easily add/remove layers
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

    // Create Leaflet Map
    const map = L.map(mapContainerRef.current, {
      center: MAP_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false
    });

    // Add CartoDB Dark Matter tiles for ultra-sleek dark aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '&copy; CartoDB &copy; OpenStreetMap'
    }).addTo(map);

    // Zoom control at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Attribution at bottom-right
    L.control.attribution({ position: 'bottomright' }).addTo(map);

    // Create Layer Groups
    networkLayerRef.current = L.layerGroup().addTo(map);
    coveredLayerRef.current = L.layerGroup().addTo(map);
    deadZonesLayerRef.current = L.layerGroup().addTo(map);
    streetlightsLayerRef.current = L.layerGroup().addTo(map);
    cctvLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map clicks for 2.1 출발지 / 도착지 선택
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
        // Default click behavior: cycle or snap to closest
        setStartNodeId(nearestId);
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

    // Render underlying pedestrian network
    for (const edge of EDGES) {
      const uNode = NODES[edge.u];
      const vNode = NODES[edge.v];
      if (!uNode || !vNode) continue;

      const poly = L.polyline(
        [[uNode.lat, uNode.lng], [vNode.lat, vNode.lng]],
        {
          color: '#334155',
          weight: 3,
          opacity: 0.6,
          dashArray: edge.layer === -1 ? '4, 4' : null
        }
      );
      poly.bindTooltip(
        `<strong>${edge.name}</strong><br/>길이: ${edge.length}m | ${edge.covered ? '비가림/지하 통로' : '지상 보도'}<br/>가로등 조명률: ${Math.round((edge.litLengthRatio||0)*100)}% | CCTV: ${edge.cctvCount||0}대`,
        { className: 'route-tooltip-custom', sticky: true }
      );
      netLayer.addLayer(poly);
    }
  }, []);

  // Render 2.3 Layer Toggles: Streetlights, CCTV, Covered Corridors, Dead Zones
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Streetlights & 15m radius buffer
    const slLayer = streetlightsLayerRef.current;
    slLayer.clearLayers();
    if (layers.streetlights) {
      for (const sl of STREETLIGHTS) {
        // 15m illumination circle
        const circle = L.circle([sl.lat, sl.lng], {
          radius: sl.radius,
          color: '#f59e0b',
          weight: 1,
          opacity: 0.6,
          fillColor: '#fde047',
          fillOpacity: 0.16
        });
        circle.bindTooltip(`가로등 (${sl.type})<br/>유효 조명 반경 15m`, { className: 'route-tooltip-custom' });
        slLayer.addLayer(circle);

        // Core light marker
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

    // 2. CCTV & 20m safety zone
    const cctvLayer = cctvLayerRef.current;
    cctvLayer.clearLayers();
    if (layers.cctv) {
      for (const cam of CCTVS) {
        // 20m buffer circle
        const circle = L.circle([cam.lat, cam.lng], {
          radius: cam.radius,
          color: '#0284c7',
          weight: 1,
          opacity: 0.5,
          fillColor: '#38bdf8',
          fillOpacity: 0.12
        });
        circle.bindTooltip(`방범 CCTV: ${cam.name}<br/>안전 감시 반경 20m`, { className: 'route-tooltip-custom' });
        cctvLayer.addLayer(circle);

        // CCTV badge marker
        const cctvIcon = L.divIcon({
          className: 'cctv-badge',
          html: `<div style="background: #0284c7; color: white; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 1.5px solid #ffffff; box-shadow: 0 0 8px rgba(56,189,248,0.8);">📹</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        const marker = L.marker([cam.lat, cam.lng], { icon: cctvIcon });
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
            weight: 6,
            opacity: 0.55,
            dashArray: '8, 6'
          });
          poly.bindTooltip(`비가림 쉴드 통로: ${edge.name} (${edge.shelterType})`, { className: 'route-tooltip-custom' });
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
            opacity: 0.75,
            dashArray: '4, 6'
          });
          poly.bindTooltip(`⚠️ 조명 미설치 암흑 구간: ${edge.deadZoneLength}m (${edge.name})`, { className: 'route-tooltip-custom' });
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

    // 1. Standard Shortest Route (회색 점선)
    if (standardRoute && standardRoute.nodeIds.length > 1) {
      const latlngs = standardRoute.nodeIds.map((id) => [NODES[id].lat, NODES[id].lng]);
      const standardPoly = L.polyline(latlngs, {
        color: '#94a3b8',
        weight: 4,
        opacity: 0.7,
        dashArray: '6, 8',
        lineCap: 'round',
        lineJoin: 'round'
      });
      standardPoly.bindTooltip('기본 최단 경로 (대조군 기준)', { className: 'route-tooltip-custom' });
      routeLayer.addLayer(standardPoly);
    }

    // 2. Recommended Custom Route (안심/우천 추천 경로: 파란색/녹색 실선 & Glow)
    if (recommendedRoute && recommendedRoute.nodeIds.length > 1) {
      const latlngs = recommendedRoute.nodeIds.map((id) => [NODES[id].lat, NODES[id].lng]);
      
      const isNight = mode === 'night';
      const isRain = mode === 'rain';
      const primaryColor = isNight ? '#38bdf8' : isRain ? '#10b981' : '#94a3b8';
      const glowColor = isNight ? '#0284c7' : isRain ? '#059669' : '#64748b';

      if (mode !== 'standard') {
        // Glowing halo effect under the route line
        const glowPoly = L.polyline(latlngs, {
          color: glowColor,
          weight: 12,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round'
        });
        routeLayer.addLayer(glowPoly);
      }

      // Foreground solid route polyline
      const mainPoly = L.polyline(latlngs, {
        color: primaryColor,
        weight: mode === 'standard' ? 4 : 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      });

      mainPoly.bindTooltip(
        `<strong>${
          isNight
            ? '야간 안심 경로 (조명·CCTV 최적화)'
            : isRain
            ? '우천 회피 경로 (비가림 아케이드)'
            : '일반 최단 경로'
        }</strong><br/>거리: ${recommendedRoute.totalDistance}m | 시간: ${recommendedRoute.estimatedMinutes}분`,
        { className: 'route-tooltip-custom', sticky: true }
      );
      routeLayer.addLayer(mainPoly);
    }
  }, [mode, recommendedRoute, standardRoute]);

  // Render 2.1 출발지 (A) & 도착지 (B) Interactive Draggable Markers
  useEffect(() => {
    const markLayer = markersLayerRef.current;
    if (!markLayer) return;
    markLayer.clearLayers();

    // Start Pin (A - Emerald)
    const startNode = NODES[startNodeId];
    if (startNode) {
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

      const startMarker = L.marker([startNode.lat, startNode.lng], {
        icon: startIcon,
        draggable: true
      });

      startMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        const nearest = findNearestNode(lat, lng);
        if (nearest && nearest !== targetNodeId) {
          setStartNodeId(nearest);
        } else {
          // snap back
          startMarker.setLatLng([startNode.lat, startNode.lng]);
        }
      });

      startMarker.bindTooltip(`출발지 (A): ${startNode.name}<br/>(드래그하여 변경 가능)`, {
        className: 'route-tooltip-custom'
      });
      markLayer.addLayer(startMarker);
    }

    // Target Pin (B - Rose)
    const targetNode = NODES[targetNodeId];
    if (targetNode) {
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

      const targetMarker = L.marker([targetNode.lat, targetNode.lng], {
        icon: targetIcon,
        draggable: true
      });

      targetMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        const nearest = findNearestNode(lat, lng);
        if (nearest && nearest !== startNodeId) {
          setTargetNodeId(nearest);
        } else {
          // snap back
          targetMarker.setLatLng([targetNode.lat, targetNode.lng]);
        }
      });

      targetMarker.bindTooltip(`도착지 (B): ${targetNode.name}<br/>(드래그하여 변경 가능)`, {
        className: 'route-tooltip-custom'
      });
      markLayer.addLayer(targetMarker);
    }
  }, [startNodeId, targetNodeId, setStartNodeId, setTargetNodeId]);

  return (
    <div
      ref={mapContainerRef}
      className="map-viewport"
      style={{ cursor: pinSelectMode ? 'crosshair' : 'grab' }}
    />
  );
}
