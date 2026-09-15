// ==========================================
// ZAK'S SPIDER / ZAKOS — GEOINT & SPATIAL INTELLIGENCE TYPES
// ==========================================

export interface GeointFlight {
  id: string;
  callsign: string;
  airline?: string;
  aircraftType: string;
  lat: number;
  lng: number;
  altitudeFt: number;
  groundSpeedKts: number;
  heading: number; // 0-360 degrees
  squawk: string;
  origin?: string;
  destination?: string;
  isMilitary?: boolean;
}

export interface GeointCctvCamera {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  altitudeM: number;
  headingDeg: number; // Yaw (0-360)
  pitchDeg: number;   // Tilt (-90 to +90)
  fovDeg: number;     // Field of view (e.g. 60)
  rangeM: number;     // Effective view distance (e.g. 150m)
  streamUrl: string;
  snapshotUrl: string;
  provider: string;
  status: 'ONLINE' | 'STANDBY' | 'MAINTENANCE';
  blindSpotDesc: string;
  distanceKm?: number;
  feedType?: string;
  isLive?: boolean;
  sourceKind?: string;
  mountHeightM?: number;
}

export interface GeointSatellite {
  id: string;
  name: string;
  noradId: number;
  category: 'RECON' | 'COMM' | 'SCIENCE' | 'SOVEREIGN';
  lat: number;
  lng: number;
  altitudeKm: number;
  velocityKmS: number;
  inclinationDeg: number;
  periodMin: number;
  orbitPath: [number, number][]; // Array of [lat, lng] points
  footprintRadiusKm: number;
}

export interface GeointSubseaCable {
  id: string;
  name: string;
  rfsYear: number;
  lengthKm: number;
  landingPoints: { name: string; country: string; lat: number; lng: number }[];
  coordinates: [number, number][]; // Vector polyline [lat, lng]
  capacityTbps: number;
  status: 'ACTIVE' | 'DEGRADED' | 'MAINTENANCE';
}

export interface GeointVessel {
  id: string;
  name: string;
  mmsi: string;
  vesselType: 'CARGO' | 'TANKER' | 'PATROL' | 'CABLE_SHIP' | 'TUG';
  lat: number;
  lng: number;
  speedKts: number;
  headingDeg: number;
  destination: string;
  flag: string;
}

export type GeointLayerType = 'cctv' | 'flights' | 'satellites' | 'cables' | 'maritime' | 'earthquakes';

export interface GeointEarthquake {
  id: string;
  place: string;
  mag: number;
  time: number;
  lat: number;
  lng: number;
  depthKm: number;
  tsunami?: number;
  alert?: string;
  url?: string;
}

export interface TargetIpMarker {
  ip: string;
  lat: number;
  lng: number;
  city: string;
  region?: string;
  country: string;
  countryCode?: string;
  isp: string;
  org?: string;
  asn?: string;
  closestCamId?: string;
  distanceKm?: number;
  bearingDeg?: number;
}

export interface HighlightedBoundary {
  name: string;
  name_ar?: string;
  fullName?: string;
  type: 'wilaya' | 'country' | 'city' | 'district' | 'region';
  code?: string | number;
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [south, west, north, east]
  geojson?: any; // Polygon or MultiPolygon GeoJSON geometry
  color?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
