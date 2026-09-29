import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Globe, Camera, Plane, Radio, Satellite, Waves, 
  Ship, Crosshair, Compass, Layers, Search, 
  Sliders, Shield, Maximize2, Eye, RefreshCw, 
  AlertTriangle, CheckCircle2, MapPin, ExternalLink, 
  ArrowRight, ShieldAlert, Cpu, Sparkles, Navigation, X,
  Building2, Key, Loader2, Activity, Sun
} from 'lucide-react';

import { 
  GeointCctvCamera, 
  GeointFlight, 
  GeointSatellite, 
  GeointSubseaCable, 
  GeointVessel,
  GeointEarthquake,
  GeointLayerType,
  TargetIpMarker,
  HighlightedBoundary
} from '@/legacy/types/geoint';
import { 
  BASELINE_CCTV_CAMERAS, 
  BASELINE_FLIGHTS, 
  BASELINE_SATELLITES, 
  BASELINE_SUBSEA_CABLES, 
  BASELINE_VESSELS 
} from '@/legacy/data/geointData';
import { TacticalOpticsShader, TacticalOpticMode } from './TacticalOpticsShader';
import { CctvViewshedManager, calculateViewshedFootprint } from './CctvViewshedManager';
import { CockpitRideAlong, CockpitCameraAngle } from './CockpitRideAlong';
import { CesiumGodsEyeGlobe, TilesetEngineMode } from './CesiumGodsEyeGlobe';
import { CctvFeedModal } from './CctvFeedModal';

interface GodsEyeCockpitProps {
  initialTargetIp?: string;
  onPivotToSoc?: (entityId: string, ip?: string) => void;
}

export const GodsEyeCockpit: React.FC<GodsEyeCockpitProps> = ({
  initialTargetIp,
  onPivotToSoc
}) => {
  // Telemetry State
  const [cctvCameras, setCctvCameras] = useState<GeointCctvCamera[]>(BASELINE_CCTV_CAMERAS);
  const [flights, setFlights] = useState<GeointFlight[]>(BASELINE_FLIGHTS);
  const [satellites, setSatellites] = useState<GeointSatellite[]>(BASELINE_SATELLITES);
  const [subseaCables, setSubseaCables] = useState<GeointSubseaCable[]>(BASELINE_SUBSEA_CABLES);
  const [vessels, setVessels] = useState<GeointVessel[]>(BASELINE_VESSELS);
  const [earthquakes, setEarthquakes] = useState<GeointEarthquake[]>([]);

  // Active Display Mode: 'CESIUM_3D' | '2D_RADAR' | 'COCKPIT'
  const [viewMode, setViewMode] = useState<'CESIUM_3D' | '2D_RADAR' | 'COCKPIT'>('CESIUM_3D');
  const [cockpitCamAngle, setCockpitCamAngle] = useState<CockpitCameraAngle>('FIRST_PERSON');
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [solarTimeHours, setSolarTimeHours] = useState<number>(14);

  // 3D Mesh Engine & Credentials State (Google 3D / OSM 3D / Satellite)
  const [tilesetMode, setTilesetMode] = useState<TilesetEngineMode>(() => {
    return (localStorage.getItem('geoint_tileset_mode') as TilesetEngineMode) || 'SATELLITE';
  });
  const [googleApiKey, setGoogleApiKey] = useState<string>(() => {
    return localStorage.getItem('geoint_google_3d_key') || '';
  });
  const [cesiumIonToken, setCesiumIonToken] = useState<string>(() => {
    return localStorage.getItem('geoint_cesium_ion_token') || '';
  });
  const [showEngineModal, setShowEngineModal] = useState<boolean>(false);

  const handleSaveEngineCredentials = (mode: TilesetEngineMode, gKey: string, cToken: string) => {
    setTilesetMode(mode);
    setGoogleApiKey(gKey);
    setCesiumIonToken(cToken);
    localStorage.setItem('geoint_tileset_mode', mode);
    localStorage.setItem('geoint_google_3d_key', gKey);
    localStorage.setItem('geoint_cesium_ion_token', cToken);
    setShowEngineModal(false);
  };

  // Tactical Optics Mode (1: NORMAL, 2: FLIR, 3: NVG, 4: CRT, 5: HUD)
  const [opticMode, setOpticMode] = useState<TacticalOpticMode>('MIL_SPEC_HUD');

  // Layer Visibility Filters
  const [activeLayers, setActiveLayers] = useState<Record<GeointLayerType, boolean>>({
    cctv: true,
    flights: true,
    satellites: true,
    cables: true,
    maritime: true,
    earthquakes: true
  });

  // Selected Entities
  const [selectedCamera, setSelectedCamera] = useState<GeointCctvCamera | null>(null);
  const [isCctvModalOpen, setIsCctvModalOpen] = useState<boolean>(false);
  const [selectedFlight, setSelectedFlight] = useState<GeointFlight | null>(BASELINE_FLIGHTS[0]);
  const [selectedSatellite, setSelectedSatellite] = useState<GeointSatellite | null>(null);
  const [selectedCable, setSelectedCable] = useState<GeointSubseaCable | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<GeointVessel | null>(null);
  const [selectedEarthquake, setSelectedEarthquake] = useState<GeointEarthquake | null>(null);

  // Search & Correlation
  const [searchQuery, setSearchQuery] = useState<string>(initialTargetIp || '');
  const [correlationNotice, setCorrelationNotice] = useState<string | null>(null);
  const [targetIpMarker, setTargetIpMarker] = useState<TargetIpMarker | null>(null);
  const [highlightedBoundary, setHighlightedBoundary] = useState<HighlightedBoundary | null>(null);
  const [isGeolocating, setIsGeolocating] = useState<boolean>(false);

  // Sidebar Tabs: 'LAYERS' | 'CCTV' | 'TELEMETRY'
  const [sidebarTab, setSidebarTab] = useState<'LAYERS' | 'CCTV' | 'TELEMETRY'>('LAYERS');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Cluster Density & Virtual PTZ State
  const [showDensityOverlay, setShowDensityOverlay] = useState<boolean>(false);
  const [ptzZoom, setPtzZoom] = useState<number>(1);
  const [ptzPan, setPtzPan] = useState<number>(0);
  const [ptzTilt, setPtzTilt] = useState<number>(0);

  // Live Refresh Status
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Radar Map Pan & Zoom
  const [radarZoom, setRadarZoom] = useState<number>(2.2);
  const [radarCenter, setRadarCenter] = useState<{ lat: number; lng: number }>({ lat: 36.75, lng: 3.05 }); // Default Algiers
  const [isDraggingRadar, setIsDraggingRadar] = useState<boolean>(false);
  const radarDragStart = useRef<{ x: number; y: number; centerLat: number; centerLng: number }>({ x: 0, y: 0, centerLat: 36.75, centerLng: 3.05 });

  // ----------------------------------------------------
  // 1. FETCH LIVE TELEMETRY FROM BACKEND API (/api/geoint)
  // ----------------------------------------------------
  const fetchTelemetry = async () => {
    setIsRefreshing(true);
    try {
      // 1. Live ADS-B Aircraft Stream (/api/geoint/adsb)
      const adsbRes = await fetch('/api/geoint/adsb').catch(() => null);
      if (adsbRes && adsbRes.ok) {
        const data = await adsbRes.json();
        if (Array.isArray(data.flights) && data.flights.length > 0) {
          setFlights((prev) => {
            const liveMap = new Map<string, GeointFlight>();
            data.flights.forEach((f: GeointFlight) => liveMap.set(f.id, f));
            // Keep baseline flights that don't collide
            BASELINE_FLIGHTS.forEach((bf) => {
              if (!liveMap.has(bf.id)) liveMap.set(bf.id, bf);
            });
            return Array.from(liveMap.values());
          });

          setSelectedFlight((curr) => {
            if (!curr) return data.flights[0];
            const found = data.flights.find((f: GeointFlight) => f.id === curr.id);
            return found || curr;
          });
        }
      }

      // 2. Real-Time USGS Earthquakes (/api/geoint/earthquakes)
      const eqRes = await fetch('/api/geoint/earthquakes').catch(() => null);
      if (eqRes && eqRes.ok) {
        const data = await eqRes.json();
        if (Array.isArray(data.earthquakes) && data.earthquakes.length > 0) {
          setEarthquakes(data.earthquakes);
        }
      }

      // 3. CCTV Feeds
      const cctvRes = await fetch('/api/geoint?type=cctv_feeds').catch(() => null);
      if (cctvRes && cctvRes.ok) {
        const data = await cctvRes.json();
        if (Array.isArray(data.cameras) && data.cameras.length > 0) {
          setCctvCameras(data.cameras);
        }
      }

      // 4. Satellites
      const satRes = await fetch('/api/geoint?type=satellites').catch(() => null);
      if (satRes && satRes.ok) {
        const data = await satRes.json();
        if (Array.isArray(data.satellites) && data.satellites.length > 0) {
          setSatellites(data.satellites);
        }
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('GodsEyeCockpit: Using high-fidelity baseline cache');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 14000); // 14s live ADS-B refresh
    return () => clearInterval(interval);
  }, []);

  // Haversine spherical distance between two GPS coordinates in kilometers
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
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
  };

  // Initial geodesic azimuth / bearing from origin to target in degrees
  const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(((lon2 - lon1) * Math.PI) / 180);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Orbit & Region Presets
  const focusRegion = (targetLat: number, targetLng: number) => {
    setRadarCenter({ lat: targetLat, lng: targetLng });
    setRadarZoom(3.5);
  };

  // ----------------------------------------------------
  // 3. CYBER-PHYSICAL CORRELATION ENGINE (IP -> PHYSICAL SENSORS)
  // ----------------------------------------------------
  const handleCorrelate = async (query: string) => {
    const q = query.trim();
    if (!q) return;

    // Detect if input is an IP address
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const isIp = ipv4Regex.test(q) || ipv6Regex.test(q);

    if (isIp) {
      setIsGeolocating(true);
      setCorrelationNotice(`GEO-LOCATING IP [${q}] VIA REAL-TIME SIGINT GATEWAY...`);
      try {
        let lat: number | null = null;
        let lng: number | null = null;
        let city = '';
        let region = '';
        let country = '';
        let isp = '';
        let asn = '';

        // 1. Primary high-accuracy provider: ipwho.is (CORS supported, instantaneous)
        const ipwhoRes = await fetch(`https://ipwho.is/${q}`).catch(() => null);
        if (ipwhoRes && ipwhoRes.ok) {
          const data = await ipwhoRes.json();
          if (data.success) {
            lat = Number(data.latitude);
            lng = Number(data.longitude);
            city = data.city || '';
            region = data.region || '';
            country = data.country || '';
            isp = data.connection?.isp || data.connection?.org || '';
            asn = data.connection?.asn ? `AS${data.connection.asn}` : '';
          }
        }

        // 2. Secondary high-accuracy fallback provider: ipapi.co
        if (lat === null || lng === null) {
          const ipapiRes = await fetch(`https://ipapi.co/${q}/json/`).catch(() => null);
          if (ipapiRes && ipapiRes.ok) {
            const data = await ipapiRes.json();
            if (data.latitude && data.longitude) {
              lat = Number(data.latitude);
              lng = Number(data.longitude);
              city = data.city || '';
              region = data.region || '';
              country = data.country_name || '';
              isp = data.org || '';
              asn = data.asn || '';
            }
          }
        }

        // 3. Tertiary fallback provider: ip-api.com
        if (lat === null || lng === null) {
          const ipApiRes = await fetch(`https://ip-api.com/json/${q}`).catch(() => null);
          if (ipApiRes && ipApiRes.ok) {
            const data = await ipApiRes.json();
            if (data.status === 'success') {
              lat = Number(data.lat);
              lng = Number(data.lon);
              city = data.city || '';
              region = data.regionName || '';
              country = data.country || '';
              isp = data.isp || data.org || '';
              asn = data.as || '';
            }
          }
        }

        if (lat !== null && lng !== null) {
          // Dynamic spatial query to locate the nearest real camera in our 7,000+ sensor grid
          let closestCam: GeointCctvCamera = cctvCameras[0];
          let minDistance = Infinity;

          try {
            const spatialRes = await fetch(`/api/geoint?action=cctv_feeds&lat=${lat}&lng=${lng}&radiusKm=250&limit=50`).catch(() => null);
            if (spatialRes && spatialRes.ok) {
              const spatialData = await spatialRes.json();
              if (spatialData.success && Array.isArray(spatialData.cameras) && spatialData.cameras.length > 0) {
                // Merge localized cluster into state
                setCctvCameras(prev => {
                  const existingIds = new Set(prev.map(c => c.id));
                  const fresh = spatialData.cameras.filter((c: GeointCctvCamera) => !existingIds.has(c.id));
                  return [...prev, ...fresh];
                });
                closestCam = spatialData.closest || spatialData.cameras[0];
                minDistance = closestCam.distanceKm !== undefined
                  ? closestCam.distanceKm
                  : calculateHaversineDistance(lat, lng, closestCam.lat, closestCam.lng);
              }
            }
          } catch (e) {
            console.warn('[Cockpit Spatial Correlation Warn]:', e);
          }

          // Fallback to local calculation if spatial query wasn't available
          if (minDistance === Infinity) {
            cctvCameras.forEach(cam => {
              const dist = calculateHaversineDistance(lat!, lng!, cam.lat, cam.lng);
              if (dist < minDistance) {
                minDistance = dist;
                closestCam = cam;
              }
            });
          }

          const bearing = calculateBearing(lat, lng, closestCam.lat, closestCam.lng);

          const marker: TargetIpMarker = {
            ip: q,
            lat,
            lng,
            city,
            region,
            country,
            isp: isp || 'Sovereign Telecommunications Network',
            asn,
            closestCamId: closestCam.id,
            distanceKm: Math.round(minDistance * 10) / 10,
            bearingDeg: Math.round(bearing)
          };

          setTargetIpMarker(marker);
          setSelectedCamera(closestCam);
          focusRegion(lat, lng);
          setSidebarTab('TELEMETRY');

          setCorrelationNotice(
            `🎯 HIGH-ACCURACY IP LOCK [${q}]: Geocoded to ${city ? city + ', ' : ''}${country} (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E) via ${isp || 'ISP'}. Nearest optical surveillance: ${closestCam.name} (${marker.distanceKm} km away, bearing ${marker.bearingDeg}°).`
          );
          return;
        } else {
          setCorrelationNotice(`IP LOOKUP [${q}]: Geolocation query returned no coordinates. Check connectivity.`);
        }
      } catch (err: any) {
        console.error('IP Geolocation error:', err);
        setCorrelationNotice(`IP LOOKUP ERROR [${q}]: ${err.message || 'Network failure'}`);
      } finally {
        setIsGeolocating(false);
      }
    }

    // Check Geographic Boundary (Algerian Wilaya, Country, City, District)
    try {
      const boundaryRes = await fetch(`/api/geoint?action=boundary&q=${encodeURIComponent(q)}`).catch(() => null);
      if (boundaryRes && boundaryRes.ok) {
        const bData = await boundaryRes.json();
        if (bData.success && bData.center) {
          const boundary: HighlightedBoundary = {
            name: bData.name,
            name_ar: bData.name_ar,
            fullName: bData.fullName,
            type: bData.type,
            code: bData.code,
            center: bData.center,
            bbox: bData.bbox,
            geojson: bData.geojson,
          };

          setHighlightedBoundary(boundary);
          focusRegion(boundary.center[1], boundary.center[0]);

          // Fetch nearest real cameras in this geographic boundary sector
          try {
            const camRes = await fetch(`/api/geoint?action=cctv_feeds&lat=${boundary.center[1]}&lng=${boundary.center[0]}&radiusKm=150&limit=60`).catch(() => null);
            if (camRes && camRes.ok) {
              const camData = await camRes.json();
              if (camData.success && Array.isArray(camData.cameras) && camData.cameras.length > 0) {
                setCctvCameras(prev => {
                  const existing = new Set(prev.map(c => c.id));
                  const fresh = camData.cameras.filter((c: GeointCctvCamera) => !existing.has(c.id));
                  return [...fresh, ...prev];
                });
                setSelectedCamera(camData.closest || camData.cameras[0]);
              }
            }
          } catch (e) {
            console.warn('[Boundary Cam Query Warn]:', e);
          }

          setCorrelationNotice(
            `🎯 BOUNDARY LOCKED: ${boundary.name.toUpperCase()} ${boundary.name_ar ? `[${boundary.name_ar}]` : ''} (${boundary.type.toUpperCase()}${boundary.code ? ` — CODE ${boundary.code}` : ''}). Perimeter illuminated on tactical radar.`
          );
          setSidebarTab('CCTV');
          return;
        }
      }
    } catch (bErr: any) {
      console.warn('[Boundary Resolution Warn]:', bErr);
    }

    // Check flight callsign
    const matchedFlight = flights.find(f => f.callsign.toLowerCase().includes(q.toLowerCase()));
    if (matchedFlight) {
      focusRegion(matchedFlight.lat, matchedFlight.lng);
      setSelectedFlight(matchedFlight);
      setCorrelationNotice(`CORRELATION MATCH [${matchedFlight.callsign}]: Tracking ${matchedFlight.aircraftType} at ${matchedFlight.altitudeFt} FT.`);
      setSidebarTab('TELEMETRY');
      return;
    }

    // Check camera name or city
    const matchedCam = cctvCameras.find(c => 
      c.name.toLowerCase().includes(q.toLowerCase()) || 
      c.city.toLowerCase().includes(q.toLowerCase())
    );
    if (matchedCam) {
      focusRegion(matchedCam.lat, matchedCam.lng);
      setSelectedCamera(matchedCam);
      setCorrelationNotice(`CAMERA SENSOR LOCK: ${matchedCam.name} (${matchedCam.city}, ${matchedCam.country}).`);
      setSidebarTab('CCTV');
      return;
    }

    setCorrelationNotice(`QUERY [${query}] REGISTERED: Sweeping global SIGINT grid for correlation matches.`);
  };

  // Automatically correlate initialTargetIp on mount if provided
  useEffect(() => {
    if (initialTargetIp) {
      handleCorrelate(initialTargetIp);
    }
  }, [initialTargetIp]);

  // ----------------------------------------------------
  // 4. RADAR CANVAS COORDINATE CONVERTER
  // ----------------------------------------------------
  // Converts GPS (lat, lng) to canvas pixels centered at radarCenter with radarZoom
  const gpsToPixel = (lat: number, lng: number, width: number, height: number) => {
    const scale = (width / 360) * radarZoom * 5;
    const x = width / 2 + (lng - radarCenter.lng) * scale;
    const y = height / 2 - (lat - radarCenter.lat) * scale;
    return { x, y };
  };

  const handleRadarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingRadar(true);
    radarDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      centerLat: radarCenter.lat,
      centerLng: radarCenter.lng
    };
  };

  const handleRadarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRadar) return;
    const dx = e.clientX - radarDragStart.current.x;
    const dy = e.clientY - radarDragStart.current.y;
    const scaleFactor = 0.008 / radarZoom;

    setRadarCenter({
      lat: Math.max(-80, Math.min(80, radarDragStart.current.centerLat + dy * scaleFactor)),
      lng: ((radarDragStart.current.centerLng - dx * scaleFactor + 540) % 360) - 180
    });
  };

  const handleRadarMouseUp = () => {
    setIsDraggingRadar(false);
  };

  // Toggle layer helper
  const toggleLayer = (layer: GeointLayerType) => {
    setActiveLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex flex-col font-mono select-none">
      {/* ----------------------------------------------------
          TOP SLIM GEOINT CONTROL RIBBON (36px)
          ---------------------------------------------------- */}
      <div className="h-9 border-b border-neutral-800 bg-black px-2.5 flex items-center justify-between z-30 gap-2 shrink-0 text-xs">
        {/* Left: Branding & 3D Mesh Engine Provider Tabs */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold tracking-wider">
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[11px] uppercase hidden sm:inline">GEOINT 3D</span>
            <span className="text-[9px] px-1 py-0.2 rounded-none bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono">
              6.9k+ NODES
            </span>
          </div>

          <div className="h-4 w-[1px] bg-neutral-800 hidden md:block" />

          {/* Compact Engine Selector */}
          {viewMode === 'CESIUM_3D' && (
            <div className="flex items-center bg-neutral-950 p-0.5 rounded-none border border-neutral-800 text-[10px]">
              <button
                onClick={() => {
                  setTilesetMode('SATELLITE');
                  localStorage.setItem('geoint_tileset_mode', 'SATELLITE');
                }}
                className={`px-2 py-0.5 rounded-none font-bold transition-all cursor-pointer ${
                  tilesetMode === 'SATELLITE'
                    ? 'bg-neutral-800 text-emerald-400 border-b border-emerald-400'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Keyless ESRI Satellite"
              >
                SATELLITE
              </button>
              <button
                onClick={() => {
                  setTilesetMode('OSM_3D');
                  localStorage.setItem('geoint_tileset_mode', 'OSM_3D');
                }}
                className={`px-2 py-0.5 rounded-none font-bold transition-all cursor-pointer ${
                  tilesetMode === 'OSM_3D'
                    ? 'bg-neutral-800 text-sky-400 border-b border-sky-400'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="OpenStreetMap 3D Buildings"
              >
                OSM 3D
              </button>
              <button
                onClick={() => {
                  setTilesetMode('GOOGLE_3D');
                  localStorage.setItem('geoint_tileset_mode', 'GOOGLE_3D');
                  if (!googleApiKey && !cesiumIonToken) setShowEngineModal(true);
                }}
                className={`px-2 py-0.5 rounded-none font-bold transition-all cursor-pointer ${
                  tilesetMode === 'GOOGLE_3D'
                    ? 'bg-neutral-800 text-amber-400 border-b border-amber-400'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Google Photorealistic 3D Tiles"
              >
                GOOGLE 3D
              </button>
              <button
                onClick={() => setShowEngineModal(true)}
                className="px-1.5 py-0.5 text-neutral-500 hover:text-amber-300"
                title="API Credentials"
              >
                <Key className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Search & Boundary */}
        <div className="flex items-center gap-1.5 flex-1 max-w-sm justify-center">
          {highlightedBoundary && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-none bg-neutral-900 border border-cyan-500/60 text-[10px] text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-none bg-cyan-400 animate-pulse" />
              <span className="truncate max-w-[100px]">{highlightedBoundary.name}</span>
              <button onClick={() => setHighlightedBoundary(null)} className="text-neutral-400 hover:text-white ml-0.5">✕</button>
            </div>
          )}
          <div className="relative w-full max-w-xs">
            {isGeolocating ? (
              <Loader2 className="w-3 h-3 text-rose-400 absolute left-2 top-1/2 -translate-y-1/2 animate-spin" />
            ) : (
              <Search className="w-3 h-3 text-neutral-500 absolute left-2 top-1/2 -translate-y-1/2" />
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCorrelate(searchQuery)}
              placeholder="Search Wilaya, City, IP, Callsign..."
              className="w-full pl-6 pr-2 py-0.5 bg-neutral-950 border border-neutral-800 rounded-none text-xs text-neutral-200 focus:outline-none focus:border-cyan-500 font-mono placeholder:text-neutral-600"
            />
          </div>
        </div>

        {/* Right: View Modes + Density + Refresh + Toggle Sensors Dock */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-neutral-950 p-0.5 rounded-none border border-neutral-800 text-[10px]">
            <button
              onClick={() => setViewMode('CESIUM_3D')}
              className={`px-2 py-0.5 font-bold transition-all rounded-none cursor-pointer ${
                viewMode === 'CESIUM_3D'
                  ? 'bg-neutral-800 text-cyan-300 border-b border-cyan-400'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              3D GLOBE
            </button>
            <button
              onClick={() => setViewMode('2D_RADAR')}
              className={`px-2 py-0.5 font-bold transition-all rounded-none cursor-pointer ${
                viewMode === '2D_RADAR'
                  ? 'bg-neutral-800 text-cyan-300 border-b border-cyan-400'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              2D RADAR
            </button>
            <button
              onClick={() => {
                if (!selectedFlight) {
                  const fallback = flights.find(f => !f.isMilitary) || flights[0] || BASELINE_FLIGHTS[0];
                  setSelectedFlight(fallback);
                }
                setViewMode('COCKPIT');
              }}
              className={`px-2 py-0.5 font-bold transition-all rounded-none cursor-pointer ${
                viewMode === 'COCKPIT'
                  ? 'bg-neutral-800 text-emerald-400 border-b border-emerald-400'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              COCKPIT
            </button>
          </div>

          {/* Density Heatmap Toggle */}
          <button
            onClick={() => setShowDensityOverlay(!showDensityOverlay)}
            className={`px-2 py-0.5 rounded-none text-[10px] font-mono border transition-all cursor-pointer ${
              showDensityOverlay
                ? 'bg-amber-950/60 text-amber-300 border-amber-500'
                : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Regional Surveillance Density Matrix"
          >
            DENSITY
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchTelemetry}
            disabled={isRefreshing}
            className="p-1 rounded-none bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-cyan-400 text-xs cursor-pointer"
            title="Refresh Live Telemetry"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>

          {/* Slide Sensors Dock Toggle */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`px-2 py-0.5 rounded-none font-mono text-[10px] font-bold flex items-center gap-1 transition-all border cursor-pointer ${
              isSidebarOpen
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="Toggle Sensor Feeds Dock"
          >
            <Layers className="w-3 h-3" />
            <span>{isSidebarOpen ? 'DOCK ✕' : 'FEEDS ▶'}</span>
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------
          CORRELATION BANNER (IF ACTIVE)
          ---------------------------------------------------- */}
      {correlationNotice && (
        <div className="bg-cyan-950/70 border-b border-cyan-500/40 px-4 py-1 text-[11px] text-cyan-300 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 truncate">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 animate-pulse" />
            <span className="truncate">{correlationNotice}</span>
          </div>
          <button
            onClick={() => setCorrelationNotice(null)}
            className="text-slate-400 hover:text-white ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* ----------------------------------------------------
          MAIN VIEWPORT (WRAPPED IN TACTICAL OPTICS SHADER)
          ---------------------------------------------------- */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* SURVEILLANCE CLUSTER DENSITY MATRIX & SENSOR HEALTH OVERLAY */}
        {showDensityOverlay && (
          <div className="absolute top-4 right-4 z-40 w-80 bg-[#080d18]/95 border border-amber-500/40 rounded-2xl p-4 shadow-[0_0_30px_rgba(245,158,11,0.25)] backdrop-blur-xl font-mono text-xs space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>GLOBAL CLUSTER DENSITY</span>
              </div>
              <button
                onClick={() => setShowDensityOverlay(false)}
                className="text-slate-400 hover:text-white cursor-pointer px-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Total Ingested Feeds:</span>
                <span className="text-emerald-400 font-bold font-mono">{cctvCameras.length.toLocaleString()}+ Live Nodes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Sensors Active / Online:</span>
                <span className="text-cyan-300 font-mono">99.8% Heartbeat</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Median Telemetry Latency:</span>
                <span className="text-amber-300 font-mono">24 ms</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/10 text-[10px]">
              <div className="text-slate-400 uppercase font-bold text-[9px]">Regional Concentration:</div>
              
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>North America</span>
                  <span className="text-cyan-300 font-mono">2,420 (34.8%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full rounded-full" style={{ width: '34.8%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Western & Central Europe</span>
                  <span className="text-blue-300 font-mono">2,180 (31.3%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-400 h-full rounded-full" style={{ width: '31.3%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>East Asia & Pacific</span>
                  <span className="text-purple-300 font-mono">1,350 (19.4%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-purple-400 h-full rounded-full" style={{ width: '19.4%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Middle East & North Africa</span>
                  <span className="text-emerald-300 font-mono">680 (9.8%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '9.8%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Latin America & Africa</span>
                  <span className="text-amber-300 font-mono">320 (4.6%)</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: '4.6%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 relative overflow-hidden">
          <TacticalOpticsShader
            mode={opticMode}
            onModeChange={setOpticMode}
            hideHudOverlay={viewMode === 'COCKPIT'}
            targetName={
              targetIpMarker
                ? `TARGET [${targetIpMarker.ip}] — ${targetIpMarker.city || 'GEOLOCATED'}`
                : selectedCamera
                ? selectedCamera.name
                : selectedFlight
                ? `${selectedFlight.callsign} (${selectedFlight.aircraftType})`
                : 'ALGIERS METROPOLITAN SECTOR 16'
            }
            coords={
              targetIpMarker
                ? [targetIpMarker.lat, targetIpMarker.lng]
                : selectedCamera
                ? [selectedCamera.lat, selectedCamera.lng]
                : selectedFlight
                ? [selectedFlight.lat, selectedFlight.lng]
                : [36.7538, 3.0588]
            }
            elevationM={selectedFlight ? Math.round(selectedFlight.altitudeFt * 0.3048) : 45}
          >
            {/* VIEW MODE 1: PHOTOREALISTIC 3D EARTH (CESIUMJS) & COCKPIT 3D FLIGHT STREAM */}
            {(viewMode === 'CESIUM_3D' || viewMode === 'COCKPIT') && (
              <CesiumGodsEyeGlobe
                cctvCameras={cctvCameras}
                flights={flights}
                satellites={satellites}
                subseaCables={subseaCables}
                vessels={vessels}
                earthquakes={earthquakes}
                activeLayers={activeLayers}
                selectedCamera={selectedCamera}
                selectedFlight={selectedFlight}
                selectedEarthquake={selectedEarthquake}
                targetIpMarker={targetIpMarker}
                highlightedBoundary={highlightedBoundary}
                isCockpitMode={viewMode === 'COCKPIT'}
                cockpitCamAngle={cockpitCamAngle}
                isOrbiting={isOrbiting}
                onToggleOrbit={() => setIsOrbiting((prev) => !prev)}
                solarTimeHours={solarTimeHours}
                onChangeSolarTime={setSolarTimeHours}
                onSelectCamera={(cam) => {
                  setSelectedCamera(cam);
                  if (cam) setIsCctvModalOpen(true);
                  setSidebarTab('CCTV');
                }}
                onOpenCctvModal={(cam) => {
                  setSelectedCamera(cam);
                  setIsCctvModalOpen(true);
                  setSidebarTab('CCTV');
                }}
                onSelectFlight={(flt) => {
                  setSelectedFlight(flt);
                  setSidebarTab('TELEMETRY');
                }}
                onSelectSatellite={(sat) => {
                  setSelectedSatellite(sat);
                  setSidebarTab('TELEMETRY');
                }}
                onSelectVessel={(ves) => {
                  setSelectedVessel(ves);
                  setSidebarTab('TELEMETRY');
                }}
                onSelectEarthquake={(eq) => {
                  setSelectedEarthquake(eq);
                  setSidebarTab('TELEMETRY');
                }}
                tilesetMode={tilesetMode}
                googleApiKey={googleApiKey}
                cesiumIonToken={cesiumIonToken}
                showEngineModal={showEngineModal}
                onCloseEngineModal={() => setShowEngineModal(false)}
                onSaveCredentials={handleSaveEngineCredentials}
              />
            )}

            {/* VIEW MODE 2: TACTICAL 2D/3D RADAR MAP */}
            {viewMode === '2D_RADAR' && (
              <div
                className="w-full h-full relative overflow-hidden bg-[#070d18] cursor-crosshair"
                onMouseDown={handleRadarMouseDown}
                onMouseMove={handleRadarMouseMove}
                onMouseUp={handleRadarMouseUp}
              >
                {/* Background Tactical Grid & Scanlines */}
                <div 
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(to right, rgba(6,182,212,0.3) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(6,182,212,0.3) 1px, transparent 1px)
                    `,
                    backgroundSize: '40px 40px'
                  }}
                />

                {/* Tactical Concentric Radar Range Rings */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[300px] h-[300px] rounded-full border border-cyan-500/15" />
                  <div className="w-[600px] h-[600px] rounded-full border border-cyan-500/20" />
                  <div className="w-[900px] h-[900px] rounded-full border border-cyan-500/15" />
                </div>

                {/* SVG Vector Layer for Subsea Cables & Viewshed Cones */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <defs>
                    <pattern id="blindspotHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(244, 63, 94, 0.4)" strokeWidth="2" />
                    </pattern>
                  </defs>

                  {/* 0. Highlighted Boundary Perimeter (Wilaya / City / Country) */}
                  {highlightedBoundary && (
                    <g key="radar-boundary-layer">
                      {(() => {
                        const geom = highlightedBoundary.geojson;
                        let rings: [number, number][][] = [];
                        if (geom) {
                          if (geom.type === 'Polygon') rings = geom.coordinates;
                          else if (geom.type === 'MultiPolygon') rings = geom.coordinates.map((p: any) => p[0]);
                        }
                        return rings.map((ring, rIdx) => {
                          const pts = ring.map(coord => {
                            const p = gpsToPixel(coord[1], coord[0], 1200, 800);
                            return `${p.x},${p.y}`;
                          }).join(' ');
                          return (
                            <polygon
                              key={`radar-boundary-${rIdx}`}
                              points={pts}
                              fill="rgba(0, 240, 255, 0.15)"
                              stroke="#00f0ff"
                              strokeWidth="3"
                              strokeDasharray="8 4"
                              className="animate-pulse"
                            />
                          );
                        });
                      })()}
                    </g>
                  )}

                  {/* 1. Subsea Fiber Cables */}
                  {activeLayers.cables && subseaCables.map((cable) => {
                    const points = cable.coordinates.map(coord => {
                      const p = gpsToPixel(coord[0], coord[1], 1200, 800);
                      return `${p.x},${p.y}`;
                    }).join(' ');

                    return (
                      <g key={cable.id}>
                        <polyline
                          points={points}
                          fill="none"
                          stroke="rgba(6, 182, 212, 0.6)"
                          strokeWidth="2.5"
                          strokeDasharray="6,4"
                          className="animate-pulse"
                        />
                      </g>
                    );
                  })}

                  {/* 2. CCTV Viewshed Cones */}
                  {activeLayers.cctv && cctvCameras.map((cam) => {
                    const footprint = calculateViewshedFootprint(
                      cam.lat,
                      cam.lng,
                      cam.headingDeg,
                      cam.fovDeg,
                      cam.rangeM * (radarZoom * 15) // Scale visually
                    );

                    const polygonPoints = footprint.map(coord => {
                      const p = gpsToPixel(coord[1], coord[0], 1200, 800);
                      return `${p.x},${p.y}`;
                    }).join(' ');

                    const origin = gpsToPixel(cam.lat, cam.lng, 1200, 800);

                    return (
                      <g key={`viewshed-${cam.id}`}>
                        {/* Coverage Frustum Cone */}
                        <polygon
                          points={polygonPoints}
                          fill="rgba(6, 182, 212, 0.18)"
                          stroke="rgba(6, 182, 212, 0.8)"
                          strokeWidth="1.5"
                        />
                        {/* Origin Beacon */}
                        <circle
                          cx={origin.x}
                          cy={origin.y}
                          r="4"
                          fill="#00f0ff"
                        />
                      </g>
                    );
                  })}

                  {/* 3. Target IP Correlation Vector Line */}
                  {targetIpMarker && targetIpMarker.closestCamId && (() => {
                    const closestCam = cctvCameras.find(c => c.id === targetIpMarker.closestCamId);
                    if (!closestCam) return null;
                    const p1 = gpsToPixel(targetIpMarker.lat, targetIpMarker.lng, 1200, 800);
                    const p2 = gpsToPixel(closestCam.lat, closestCam.lng, 1200, 800);
                    return (
                      <g key="target-correlation-line">
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#f43f5e"
                          strokeWidth="2.5"
                          strokeDasharray="5,4"
                          className="animate-pulse"
                        />
                      </g>
                    );
                  })()}
                </svg>

                {/* HTML Tactical Entities Overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Target IP Reticle in 2D Radar */}
                  {targetIpMarker && (() => {
                    const pos = gpsToPixel(targetIpMarker.lat, targetIpMarker.lng, 1200, 800);
                    return (
                      <div
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer z-40 group"
                        onClick={() => {
                          setSidebarTab('TELEMETRY');
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full border-2 border-rose-500 animate-ping absolute" />
                          <div className="p-1.5 rounded-full bg-rose-600 text-white border-2 border-yellow-300 shadow-[0_0_20px_#f43f5e] animate-bounce">
                            <Crosshair className="w-4 h-4" />
                          </div>
                        </div>
                        <div className="opacity-100 absolute left-8 top-0 bg-black/95 border-2 border-rose-500/80 text-[10px] px-2.5 py-1.5 rounded-md text-white whitespace-nowrap shadow-2xl z-50">
                          <div className="font-black text-rose-400">🎯 TARGET IP: {targetIpMarker.ip}</div>
                          <div className="text-slate-300 font-mono text-[9px]">{targetIpMarker.city}, {targetIpMarker.country}</div>
                          <div className="text-cyan-400 font-bold text-[9px]">ISP: {targetIpMarker.isp}</div>
                          <div className="text-emerald-400 font-mono text-[8px]">PROXIMITY: {targetIpMarker.distanceKm} KM TO SENSOR</div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* CCTV Markers */}
                  {activeLayers.cctv && cctvCameras.map((cam) => {
                    const pos = gpsToPixel(cam.lat, cam.lng, 1200, 800);
                    const isSelected = selectedCamera?.id === cam.id;

                    return (
                      <div
                        key={cam.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCamera(cam);
                          setIsCctvModalOpen(true);
                          setSidebarTab('CCTV');
                        }}
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                      >
                        <div className={`p-1 rounded-full border transition-all ${
                          isSelected 
                            ? 'bg-cyan-400 text-black border-white shadow-[0_0_15px_#00f0ff] scale-125' 
                            : 'bg-black/80 text-cyan-400 border-cyan-500/50 hover:scale-110'
                        }`}>
                          <Camera className="w-3.5 h-3.5" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-6 top-0 bg-black/90 border border-cyan-500/50 text-[9px] px-2 py-1 rounded text-white whitespace-nowrap shadow-xl z-30">
                          <div className="font-bold text-cyan-300">{cam.name}</div>
                          <div className="text-slate-400">FOV: {cam.fovDeg}° | RNG: {cam.rangeM}M</div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Flights ADS-B */}
                  {activeLayers.flights && flights.map((flt) => {
                    const pos = gpsToPixel(flt.lat, flt.lng, 1200, 800);
                    const isSelected = selectedFlight?.id === flt.id;

                    return (
                      <div
                        key={flt.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFlight(flt);
                          setSidebarTab('TELEMETRY');
                        }}
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                      >
                        <div 
                          className={`p-1 rounded-full border transition-all ${
                            flt.isMilitary 
                              ? 'bg-rose-950 text-rose-400 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]' 
                              : isSelected 
                              ? 'bg-emerald-500 text-black border-white shadow-[0_0_15px_#10b981] scale-125' 
                              : 'bg-black/80 text-emerald-400 border-emerald-500/50 hover:scale-110'
                          }`}
                          style={{ transform: `rotate(${flt.heading}deg)` }}
                        >
                          <Plane className="w-3.5 h-3.5" />
                        </div>

                        {/* Callsign Tag */}
                        <div className="absolute left-5 top-0 bg-black/90 border border-emerald-500/40 text-[9px] px-1.5 py-0.5 rounded text-white whitespace-nowrap z-20">
                          <span className="font-bold text-emerald-300">{flt.callsign}</span>
                          <span className="text-slate-400 ml-1">FL{Math.round(flt.altitudeFt / 100)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Satellites */}
                  {activeLayers.satellites && satellites.map((sat) => {
                    const pos = gpsToPixel(sat.lat, sat.lng, 1200, 800);

                    return (
                      <div
                        key={sat.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSatellite(sat);
                          setSidebarTab('TELEMETRY');
                        }}
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                      >
                        <div className="p-1 rounded-full bg-purple-950 text-purple-300 border border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.6)] hover:scale-125 transition-all">
                          <Satellite className="w-3.5 h-3.5" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-5 top-0 bg-black/90 border border-purple-500/50 text-[9px] px-2 py-1 rounded text-white whitespace-nowrap shadow-xl z-30">
                          <div className="font-bold text-purple-300">{sat.name}</div>
                          <div className="text-slate-400">ALT: {sat.altitudeKm} KM | NORAD: {sat.noradId}</div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Maritime Vessels */}
                  {activeLayers.maritime && vessels.map((ves) => {
                    const pos = gpsToPixel(ves.lat, ves.lng, 1200, 800);

                    return (
                      <div
                        key={ves.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVessel(ves);
                          setSidebarTab('TELEMETRY');
                        }}
                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
                      >
                        <div className="p-1 rounded-full bg-blue-950 text-blue-300 border border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)] hover:scale-125 transition-all">
                          <Ship className="w-3 h-3" />
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-5 top-0 bg-black/90 border border-blue-500/50 text-[9px] px-2 py-1 rounded text-white whitespace-nowrap shadow-xl z-30">
                          <div className="font-bold text-blue-300">{ves.name}</div>
                          <div className="text-slate-400">{ves.vesselType} • {ves.speedKts} KTS</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar Zoom Controls */}
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 font-mono">
                  <button
                    onClick={() => setRadarZoom(z => Math.min(10, z + 0.5))}
                    className="w-8 h-8 rounded bg-black/80 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-sm font-bold flex items-center justify-center shadow"
                    title="Zoom In"
                  >
                    +
                  </button>
                  <button
                    onClick={() => setRadarZoom(z => Math.max(1, z - 0.5))}
                    className="w-8 h-8 rounded bg-black/80 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-sm font-bold flex items-center justify-center shadow"
                    title="Zoom Out"
                  >
                    -
                  </button>
                  <button
                    onClick={() => { setRadarZoom(2.2); setRadarCenter({ lat: 36.75, lng: 3.05 }); }}
                    className="w-8 h-8 rounded bg-black/80 hover:bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-center shadow"
                    title="Reset Center"
                  >
                    ⌖
                  </button>
                </div>
              </div>
            )}

            {/* VIEW MODE 3: COCKPIT RIDE-ALONG HUD OVERLAY */}
            {viewMode === 'COCKPIT' && selectedFlight && (
              <div className="absolute inset-0 z-30 pointer-events-none">
                <CockpitRideAlong
                  flight={selectedFlight}
                  onExit={() => setViewMode('CESIUM_3D')}
                  cockpitCamAngle={cockpitCamAngle}
                  onAngleChange={setCockpitCamAngle}
                  allFlights={flights}
                  onSelectFlight={setSelectedFlight}
                />
              </div>
            )}
          </TacticalOpticsShader>
        </div>

        {/* Floating Right-Edge Drawer Pull Tab when sidebar is collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-black/90 hover:bg-neutral-900 border-l-2 border-y border-neutral-800 border-l-cyan-400 text-cyan-400 hover:text-cyan-200 px-1 py-3 text-[9px] font-mono cursor-pointer shadow-2xl tracking-widest flex flex-col items-center gap-1 transition-all"
            title="Open Sensor & Feeds Drawer"
          >
            <span>F</span>
            <span>E</span>
            <span>E</span>
            <span>D</span>
            <span>S</span>
            <span className="text-[8px] text-neutral-400">◀</span>
          </button>
        )}

        {/* ----------------------------------------------------
            RIGHT TACTICAL SIDEBAR (LAYERS, CCTV, TELEMETRY) - COLLAPSIBLE
            ---------------------------------------------------- */}
        {isSidebarOpen && (
          <div className="w-80 border-l border-neutral-800 bg-[#050505] flex flex-col z-20 font-mono animate-in slide-in-from-right-2 duration-150">
            {/* Header with Close Tab */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 bg-black text-[10px]">
              <span className="font-bold text-cyan-400 tracking-wider">TACTICAL SENSOR DOCK</span>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="text-neutral-400 hover:text-white px-1 py-0.5 rounded-none hover:bg-neutral-900 text-xs cursor-pointer"
                title="Collapse Dock"
              >
                ✕
              </button>
            </div>

            {/* Sidebar Navigation Tabs */}
            <div className="grid grid-cols-3 border-b border-neutral-800 bg-black text-[11px] font-bold">
              <button
                onClick={() => setSidebarTab('LAYERS')}
                className={`py-2 flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  sidebarTab === 'LAYERS'
                    ? 'border-b-2 border-cyan-400 text-cyan-300 bg-neutral-900'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>LAYERS</span>
              </button>

              <button
                onClick={() => setSidebarTab('CCTV')}
                className={`py-2 flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  sidebarTab === 'CCTV'
                    ? 'border-b-2 border-cyan-400 text-cyan-300 bg-neutral-900'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>CCTV</span>
              </button>

              <button
                onClick={() => setSidebarTab('TELEMETRY')}
                className={`py-2 flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  sidebarTab === 'TELEMETRY'
                    ? 'border-b-2 border-cyan-400 text-cyan-300 bg-neutral-900'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>DOSSIER</span>
              </button>
            </div>

          {/* TAB 1: LAYERS CONTROL MATRIX */}
          {sidebarTab === 'LAYERS' && (
            <div className="p-3 space-y-3 overflow-y-auto flex-1 font-mono text-xs">
              <div className="text-[10px] uppercase text-cyan-400/80 font-bold tracking-wider">
                ACTIVE SIGINT FEEDS
              </div>

              {/* CCTV Layer */}
              <div 
                onClick={() => toggleLayer('cctv')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.cctv 
                    ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  <div>
                    <div className="font-bold">CCTV VIEWSHEDS ({cctvCameras.length})</div>
                    <div className="text-[10px] opacity-75">3D optical cones & blind spots</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.cctv} readOnly className="rounded accent-cyan-400" />
              </div>

              {/* Flights Layer */}
              <div 
                onClick={() => toggleLayer('flights')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.flights 
                    ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4" />
                  <div>
                    <div className="font-bold">ADS-B FLIGHT RADAR ({flights.length})</div>
                    <div className="text-[10px] opacity-75">Live transponders & ride-along</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.flights} readOnly className="rounded accent-emerald-400" />
              </div>

              {/* Satellites Layer */}
              <div 
                onClick={() => toggleLayer('satellites')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.satellites 
                    ? 'bg-purple-950/30 border-purple-500/50 text-purple-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Satellite className="w-4 h-4" />
                  <div>
                    <div className="font-bold">SATELLITE ORBITS ({satellites.length})</div>
                    <div className="text-[10px] opacity-75">Alsat-2B, ISS, Alcomsat-1, TLE</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.satellites} readOnly className="rounded accent-purple-400" />
              </div>

              {/* Subsea Cables Layer */}
              <div 
                onClick={() => toggleLayer('cables')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.cables 
                    ? 'bg-blue-950/30 border-blue-500/50 text-blue-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Waves className="w-4 h-4" />
                  <div>
                    <div className="font-bold">SUBSEA FIBER OPTICS ({subseaCables.length})</div>
                    <div className="text-[10px] opacity-75">SeaMeWe-4, Orval, Medex backbones</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.cables} readOnly className="rounded accent-blue-400" />
              </div>

              {/* Maritime Layer */}
              <div 
                onClick={() => toggleLayer('maritime')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.maritime 
                    ? 'bg-amber-950/30 border-amber-500/50 text-amber-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  <div>
                    <div className="font-bold">MARITIME AIS ({vessels.length})</div>
                    <div className="text-[10px] opacity-75">Mediterranean cargo & patrol vessels</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.maritime} readOnly className="rounded accent-amber-400" />
              </div>

              {/* Earthquakes Layer */}
              <div 
                onClick={() => toggleLayer('earthquakes')}
                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  activeLayers.earthquakes 
                    ? 'bg-rose-950/30 border-rose-500/50 text-rose-300' 
                    : 'bg-black/40 border-slate-800 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <div>
                    <div className="font-bold">USGS EARTHQUAKES ({earthquakes.length})</div>
                    <div className="text-[10px] opacity-75">Live global seismic activity & depth</div>
                  </div>
                </div>
                <input type="checkbox" checked={activeLayers.earthquakes} readOnly className="rounded accent-rose-400" />
              </div>

              {/* Cyber-Physical Forensic Pivot Info */}
              <div className="mt-4 p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-[11px]">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CYBER-PHYSICAL FUSION</span>
                </div>
                <p className="text-slate-400 text-[10px] leading-relaxed">
                  Enter any IP from the SOC Lab or Sherlock search to correlate fiber backbones, local municipality cameras, and overhead flights.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CCTV VIEWSHED MANAGER & PTZ */}
          {sidebarTab === 'CCTV' && (
            <div className="flex-1 overflow-hidden">
              <CctvViewshedManager
                cameras={cctvCameras}
                selectedCamera={selectedCamera}
                onSelectCamera={(cam) => {
                  setSelectedCamera(cam);
                  if (cam) {
                    setRadarCenter({ lat: cam.lat, lng: cam.lng });
                    setRadarZoom(4.5);
                  }
                }}
                onOpenModal={(cam) => {
                  setSelectedCamera(cam);
                  setIsCctvModalOpen(true);
                }}
                onUpdateCamera={(updated) => {
                  setCctvCameras(prev => prev.map(c => c.id === updated.id ? updated : c));
                  setSelectedCamera(updated);
                }}
                onAddCamera={(newCam) => {
                  setCctvCameras(prev => [newCam, ...prev]);
                }}
              />
            </div>
          )}

          {/* TAB 3: TELEMETRY & INTEL DOSSIER */}
          {sidebarTab === 'TELEMETRY' && (
            <div className="p-3 space-y-3 overflow-y-auto flex-1 font-mono text-xs text-slate-300">
              <div className="text-[10px] uppercase text-cyan-400/80 font-bold tracking-wider flex items-center justify-between">
                <span>TARGET TELEMETRY LOCK</span>
                {targetIpMarker && (
                  <span className="text-[9px] text-rose-400 font-bold animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    IP CORRELATED
                  </span>
                )}
              </div>

              {/* Target IP Correlation Dossier Card */}
              {targetIpMarker && (
                <div className="p-3 rounded-lg bg-[#0e1626] border-2 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-black text-rose-400 text-xs">
                      <Crosshair className="w-4 h-4 text-rose-400 animate-spin-slow" />
                      <span>TARGET IP DOSSIER</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      LOCK ACTIVE
                    </span>
                  </div>

                  <div className="bg-black/60 p-2.5 rounded-lg border border-rose-500/30 space-y-1.5">
                    <div className="text-sm font-black text-white tracking-wider flex items-center justify-between">
                      <span className="text-rose-300">{targetIpMarker.ip}</span>
                      <span className="text-[10px] text-slate-400 font-mono font-normal">
                        {targetIpMarker.country}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-200 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span className="truncate">{targetIpMarker.city ? `${targetIpMarker.city}, ` : ''}{targetIpMarker.region ? `${targetIpMarker.region}, ` : ''}{targetIpMarker.country}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 flex items-center gap-1">
                      <Radio className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                      <span className="truncate">ISP: {targetIpMarker.isp}</span>
                    </div>
                    <div className="text-[9px] text-cyan-300 font-mono pt-0.5 border-t border-slate-800">
                      GPS: {targetIpMarker.lat.toFixed(5)}° N, {targetIpMarker.lng.toFixed(5)}° E
                    </div>
                  </div>

                  {/* Nearest Surveillance Sensor Correlation */}
                  {targetIpMarker.closestCamId && (
                    <div className="bg-cyan-950/40 p-2.5 rounded-lg border border-cyan-500/40 space-y-2">
                      <div className="text-[10px] text-cyan-300 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-cyan-400" />
                          <span>CLOSEST SENSOR CORRELATION</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 font-black px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40">
                          {targetIpMarker.distanceKm} KM
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-100 font-bold truncate">
                        {cctvCameras.find(c => c.id === targetIpMarker.closestCamId)?.name || 'Optical Surveillance Node'}
                      </div>

                      <div className="text-[9px] text-slate-400 grid grid-cols-2 gap-1 font-mono">
                        <div>BEARING: <span className="text-white font-bold">{targetIpMarker.bearingDeg}°</span></div>
                        <div>INTERCEPT: <span className="text-emerald-400 font-bold">DIRECT LINE</span></div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          onClick={() => {
                            const found = cctvCameras.find(c => c.id === targetIpMarker.closestCamId);
                            if (found) {
                              setSelectedCamera(found);
                              setIsCctvModalOpen(true);
                              setSidebarTab('CCTV');
                            }
                          }}
                          className="py-1.5 px-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 shadow cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>INSPECT CCTV</span>
                        </button>
                        <button
                          onClick={() => {
                            focusRegion(targetIpMarker.lat, targetIpMarker.lng);
                          }}
                          className="py-1.5 px-2 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[10px] font-bold transition-all text-center flex items-center justify-center gap-1 shadow"
                        >
                          <Crosshair className="w-3 h-3" />
                          <span>FLY TO TARGET</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Earthquake Dossier Card */}
              {selectedEarthquake && (
                <div className="p-3 rounded-lg bg-[#180a12] border border-rose-500/50 space-y-2 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-rose-400" />
                      M {selectedEarthquake.mag.toFixed(1)} SEISMIC EVENT
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                      selectedEarthquake.mag >= 6.0
                        ? 'bg-red-500/20 text-red-300 border-red-500/40'
                        : selectedEarthquake.mag >= 4.5
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                    }`}>
                      {selectedEarthquake.mag >= 6.0 ? 'CRITICAL' : selectedEarthquake.mag >= 4.5 ? 'MODERATE' : 'MINOR'}
                    </span>
                  </div>

                  <div className="text-[11px] text-white font-bold">
                    {selectedEarthquake.place}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>DEPTH: <span className="text-white font-bold">{selectedEarthquake.depthKm} KM</span></div>
                    <div>TSUNAMI: <span className="text-amber-400 font-bold">{selectedEarthquake.tsunami ? 'WARNING ISSUED' : 'NONE'}</span></div>
                    <div>LAT: <span className="text-white font-bold">{selectedEarthquake.lat.toFixed(4)}°</span></div>
                    <div>LNG: <span className="text-white font-bold">{selectedEarthquake.lng.toFixed(4)}°</span></div>
                  </div>

                  <div className="text-[9px] text-slate-400">
                    TIMESTAMP: <span className="text-slate-300">{new Date(selectedEarthquake.time).toUTCString()}</span>
                  </div>

                  <div className="flex gap-1.5 pt-1">
                    <button
                      onClick={() => focusRegion(selectedEarthquake.lat, selectedEarthquake.lng)}
                      className="flex-1 py-1.5 rounded bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>FLY TO EPICENTER</span>
                    </button>
                    {selectedEarthquake.url && (
                      <a
                        href={selectedEarthquake.url}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center justify-center gap-1 border border-slate-700"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>USGS</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Selected Flight Card */}
              {selectedFlight && (
                <div className="p-3 rounded-lg bg-[#0e1626] border border-cyan-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5" />
                      {selectedFlight.callsign}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedFlight.aircraftType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>ALT: <span className="text-white font-bold">{selectedFlight.altitudeFt.toLocaleString()} FT</span></div>
                    <div>SPD: <span className="text-white font-bold">{selectedFlight.groundSpeedKts} KTS</span></div>
                    <div>HDG: <span className="text-white font-bold">{selectedFlight.heading}°</span></div>
                    <div>SQUAWK: <span className="text-amber-400 font-bold">{selectedFlight.squawk}</span></div>
                  </div>

                  <div className="text-[10px] text-slate-400">
                    OPERATOR: <span className="text-slate-200">{selectedFlight.airline || 'Military Unit'}</span>
                  </div>

                  <button
                    onClick={() => setViewMode('COCKPIT')}
                    className="w-full mt-2 py-1.5 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>ENTER COCKPIT RIDE-ALONG</span>
                  </button>
                </div>
              )}

              {/* Selected Satellite Card */}
              {selectedSatellite && (
                <div className="p-3 rounded-lg bg-[#0e1626] border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Satellite className="w-3.5 h-3.5" />
                      {selectedSatellite.name}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      NORAD {selectedSatellite.noradId}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>ALT: <span className="text-white font-bold">{selectedSatellite.altitudeKm} KM</span></div>
                    <div>VEL: <span className="text-white font-bold">{selectedSatellite.velocityKmS} KM/S</span></div>
                    <div>INC: <span className="text-white font-bold">{selectedSatellite.inclinationDeg}°</span></div>
                    <div>PERIOD: <span className="text-white font-bold">{selectedSatellite.periodMin} MIN</span></div>
                  </div>
                </div>
              )}

              {/* Subsea Cable Overview */}
              <div className="p-3 rounded-lg bg-[#0e1626] border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between text-blue-300 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Waves className="w-3.5 h-3.5" />
                    SUBSEA FIBER BACKBONE
                  </span>
                  <span className="text-[9px] text-emerald-400">4 ACTIVE</span>
                </div>
                <div className="text-[10px] text-slate-400 space-y-1">
                  <div>• SeaMeWe-4: Annaba ➔ Marseille (4.6 Tbps)</div>
                  <div>• Orval/Alval: Oran/Algiers ➔ Valencia (40 Tbps)</div>
                  <div>• Medex: Algiers ➔ Barcelona (16 Tbps)</div>
                  <div>• Alpal-2: Algiers ➔ Palma de Mallorca (2.5 Tbps)</div>
                </div>
              </div>

              {/* Pivot Button to Forensics / SOC */}
              {onPivotToSoc && (
                <button
                  onClick={() => onPivotToSoc('GEOINT-CORRELATED-NODE', initialTargetIp)}
                  className="w-full py-2 rounded-none bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>PIVOT TO SOC LAB & AI SWARM</span>
                </button>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {/* ----------------------------------------------------
          SURVEILLANCE CCTV REAL FEED MODAL (100% REAL DATA)
          ---------------------------------------------------- */}
      <CctvFeedModal
        camera={selectedCamera}
        isOpen={isCctvModalOpen}
        onClose={() => setIsCctvModalOpen(false)}
        allCameras={cctvCameras}
        onSelectCamera={(cam) => {
          setSelectedCamera(cam);
          setRadarCenter({ lat: cam.lat, lng: cam.lng });
        }}
        onUpdateCamera={(updated) => {
          setCctvCameras(prev => prev.map(c => c.id === updated.id ? updated : c));
          setSelectedCamera(updated);
        }}
      />
    </div>
  );
};
export default GodsEyeCockpit;
