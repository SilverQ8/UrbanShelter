import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import RouteSearch from './components/RouteSearch';
import ControlPanel from './components/ControlPanel';
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
  // Routing states: 'shade' (Gneul-ro) | 'standard' | 'night'
  const [mode, setMode] = useState('shade');
  const [sensitivity, setSensitivity] = useState(0.70); // 0.0 to 1.0 (70% shade priority)
  
  // Solar Simulation Time states (08:00 to 19:00, default 14:00 / 2 PM when sun is high)
  const [simulatedHour, setSimulatedHour] = useState(14.0);
  const [isLiveTime, setIsLiveTime] = useState(false);

  // Compute active simulation Date object
  const activeDate = useMemo(() => {
    const d = new Date();
    if (!isLiveTime) {
      // Set to high-summer July afternoon with selected hour
      d.setMonth(6); // July
      d.setDate(15);
      const hours = Math.floor(simulatedHour);
      const mins = Math.round((simulatedHour - hours) * 60);
      d.setHours(hours, mins, 0, 0);
    }
    return d;
  }, [simulatedHour, isLiveTime]);

  // High-precision geographic start and target locations
  const [startPoint, setStartPoint] = useState(DEFAULT_START);
  const [targetPoint, setTargetPoint] = useState(DEFAULT_TARGET);

  const [startNodeId, setStartNodeId] = useState('N_HAE_STATION_3');
  const [targetNodeId, setTargetNodeId] = useState('N_BEACH_EVENT');
  const [pinSelectMode, setPinSelectMode] = useState(null); // null | 'start' | 'target'
  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' | 'light'

  // User GPS state
  const [userGps, setUserGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'active' | 'denied'

  // Visualization layer toggles
  const [layers, setLayers] = useState({
    shadows: true,
    buildings: true,
    trees: true,
    cctv: true
  });

  // 1. Fetch Base Pedestrian Road Network Geometry (Only re-fetched when endpoints change!)
  const [baseRoute, setBaseRoute] = useState(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadBaseRoute() {
      const result = await fetchOsrmPedestrianPath(startPoint.lat, startPoint.lng, targetPoint.lat, targetPoint.lng);
      if (!isCancelled) {
        setBaseRoute(result);
      }
    }

    loadBaseRoute();
    return () => { isCancelled = true; };
  }, [startPoint, targetPoint]);

  // 2. Synchronous Instant Astronomical Sun Position & 3D Building Shadows (0ms Latency!)
  // Directly recalculates at 60 FPS as you drag the time slider
  const sunPos = useMemo(() => {
    const centerLat = (startPoint.lat + targetPoint.lat) / 2;
    const centerLng = (startPoint.lng + targetPoint.lng) / 2;
    return getSunPosition(activeDate, centerLat, centerLng);
  }, [activeDate, startPoint, targetPoint]);

  const shadows = useMemo(() => {
    if (!sunPos || !sunPos.isDaylight) return [];
    return generateAllShadows(HAEUNDAE_BUILDINGS, sunPos.altitudeDeg, sunPos.azimuthDeg);
  }, [sunPos]);

  // 3. Synchronous Instant Route Analytics & Shade Path
  // Immediately recalculates as the slider moves without ANY network requests!
  const computedRoutes = useMemo(() => {
    if (!baseRoute || !baseRoute.latlngs) {
      return { standard: null, shade: null, night: null };
    }

    const baseLatlngs = baseRoute.latlngs;
    const baseDist = baseRoute.distance;
    const baseMins = baseRoute.durationMinutes;

    // CCTV analytics
    const cctvAnalytics = analyzeRouteCctvSafety(baseLatlngs);

    // Standard Route shade analysis
    const stdShade = calculateRouteShadeAnalytics(baseLatlngs, shadows, GUNAM_RO_TREES, sunPos);
    const standardRoute = {
      type: 'standard',
      latlngs: baseLatlngs,
      totalDistance: baseDist,
      estimatedMinutes: baseMins,
      cctvCount: cctvAnalytics.cctvCount,
      shadeRatio: stdShade.shadeRatio,
      shadedDistance: stdShade.shadedDistance,
      exposedDistance: stdShade.exposedDistance,
      uvExposureScore: stdShade.uvExposureScore,
      segments: stdShade.segments
    };

    // Shade-Safe Route (Gneul-ro Engine with live sidewalk shadow shift)
    const shadeSafeCalc = generateShadeSafeRoute(baseLatlngs, shadows, sensitivity, sunPos);
    const shadeRoute = shadeSafeCalc ? {
      type: 'shade',
      latlngs: shadeSafeCalc.latlngs,
      totalDistance: shadeSafeCalc.totalDistance,
      estimatedMinutes: shadeSafeCalc.estimatedMinutes,
      cctvCount: cctvAnalytics.cctvCount,
      shadeRatio: shadeSafeCalc.shadeRatio,
      shadedDistance: shadeSafeCalc.shadedDistance,
      exposedDistance: shadeSafeCalc.exposedDistance,
      uvExposureScore: shadeSafeCalc.uvExposureScore,
      segments: shadeSafeCalc.segments
    } : standardRoute;

    // Night-Safe Route (CCTV Priority)
    const nightRoute = {
      type: 'night',
      latlngs: baseLatlngs,
      totalDistance: Math.round(baseDist * (1 + (1 - sensitivity) * 0.05)),
      estimatedMinutes: Math.max(1, Math.round(baseMins * 1.02)),
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
  }, [baseRoute, shadows, sunPos, sensitivity]);

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

  // Request GPS on initial mount
  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

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
    setMode('shade');
    setSimulatedHour(14.0);
    setIsLiveTime(false);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        onResetPins={handleResetPins}
        mapTheme={mapTheme}
        setMapTheme={setMapTheme}
        sunPos={sunPos}
        simulatedHour={simulatedHour}
      />

      {/* Main Workspace */}
      <main className="main-workspace">
        {/* Full-bleed Leaflet Map */}
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
        />

        {/* Floating Left Overlay: Route Search & Control Panel */}
        <div className="floating-overlay-left">
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
          />

          {/* Infrastructure Layer, Solar Time & Weighting Controls */}
          <ControlPanel
            mode={mode}
            setMode={setMode}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            simulatedHour={simulatedHour}
            setSimulatedHour={setSimulatedHour}
            isLiveTime={isLiveTime}
            setIsLiveTime={setIsLiveTime}
            sunPos={sunPos}
            layers={layers}
            setLayers={setLayers}
            startPoint={startPoint}
            targetPoint={targetPoint}
            startNodeId={startNodeId}
            targetNodeId={targetNodeId}
            pinSelectMode={pinSelectMode}
            setPinSelectMode={setPinSelectMode}
          />
        </div>

        {/* Floating Bottom Overlay: Analytics & Hazard Dashboard */}
        <div className="floating-overlay-bottom">
          <Dashboard
            mode={mode}
            recommendedRoute={recommendedRoute}
            standardRoute={standardRoute}
            sunPos={sunPos}
          />
        </div>
      </main>
    </div>
  );
}
