// UrbanShelter Routing Engine
// Implements Dijkstra/A* algorithm, custom cost weighting for Night Safe and Weather Shield modes,
// nearest node snapping, and route safety/weather shield analytics.

import { NODES, EDGES } from '../data/urbanNetwork';

// Walking speed standard: 4.5 km/h ≈ 75 meters / minute
export const WALKING_SPEED_METERS_PER_MIN = 75;

// Build adjacency graph from EDGES (undirected bidirectional pedestrian paths)
export function buildGraph() {
  const adj = {};
  for (const nodeId of Object.keys(NODES)) {
    adj[nodeId] = [];
  }

  for (const edge of EDGES) {
    if (!adj[edge.u]) adj[edge.u] = [];
    if (!adj[edge.v]) adj[edge.v] = [];

    adj[edge.u].push({ neighbor: edge.v, edge });
    adj[edge.v].push({ neighbor: edge.u, edge });
  }

  return adj;
}

// Calculate cost of traversing an edge given the mode and sensitivity (0.0 to 1.0)
export function computeEdgeCost(edge, mode, sensitivity = 0.5) {
  const baseLength = edge.length;

  if (mode === 'standard') {
    // 1.1 Physical distance only
    return baseLength;
  }

  if (mode === 'night') {
    // 1.2 Night Safe Route:
    // Dead zone penalty: roads with high unlit ratio have drastically increased cost
    // CCTV bonus: segments with CCTVs get safety trust bonus
    const unlitRatio = 1 - (edge.litLengthRatio || 0); // 0 (fully lit) to 1.0 (completely dark)
    const deadZoneLength = edge.deadZoneLength || (unlitRatio * baseLength);
    const cctvCount = edge.cctvCount || 0;

    // Penalty multiplier scales with user sensitivity (0 ~ 1)
    // At sensitivity=1.0, dark alleys get up to 5x penalty cost
    const penaltyMultiplier = 1 + (sensitivity * 4.5 * (deadZoneLength / Math.max(baseLength, 1)));
    
    // CCTV safety discount (up to 30% discount on cost)
    const cctvDiscount = Math.min(cctvCount * 0.12 * sensitivity, 0.35);

    const cost = baseLength * penaltyMultiplier * (1 - cctvDiscount);
    return Math.max(cost, 1);
  }

  if (mode === 'rain') {
    // 1.3 Weather Shield Route:
    // Covered / underground corridors get heavy virtual distance discount (bonus)
    // Exposed open-air paths receive rain exposure cost penalty
    const isCovered = edge.covered || edge.layer === -1;

    if (isCovered) {
      // Bonus: virtual distance discount up to 75% at max sensitivity
      const discount = 0.20 + (sensitivity * 0.55);
      return baseLength * (1 - discount);
    } else {
      // Open sky penalty: exposed walking becomes up to 2.5x more costly
      const exposurePenalty = 1 + (sensitivity * 1.8);
      return baseLength * exposurePenalty;
    }
  }

  return baseLength;
}

// Dijkstra Shortest Path Solver
export function findPath(startNodeId, targetNodeId, mode = 'standard', sensitivity = 0.5) {
  if (!NODES[startNodeId] || !NODES[targetNodeId]) return null;
  if (startNodeId === targetNodeId) {
    return {
      nodeIds: [startNodeId],
      edges: [],
      totalDistance: 0,
      estimatedMinutes: 0,
      litRatio: 100,
      coveredRatio: 100,
      cctvCount: 0,
      deadZoneTotal: 0,
      hazards: []
    };
  }

  const adj = buildGraph();
  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(NODES));

  for (const node of Object.keys(NODES)) {
    distances[node] = Infinity;
  }
  distances[startNodeId] = 0;

  while (unvisited.size > 0) {
    let closestNode = null;
    let shortestDist = Infinity;

    for (const node of unvisited) {
      if (distances[node] < shortestDist) {
        shortestDist = distances[node];
        closestNode = node;
      }
    }

    if (closestNode === null || shortestDist === Infinity) break;
    if (closestNode === targetNodeId) break;

    unvisited.delete(closestNode);

    const neighbors = adj[closestNode] || [];
    for (const { neighbor, edge } of neighbors) {
      if (!unvisited.has(neighbor)) continue;

      const edgeCost = computeEdgeCost(edge, mode, sensitivity);
      const altDistance = distances[closestNode] + edgeCost;

      if (altDistance < distances[neighbor]) {
        distances[neighbor] = altDistance;
        previous[neighbor] = { node: closestNode, edge };
      }
    }
  }

  if (distances[targetNodeId] === Infinity) {
    return null; // No path found
  }

  // Reconstruct path
  const pathNodes = [];
  const pathEdges = [];
  let curr = targetNodeId;

  while (curr !== startNodeId) {
    pathNodes.unshift(curr);
    const prevEntry = previous[curr];
    if (!prevEntry) break;
    pathEdges.unshift(prevEntry.edge);
    curr = prevEntry.node;
  }
  pathNodes.unshift(startNodeId);

  // Compute realistic metrics based on physical edge properties
  let totalDistance = 0;
  let totalLitDistance = 0;
  let totalCoveredDistance = 0;
  let totalDeadZone = 0;
  let totalCctvs = 0;
  const hazards = [];

  for (const edge of pathEdges) {
    totalDistance += edge.length;
    const litDist = edge.length * (edge.litLengthRatio || 0);
    totalLitDistance += litDist;
    const deadZone = edge.deadZoneLength || (edge.length - litDist);
    totalDeadZone += deadZone;

    if (edge.covered || edge.layer === -1) {
      totalCoveredDistance += edge.length;
    }

    totalCctvs += (edge.cctvCount || 0);

    // Hazard checks according to specifications
    if (mode === 'night' && deadZone >= 25) {
      hazards.push({
        type: 'dark_zone',
        severity: deadZone > 70 ? 'danger' : 'warning',
        edgeName: edge.name,
        length: Math.round(deadZone),
        message: `주의: 조명 미설치 암흑 구간 ${Math.round(deadZone)}m 포함 (${edge.name})`
      });
    }

    if (mode === 'rain' && !(edge.covered || edge.layer === -1)) {
      hazards.push({
        type: 'rain_exposure',
        severity: edge.length > 100 ? 'warning' : 'info',
        edgeName: edge.name,
        length: Math.round(edge.length),
        message: `우천 노출: 비가림 미설치 지상 구간 ${Math.round(edge.length)}m (${edge.name})`
      });
    }
  }

  const litRatio = totalDistance > 0 ? Math.round((totalLitDistance / totalDistance) * 100) : 100;
  const coveredRatio = totalDistance > 0 ? Math.round((totalCoveredDistance / totalDistance) * 100) : 0;
  const estimatedMinutes = Math.max(1, Math.round(totalDistance / WALKING_SPEED_METERS_PER_MIN));

  return {
    nodeIds: pathNodes,
    edges: pathEdges,
    totalDistance: Math.round(totalDistance),
    estimatedMinutes,
    litRatio,
    coveredRatio,
    cctvCount: totalCctvs,
    deadZoneTotal: Math.round(totalDeadZone),
    hazards
  };
}

// Find closest graph node from any clicked latitude & longitude
export function findNearestNode(lat, lng) {
  let nearestNodeId = null;
  let minDistanceSq = Infinity;

  for (const [nodeId, node] of Object.entries(NODES)) {
    // Equirectangular approximation for small distances
    const dLat = node.lat - lat;
    const dLng = (node.lng - lng) * Math.cos((lat * Math.PI) / 180);
    const distSq = dLat * dLat + dLng * dLng;

    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      nearestNodeId = nodeId;
    }
  }

  return nearestNodeId;
}

// Haversine distance in meters
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
