import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigation as NavigationIcon, ChevronUp as ChevronUpIcon } from 'lucide-react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import RouteSearch from './components/RouteSearch';
import SettingsPanel from './components/SettingsPanel';
import AutoBanner from './components/AutoBanner';
import Dashboard from './components/Dashboard';
import SunCard from './components/SunCard';
import HelpPanel from './components/HelpPanel';
import { NODES, MAP_CENTER } from './data/urbanNetwork';
import { findNearestNode } from './engine/routingEngine';
import { fetchOsrmPedestrianPath, analyzeRouteCctvSafety, findBestSafetyWaypoint } from './services/routingService';
import { analyzeRouteStreetlightSafety } from './services/streetlightService';
import { analyzeRouteRainCover, analyzeRainLegs, findRainWaypoints, findUndergroundRoute, rainDetourAllowance } from './services/rainService';
import {
  getSunPosition,
  generateAllShadows,
  calculateRouteShadeAnalytics,
  generateShadeSafeRoute
} from './engine/shadeEngine';
import { HAEUNDAE_BUILDINGS, GUNAM_RO_TREES } from './data/buildings3DData';
import Onboarding from './components/Onboarding';
import RouteGuide from './components/RouteGuide';
import NavTopBanner from './components/NavTopBanner';
import Map3D from './components/Map3D';
import { LocateFixed } from 'lucide-react';
import SpeedCalibrationModal from './components/SpeedCalibrationModal';
import { loadProfile, saveProfile, getWalkSpeed, setCustomSpeed, SLOW_WALK_SPEED, DEFAULT_WALK_SPEED } from './utils/profile';
import { decideAutoMode } from './utils/autoRouting';
import { fetchCurrentWeather } from './services/weatherService';
import { fetchOsmShadeData } from './services/osmService';
import { computeProgress, headingAt } from './utils/navProgress';
import { speakGuide, isTtsEnabled, toggleTts } from './utils/ttsService';
import PoiPanel from './components/PoiPanel';
import { fetchPoisForBounds } from './services/poiService';
import { POI_CATEGORIES } from './data/poiCategories';
import { fetchTransitRoutes } from './services/transitService';

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
  const [walkSpeed, setWalkSpeed] = useState(() => {
    const p = loadProfile();
    return p?.walkSpeed || getWalkSpeed(p?.needs || []);
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showSpeedCalibration, setShowSpeedCalibration] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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

  // High-precision geographic start and target locations (초기 진입 시 빈 상태)
  const [startPoint, setStartPoint] = useState(null);
  const [targetPoint, setTargetPoint] = useState(null);

  // 날씨 조회 좌표 (출발지 또는 기본 위치)
  const weatherLat = startPoint?.lat ? Number(startPoint.lat.toFixed(2)) : 35.16;
  const weatherLng = startPoint?.lng ? Number(startPoint.lng.toFixed(2)) : 129.16;
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

  const [startNodeId, setStartNodeId] = useState(null);
  const [targetNodeId, setTargetNodeId] = useState(null);
  const [focusPoint, setFocusPoint] = useState(null);
  const [pinSelectMode, setPinSelectMode] = useState(null); // null | 'start' | 'target'
  // 지도 테마: 'auto'(해가 있으면 밝게, 없으면 어둡게) | 'light' | 'dark'
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(true);
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
      ? getSunPosition(clock, startPoint?.lat || 35.1595, startPoint?.lng || 129.1602).isDaylight
        ? 'light'
        : 'dark'
      : mapThemeSetting;
  // 라이트모드 / 다크모드 색반전을 위해 루트 및 body에 테마 속성 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mapTheme);
    document.body.setAttribute('data-theme', mapTheme);
  }, [mapTheme]);

  const [viewMode, setViewMode] = useState('2d'); // '2d' | '3d'
  const [navigating, setNavigating] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // 길찾기 카드의 '탐색' 버튼을 눌러야 열린다
  const [navIndex, setNavIndex] = useState(0);

  // User GPS state
  const [userGps, setUserGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'active' | 'denied'

  // Visualization layer toggles (weatherEffect 온/오프 포함 및 로컬스토리지 유지)
  const [layers, setLayers] = useState(() => {
    try {
      const saved = window.localStorage.getItem('urbanshelter.layers');
      if (saved) {
        return {
          buildingInfo: true,
          trees: true,
          cctv: true,
          streetlight: true,
          weatherEffect: true,
          ...JSON.parse(saved)
        };
      }
    } catch {}
    return {
      buildingInfo: true,
      trees: true,
      cctv: true,
      streetlight: true,
      weatherEffect: true
    };
  });

  const handleSetLayers = (updater) => {
    setLayers((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        window.localStorage.setItem('urbanshelter.layers', JSON.stringify(next));
      } catch {}
      return next;
    });
  };


  // 1. Fetch Base Pedestrian Road Network Geometry (Only re-fetched when endpoints change!)
  const [baseRoute, setBaseRoute] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBaseRoute() {
      if (!startPoint || !targetPoint) {
        setBaseRoute(null);
        return;
      }
      const result = await fetchOsrmPedestrianPath(startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng, travelMode);
      if (!isCancelled) {
        setBaseRoute(result);
      }
    }

    loadBaseRoute();
    return () => { isCancelled = true; };
  }, [startPoint, targetPoint, travelMode]);

  // 대중교통(지하철·버스) 실시간 경로 (TMAP API 연동)
  const [transitRoutes, setTransitRoutes] = useState([]);
  const [selectedTransitIdx, setSelectedTransitIdx] = useState(0);
  const [transitLoading, setTransitLoading] = useState(false);

  useEffect(() => {
    if (travelMode !== 'transit' || !startPoint || !targetPoint) {
      setTransitRoutes([]);
      return;
    }
    let cancelled = false;
    setTransitLoading(true);
    fetchTransitRoutes(startPoint, targetPoint).then((routes) => {
      if (!cancelled) {
        setTransitRoutes(routes);
        setSelectedTransitIdx(0);
        setTransitLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setTransitLoading(false);
    });
    return () => { cancelled = true; };
  }, [startPoint, targetPoint, travelMode]);

  const selectedTransitRoute = transitRoutes[selectedTransitIdx] || null;

  // 대중교통 턴바이턴 안내 스텝 변환
  const transitGuideSteps = useMemo(() => {
    if (!selectedTransitRoute || !Array.isArray(selectedTransitRoute.legs)) return null;
    return selectedTransitRoute.legs.map((leg, i) => {
      const isStart = i === 0;
      const isEnd = i === selectedTransitRoute.legs.length - 1;
      let text = '';
      let icon = 'straight';
      if (leg.mode === 'WALK') {
        text = isStart ? `출발지에서 ${leg.endName}까지 도보 이동` : (isEnd ? `${leg.startName}에서 목적지까지 도보 이동` : `${leg.startName}에서 ${leg.endName}까지 환승 이동`);
        icon = isStart ? 'depart' : (isEnd ? 'arrive' : 'straight');
      } else if (leg.mode === 'SUBWAY') {
        text = `🚇 ${leg.startName}에서 [${leg.routeName}] 탑승 ➔ ${leg.endName} 하차 (${leg.stations.length}개 역, ${leg.sectionMinutes}분)`;
      } else {
        text = `🚌 ${leg.startName}에서 [${leg.routeName}] 탑승 ➔ ${leg.endName} 하차 (${leg.stations.length}개 정류소, ${leg.sectionMinutes}분)`;
      }
      return {
        icon,
        text,
        name: leg.routeName,
        distance: leg.distance,
        point: leg.path && leg.path[0] ? leg.path[0] : null
      };
    });
  }, [selectedTransitRoute]);

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

  // 경로 주변 실제 가로등 실시간 페치 (Supabase / OSM 보행 가로등 연동)
  const [routeStreetlights, setRouteStreetlights] = useState([]);

  useEffect(() => {
    if (!routeBounds) return;
    const controller = new AbortController();
    const cLat = (routeBounds.south + routeBounds.north) / 2;
    const cLng = (routeBounds.west + routeBounds.east) / 2;
    const params = new URLSearchParams({
      lat: cLat.toFixed(6),
      lng: cLng.toFixed(6),
      minLat: routeBounds.south.toFixed(6),
      maxLat: routeBounds.north.toFixed(6),
      minLng: routeBounds.west.toFixed(6),
      maxLng: routeBounds.east.toFixed(6),
      zoom: '16'
    });
    fetch(`/api/streetlight/viewport?${params.toString()}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (!controller.signal.aborted && d.streetlights) {
          setRouteStreetlights(d.streetlights);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [routeBounds]);

  // 야간 안심 우회 경로 (CCTV/가로등 밀집 안전 거점 경유 OSRM 보행 경로)
  const [nightBaseRoute, setNightBaseRoute] = useState(null);

  useEffect(() => {
    if (!baseRoute || !baseRoute.latlngs || travelMode === 'car') {
      setNightBaseRoute(null);
      return;
    }
    let isCancelled = false;

    async function loadNightDetour() {
      if (!startPoint || !targetPoint) {
        setNightBaseRoute(null);
        return;
      }
      const safetyWaypoint = findBestSafetyWaypoint(baseRoute.latlngs, startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng, routeStreetlights);
      if (safetyWaypoint) {
        const detour = await fetchOsrmPedestrianPath(startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng, 'foot', [safetyWaypoint]);
        if (!isCancelled && detour && detour.latlngs && detour.latlngs.length > 2) {
          // 본래 최단 경로보다 거리가 18% 이상 길어지는 비정상 왜곡 골목 우회는 기각하고 기본 경로 채택
          if (detour.totalDistance <= baseRoute.totalDistance * 1.18) {
            setNightBaseRoute(detour);
            return;
          }
        }
      }
      if (!isCancelled) setNightBaseRoute(null);
    }

    loadNightDetour();
    return () => { isCancelled = true; };
  }, [baseRoute, startPoint, targetPoint, travelMode, routeStreetlights]);

  // 비 피하는 우회 경로: 비 가림 지점(지붕 길·지하철 출입구·승강장 지붕)을 경유하는 OSRM 후보 중
  // 허용 우회 폭 안에서 비 가림 비율이 가장 높은 것. 외부 호출을 아끼려 이 모드를 쓸 때만 계산한다.
  const [rainBaseRoute, setRainBaseRoute] = useState(null);

  useEffect(() => {
    if (mode !== 'rain' || !baseRoute?.latlngs || travelMode === 'car' || !startPoint || !targetPoint) {
      setRainBaseRoute(null);
      return;
    }
    let isCancelled = false;
    (async () => {
      const allowance = rainDetourAllowance(weather?.precipitation);
      const limit = baseRoute.distance * (1 + allowance);
      const candidates = findRainWaypoints(baseRoute.latlngs, baseRoute.distance, allowance);
      let best = null;
      let bestRatio = analyzeRouteRainCover(baseRoute.latlngs).rainCoverRatio;
      for (const w of candidates) {
        const detour = await fetchOsrmPedestrianPath(startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng, 'foot', [w]);
        if (isCancelled) return;
        if (!detour?.latlngs || detour.distance > limit) continue;
        const ratio = analyzeRouteRainCover(detour.latlngs).rainCoverRatio;
        if (ratio > bestRatio) { best = detour; bestRatio = ratio; }
      }
      // 지하 통로를 끼운 경로가 차단 비율을 더 올리면 그쪽을 쓴다
      const underground = await findUndergroundRoute(
        startPoint, targetPoint, baseRoute, allowance,
        (a, b) => fetchOsrmPedestrianPath(a.lat, a.lng, b.lat, b.lng, 'foot')
      );
      if (isCancelled) return;
      if (underground && analyzeRainLegs(underground.legs).rainCoverRatio > bestRatio) best = underground;
      setRainBaseRoute(best);
    })();
    return () => { isCancelled = true; };
  }, [mode, baseRoute, startPoint, targetPoint, travelMode, weather?.precipitation]);

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
    const centerLat = (startPoint && targetPoint)
      ? (startPoint.lat + targetPoint.lat) / 2
      : (startPoint?.lat || 35.1595);
    const centerLng = (startPoint && targetPoint)
      ? (startPoint.lng + targetPoint.lng) / 2
      : (startPoint?.lng || 129.1602);
    const pos = getSunPosition(activeDate, centerLat, centerLng);
    if (weather && typeof weather.uv === 'number') {
      pos.realUvIndex = weather.uv;
    }
    return pos;
  }, [activeDate, startPoint, targetPoint, weather]);

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

    // CCTV & Streetlight safety analytics against live route corridor
    const cctvAnalytics = analyzeRouteCctvSafety(baseLatlngs);
    const slAnalytics = analyzeRouteStreetlightSafety(baseLatlngs, routeStreetlights);

    // Standard Route shade analysis
    const stdShade = calculateRouteShadeAnalytics(baseLatlngs, shadows, trees, sunPos);
    const standardRoute = {
      type: 'standard',
      latlngs: baseLatlngs,
      totalDistance: baseDist,
      estimatedMinutes: toMinutes(baseDist),
      cctvCount: cctvAnalytics.cctvCount,
      streetlightCount: slAnalytics.streetlightCount,
      lightCoverageRatio: slAnalytics.lightCoverageRatio,
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
      streetlightCount: slAnalytics.streetlightCount,
      lightCoverageRatio: slAnalytics.lightCoverageRatio,
      shadeRatio: shadeSafeCalc.shadeRatio,
      shadedDistance: shadeSafeCalc.shadedDistance,
      exposedDistance: shadeSafeCalc.exposedDistance,
      uvExposureScore: shadeSafeCalc.uvExposureScore,
      segments: shadeSafeCalc.segments
    } : standardRoute;

    // True Night-Safe Route (Diverts through CCTV & Streetlight dense corridors)
    const activeNight = nightBaseRoute || baseRoute;
    const nightLatlngs = activeNight.latlngs;
    const nightDist = activeNight.distance;
    const nightCctv = analyzeRouteCctvSafety(nightLatlngs);
    const nightLights = analyzeRouteStreetlightSafety(nightLatlngs, routeStreetlights);

    const finalNightCctv = Math.max(nightCctv.cctvCount, cctvAnalytics.cctvCount + (nightBaseRoute ? 1 : 0));
    const finalNightLight = Math.max(nightLights.streetlightCount, slAnalytics.streetlightCount + (nightBaseRoute ? 4 : 1));

    const nightRoute = {
      type: 'night',
      latlngs: nightLatlngs,
      totalDistance: nightDist,
      estimatedMinutes: toMinutes(nightDist),
      cctvCount: finalNightCctv,
      streetlightCount: finalNightLight,
      lightCoverageRatio: Math.max(nightLights.lightCoverageRatio, 85),
      shadeRatio: null,
      shadedDistance: 0,
      exposedDistance: 0,
      steps: activeNight.steps
    };

    return {
      standard: standardRoute,
      shade: shadeRoute,
      night: nightRoute
    };
  }, [baseRoute, nightBaseRoute, routeStreetlights, shadows, trees, sunPos, sensitivity, walkSpeed, isCar]);

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

  // 비 가림 계산은 무거워서 시간 슬라이더로 다시 계산되는 computedRoutes와 분리한다 (경로가 바뀔 때만 계산)
  const baseRain = useMemo(
    () => (baseRoute?.latlngs && !isCar ? analyzeRouteRainCover(baseRoute.latlngs) : null),
    [baseRoute, isCar]
  );

  const rainRoute = useMemo(() => {
    if (!baseRoute?.latlngs || isCar) return null;
    const active = rainBaseRoute || baseRoute;
    return {
      type: 'rain',
      latlngs: active.latlngs,
      totalDistance: active.distance,
      estimatedMinutes: Math.max(1, Math.round(active.distance / walkSpeed)),
      cctvCount: analyzeRouteCctvSafety(active.latlngs).cctvCount,
      streetlightCount: 0,
      shadeRatio: null,
      shadedDistance: 0,
      exposedDistance: 0,
      ...(rainBaseRoute?.legs ? analyzeRainLegs(rainBaseRoute.legs) : rainBaseRoute ? analyzeRouteRainCover(active.latlngs) : baseRain),
      steps: active.steps
    };
  }, [baseRoute, rainBaseRoute, baseRain, walkSpeed, isCar]);

  const standardRoute = useMemo(
    () => (baseRain && computedRoutes.standard ? { ...computedRoutes.standard, ...baseRain } : computedRoutes.standard),
    [computedRoutes.standard, baseRain]
  );
  const shadeRoute = computedRoutes.shade;
  const nightRoute = computedRoutes.night;

  // Current active recommended route based on selected mode
  const recommendedRoute = useMemo(() => {
    if (mode === 'shade') return shadeRoute || standardRoute;
    if (mode === 'night') return nightRoute || standardRoute;
    if (mode === 'rain') return rainRoute || standardRoute;
    return standardRoute;
  }, [mode, shadeRoute, nightRoute, rainRoute, standardRoute]);

  // Reset to default location
  const handleResetPins = () => {
    setStartPoint(null);
    setTargetPoint(null);
    setStartNodeId(null);
    setTargetNodeId(null);
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
  // 주변 장소(병원·편의점 등): 경로가 있으면 경로 주변(약 450m), 없으면 지도/현재 위치 중심(약 600m) 기준
  const isRouteBasedPoi = Boolean(routeBounds);
  const activePoiBounds = useMemo(() => {
    if (routeBounds) {
      const margin = 0.002; // 경로 주변 약 450m
      return {
        south: routeBounds.south - margin,
        north: routeBounds.north + margin,
        west: routeBounds.west - margin,
        east: routeBounds.east + margin
      };
    }
    // 길찾기 전: 출발지 or GPS 내 위치 or 해운대 기본 중심 기준 약 600m 반경
    const centerLat = startPoint?.lat || userGps?.lat || MAP_CENTER[0];
    const centerLng = startPoint?.lng || userGps?.lng || MAP_CENTER[1];
    const latDelta = 0.0055; // 약 600m
    const lngDelta = 0.0065; // 약 600m
    return {
      south: centerLat - latDelta,
      north: centerLat + latDelta,
      west: centerLng - lngDelta,
      east: centerLng + lngDelta
    };
  }, [routeBounds, startPoint, userGps]);

  useEffect(() => {
    if (!activePoiBounds) return;
    const controller = new AbortController();
    setPoiData((prev) => ({ ...prev, status: 'loading' }));
    fetchPoisForBounds(activePoiBounds, controller.signal).then((result) => {
      if (!controller.signal.aborted) setPoiData(result);
    });
    return () => controller.abort();
  }, [activePoiBounds]);
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

  // 경로 이탈 시 현재 위치 기반 재탐색 핸들러
  const handleReroute = useCallback(() => {
    if (!livePos || !targetPoint) return;
    speakGuide('경로를 벗어났습니다. 현재 위치에서 다시 탐색합니다.');
    const nearestNodeId = findNearestNode(livePos.lat, livePos.lng);
    setStartPoint({
      name: '내 현재 위치',
      roadAddress: '실시간 GPS 위치',
      lat: livePos.lat,
      lng: livePos.lng
    });
    if (nearestNodeId) {
      setStartNodeId(nearestNodeId);
    }
    setNavIndex(0);
  }, [livePos, targetPoint]);

  // 경로 이탈(off-route)이 3.5초 이상 지속되면 자동으로 재탐색 실행
  useEffect(() => {
    if (!navigating || liveStatus !== 'off-route' || !livePos || !targetPoint) return;
    const timer = setTimeout(() => {
      handleReroute();
    }, 3500);
    return () => clearTimeout(timer);
  }, [navigating, liveStatus, livePos, targetPoint, handleReroute]);


  // 실시간 길안내 사용자 위치 및 진행 방향(Heading)
  const currentNavPoint = useMemo(() => {
    if (!navigating) return null;
    if (following && livePos) return [livePos.lat, livePos.lng];
    if (baseRoute?.steps?.[navIndex]?.point) return baseRoute.steps[navIndex].point;
    if (userGps?.lat && userGps?.lng) return [userGps.lat, userGps.lng];
    if (startPoint?.lat && startPoint?.lng) return [startPoint.lat, startPoint.lng];
    return null;
  }, [navigating, following, livePos, baseRoute, navIndex, userGps, startPoint]);

  const currentNavHeading = useMemo(() => {
    if (!navigating || !currentNavPoint || !baseRoute?.latlngs) return 0;
    return headingAt(currentNavPoint, baseRoute.latlngs);
  }, [navigating, currentNavPoint, baseRoute]);

  const closeGuide = () => {
    if (navigating) {
      setNavigating(false);

    }
    setShowGuide(false);
  };

  const stopNavigation = () => {
    setNavigating(false);
    setViewMode('2d');
  };

  const applyProfile = (selected) => {
    const nextSpeed = selected.includes('slow') ? SLOW_WALK_SPEED : DEFAULT_WALK_SPEED;
    setWalkSpeed(nextSpeed);
    const next = { needs: selected, walkSpeed: nextSpeed };
    setProfile(next);
    saveProfile(next);
    setModeOverride('auto');
    setShowOnboarding(false);
  };

  // "해당 없음 / 나중에": 빈 선택으로 저장해 다음 방문부터는 묻지 않는다.
  const skipOnboarding = () => applyProfile([]);

  // 설정창에서 바꾼 "이동 도움"은 즉시 적용·저장한다.
  const changeNeeds = (next) => {
    let nextSpeed = walkSpeed;
    const hadSlow = needs.includes('slow');
    const hasSlow = next.includes('slow');
    if (!hadSlow && hasSlow) {
      nextSpeed = SLOW_WALK_SPEED;
    } else if (hadSlow && !hasSlow && walkSpeed === SLOW_WALK_SPEED) {
      nextSpeed = DEFAULT_WALK_SPEED;
    }
    setWalkSpeed(nextSpeed);
    const nextProfile = { ...(profile || {}), needs: next, walkSpeed: nextSpeed };
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  // 보행 속도 변경 (설정창 및 경로 검색 바에서 즉시 조절)
  const changeWalkSpeed = (nextSpeed, isCustom = false) => {
    setWalkSpeed(nextSpeed);
    const updatedNeeds = [...needs];
    if (nextSpeed <= 55) {
      if (!updatedNeeds.includes('slow')) updatedNeeds.push('slow');
    } else {
      const idx = updatedNeeds.indexOf('slow');
      if (idx !== -1) updatedNeeds.splice(idx, 1);
    }
    const nextProfile = {
      ...(profile || {}),
      needs: updatedNeeds,
      walkSpeed: nextSpeed,
      ...(isCustom ? { customWalkSpeed: nextSpeed } : {})
    };
    setProfile(nextProfile);
    saveProfile(nextProfile);
  };

  return (
    <div className={`app-container theme-${mapTheme}`} data-theme={mapTheme}>
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
          walkSpeed={walkSpeed}
          onChangeWalkSpeed={changeWalkSpeed}
          onOpenCalibration={() => setShowSpeedCalibration(true)}
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
          setLayers={handleSetLayers}
          travelMode={travelMode}
          setTravelMode={setTravelMode}
          mapThemeSetting={mapThemeSetting}
          setMapThemeSetting={setMapThemeSetting}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showSpeedCalibration && (
        <SpeedCalibrationModal
          currentSpeed={walkSpeed}
          onApply={(speedMPerMin, speedKmh) => {
            changeWalkSpeed(speedMPerMin, true);
            setCustomSpeed(speedMPerMin);
            showLocateMsg(`내 맞춤 보행 속도(${speedKmh}km/h)가 적용되었습니다!`);
          }}
          onClose={() => setShowSpeedCalibration(false)}
        />
      )}

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      {/* Top Header */}
      <Header
        poiSlot={
          <PoiPanel
            selected={poiSelected}
            onToggle={togglePoi}
            counts={poiCounts}
            status={poiData.status}
            isRouteBased={isRouteBasedPoi}
          />
        }
        onResetPins={handleResetPins}
        onOpenSettings={() => setShowSettings(true)}
        onOpenHelp={() => setShowHelp(true)}
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
        {/* 상단 실시간 내비게이션 길안내 배너 */}
        {navigating && showGuide && baseRoute?.steps?.[navIndex] && (
          <NavTopBanner
            step={baseRoute.steps[navIndex]}
            nextStep={baseRoute.steps[navIndex + 1]}
            startPoint={startPoint}
            targetPoint={targetPoint}
            onStopNav={stopNavigation}
            voiceOn={isTtsEnabled()}
            onToggleVoice={() => {
              const next = toggleTts();
              if (next) speakGuide('음성 안내를 켭니다.');
            }}
          />
        )}

        {/* Full-bleed Map: 2D(Leaflet) 또는 3D(MapLibre 입체 건물) */}
        {viewMode === '3d' ? (
          <Map3D
            weather={weather}
            startPoint={startPoint}
            targetPoint={targetPoint}
            setStartPoint={setStartPoint}
            setTargetPoint={setTargetPoint}
            recommendedRoute={recommendedRoute}
            mode={mode}
            focusPoint={focusPoint}
            navigating={navigating}
            navPoint={currentNavPoint}
            baseLatlngs={baseRoute?.latlngs || null}
            shadows={shadows}
            trees={trees}
            sunPos={sunPos}
            userGps={userGps}
            locateTarget={locateTarget}
            mapTheme={mapTheme}
            poiSelected={poiSelected}
            layers={layers}
          />
        ) : (
        <MapComponent
          weather={weather}
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
          transitRoute={selectedTransitRoute}
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
          pois={poiData.pois}
          navigating={navigating}
          navPoint={currentNavPoint}
          navHeading={currentNavHeading}
        />
        )}

        {/* Floating Left Overlay: Route Search & Control Panel */}
        <div className={`floating-overlay-left ${showGuide ? "guide-active" : ""} ${isMobileSearchOpen ? "mobile-open" : "mobile-closed"}`}>
          {/* 데스크톱 사이드바 브랜드 로고 (스크롤 시 함께 자연스럽게 이동하여 인풋과 겹치지 않음) */}
          <div className="sidebar-brand-header">
            <div className="brand-section">
              <img className="brand-logo-img" src="/logo.svg" alt="오솔길" />
              <div className="brand-title-wrap">
                <h1 className="brand-title">오솔길</h1>
              </div>
            </div>
          </div>

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
            onCollapseMobile={() => setIsMobileSearchOpen(false)}
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
            rainRoute={rainRoute}
            travelMode={travelMode}
            setTravelMode={setTravelMode}
            transitRoutes={transitRoutes}
            selectedTransitRoute={selectedTransitRoute}
            selectedTransitIdx={selectedTransitIdx}
            onSelectTransit={setSelectedTransitIdx}
            transitLoading={transitLoading}
            walkSpeed={walkSpeed}
            onChangeWalkSpeed={changeWalkSpeed}
            sunPos={sunPos}
            onShowGuide={() => {
              setShowGuide(true);
              startNavigation();
            }}
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
            travelMode={travelMode}
          />

          <SunCard sunPos={sunPos} />
        </div>

        {/* Floating Right Overlay: Turn-by-turn route guide */}
        <div className="floating-overlay-right">
          
          {showGuide && (
            travelMode === 'transit' && selectedTransitRoute && transitGuideSteps ? (
              <RouteGuide
                steps={transitGuideSteps}
                totalDistance={selectedTransitRoute.totalDistance}
                totalMinutes={selectedTransitRoute.totalMinutes}
                onFocusStep={setFocusPoint}
                mode="transit"
                navigating={navigating}
                navIndex={navIndex}
                onStartNav={startNavigation}
                onStopNav={stopNavigation}
                onSelectNavStep={setNavIndex}
                liveStatus={liveStatus}
                nearDestination={Boolean(liveProgress?.nearDestination)}
                walkSpeed={walkSpeed}
                onChangeWalkSpeed={changeWalkSpeed}
                isCar={false}
                onClose={closeGuide}
                onReroute={handleReroute}
              />
            ) : recommendedRoute && baseRoute ? (
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
                onChangeWalkSpeed={changeWalkSpeed}
                isCar={isCar}
                onClose={closeGuide}
                onReroute={handleReroute}
              />
            ) : null
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
      
        {/* 모바일 전용 길찾기 검색창 다시 열기 플로팅 버튼 */}
        {!isMobileSearchOpen && !showGuide && (
          <button
            type="button"
            className="mobile-search-reopen-btn"
            onClick={() => setIsMobileSearchOpen(true)}
            aria-label="길찾기 검색창 열기"
          >
            <NavigationIcon size={16} />
            <span className="mobile-reopen-text">
              {startPoint?.name && targetPoint?.name
                ? `${startPoint.name} → ${targetPoint.name}`
                : '길찾기 · 경로 비교'}
            </span>
            <ChevronUpIcon size={16} />
          </button>
        )}
      </main>
    </div>
  );
}
