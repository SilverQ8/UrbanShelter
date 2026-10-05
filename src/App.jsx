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
  // Routing states
  const [mode, setMode] = useState('night'); // 'standard' | 'night'
  const [sensitivity, setSensitivity] = useState(0.65); // 0.0 to 1.0 (default 65%)
  
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
    night: null
  });

  // Visualization layer toggles
  const [layers, setLayers] = useState({
    cctv: true
  });

  // Solve real-world pedestrian routes whenever points or sensitivity changes
  useEffect(() => {
    let isCancelled = false;

    async function computeRoutes() {
      const results = await solveAllRoutes(startPoint, targetPoint, sensitivity);
      if (!isCancelled) {
        setComputedRoutes(results);
      }
    }

    computeRoutes();
    return () => { isCancelled = true; };
  }, [startPoint, targetPoint, sensitivity]);

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
  const nightRoute = computedRoutes.night;

  // Current active recommended route based on selected mode
  const recommendedRoute = useMemo(() => {
    if (mode === 'night') return nightRoute || standardRoute;
    return standardRoute;
  }, [mode, nightRoute, standardRoute]);

  // Reset to default location
  const handleResetPins = () => {
    setStartPoint(DEFAULT_START);
    setTargetPoint(DEFAULT_TARGET);
    setStartNodeId('N_HAE_STATION_3');
    setTargetNodeId('N_BEACH_EVENT');
    setMode('night');
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        onResetPins={handleResetPins}
        mapTheme={mapTheme}
        setMapTheme={setMapTheme}
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
          nightRoute={nightRoute}
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
            nightRoute={nightRoute}
          />

          {/* Infrastructure Layer & Weighting Controls */}
          <ControlPanel
            mode={mode}
            setMode={setMode}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
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
          />
        </div>
      </main>
    </div>
  );
}
