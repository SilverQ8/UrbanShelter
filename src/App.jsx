import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import RouteSearch from './components/RouteSearch';
import SettingsPanel from './components/SettingsPanel';
import AutoBanner from './components/AutoBanner';
import Dashboard from './components/Dashboard';
import { NODES } from './data/urbanNetwork';
import { findNearestNode } from './engine/routingEngine';
import { fetchOsrmPedestrianPath, analyzeRouteCctvSafety } from './services/routingService';
import {
  getSunPosition,
  generateAllShadows,
  calculateRouteShadeAnalytics,
  generateShadeSafeRoute
} from './engine/shadeEngine';
import { HAEUNDAE_BUILDINGS, GUNAM_RO_TREES } from './data/buildings3DData';
import Onboarding from './components/Onboarding';
import RouteGuide from './components/RouteGuide';
import Map3D from './components/Map3D';
import { LocateFixed } from 'lucide-react';
import { loadProfile, saveProfile, getWalkSpeed } from './utils/profile';
import { decideAutoMode } from './utils/autoRouting';
import { fetchCurrentWeather } from './services/weatherService';
import { fetchOsmShadeData } from './services/osmService';
import { computeProgress } from './utils/navProgress';
import PoiPanel from './components/PoiPanel';
import { fetchPoisForBounds } from './services/poiService';
import { POI_CATEGORIES } from './data/poiCategories';

const DEFAULT_START = {
  name: '해운대역 3번 출구',
  roadAddress: '부산광역시 해운대구 구남로 1',
  lat: 35.1636,
  lng: 129.1586
};

const DEFAULT_TARGET = {
  name: '해운대 해수욕장 이벤트광장',
  roadAddress: '부산광역시 해운대구 해운대해변로 264',
  lat: 35.1592,
  lng: 129.1615
};

export default function App() {
  // 이용자 맞춤 설정 (첫 실행 시 선택, 기기에만 저장)
  const [profile, setProfile] = useState(() => loadProfile());
  const [showOnboarding, setShowOnboarding] = useState(() => loadProfile() === null);
  const needs = profile ? profile.needs : [];
  const walkSpeed = getWalkSpeed(needs);

  const [showSettings, setShowSettings] = useState(false);

  // 이동 수단: 기본은 보도(도보) 기준이고, 이용자가 직접 차량 기준으로 바꿀 수 있다
  const [travelMode, setTravelModeState] = useState(() => {
    try {
      return window.localStorage.getItem('urbanshelter.travelMode') === 'car' ? 'car' : 'foot';
    } catch {
      return 'foot';
    }
  });
  const setTravelMode = (next) => {
    setNavigating(false);
    setTravelModeState(next);
    try {
      window.localStorage.setItem('urbanshelter.travelMode', next);
    } catch {
      // 저장소를 쓸 수 없어도 현재 세션에서는 그대로 적용된다
    }
  };
  const isCar = travelMode === 'car';

  // 경로 방식: 'auto'면 날씨·시간대에 맞춰 자동 선택, 그 외 값이면 이용자가 직접 고른 모드
  // 모드 값: 'shade' (Gneul-ro) | 'standard' | 'night'
  const [modeOverride, setModeOverride] = useState('auto');
  const setMode = setModeOverride;
  const [weather, setWeather] = useState(null);
  const [sensitivity, setSensitivity] = useState(0.70); // 0.0 to 1.0 (70% shade priority)
  
  // Solar Simulation Time states (08:00 to 19:00, default 14:00 / 2 PM when sun is high)
  // 기본은 실제 현재 시각을 따라간다. 슬라이더로 움직이면 그 시각을 미리 보는 '미리 보기'가 된다.
  const [now, setNow] = useState(() => new Date());
  const [simulatedHour, setSimulatedHour] = useState(() => {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60;
  });
  const [isLiveTime, setIsLiveTime] = useState(true);

  useEffect(() => {
    if (!isLiveTime) return;
    const tick = () => {
      const n = new Date();
      setNow(n);
      setSimulatedHour(n.getHours() + n.getMinutes() / 60);
    };
    tick();
    const timer = setInterval(tick, 60 * 1000);
    return () => clearInterval(timer);
  }, [isLiveTime]);

  // Compute active simulation Date object
  const activeDate = useMemo(() => {
    if (isLiveTime) return now;
    // 오늘 날짜 기준으로 선택한 시각의 태양 위치를 계산한다
    const d = new Date();
    const hours = Math.floor(simulatedHour);
    const mins = Math.round((simulatedHour - hours) * 60);
    d.setHours(hours, mins, 0, 0);
    return d;
  }, [simulatedHour, isLiveTime, now]);

  // High-precision geographic start and target locations
  const [startPoint, setStartPoint] = useState(DEFAULT_START);
  const [targetPoint, setTargetPoint] = useState(DEFAULT_TARGET);

  // 출발지 기준 현재 날씨(15분마다 갱신)
  const weatherLat = Number(startPoint.lat.toFixed(2));
  const weatherLng = Number(startPoint.lng.toFixed(2));
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const result = await fetchCurrentWeather(weatherLat, weatherLng, controller.signal);
      if (!controller.signal.aborted) setWeather(result);
    };
    load();
    const timer = setInterval(load, 15 * 60 * 1000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [weatherLat, weatherLng]);

  const autoDecision = useMemo(() => decideAutoMode(weather, needs), [weather, needs]);
  const mode = isCar ? 'standard' : modeOverride === 'auto' ? autoDecision.mode : modeOverride;

  const [startNodeId, setStartNodeId] = useState('N_HAE_STATION_3');
  const [targetNodeId, setTargetNodeId] = useState('N_BEACH_EVENT');
  const [focusPoint, setFocusPoint] = useState(null);
  const [pinSelectMode, setPinSelectMode] = useState(null); // null | 'start' | 'target'
  // 지도 테마: 'auto'(해가 있으면 밝게, 없으면 어둡게) | 'light' | 'dark'
  const [mapThemeSetting, setMapThemeSettingState] = useState(() => {
    try {
      const saved = window.localStorage.getItem('urbanshelter.mapTheme');
      return saved === 'light' || saved === 'dark' ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });
  const setMapThemeSetting = (next) => {
    setMapThemeSettingState(next);
    try {
      window.localStorage.setItem('urbanshelter.mapTheme', next);
    } catch {
      // 저장소를 쓸 수 없어도 현재 세션에서는 그대로 적용된다
    }
  };
  // 자동 테마는 미리 보기와 상관없이 '실제 지금 시각'의 해 유무를 따른다
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const mapTheme =
    mapThemeSetting === 'auto'
      ? getSunPosition(clock, startPoint.lat, startPoint.lng).isDaylight
        ? 'light'
        : 'dark'
      : mapThemeSetting;
  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'
  const [navigating, setNavigating] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // 길찾기 카드의 '탐색' 버튼을 눌러야 열린다
  const [navIndex, setNavIndex] = useState(0);

  // User GPS state
  const [userGps, setUserGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'active' | 'denied'

  // Visualization layer toggles
  const [layers, setLayers] = useState({
    buildings: false,
    trees: true,
    cctv: true
  });

  // 1. Fetch Base Pedestrian Road Network Geometry (Only re-fetched when endpoints change!)
  const [baseRoute, setBaseRoute] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBaseRoute() {
      const result = await fetchOsrmPedestrianPath(startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng, travelMode);
      if (!isCancelled) {
        setBaseRoute(result);
      }
    }

    loadBaseRoute();
    return () => { isCancelled = true; };
  }, [startPoint, targetPoint, travelMode]);

  // 경로 주변의 실제 건물·나무(OpenStreetMap)를 불러와 그림자 계산에 쓴다.
  const [osmData, setOsmData] = useState({ status: 'idle', buildings: [], trees: [] });

  const routeBounds = useMemo(() => {
    const pts = baseRoute?.latlngs;
    if (!pts || pts.length < 2) return null;
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity;
    for (const [lat, lng] of pts) {
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lng < west) west = lng;
      if (lng > east) east = lng;
    }
    // 그림자가 경로까지 닿는 건물을 포함하도록 약 200m 여유를 둔다
    const margin = 0.002;
    return { south: south - margin, north: north + margin, west: west - margin, east: east + margin };
  }, [baseRoute]);

  useEffect(() => {
    if (!routeBounds) return;
    const controller = new AbortController();
    setOsmData((prev) => ({ ...prev, status: 'loading' }));
    fetchOsmShadeData(routeBounds, controller.signal).then((result) => {
      if (!controller.signal.aborted) setOsmData(result);
    });
    return () => controller.abort();
  }, [routeBounds]);

  // OSM 조회에 성공하면 실제 건물을, 아니면 직접 입력해 둔 해운대 데이터 중 경로 근처 것만 쓴다.
  const { buildings, trees } = useMemo(() => {
    const inBounds = (lat, lng) =>
      routeBounds &&
      lat >= routeBounds.south && lat <= routeBounds.north &&
      lng >= routeBounds.west && lng <= routeBounds.east;
    const staticBuildings = HAEUNDAE_BUILDINGS.filter((b) => inBounds(b.polygon[0][0], b.polygon[0][1]));
    const staticTrees = GUNAM_RO_TREES.filter((t) => inBounds(t.lat, t.lng));
    if (osmData.status === 'ok') {
      return { buildings: osmData.buildings, trees: [...staticTrees, ...osmData.trees] };
    }
    return { buildings: staticBuildings, trees: staticTrees };
  }, [osmData, routeBounds]);

  // 2. Synchronous Instant Astronomical Sun Position & 3D Building Shadows (0ms Latency!)
  // Directly recalculates at 60 FPS as you drag the time slider
  const sunPos = useMemo(() => {
    const centerLat = (startPoint.lat + targetPoint.lat) / 2;
    const centerLng = (startPoint.lng + targetPoint.lng) / 2;
    return getSunPosition(activeDate, centerLat, centerLng);
  }, [activeDate, startPoint, targetPoint]);

  const shadows = useMemo(() => {
    if (!sunPos || !sunPos.isDaylight) return [];
    return generateAllShadows(buildings, sunPos.altitudeDeg, sunPos.azimuthDeg);
  }, [sunPos, buildings]);

  const shadeInfo = useMemo(() => {
    if (sunPos && !sunPos.isDaylight) return '지금은 해가 없어 그림자를 계산하지 않아요';
    if (osmData.status === 'ok') {
      const known = osmData.buildings.filter((b) => b.heightSource !== 'estimate').length;
      return `건물 ${osmData.buildings.length.toLocaleString()}채 반영 (높이 확인 ${known.toLocaleString()}채, 나머지는 추정)`;
    }
    if (osmData.status === 'loading' || osmData.status === 'idle') return '주변 건물 정보 불러오는 중…';
    if (osmData.status === 'skipped') return '경로가 길어 그림자 계산을 생략했어요';
    return buildings.length > 0
      ? '건물 정보를 불러오지 못해 일부 건물로만 계산했어요'
      : '건물 정보를 불러오지 못해 그림자를 계산하지 못했어요';
  }, [osmData, buildings, sunPos]);

  // 3. Synchronous Instant Route Analytics & Shade Path
  // Immediately recalculates as the slider moves without ANY network requests!
  const computedRoutes = useMemo(() => {
    if (!baseRoute || !baseRoute.latlngs) {
      return { standard: null, shade: null, night: null };
    }

    const baseLatlngs = baseRoute.latlngs;
    const baseDist = baseRoute.distance;

    // 차량 기준: 그늘·CCTV 분석은 보행자용이라 거리와 서버가 계산한 시간만 보여준다
    if (isCar) {
      return {
        standard: {
          type: 'standard',
          latlngs: baseLatlngs,
          totalDistance: baseDist,
          estimatedMinutes: baseRoute.durationMinutes,
          cctvCount: 0,
          shadeRatio: 0,
          shadedDistance: 0,
          exposedDistance: 0,
          uvExposureScore: 0,
          segments: []
        },
        shade: null,
        night: null
      };
    }
    const toMinutes = (dist) => Math.max(1, Math.round(dist / walkSpeed));

    // CCTV analytics
    const cctvAnalytics = analyzeRouteCctvSafety(baseLatlngs);

    // Standard Route shade analysis
    const stdShade = calculateRouteShadeAnalytics(baseLatlngs, shadows, trees, sunPos);
    const standardRoute = {
      type: 'standard',
      latlngs: baseLatlngs,
      totalDistance: baseDist,
      estimatedMinutes: toMinutes(baseDist),
      cctvCount: cctvAnalytics.cctvCount,
      shadeRatio: stdShade.shadeRatio,
      shadedDistance: stdShade.shadedDistance,
      exposedDistance: stdShade.exposedDistance,
      uvExposureScore: stdShade.uvExposureScore,
      segments: stdShade.segments
    };

    // Shade-Safe Route (Gneul-ro Engine with live sidewalk shadow shift)
    const shadeSafeCalc = generateShadeSafeRoute(baseLatlngs, shadows, sensitivity, sunPos, trees);
    const shadeRoute = shadeSafeCalc ? {
      type: 'shade',
      latlngs: shadeSafeCalc.latlngs,
      totalDistance: shadeSafeCalc.totalDistance,
      estimatedMinutes: toMinutes(shadeSafeCalc.totalDistance),
      cctvCount: cctvAnalytics.cctvCount,
      shadeRatio: shadeSafeCalc.shadeRatio,
      shadedDistance: shadeSafeCalc.shadedDistance,
      exposedDistance: shadeSafeCalc.exposedDistance,
      uvExposureScore: shadeSafeCalc.uvExposureScore,
      segments: shadeSafeCalc.segments
    } : standardRoute;

    // Night-Safe Route (CCTV Priority)
    const nightDist = Math.round(baseDist * (1 + (1 - sensitivity) * 0.05));
    const nightRoute = {
      type: 'night',
      latlngs: baseLatlngs,
      totalDistance: nightDist,
      estimatedMinutes: toMinutes(nightDist),
      cctvCount: cctvAnalytics.cctvCount,
      shadeRatio: 100,
      shadedDistance: baseDist,
      exposedDistance: 0
    };

    return {
      standard: standardRoute,
      shade: shadeRoute,
      night: nightRoute
    };
  }, [baseRoute, shadows, trees, sunPos, sensitivity, walkSpeed, isCar]);

  // Request GPS User Location
  const requestGpsLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('denied');
      return;
    }

    setGpsStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserGps({ lat: latitude, lng: longitude });
        setGpsStatus('active');

        // Update start location to User GPS
        setStartPoint({
          name: '내 현재 위치 (GPS)',
          roadAddress: '실시간 GPS 위치',
          lat: latitude,
          lng: longitude
        });

        // Snap user GPS to nearest road network node
        const nearestId = findNearestNode(latitude, longitude);
        if (nearestId) {
          setStartNodeId(nearestId);
        }
      },
      (err) => {
        console.warn('Geolocation access failed or denied:', err);
        setGpsStatus('denied');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  }, []);

  // GPS는 이용자가 "내 위치" 버튼을 눌렀을 때만 요청한다.
  // (자동 요청 시 출발지가 현재 위치로 덮어써져 기본 경로가 어긋나던 문제 방지)

  const standardRoute = computedRoutes.standard;
  const shadeRoute = computedRoutes.shade;
  const nightRoute = computedRoutes.night;

  // Current active recommended route based on selected mode
  const recommendedRoute = useMemo(() => {
    if (mode === 'shade') return shadeRoute || standardRoute;
    if (mode === 'night') return nightRoute || standardRoute;
    return standardRoute;
  }, [mode, shadeRoute, nightRoute, standardRoute]);

  // Reset to default location
  const handleResetPins = () => {
    setStartPoint(DEFAULT_START);
    setTargetPoint(DEFAULT_TARGET);
    setStartNodeId('N_HAE_STATION_3');
    setTargetNodeId('N_BEACH_EVENT');
    setModeOverride('auto');
    setShowGuide(false);
    setIsLiveTime(true);
  };

  // 글자 크게 보기: 루트 글자 크기를 키워 rem 기반 UI 전체를 확대한다.
  useEffect(() => {
    document.documentElement.style.fontSize = needs.includes('largeText') ? '125%' : '';
  }, [needs]);

  // 지도 보기를 직접 바꾸면 탐색(보행자 시점)을 끝낸다
  const changeViewMode = (next) => {
    setNavigating(false);
    setViewMode(next);
  };

  const startNavigation = () => {
    setNavIndex(0);
    setNavigating(true);
    setViewMode('3d');
  };

  // 주변 장소(병원·편의점 등): 경로 주변을 불러오고, 고른 종류만 지도에 표시한다
  const [poiData, setPoiData] = useState({ status: 'idle', pois: [] });
  const [poiSelected, setPoiSelected] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('urbanshelter.poiSelected') || '{}') || {};
    } catch {
      return {};
    }
  });
  const togglePoi = (id) => setPoiSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  // 저장은 상태가 확정된 뒤에 한다(상태 갱신 함수 안에서 저장하면 개발 모드에서 두 번 실행될 수 있다)
  useEffect(() => {
    try {
      window.localStorage.setItem('urbanshelter.poiSelected', JSON.stringify(poiSelected));
    } catch {
      // 저장소를 쓸 수 없어도 현재 세션에서는 그대로 적용된다
    }
  }, [poiSelected]);
  useEffect(() => {
    if (!routeBounds) return;
    const controller = new AbortController();
    const margin = 0.002; // 건물용 범위(이미 200m 여유)에 200m를 더해 약 450m
    setPoiData((prev) => ({ ...prev, status: 'loading' }));
    fetchPoisForBounds(
      {
        south: routeBounds.south - margin,
        north: routeBounds.north + margin,
        west: routeBounds.west - margin,
        east: routeBounds.east + margin
      },
      controller.signal
    ).then((result) => {
      if (!controller.signal.aborted) setPoiData(result);
    });
    return () => controller.abort();
  }, [routeBounds]);
  const poiCounts = useMemo(() => {
    const counts = {};
    POI_CATEGORIES.forEach((c) => (counts[c.id] = 0));
    poiData.pois.forEach((p) => (counts[p.category] += 1));
    return counts;
  }, [poiData]);

  // 오른쪽 아래 '내 위치' 버튼: 출발지는 건드리지 않고 지도만 현재 위치로 옮긴다
  const [locateTarget, setLocateTarget] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState('');
  const showLocateMsg = (text) => {
    setLocateMsg(text);
    setTimeout(() => setLocateMsg(''), 4000);
  };
  const locateMe = () => {
    if (!navigator.geolocation) {
      showLocateMsg('이 브라우저에서는 위치를 확인할 수 없어요');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserGps(here);
        setLocateTarget({ ...here, key: Date.now() });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        showLocateMsg(err.code === 1 ? '위치 사용을 허용해 주세요' : '현재 위치를 찾지 못했어요');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  // 걷는 동안 현재 위치를 계속 받아 길 안내 단계를 자동으로 넘긴다
  const [livePos, setLivePos] = useState(null);
  const [geoState, setGeoState] = useState('idle'); // idle | searching | active | denied | error | unsupported
  useEffect(() => {
    if (!navigating) {
      setLivePos(null);
      setGeoState('idle');
      return;
    }
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      return;
    }
    setGeoState('searching');
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLivePos({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGeoState('active');
      },
      (err) => setGeoState(err.code === 1 ? 'denied' : 'error'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [navigating]);

  const liveProgress = useMemo(
    () => (geoState === 'active' ? computeProgress(livePos, baseRoute?.latlngs, baseRoute?.steps, targetPoint) : null),
    [geoState, livePos, baseRoute, targetPoint]
  );
  const following = Boolean(liveProgress?.onRoute);
  useEffect(() => {
    if (following) setNavIndex(liveProgress.stepIndex);
  }, [following, liveProgress?.stepIndex]);

  // 안내 상태: 위치를 따라가는 중 / 확인 중 / 경로 이탈 / 직접 넘기기
  const liveStatus = !navigating
    ? 'off'
    : geoState === 'searching'
    ? 'searching'
    : geoState === 'active'
    ? following
      ? 'following'
      : 'off-route'
    : 'manual';

  const closeGuide = () => {
    if (navigating) {
      setNavigating(false);
      setViewMode('2d');
    }
    setShowGuide(false);
  };

  const stopNavigation = () => {
    setNavigating(false);
    setViewMode('2d');
  };

  const applyProfile = (selected) => {
    const next = { needs: selected };
    setProfile(next);
    saveProfile(next);
    setModeOverride('auto');
    setShowOnboarding(false);
  };

  // "해당 없음 / 나중에": 빈 선택으로 저장해 다음 방문부터는 묻지 않는다.
  const skipOnboarding = () => applyProfile([]);

  // 설정창에서 바꾼 "이동 도움"은 즉시 적용·저장한다.
  const changeNeeds = (next) => {
    const nextProfile = { needs: next };
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  return (
    <div className="app-container">
      {showOnboarding && (
        <Onboarding
          initialNeeds={needs}
          isFirstRun
          onConfirm={applyProfile}
          onSkip={skipOnboarding}
        />
      )}

      {showSettings && (
        <SettingsPanel
          needs={needs}
          onChangeNeeds={changeNeeds}
          modeOverride={modeOverride}
          setModeOverride={setModeOverride}
          autoDecision={autoDecision}
          mode={mode}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          simulatedHour={simulatedHour}
          setSimulatedHour={setSimulatedHour}
          isLiveTime={isLiveTime}
        onResetLive={() => setIsLiveTime(true)}
          setIsLiveTime={setIsLiveTime}
          layers={layers}
          setLayers={setLayers}
          travelMode={travelMode}
          setTravelMode={setTravelMode}
          mapThemeSetting={mapThemeSetting}
          setMapThemeSetting={setMapThemeSetting}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Top Header */}
      <Header
        onResetPins={handleResetPins}
        onOpenSettings={() => setShowSettings(true)}
        viewMode={viewMode}
        setViewMode={changeViewMode}
        mapThemeSetting={mapThemeSetting}
        setMapThemeSetting={setMapThemeSetting}
        sunPos={sunPos}
        simulatedHour={simulatedHour}
        isLiveTime={isLiveTime}
      />

      {/* Main Workspace */}
      <main className="main-workspace">
        {/* Full-bleed Map: 2D(Leaflet) 또는 3D(MapLibre 입체 건물) */}
        {viewMode === '3d' ? (
          <Map3D
            startPoint={startPoint}
            targetPoint={targetPoint}
            recommendedRoute={recommendedRoute}
            mode={mode}
            focusPoint={focusPoint}
            navigating={navigating}
            navPoint={
              navigating
                ? following
                  ? [livePos.lat, livePos.lng]
                  : baseRoute?.steps?.[navIndex]?.point || null
                : null
            }
            baseLatlngs={baseRoute?.latlngs || null}
            shadows={shadows}
            trees={trees}
            sunPos={sunPos}
            userGps={userGps}
            locateTarget={locateTarget}
            mapTheme={mapTheme}
            poiSelected={poiSelected}
          />
        ) : (
        <MapComponent
          userGps={userGps}
          onRequestGps={requestGpsLocation}
          startPoint={startPoint}
          setStartPoint={setStartPoint}
          targetPoint={targetPoint}
          setTargetPoint={setTargetPoint}
          startNodeId={startNodeId}
          setStartNodeId={setStartNodeId}
          targetNodeId={targetNodeId}
          setTargetNodeId={setTargetNodeId}
          pinSelectMode={pinSelectMode}
          setPinSelectMode={setPinSelectMode}
          mode={mode}
          recommendedRoute={recommendedRoute}
          standardRoute={standardRoute}
          shadeRoute={shadeRoute}
          nightRoute={nightRoute}
          sunPos={sunPos}
          shadows={shadows}
          simulatedHour={simulatedHour}
          layers={layers}
          mapTheme={mapTheme}
          focusPoint={focusPoint}
          buildings={buildings}
          trees={trees}
          travelMode={travelMode}
          locateTarget={locateTarget}
          poiSelected={poiSelected}
        />
        )}

        {/* Floating Left Overlay: Route Search & Control Panel */}
        <div className="floating-overlay-left">
          {/* 날씨 기반 자동 경로 안내 */}
          <AutoBanner
            weather={weather}
            mode={mode}
            isAuto={modeOverride === 'auto'}
            reason={autoDecision.reason}
            isCar={isCar}
            onResetAuto={() => setModeOverride('auto')}
          />

          {/* Route Search & Recommendation Component */}
          <RouteSearch
            userGps={userGps}
            onRequestGps={requestGpsLocation}
            gpsStatus={gpsStatus}
            startPoint={startPoint}
            setStartPoint={setStartPoint}
            targetPoint={targetPoint}
            setTargetPoint={setTargetPoint}
            startNodeId={startNodeId}
            setStartNodeId={setStartNodeId}
            targetNodeId={targetNodeId}
            setTargetNodeId={setTargetNodeId}
            mode={mode}
            setMode={setMode}
            standardRoute={standardRoute}
            shadeRoute={shadeRoute}
            nightRoute={nightRoute}
            travelMode={travelMode}
            setTravelMode={setTravelMode}
            onShowGuide={() => setShowGuide(true)}
            guideOpen={showGuide}
          />

          {/* 경로 추천 세부 내용 (왼쪽 가장자리, 작게) */}
          <Dashboard
            mode={mode}
            recommendedRoute={recommendedRoute}
            standardRoute={standardRoute}
            sunPos={sunPos}
            walkSpeed={walkSpeed}
            shadeInfo={shadeInfo}
            isCar={isCar}
          />
        </div>

        {/* Floating Right Overlay: Turn-by-turn route guide */}
        <div className="floating-overlay-right">
          <PoiPanel selected={poiSelected} onToggle={togglePoi} counts={poiCounts} status={poiData.status} />
          {recommendedRoute && baseRoute && showGuide && (
            <RouteGuide
              steps={baseRoute.steps}
              totalDistance={recommendedRoute.totalDistance}
              totalMinutes={recommendedRoute.estimatedMinutes}
              onFocusStep={setFocusPoint}
              mode={mode}
              navigating={navigating}
              navIndex={navIndex}
              onStartNav={startNavigation}
              onStopNav={stopNavigation}
              onSelectNavStep={setNavIndex}
              liveStatus={liveStatus}
              nearDestination={Boolean(liveProgress?.nearDestination)}
              walkSpeed={walkSpeed}
              isCar={isCar}
              onClose={closeGuide}
            />
          )}
        </div>

        {/* 오른쪽 아래: 현재 위치로 이동 */}
        {locateMsg && <div className="locate-msg" role="status">{locateMsg}</div>}
        <button
          type="button"
          className="locate-btn"
          onClick={locateMe}
          disabled={locating}
          aria-label="현재 위치로 이동"
          title="현재 위치로 이동"
        >
          <LocateFixed size={22} className={locating ? 'spin-anim' : ''} />
        </button>
      </main>
    </div>
  );
}
