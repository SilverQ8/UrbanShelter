import React, { useState, useMemo } from 'react';
import Header from './components/Header';
import MapComponent from './components/MapComponent';
import ControlPanel from './components/ControlPanel';
import Dashboard from './components/Dashboard';
import { PRESET_SCENARIOS } from './data/urbanNetwork';
import { findPath } from './engine/routingEngine';

export default function App() {
  // Routing states
  const [mode, setMode] = useState('night'); // 'standard' | 'night' | 'rain'
  const [sensitivity, setSensitivity] = useState(0.65); // 0.0 to 1.0 (default 65%)
  const [startNodeId, setStartNodeId] = useState('N_HAE_STATION_5');
  const [targetNodeId, setTargetNodeId] = useState('N_BEACH_EVENT');
  const [pinSelectMode, setPinSelectMode] = useState(null); // null | 'start' | 'target'
  const [activeScenario, setActiveScenario] = useState('scenario_1');
  const [mapTheme, setMapTheme] = useState('dark'); // 'dark' | 'light'

  // Visualization layer toggles (2.3)
  const [layers, setLayers] = useState({
    streetlights: true,
    cctv: true,
    covered: true,
    deadZones: true,
  });

  // Calculate baseline shortest path (1.1)
  const standardRoute = useMemo(() => {
    return findPath(startNodeId, targetNodeId, 'standard', 0);
  }, [startNodeId, targetNodeId]);

  // Calculate recommended path with custom dynamic weights (1.2, 1.3, 1.4)
  const recommendedRoute = useMemo(() => {
    return findPath(startNodeId, targetNodeId, mode, sensitivity);
  }, [startNodeId, targetNodeId, mode, sensitivity]);

  // Scenario selection handler
  const handleSelectScenario = (scenarioId) => {
    const sc = PRESET_SCENARIOS.find((s) => s.id === scenarioId);
    if (!sc) return;
    setActiveScenario(scenarioId);
    setStartNodeId(sc.startNode);
    setTargetNodeId(sc.endNode);

    // Auto set appropriate mode for scenario
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
          startNodeId={startNodeId}
          setStartNodeId={setStartNodeId}
          targetNodeId={targetNodeId}
          setTargetNodeId={setTargetNodeId}
          pinSelectMode={pinSelectMode}
          setPinSelectMode={setPinSelectMode}
          mode={mode}
          recommendedRoute={recommendedRoute}
          standardRoute={standardRoute}
          layers={layers}
          mapTheme={mapTheme}
        />

        {/* Floating Left Overlay: Control & Weighting Panel */}
        <div className="floating-overlay-left">
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
