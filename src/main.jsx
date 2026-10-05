import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('CRITICAL APP CRASH:', error, errorInfo);
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          color: '#f87171',
          background: '#0f172a',
          minHeight: '100vh',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          zIndex: 99999,
          position: 'relative'
        }}>
          <h2>⚠️ 애플리케이션 렌더링 오류 발생</h2>
          <div style={{ color: '#fbbf24', fontSize: '1.1rem', margin: '12px 0' }}>
            {String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            {this.state.error && this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
