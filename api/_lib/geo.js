import proj4 from 'proj4';

// Define Korean major coordinate projections with accurate TOWGS84 7-parameter transformations
proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs");
proj4.defs("EPSG:5179", "+proj=tmerc +lat_0=38 +lon_0=127.5 +k=0.9996 +x_0=1000000 +y_0=2000000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
proj4.defs("EPSG:5174", "+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs");
proj4.defs("EPSG:2097", "+proj=tmerc +lat_0=38 +lon_0=129.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs");
proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

export { proj4 };

export function isInvalidOceanCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng) || lat <= 0 || lng <= 0) return true;
  if (lat < 33.0 || lat > 38.9 || lng < 124.5 || lng > 131.9) return true;
  if (lng >= 129.138 && lng <= 129.149 && lat < 35.1540) return true;
  if (lng >= 129.149 && lng <= 129.156 && lat < 35.1510) return true;
  if (lng >= 129.156 && lng < 129.161 && lat < 35.1582) return true;
  if (lng >= 129.161 && lng < 129.166 && lat < 35.1586) return true;
  if (lng >= 129.166 && lng <= 129.172 && lat < 35.1592) return true;
  return false;
}

export function getDistM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
