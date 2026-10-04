import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import RouteSearch from './components/RouteSearch';
import ControlPanel from './components/ControlPanel';
import Dashboard from './components/Dashboard';
import { PRESET_SCENARIOS, MAP_CENTER } from './data/urbanNetwork';
import { findPath, findNearestNode } from './engine/routingEngine';

export default function App() {
  // Routing states
  const [mode, setMode] = useState('night'); // 'standard' | 'night' | 'rain'
  const [sensitivity, setSensitivity] = useState(0.65); // 0.0 to 1.0 (default 65%)
  const [startNodeId, setStartNodeId] = useState('N_HAE_STATION_3');
  const [targetNodeId, setTargetNodeId] = useState('N_BEACH_EVENT');
  const [pinSelectMode, setPinSelectMode] = useState(null); // null | 'start' | 'target'
  const [activeScenario, setActiveScenario] = useState('scenario_1');
  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' | 'light'

  // User GPS state
  const [userGps, setUserGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'active' | 'denied'

  // Visualization layer toggles (2.3)
  const [layers, setLayers] = useState({
    streetlights: true,
    cctv: true,
    covered: true,
    deadZones: true,
  });

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

        // Snap user GPS to nearest road network node
        const nearestId = findNearestNode(latitude, longitude);
        if (nearestId) {
          setStartNodeId(nearestId);
        }
      },
      (err) => {
        console.warn('Geolocation access failed or denied:', err);
        setGpsStatus('denied');
        // Fallback default: Haeundae Station
        setStartNodeId('N_HAE_STATION_3');
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

  // Compute all 3 routes for comparison
  const standardRoute = useMemo(() => {
    return findPath(startNodeId, targetNodeId, 'standard', 0);
  }, [startNodeId, targetNodeId]);

  const nightRoute = useMemo(() => {
    return findPath(startNodeId, targetNodeId, 'night', sensitivity);
  }, [startNodeId, targetNodeId, sensitivity]);

  const rainRoute = useMemo(() => {
    return findPath(startNodeId, targetNodeId, 'rain', sensitivity);
  }, [startNodeId, targetNodeId, sensitivity]);

  // Current active recommended route based on selected mode
  const recommendedRoute = useMemo(() => {
    if (mode === 'night') return nightRoute;
    if (mode === 'rain') return rainRoute;
    return standardRoute;
  }, [mode, nightRoute, rainRoute, standardRoute]);

  // Scenario selection handler
  const handleSelectScenario = (scenarioId) => {
    const sc = PRESET_SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    setActiveScenario(scenarioId);
    setStartNodeId(sc.startNode);
    setTargetNodeId(sc.endNode);

    if (scenarioId === 'scenario_2') {
      setMode('rain');
    } else {
      setMode('night');
    }
  };

  // Reset to default scenario
  const handleResetPins = () => {
    handleSelectScenario('scenario_1');
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        activeScenario={activeScenario}
        onSelectScenario={handleSelectScenario}
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
          rainRoute={rainRoute}
          layers={layers}
          mapTheme={mapTheme}
        />

        {/* Floating Left Overlay: Route Search & Control Panel */}
        <div className="floating-overlay-left">
          {/* New Route Search & Recommendation Component */}
          <RouteSearch
            userGps={userGps}
            onRequestGps={requestGpsLocation}
            gpsStatus={gpsStatus}
            startNodeId={startNodeId}
            setStartNodeId={setStartNodeId}
            targetNodeId={targetNodeId}
            setTargetNodeId={setTargetNodeId}
            mode={mode}
            setMode={setMode}
            standardRoute={standardRoute}
            nightRoute={nightRoute}
            rainRoute={rainRoute}
          />

          {/* Infrastructure Layer & Weighting Controls */}
          <ControlPanel
            mode={mode}
            setMode={setMode}
            sensitivity={sensitivity}
            setSensitivity={setSensitivity}
            layers={layers}
            setLayers={setLayers}
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
