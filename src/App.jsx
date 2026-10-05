import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import RouteSearch from './components/RouteSearch';
import ControlPanel from './components/ControlPanel';
import Dashboard from './components/Dashboard';
import { NODES } from './data/urbanNetwork';
import { findNearestNode } from './engine/routingEngine';
import { solveAllRoutes } from './services/routingService';

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

  // Computed Routes Container
  const [computedRoutes, setComputedRoutes] = useState({
    standard: null,
    shade: null,
    night: null,
    sunPos: null,
    shadows: []
  });

  // Visualization layer toggles
  const [layers, setLayers] = useState({
    shadows: true,
    buildings: true,
    trees: true,
    cctv: true
  });

  // Solve real-world pedestrian routes whenever points, sensitivity, or sun time changes
  useEffect(() => {
    let isCancelled = false;

    async function computeRoutes() {
      const results = await solveAllRoutes(startPoint, targetPoint, sensitivity, activeDate);
      if (!isCancelled) {
        setComputedRoutes(results);
      }
    }

    computeRoutes();
    return () => { isCancelled = true; };
  }, [startPoint, targetPoint, sensitivity, activeDate]);

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
  const sunPos = computedRoutes.sunPos;
  const shadows = computedRoutes.shadows;

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
