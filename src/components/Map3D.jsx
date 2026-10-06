import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_CENTER } from '../data/urbanNetwork';
import { loadMapStyle, applyPedestrianTweaks, applyPoiFilter } from '../utils/mapStyle';
import { filterValidUrbanMarkers, isInvalidOceanCoordinate } from '../utils/geoSanity';
import { fetchStreetlightsInViewport } from '../services/streetlightService';
import { ShadeLegend, SunDial, CounterPill } from './MapOverlays';

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

// 그늘 경로는 구간마다 그늘(초록)/직사광선(주황)으로 나눠 칠하고, 그 밖에는 한 색으로 칠한다.
function toRouteFeatures(route, mode, useSegments) {
  const latlngs = route?.latlngs;
  if (!latlngs || latlngs.length < 2) return emptyLine;
  const segments = useSegments && mode === 'shade' ? route.segments : null;
  if (!segments || segments.length === 0) return toLineFeature(latlngs);
  return {
    type: 'FeatureCollection',
    features: segments
      .filter((s) => s.latlngs && s.latlngs.length >= 2)
      .map((s) => ({
        type: 'Feature',
        properties: { shaded: Boolean(s.isShaded) },
        geometry: { type: 'LineString', coordinates: s.latlngs.map(([lat, lng]) => [lng, lat]) }
      }))
  };
}

const SHADE_COLOR = '#10b981';
const SUN_COLOR = '#f59e0b';

const LIGHT_TYPE_LABELS = {
  smart_led: '스마트 LED 안심등',
  coastal_led: '해안 보행로 고효율 LED',
  smart_security: '스마트 보안등',
  security: '골목길 안심보안등',
  solar_led: '친환경 태양광 LED'
};

// 핀을 눌렀을 때 보여줄 내용(제목, 주소, 설명 줄들). 2D 지도의 툴팁과 같은 항목이다.
function describeInfra(kind, it) {
  if (kind === 'cctv') {
    return {
      title: it.name || '방범 CCTV',
      subtitle: it.address || '',
      lines: [
        `설치목적: ${it.purpose || '방범'} · 카메라 ${it.cameraCount || 1}대`,
        `관리기관: ${it.manager || '관할구청'}`,
        `안전반경 ${it.radius || 20}m`
      ]
    };
  }
  if (kind === 'streetlight') {
    return {
      title: it.name || '가로등',
      subtitle: it.address || '',
      lines: [
        `조명종류: ${LIGHT_TYPE_LABELS[it.type] || '표준 보행 가로등'}`,
        `조명밝기: ${it.lumens ? `${Number(it.lumens).toLocaleString()} lm` : '고조도 LED'}`,
        `관리기관: ${it.manager || '관할구청 도로시설과'}`,
        `안심 조명반경 ${it.radius || 15}m`
      ]
    };
  }
  return {
    title: it.name || '가로수 그늘',
    subtitle: '',
    lines: [`그늘 반경 약 ${(it.radius || 4.5).toFixed(1)}m`]
  };
}

// routeLine이 있으면, 경로에서 가까운 시설에만 near 표시를 달아 안전 반경 원을 그릴 대상으로 삼는다.
function toInfraPoints(items, kind, routeLine = null) {
  return {
    type: 'FeatureCollection',
    features: items.map((it) => {
      const point = turf.point([Number(it.lng), Number(it.lat)]);
      const near = routeLine ? turf.pointToLineDistance(point, routeLine, { units: 'meters' }) <= NEAR_ROUTE_METERS : false;
      return {
        type: 'Feature',
        properties: { near, info: JSON.stringify(describeInfra(kind, it)) },
        geometry: point.geometry
      };
    })
  };
}

// 팝업 내용은 서버에서 받은 글자가 들어가므로 HTML 문자열이 아니라 요소로 만들어 안전하게 넣는다.
function buildInfoPopupContent(info) {
  const root = document.createElement('div');
  root.className = 'infra-popup';
  const title = document.createElement('strong');
  title.textContent = info.title;
  root.appendChild(title);
  if (info.subtitle) {
    const sub = document.createElement('span');
    sub.className = 'infra-popup-sub';
    sub.textContent = info.subtitle;
    root.appendChild(sub);
  }
  info.lines.forEach((line) => {
    const row = document.createElement('div');
    row.textContent = line;
    root.appendChild(row);
  });
  return root;
}

const PIN_LAYER_IDS = ['cctv-pin', 'streetlight-pin', 'tree-pin'];

// 지도 위 반경(m)을 화면 픽셀로. 확대할 때마다 2배씩 커지는 값을 그 위도 기준으로 계산한다.
function metersToPixelsExpr(meters, lat) {
  const atZoom0 = meters / (78271.484 * Math.cos((lat * Math.PI) / 180));
  return ['interpolate', ['exponential', 2], ['zoom'], 0, atZoom0, 22, atZoom0 * 2 ** 22];
}

// 시설 표시용 핀 아이콘을 캔버스로 그린다(이모지 대신 직접 그린 단순한 도형이라 지도 글꼴과 무관하게 선명하다).
// 24x32 논리 크기를 2배 해상도로 그리고, 뾰족한 끝이 시설 위치를 가리킨다.
const PIN_W = 24;
const PIN_H = 32;
const PIN_RATIO = 2;

const PIN_GLYPHS = {
  cctv(ctx) {
    ctx.beginPath();
    ctx.roundRect(6, 9, 8.5, 6.5, 1.5); // 카메라 몸통
    ctx.fill();
    ctx.beginPath(); // 렌즈 쪽 삼각형
    ctx.moveTo(14.8, 11.2);
    ctx.lineTo(18.2, 9);
    ctx.lineTo(18.2, 15.5);
    ctx.lineTo(14.8, 13.3);
    ctx.closePath();
    ctx.fill();
  },
  streetlight(ctx) {
    ctx.beginPath(); // 등 머리(반원)
    ctx.arc(12, 11.5, 4.8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(10.8, 11.5, 2.4, 6); // 기둥
  },
  tree(ctx) {
    ctx.beginPath(); // 나뭇잎
    ctx.arc(12, 10, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(11, 13.5, 2, 4.5); // 줄기
  }
};

function drawPin(kind, color) {
  const canvas = document.createElement('canvas');
  canvas.width = PIN_W * PIN_RATIO;
  canvas.height = PIN_H * PIN_RATIO;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIN_RATIO, PIN_RATIO);

  // 물방울 모양 핀
  ctx.beginPath();
  ctx.moveTo(12, 31);
  ctx.bezierCurveTo(12, 31, 1.5, 19.5, 1.5, 12);
  ctx.arc(12, 12, 10.5, Math.PI, 0, false);
  ctx.bezierCurveTo(22.5, 19.5, 12, 31, 12, 31);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  PIN_GLYPHS[kind](ctx);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

const PIN_COLORS = { cctv: '#0284c7', streetlight: '#d97706', tree: '#059669' };

// 스타일을 바꾸면(테마 변경) 등록한 이미지가 사라지므로 style.load마다 다시 등록한다
function registerPinImages(map) {
  Object.keys(PIN_COLORS).forEach((kind) => {
    const id = `pin-${kind}`;
    if (!map.hasImage(id)) map.addImage(id, drawPin(kind, PIN_COLORS[kind]), { pixelRatio: PIN_RATIO });
  });
}

function pinLayer(id, source, kind, sizeRange) {
  return {
    id,
    type: 'symbol',
    source,
    layout: {
      'icon-image': `pin-${kind}`,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-pitch-alignment': 'viewport',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 15, sizeRange[0], 19, sizeRange[1]]
    }
  };
}

const NEAR_ROUTE_METERS = 40; // 이 거리 안의 시설만 안전 반경 원을 그린다
const INFRA_MIN_ZOOM = 15;
const INFRA_RADIUS_MIN_ZOOM = 16;
const NO_INFRA = { count: 0, isZoomTooLow: false };

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
  poiSelected = {},
  layers = {}
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const loadedRef = useRef(false);
  const latestRef = useRef({});
  const fittedKeyRef = useRef('');
  const infraSeqRef = useRef(0);
  const [infra, setInfra] = useState({ cctv: NO_INFRA, streetlight: NO_INFRA, tree: NO_INFRA });
  latestRef.current = { startPoint, targetPoint, recommendedRoute, mode, navigating, navPoint, shadows, trees, sunPos, userGps, baseLatlngs, mapTheme, poiSelected, layers, applyNavCamera: latestRef.current.applyNavCamera, refreshInfra: latestRef.current.refreshInfra };

  // 불러온 시설을 지도에 올린다. 경로가 바뀌어도 다시 불러오지 않고 이 함수만 다시 부른다.
  const infraItemsRef = useRef({ cctv: [], streetlights: [], trees: [], lat: 35.16 });
  const applyInfraData = () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const route = latestRef.current.recommendedRoute?.latlngs;
    const routeLine = route && route.length >= 2 ? turf.lineString(route.map(([lat, lng]) => [lng, lat])) : null;
    const { cctv, streetlights, trees: treeItems, lat } = infraItemsRef.current;
    map.getSource('cctv')?.setData(toInfraPoints(cctv, 'cctv', routeLine));
    map.getSource('streetlights')?.setData(toInfraPoints(streetlights, 'streetlight', routeLine));
    map.getSource('tree-points')?.setData(toInfraPoints(treeItems, 'tree'));
    if (map.getLayer('cctv-radius')) map.setPaintProperty('cctv-radius', 'circle-radius', metersToPixelsExpr(20, lat));
    if (map.getLayer('streetlight-radius')) map.setPaintProperty('streetlight-radius', 'circle-radius', metersToPixelsExpr(15, lat));
  };

  // 화면에 보이는 영역의 CCTV·가로등·가로수를 불러와 지도에 올린다(2D 지도와 같은 기준: 확대 15 이상).
  const refreshInfra = async () => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const { layers: ly, trees: trs } = latestRef.current;
    const seq = ++infraSeqRef.current;
    const zoom = map.getZoom();
    const center = map.getCenter();
    const b = map.getBounds();
    const padLat = (b.getNorth() - b.getSouth()) * 0.08;
    const padLng = (b.getEast() - b.getWest()) * 0.08;
    const bounds = {
      minLat: b.getSouth() - padLat,
      maxLat: b.getNorth() + padLat,
      minLng: b.getWest() - padLng,
      maxLng: b.getEast() + padLng
    };
    const tooLow = zoom < INFRA_MIN_ZOOM;

    // CCTV
    let cctvItems = [];
    if (ly.cctv && !tooLow) {
      try {
        const params = new URLSearchParams({
          lat: center.lat.toFixed(6),
          lng: center.lng.toFixed(6),
          minLat: bounds.minLat.toFixed(6),
          maxLat: bounds.maxLat.toFixed(6),
          minLng: bounds.minLng.toFixed(6),
          maxLng: bounds.maxLng.toFixed(6),
          zoom: String(zoom)
        });
        const resp = await fetch(`/api/cctv/viewport?${params.toString()}`);
        if (resp.ok) cctvItems = filterValidUrbanMarkers((await resp.json()).cctvs || []);
      } catch {
        cctvItems = [];
      }
    }

    // 가로등
    let lightItems = [];
    if (ly.streetlight && !tooLow) {
      try {
        const result = await fetchStreetlightsInViewport(bounds, zoom);
        lightItems = filterValidUrbanMarkers(result.streetlights || []);
      } catch {
        lightItems = [];
      }
    }

    // 가로수 (이미 불러온 목록에서 화면 안의 것만)
    const treeItems = ly.trees && !tooLow
      ? (trs || []).filter((t) => {
          const lat = Number(t.lat);
          const lng = Number(t.lng);
          return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng && !isInvalidOceanCoordinate(lat, lng);
        })
      : [];

    if (seq !== infraSeqRef.current || !mapRef.current) return; // 그 사이 화면이 또 움직였으면 이번 결과는 버린다

    infraItemsRef.current = { cctv: cctvItems, streetlights: lightItems, trees: treeItems, lat: center.lat };
    applyInfraData();

    setInfra({
      cctv: { count: cctvItems.length, isZoomTooLow: ly.cctv && tooLow },
      streetlight: { count: lightItems.length, isZoomTooLow: ly.streetlight && tooLow },
      tree: { count: treeItems.length, isZoomTooLow: ly.trees && tooLow }
    });
  };
  latestRef.current.refreshInfra = refreshInfra;

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
    // 해가 있을 때의 그늘 경로는 구간별로 그늘/직사광선 색을 나눠 칠한다(2D 지도와 같은 기준)
    const bySegments = m === 'shade' && sun?.isDaylight && r?.segments?.length > 0;
    map.getSource('route')?.setData(toRouteFeatures(r, m, Boolean(sun?.isDaylight)));
    map.getSource('endpoints')?.setData(toPointFeatures(s, t));
    map.setPaintProperty(
      'route-line',
      'line-color',
      bySegments ? ['case', ['get', 'shaded'], SHADE_COLOR, SUN_COLOR] : ROUTE_COLORS[m] || ROUTE_COLORS.shade
    );

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
        // 화면을 옮기거나 확대할 때마다 그 영역의 CCTV·가로등·가로수를 다시 채운다
        map.on('moveend', () => latestRef.current.refreshInfra?.());

        // 핀을 누르면 이름·종류·관리기관을 팝업으로 보여준다. 핀 위에서는 손가락 모양 커서.
        const pinsAt = (point) => {
          const layers = PIN_LAYER_IDS.filter((id) => map.getLayer(id));
          if (layers.length === 0) return [];
          const box = [[point.x - 8, point.y - 8], [point.x + 8, point.y + 8]];
          return map.queryRenderedFeatures(box, { layers });
        };
        map.on('mousemove', (e) => {
          map.getCanvas().style.cursor = pinsAt(e.point).length > 0 ? 'pointer' : '';
        });
        map.on('click', (e) => {
          const hit = pinsAt(e.point)[0];
          if (!hit) return;
          let info;
          try {
            info = JSON.parse(hit.properties.info);
          } catch {
            return;
          }
          new maplibregl.Popup({ className: 'urban-popup', offset: [0, -30], maxWidth: '260px' })
            .setLngLat(hit.geometry.coordinates)
            .setDOMContent(buildInfoPopupContent(info))
            .addTo(map);
        });
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
      map.addSource('cctv', { type: 'geojson', data: emptyLine });
      map.addSource('streetlights', { type: 'geojson', data: emptyLine });
      map.addSource('tree-points', { type: 'geojson', data: emptyLine });

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

      // 가로등·CCTV 안전 반경은 경로 근처 시설만, 얇은 테두리와 아주 옅은 채움으로 그린다(원이 겹쳐도 색이 진해지지 않게)
      registerPinImages(map);
      map.addLayer({
        id: 'cctv-radius',
        type: 'circle',
        source: 'cctv',
        minzoom: INFRA_RADIUS_MIN_ZOOM,
        filter: ['==', ['get', 'near'], true],
        paint: {
          'circle-radius': metersToPixelsExpr(20, 35.16),
          'circle-color': '#38bdf8',
          'circle-opacity': 0.06,
          'circle-stroke-color': '#0284c7',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.55,
          'circle-pitch-alignment': 'map'
        }
      });
      map.addLayer({
        id: 'streetlight-radius',
        type: 'circle',
        source: 'streetlights',
        minzoom: INFRA_RADIUS_MIN_ZOOM,
        filter: ['==', ['get', 'near'], true],
        paint: {
          'circle-radius': metersToPixelsExpr(15, 35.16),
          'circle-color': '#f59e0b',
          'circle-opacity': 0.06,
          'circle-stroke-color': '#d97706',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.55,
          'circle-pitch-alignment': 'map'
        }
      });
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
      // 시설 핀은 경로선 위에 올려 가려지지 않게 한다
      map.addLayer(pinLayer('tree-pin', 'tree-points', 'tree', [0.5, 0.8]));
      map.addLayer(pinLayer('streetlight-pin', 'streetlights', 'streetlight', [0.6, 0.95]));
      map.addLayer(pinLayer('cctv-pin', 'cctv', 'cctv', [0.6, 0.95]));
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
      latestRef.current.refreshInfra?.(); // 테마 변경으로 레이어가 다시 만들어진 뒤에도 표시를 채운다
      latestRef.current.applyNavCamera?.(); // 탐색 중에 3D 지도가 열린 경우 보행자 시점으로 이동
    });

  }

  // 고른 종류가 바뀌면 지도의 장소 아이콘 필터를 다시 건다
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) applyPoiFilter(map, poiSelected);
  }, [poiSelected]);

  // 레이어 켜고 끄기, 가로수 목록이 바뀔 때 표시를 다시 채운다
  useEffect(() => {
    refreshInfra();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.cctv, layers.streetlight, layers.trees, trees]);

  // 경로가 바뀌면 안전 반경 원을 그릴 시설만 다시 고른다(새로 불러오지는 않는다)
  useEffect(() => {
    applyInfraData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedRoute]);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} className="map3d-viewport" />

      {/* 2D 지도와 같은 안내: 그늘 구간 색, 태양 방위·고도, 화면 안 시설 개수 */}
      {mode === 'shade' && sunPos?.isDaylight && <ShadeLegend />}
      <SunDial sunPos={sunPos} />
      {layers.cctv && <CounterPill kind="cctv" count={infra.cctv.count} isZoomTooLow={infra.cctv.isZoomTooLow} />}
      {layers.streetlight && <CounterPill kind="streetlight" count={infra.streetlight.count} isZoomTooLow={infra.streetlight.isZoomTooLow} />}
      {layers.trees && <CounterPill kind="tree" count={infra.tree.count} isZoomTooLow={infra.tree.isZoomTooLow} />}
    </div>
  );
}
