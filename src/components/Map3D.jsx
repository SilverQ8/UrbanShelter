import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CENTER } from '../data/urbanNetwork';
import { loadMapStyle, applyPedestrianTweaks, applyPoiFilter } from '../utils/mapStyle';

// Vite 번들링 환경에서 워커 경로를 직접 지정한다(지정하지 않으면 Worker failed to load 오류).
maplibregl.setWorkerUrl(workerUrl);

// 오픈 벡터 타일(OpenFreeMap): API 키 없이 쓸 수 있고 건물 높이 데이터를 포함한다.

const ROUTE_COLORS = {
  shade: '#10b981',
  night: '#38bdf8',
  standard: '#64748b'
};

const emptyLine = { type: 'FeatureCollection', features: [] };

function toLineFeature(latlngs) {
  if (!latlngs || latlngs.length < 2) return emptyLine;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: latlngs.map(([lat, lng]) => [lng, lat]) }
      }
    ]
  };
}

const NAV_ZOOM = 19;
const NAV_PITCH = 78;
const LOOK_AHEAD_M = 25;

function distanceM(a, b) {
  const dLat = (b[0] - a[0]) * 111320;
  const dLng = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function bearingDeg(a, b) {
  const dy = b[0] - a[0];
  const dx = (b[1] - a[1]) * Math.cos((a[0] * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

// 경로 위 한 지점에서 진행 방향(도): 가장 가까운 꼭짓점에서 약 25m 앞을 바라본다.
function headingAt(point, latlngs) {
  if (!point || !latlngs || latlngs.length < 2) return 0;
  let nearest = 0;
  let best = Infinity;
  latlngs.forEach((p, i) => {
    const d = distanceM(point, p);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  // 마지막 지점이면 직전 구간 방향을 유지한다
  if (nearest >= latlngs.length - 1) return bearingDeg(latlngs[latlngs.length - 2], latlngs[latlngs.length - 1]);
  let target = latlngs[nearest + 1];
  for (let i = nearest + 1; i < latlngs.length; i++) {
    target = latlngs[i];
    if (distanceM(point, latlngs[i]) >= LOOK_AHEAD_M) break;
  }
  return bearingDeg(point, target);
}

function toShadowFeatures(shadows, trees) {
  const features = [];
  for (const sh of shadows || []) {
    const ring = sh.polygon.map(([lat, lng]) => [lng, lat]);
    if (ring.length < 3) continue;
    ring.push(ring[0]);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  return { type: 'FeatureCollection', features };
}

function toTreeFeatures(trees) {
  const features = (trees || []).map((t) =>
    turf.circle([t.lng, t.lat], t.radius || 4.5, { steps: 12, units: 'meters', properties: { height: t.height || 7 } })
  );
  return { type: 'FeatureCollection', features };
}

function toPointFeatures(startPoint, targetPoint) {
  const features = [];
  if (startPoint) {
    features.push({
      type: 'Feature',
      properties: { label: 'A', color: '#10b981' },
      geometry: { type: 'Point', coordinates: [startPoint.lng, startPoint.lat] }
    });
  }
  if (targetPoint) {
    features.push({
      type: 'Feature',
      properties: { label: 'B', color: '#f43f5e' },
      geometry: { type: 'Point', coordinates: [targetPoint.lng, targetPoint.lat] }
    });
  }
  return { type: 'FeatureCollection', features };
}

export default function Map3D({
  startPoint,
  targetPoint,
  recommendedRoute,
  mode,
  focusPoint,
  navigating = false,
  navPoint = null,
  baseLatlngs = null,
  shadows = [],
  trees = [],
  sunPos = null,
  userGps = null,
  locateTarget = null,
  mapTheme = 'light',
  poiSelected = {}
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const latestRef = useRef({});
  const fittedKeyRef = useRef('');
  latestRef.current = { startPoint, targetPoint, recommendedRoute, mode, navigating, navPoint, shadows, trees, sunPos, userGps, baseLatlngs, mapTheme, poiSelected, applyNavCamera: latestRef.current.applyNavCamera };

  // 현재 props를 지도 소스·레이어에 반영한다.
  const syncData = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const { startPoint: s, targetPoint: t, recommendedRoute: r, mode: m } = latestRef.current;

    const { navigating: nav, navPoint: np, shadows: shs, trees: trs, sunPos: sun } = latestRef.current;

    // 보행자 시점(탐색 중)에서만 그림자와 나무를 보여준다
    map.getSource('shadows')?.setData(nav ? toShadowFeatures(shs) : emptyLine);
    map.getSource('trees3d')?.setData(nav ? toTreeFeatures(trs) : emptyLine);
    map.getSource('nav-position')?.setData(
      nav && np
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [np[1], np[0]] } }] }
        : emptyLine
    );
    if (nav && sun?.isDaylight) {
      // 건물 벽면의 밝고 어두움도 실제 태양 방향에 맞춘다
      map.setLight({ anchor: 'map', color: '#fff7e0', intensity: 0.45, position: [1.5, sun.azimuthDeg, Math.max(5, 90 - sun.altitudeDeg)] });
    } else {
      map.setLight({ anchor: 'viewport', color: '#ffffff', intensity: 0.5, position: [1.15, 210, 30] });
    }
    map.getStyle().layers.forEach((layer) => {
      if (layer.type === 'fill-extrusion' && !layer.id.startsWith('trees3d')) {
        map.setPaintProperty(layer.id, 'fill-extrusion-opacity', nav ? 0.85 : 0.55);
      }
    });

    map.getSource('me-position')?.setData(
      latestRef.current.userGps
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [latestRef.current.userGps.lng, latestRef.current.userGps.lat] } }] }
        : emptyLine
    );
    map.getSource('route')?.setData(toLineFeature(r?.latlngs));
    map.getSource('endpoints')?.setData(toPointFeatures(s, t));
    map.setPaintProperty('route-line', 'line-color', ROUTE_COLORS[m] || ROUTE_COLORS.shade);

    if (!s || !t || nav) return; // 탐색 중에는 카메라를 보행자 시점으로 유지한다
    const key = `${s.lat.toFixed(4)}_${s.lng.toFixed(4)}_${t.lat.toFixed(4)}_${t.lng.toFixed(4)}`;
    if (fittedKeyRef.current === key) return;
    fittedKeyRef.current = key;

    const bounds = new maplibregl.LngLatBounds();
    (r?.latlngs?.length > 1 ? r.latlngs : [[s.lat, s.lng], [t.lat, t.lng]]).forEach(([lat, lng]) =>
      bounds.extend([lng, lat])
    );
    map.fitBounds(bounds, {
      padding: { top: 120, bottom: 220, left: 460, right: 400 },
      maxZoom: 17,
      pitch: 60,
      bearing: -20,
      duration: 1200
    });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;
    let map = null;

    loadMapStyle(latestRef.current.mapTheme)
      .then((style) => {
        if (cancelled || !containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [MAP_CENTER[1], MAP_CENTER[0]],
          zoom: 16,
          pitch: 60,
          bearing: -20,
          maxPitch: 80,
          attributionControl: { compact: true }
        });
        mapRef.current = map;
        setupMap(map);
      })
      .catch((err) => console.warn('Map style load failed:', err));

    return () => {
      cancelled = true;
      loadedRef.current = false;
      if (map) map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 지도를 만든 뒤 컨트롤과 'style.load' 처리(레이어 추가)를 연결한다.
  function setupMap(map) {
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    // 'style.load'는 처음 로드와 테마 변경(setStyle) 때마다 발생하므로 그때마다 레이어를 다시 올린다.
    map.on('style.load', () => {
      const isDark = latestRef.current.mapTheme === 'dark';
      if (isDark) {
        // 어두운 스타일에는 입체 건물이 없어 직접 추가한다(평면 건물 레이어는 숨김)
        if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
        map.addLayer(
          {
            id: 'building-3d',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 13,
            paint: {
              'fill-extrusion-color': '#334155',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.8
            }
          },
          map.getLayer('highway_name_other') ? 'highway_name_other' : undefined
        );
      }
      // 보행자 중심 지도 조정 + 고른 종류의 장소 아이콘만 표시(지도 스타일에 이미 있는 아이콘 사용)
      applyPedestrianTweaks(map, latestRef.current.mapTheme);
      applyPoiFilter(map, latestRef.current.poiSelected);

      map.addSource('route', { type: 'geojson', data: emptyLine });
      map.addSource('endpoints', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addSource('shadows', { type: 'geojson', data: emptyLine });
      map.addSource('trees3d', { type: 'geojson', data: emptyLine });
      map.addSource('nav-position', { type: 'geojson', data: emptyLine });
      map.addSource('me-position', { type: 'geojson', data: emptyLine });

      // 그림자는 건물 아래(땅 위)에 깔고, 길과 함께 보이도록 반투명하게 칠한다 (어두운 지도 대비 보강)
      const firstExtrusion = map.getStyle().layers.find((l) => l.type === 'fill-extrusion')?.id;
      map.addLayer(
        {
          id: 'shadow-fill',
          type: 'fill',
          source: 'shadows',
          paint: {
            'fill-color': isDark ? '#020617' : '#0f172a',
            'fill-opacity': isDark ? 0.65 : 0.38
          }
        },
        firstExtrusion
      );
      map.addLayer(
        {
          id: 'shadow-stroke',
          type: 'line',
          source: 'shadows',
          paint: {
            'line-color': isDark ? '#38bdf8' : '#334155',
            'line-opacity': isDark ? 0.28 : 0.15,
            'line-width': 1
          }
        },
        firstExtrusion
      );
      // 가로수는 기둥 모양 대신, 나뭇잎이 드리우는 그늘만 땅 위에 옅게 표시한다
      map.addLayer(
        {
          id: 'trees3d-crown',
          type: 'fill',
          source: 'trees3d',
          paint: { 'fill-color': '#14532d', 'fill-opacity': 0.3 }
        },
        firstExtrusion
      );

      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 11, 'line-opacity': 0.9 }
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROUTE_COLORS.shade, 'line-width': 7 }
      });
      map.addLayer({
        id: 'me-position-dot',
        type: 'circle',
        source: 'me-position',
        paint: {
          'circle-radius': 8,
          'circle-color': '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3
        }
      });
      map.addLayer({
        id: 'nav-position-dot',
        type: 'circle',
        source: 'nav-position',
        paint: {
          'circle-radius': 9,
          'circle-color': '#2563eb',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-pitch-alignment': 'map'
        }
      });
      map.addLayer({
        id: 'endpoints-circle',
        type: 'circle',
        source: 'endpoints',
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
          'circle-pitch-alignment': 'viewport'
        }
      });
      map.addLayer({
        id: 'endpoints-label',
        type: 'symbol',
        source: 'endpoints',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-font': ['Noto Sans Bold']
        },
        paint: { 'text-color': '#ffffff' }
      });

      loadedRef.current = true;
      syncData();
      latestRef.current.applyNavCamera?.(); // 탐색 중에 3D 지도가 열린 경우 보행자 시점으로 이동
    });

  }

  // 고른 종류가 바뀌면 지도의 장소 아이콘 필터를 다시 건다
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyPoiFilter(map, poiSelected);
  }, [poiSelected]);

  // 테마가 바뀌면 지도 스타일을 통째로 바꾸고, 'style.load'에서 경로·표시 레이어를 다시 올린다
  const appliedThemeRef = useRef(mapTheme);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeRef.current === mapTheme) return;
    appliedThemeRef.current = mapTheme;
    loadedRef.current = false;
    loadMapStyle(mapTheme).then((style) => map.setStyle(style, { diff: false }));
  }, [mapTheme]);

  useEffect(() => {
    syncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint, targetPoint, recommendedRoute, mode, navigating, navPoint, shadows, trees, sunPos, userGps]);

  // 탐색 시작: 보행자 시점으로 카메라를 낮추고 진행 방향을 바라본다. 종료하면 전체 보기로 되돌린다.
  const wasNavigatingRef = useRef(false);
  const applyNavCamera = () => {
    const map = mapRef.current;
    const { navigating: nav, navPoint: np } = latestRef.current;
    if (!map || !nav || !np) return;
    wasNavigatingRef.current = true;
    map.easeTo({
      center: [np[1], np[0]],
      zoom: NAV_ZOOM,
      pitch: NAV_PITCH,
      bearing: headingAt(np, latestRef.current.baseLatlngs),
      duration: 1400
    });
  };
  latestRef.current.applyNavCamera = applyNavCamera;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (navigating && navPoint) {
      applyNavCamera();
    } else if (wasNavigatingRef.current) {
      wasNavigatingRef.current = false;
      map.easeTo({ zoom: 16.5, pitch: 60, duration: 1000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigating, navPoint, baseLatlngs]);

  // 오른쪽 아래 '내 위치' 버튼: 지도만 현재 위치로 옮긴다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !locateTarget) return;
    map.flyTo({ center: [locateTarget.lng, locateTarget.lat], zoom: Math.max(map.getZoom(), 17), duration: 900 });
  }, [locateTarget]);

  // 길 안내 단계를 누르면 해당 지점으로 이동한다.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;
    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: Math.max(map.getZoom(), 18),
      pitch: 65,
      duration: 900
    });
  }, [focusPoint]);

  return <div ref={containerRef} className="map3d-viewport" />;
}
