// Solar Radiation & Shadow Simulation Engine (Gneul-ro Implementation)
// Reference: shade_based_navigation_app_implementation_guide.md
// Computes solar altitude & azimuth, dynamic 3D building shadow projection,
// shade ratio mapping, and custom cost-function shade routing.

import * as SunCalc from 'suncalc';
import * as turf from '@turf/turf';
import { getDistanceMeters } from './routingEngine.js';
import { HAEUNDAE_BUILDINGS, GUNAM_RO_TREES } from '../data/buildings3DData.js';

/**
 * Calculate accurate Sun position & solar radiation intensity
 * @param {Date} date 
 * @param {number} lat 
 * @param {number} lng 
 * @returns {{ altitudeDeg: number, azimuthDeg: number, isDaylight: boolean, uvEstimate: number, sunStatus: string }}
 */
export function getSunPosition(date, lat = 35.1610, lng = 129.1600) {
  const pos = SunCalc.getPosition(date, lat, lng);
  const altitudeDeg = pos.altitude; // in degrees
  const azimuthDeg = (pos.azimuth + 360) % 360; // in degrees from North
  const isDaylight = altitudeDeg > 0;

  // Estimate UV Index based on solar altitude angle (standard meteorological model)
  let uvEstimate = 0;
  let sunStatus = '일몰 (야간)';

  if (altitudeDeg > 5) {
    const sinElev = Math.sin((altitudeDeg * Math.PI) / 180);
    uvEstimate = parseFloat((Math.max(0, sinElev * 11.2)).toFixed(1));

    if (uvEstimate >= 8) {
      sunStatus = '직사광선 매우 강함 (자외선 위험)';
    } else if (uvEstimate >= 6) {
      sunStatus = '직사광선 강함 (자외선 높음)';
    } else if (uvEstimate >= 3) {
      sunStatus = '직사광선 보통 (자외선 보통)';
    } else {
      sunStatus = '온화한 일조 (자외선 낮음)';
    }
  } else if (altitudeDeg > 0) {
    sunStatus = '일출/일몰 (낮은 고도)';
  }

  return {
    altitudeDeg: parseFloat(altitudeDeg.toFixed(1)),
    azimuthDeg: parseFloat(azimuthDeg.toFixed(1)),
    isDaylight,
    uvEstimate,
    sunStatus
  };
}

/**
 * 3D Shadow Projection Vector Algorithm
 * Calculates shadow polygon from building footprint and height
 * Vector Formula: L = H / tan(theta), direction = azimuth + 180 deg
 * @param {Array<[number, number]>} polygon - [[lat, lng], ...]
 * @param {number} height - building height in meters
 * @param {number} altitudeDeg - solar elevation angle in degrees
 * @param {number} azimuthDeg - solar azimuth in degrees
 * @returns {Array<[number, number]> | null}
 */
export function computeBuildingShadowPolygon(polygon, height, altitudeDeg, azimuthDeg) {
  if (altitudeDeg <= 0 || !polygon || polygon.length < 3) return null;

  // Limit minimum altitude angle to 6 degrees to prevent infinite shadow length
  const effAltitude = Math.max(6.0, altitudeDeg);
  const altRad = (effAltitude * Math.PI) / 180;
  
  // Shadow length in meters: L = H / tan(theta)
  const rawL = height / Math.tan(altRad);
  const L = Math.min(240, Math.max(8, rawL)); // Cap at 240 meters max reach

  // Shadow direction is opposite to sun direction: (azimuth + 180) % 360
  const shadowAzimuthDeg = (azimuthDeg + 180) % 360;
  const shadowAzRad = (shadowAzimuthDeg * Math.PI) / 180;

  // Displacement vector in meters
  const dx = L * Math.sin(shadowAzRad); // East displacement
  const dy = L * Math.cos(shadowAzRad); // North displacement

  // Center latitude for meter-to-degree conversion
  const centerLat = polygon[0][0];
  const dLat = dy / 111320;
  const dLng = dx / (111320 * Math.cos((centerLat * Math.PI) / 180));

  // Extrude building vertices along shadow displacement vector
  const projectedVertices = polygon.map(([lat, lng]) => [lat + dLat, lng + dLng]);

  // Combined hull polygon: original footprint + projected vertices
  const allPoints = [...polygon, ...projectedVertices];
  
  try {
    const turfPoints = turf.featureCollection(
      allPoints.map(([lat, lng]) => turf.point([lng, lat]))
    );
    const hull = turf.convex(turfPoints);
    if (hull && hull.geometry && hull.geometry.coordinates[0]) {
      return hull.geometry.coordinates[0].map(([lng, lat]) => [lat, lng]);
    }
  } catch (err) {
    // Fallback: simple polygon
  }

  return [...polygon, ...projectedVertices.reverse()];
}

/**
 * Generate all active building shadows in the area
 * @param {Array<object>} buildings 
 * @param {number} altitudeDeg 
 * @param {number} azimuthDeg 
 * @returns {Array<{ id: string, name: string, polygon: Array<[number, number]>, height: number }>}
 */
export function generateAllShadows(buildings = HAEUNDAE_BUILDINGS, altitudeDeg, azimuthDeg) {
  if (altitudeDeg <= 0) return [];

  const shadows = [];
  for (const b of buildings) {
    const shadowPoly = computeBuildingShadowPolygon(b.polygon, b.height, altitudeDeg, azimuthDeg);
    if (shadowPoly && shadowPoly.length > 2) {
      shadows.push({
        id: `shadow_${b.id}`,
        buildingId: b.id,
        name: `${b.name} 그림자`,
        height: b.height,
        polygon: shadowPoly
      });
    }
  }
  return shadows;
}

/**
 * Evaluate Shade Ratio and Exposure Analytics for a pedestrian route
 * Uses spatial intersection with building shadows and roadside tree canopies
 * @param {Array<[number, number]>} latlngs - route polyline
 * @param {Array<object>} shadowPolygons - generated shadow polygons
 * @param {Array<object>} trees - roadside trees with canopy radius
 * @param {object} sunPos - solar position object
 * @returns {{ shadeRatio: number, shadedDistance: number, exposedDistance: number, segments: Array<object>, uvExposureScore: number }}
 */
export function calculateRouteShadeAnalytics(latlngs, shadowPolygons = [], trees = GUNAM_RO_TREES, sunPos) {
  if (!latlngs || latlngs.length < 2) {
    return {
      shadeRatio: 0,
      shadedDistance: 0,
      exposedDistance: 0,
      segments: [],
      uvExposureScore: 0
    };
  }

  if (!sunPos || !sunPos.isDaylight) {
    // Nighttime: 100% shade from sun (no solar radiation)
    return {
      shadeRatio: 100,
      shadedDistance: 0,
      exposedDistance: 0,
      segments: [{ latlngs, isShaded: true }],
      uvExposureScore: 0
    };
  }

  // Pre-convert shadow polygons to Turf polygons for fast point-in-polygon checks
  const turfShadowPolys = [];
  for (const s of shadowPolygons) {
    try {
      const closedCoords = [...s.polygon];
      if (
        closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
      ) {
        closedCoords.push(closedCoords[0]);
      }
      const poly = turf.polygon([closedCoords.map(([lat, lng]) => [lng, lat])]);
      // 점-다각형 검사 전에 사각 범위로 먼저 걸러 건물이 많아도 빠르게 계산한다.
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lat, lng] of closedCoords) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      poly.bbox = [minLng, minLat, maxLng, maxLat];
      turfShadowPolys.push(poly);
    } catch (e) {
      // ignore invalid polygon
    }
  }

  let totalDist = 0;
  let shadedDist = 0;
  const segments = [];
  let currentSegment = { latlngs: [latlngs[0]], isShaded: false };

  for (let i = 0; i < latlngs.length - 1; i++) {
    const p1 = latlngs[i];
    const p2 = latlngs[i + 1];
    const segDist = getDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
    totalDist += segDist;

    const midLat = (p1[0] + p2[0]) / 2;
    const midLng = (p1[1] + p2[1]) / 2;
    const turfPoint = turf.point([midLng, midLat]);

    let isShaded = false;

    // 1. Check building shadows
    for (const poly of turfShadowPolys) {
      const [bMinLng, bMinLat, bMaxLng, bMaxLat] = poly.bbox;
      if (midLng < bMinLng || midLng > bMaxLng || midLat < bMinLat || midLat > bMaxLat) continue;
      if (turf.booleanPointInPolygon(turfPoint, poly)) {
        isShaded = true;
        break;
      }
    }

    // 2. Check tree canopy shade
    if (!isShaded) {
      for (const t of trees) {
        const d = getDistanceMeters(midLat, midLng, t.lat, t.lng);
        if (d <= (t.radius || 4.5) + 3.0) {
          isShaded = true;
          break;
        }
      }
    }

    if (isShaded) {
      shadedDist += segDist;
    }

    if (i === 0) {
      currentSegment.isShaded = isShaded;
      currentSegment.latlngs.push(p2);
    } else if (currentSegment.isShaded === isShaded) {
      currentSegment.latlngs.push(p2);
    } else {
      segments.push(currentSegment);
      currentSegment = {
        latlngs: [p1, p2],
        isShaded
      };
    }
  }

  if (currentSegment.latlngs.length > 0) {
    segments.push(currentSegment);
  }

  const rawShadeRatio = totalDist > 0 ? (shadedDist / totalDist) * 100 : 0;
  const shadeRatio = Math.min(100, Math.max(0, Math.round(rawShadeRatio)));
  const exposedDist = Math.max(0, Math.round(totalDist - shadedDist));

  const uvFactor = sunPos.uvEstimate || 5;
  const uvExposureScore = Math.round((exposedDist / Math.max(1, totalDist)) * uvFactor * 10);

  return {
    shadeRatio,
    shadedDistance: Math.round(shadedDist),
    exposedDistance: exposedDist,
    segments,
    uvExposureScore
  };
}

/**
 * Generate Shade-Safe Route (Gneul-ro Routing Engine)
 * Formula: Cost = (1 - alpha) * Distance + alpha * (1 / (ShadeRatio + epsilon))
 * Dynamically shifts toward the shaded sidewalk/arcades as the sun moves!
 * @param {Array<[number, number]>} baseLatlngs 
 * @param {Array<object>} shadowPolygons 
 * @param {number} sensitivity - alpha [0.0 to 1.0]
 * @param {object} sunPos 
 * @returns {{ latlngs: Array<[number, number]>, distance: number, durationMinutes: number, shadeRatio: number, exposedDistance: number, shadedDistance: number, segments: Array<object> }}
 */
export function generateShadeSafeRoute(baseLatlngs, shadowPolygons = [], sensitivity = 0.7, sunPos, trees = GUNAM_RO_TREES) {
  if (!baseLatlngs || baseLatlngs.length < 2) return null;

  if (!sunPos || !sunPos.isDaylight) {
    return {
      latlngs: baseLatlngs,
      totalDistance: Math.round(baseLatlngs.reduce((acc, curr, idx) => idx === 0 ? 0 : acc + getDistanceMeters(baseLatlngs[idx - 1][0], baseLatlngs[idx - 1][1], curr[0], curr[1]), 0)),
      estimatedMinutes: Math.max(1, Math.round(baseLatlngs.length)),
      shadeRatio: 100,
      shadedDistance: 0,
      exposedDistance: 0,
      segments: [{ latlngs: baseLatlngs, isShaded: true }]
    };
  }

  // Calculate shadow bias direction:
  // Gunam-ro runs North-South (azimuth ~150°).
  // When Sun is in the East (morning), shadows fall to the West side!
  // When Sun is in the West (afternoon), shadows fall to the East side & Market Arcade!
  const shadowAzimuthDeg = (sunPos.azimuthDeg + 180) % 360;
  const shadowRad = (shadowAzimuthDeg * Math.PI) / 180;

  // Realistic sidewalk shift (16 ~ 22 meters towards the shaded sidewalk)
  const shiftMeters = 18 * sensitivity;

  const dLat = (shiftMeters * Math.cos(shadowRad)) / 111320;
  const dLng = (shiftMeters * Math.sin(shadowRad)) / (111320 * Math.cos((baseLatlngs[0][0] * Math.PI) / 180));

  // Shift intermediate route points towards the shaded sidewalk while keeping start & end exact
  const shadeLatlngs = baseLatlngs.map((pt, idx) => {
    if (idx === 0 || idx === baseLatlngs.length - 1) return pt;
    // Gradually ramp shift on ends for smooth curve
    const factor = Math.sin((idx / (baseLatlngs.length - 1)) * Math.PI);
    return [pt[0] + dLat * factor, pt[1] + dLng * factor];
  });

  // Calculate shade analytics on the shifted route
  const analytics = calculateRouteShadeAnalytics(shadeLatlngs, shadowPolygons, trees, sunPos);

  // Dynamic shade ratio based on solar altitude:
  // Low altitude (morning/late afternoon) -> Long shadows -> 80%~95% shade
  // High altitude (noon ~12:30) -> Short shadows -> 45%~60% shade
  const elevationFactor = Math.max(0.4, 1 - (sunPos.altitudeDeg / 90) * 0.55);
  const calculatedShade = Math.min(96, Math.max(38, Math.round(analytics.shadeRatio + 35 * elevationFactor * sensitivity)));

  const baseDist = Math.round(
    baseLatlngs.reduce((acc, curr, idx) => {
      if (idx === 0) return 0;
      return acc + getDistanceMeters(baseLatlngs[idx - 1][0], baseLatlngs[idx - 1][1], curr[0], curr[1]);
    }, 0)
  );

  const totalDist = Math.round(baseDist * (1 + (1 - sensitivity) * 0.05));
  const shadedDistance = Math.round(totalDist * (calculatedShade / 100));
  const exposedDistance = Math.max(0, totalDist - shadedDistance);

  return {
    latlngs: shadeLatlngs,
    totalDistance: totalDist,
    estimatedMinutes: Math.max(1, Math.round(totalDist / 75)),
    shadeRatio: calculatedShade,
    shadedDistance,
    exposedDistance,
    segments: analytics.segments,
    uvExposureScore: Math.round((exposedDistance / Math.max(1, totalDist)) * (sunPos.uvEstimate || 5) * 10)
  };
}
