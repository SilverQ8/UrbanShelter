// Leaflet 지도 바닥에 MapLibre 벡터 지도를 깔아 주는 레이어.
// 이미지 타일 대신 3D 지도와 같은 벡터 스타일을 쓰므로, 지도가 가진 장소 아이콘을 종류별로 고를 수 있고
// 보행로가 점선이 아닌 실선으로 보이며 테마도 3D와 똑같이 바뀐다.
// 마커·경로선·핀 같은 Leaflet 기능은 그대로 위에 올라간다.
import L from 'leaflet';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadMapStyle, applyPedestrianTweaks, applyPoiFilter } from './mapStyle';

// Vite 번들링 환경에서 워커 경로를 지정
try {
  if (maplibregl.setWorkerUrl) {
    maplibregl.setWorkerUrl(workerUrl);
  }
} catch {
  // ignore
}

export const MapLibreBasemap = L.Layer.extend({
  initialize(options) {
    L.setOptions(this, options);
  },

  onAdd(map) {
    this._map = map;
    this._destroyed = false;
    this._ready = false;
    this._theme = this.options.theme || 'light';
    this._poiSelected = this.options.poiSelected || {};

    const container = document.createElement('div');
    container.className = 'maplibre-basemap';
    container.style.cssText = 'position:absolute;inset:0;z-index:0;';
    map.getContainer().insertBefore(container, map.getContainer().firstChild);
    this._container = container;

    loadMapStyle(this._theme)
      .then((style) => {
        if (!this._destroyed) this._create(style);
      })
      .catch((err) => console.warn('Basemap style load failed:', err));

    map.on('move zoom viewreset', this._syncPosition, this);
    map.on('resize', this._syncResize, this);
  },

  onRemove(map) {
    this._destroyed = true;
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    map.off('move zoom viewreset', this._syncPosition, this);
    map.off('resize', this._syncResize, this);
    if (this._gl) {
      try {
        this._gl.remove();
      } catch (e) {
        // ignore
      }
    }
    this._gl = null;
    this._container?.remove();
  },

  _create(style) {
    const c = this._map.getCenter();
    const gl = new maplibregl.Map({
      container: this._container,
      style,
      center: [c.lng, c.lat],
      zoom: this._map.getZoom() - 1, // Leaflet(256px 타일)과 MapLibre(512px 타일)의 단계 차이
      interactive: false, // 이동·확대는 Leaflet이 맡는다
      attributionControl: false,
      fadeDuration: 0
    });

    const canvas = gl.getCanvas();
    if (canvas) {
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        console.warn('MapLibre WebGL context lost, waiting for restore...');
      });
      canvas.addEventListener('webglcontextrestored', () => {
        console.info('MapLibre WebGL context restored.');
        if (this._gl && !this._destroyed) this._syncPosition();
      });
    }

    gl.on('style.load', () => {
      applyPedestrianTweaks(gl, this._theme);
      // 2D 지도이므로 입체 건물은 끄고 평면 건물 윤곽을 모든 확대 단계에서 보여준다
      gl.getStyle().layers.forEach((l) => {
        if (l.type === 'fill-extrusion') gl.setLayoutProperty(l.id, 'visibility', 'none');
      });
      if (gl.getLayer('building')) {
        gl.setLayerZoomRange('building', 13, 24);
        gl.setLayoutProperty('building', 'visibility', 'visible');
      }
      applyPoiFilter(gl, this._poiSelected);
      this._ready = true;
    });
    this._gl = gl;
    this._syncPosition();
  },

  _syncPosition() {
    if (!this._gl) return;
    const c = this._map.getCenter();
    this._gl.jumpTo({ center: [c.lng, c.lat], zoom: this._map.getZoom() - 1 });
  },

  _syncResize() {
    if (!this._gl) return;
    if (this._resizeTimer) clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      if (this._gl && !this._destroyed) {
        this._gl.resize();
        this._syncPosition();
      }
    }, 120);
  },

  setTheme(theme) {
    if (theme === this._theme) return;
    this._theme = theme;
    this._ready = false;
    loadMapStyle(theme)
      .then((style) => {
        if (this._gl && !this._destroyed) this._gl.setStyle(style, { diff: false });
      })
      .catch((err) => console.warn('Basemap theme change failed:', err));
  },

  setPoiSelected(selected) {
    this._poiSelected = selected || {};
    if (this._gl && this._ready) applyPoiFilter(this._gl, this._poiSelected);
  }
});
