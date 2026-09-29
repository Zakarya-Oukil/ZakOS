import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { 
  Camera, Plane, Satellite, Waves, Ship, 
  Crosshair, Compass, Layers, RotateCcw, 
  MapPin, Radio, Eye, Sparkles, Navigation,
  Building2, Key, Settings, Check, Globe, HelpCircle, Loader2, Info, X,
  Sun, Activity, Flame
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
import { calculateViewshedFootprint } from './CctvViewshedManager';

export type TilesetEngineMode = 'SATELLITE' | 'OSM_3D' | 'GOOGLE_3D';

/**
 * Computes authentic 3D pitched camera frustum wireframe (1:1 with Bilawal Sidhu v2 geometry)
 */
function computeFrustumPyramid(
  lat: number,
  lng: number,
  mountAltM: number,
  headingDeg: number,
  pitchDeg: number,
  fovDeg: number,
  rangeM: number
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const R = Math.max(25, rangeM);
  const pitch = toRad(Math.max(-89, Math.min(89, pitchDeg)));
  const hFov = toRad(Math.max(10, Math.min(150, fovDeg)));
  const heading = headingDeg;

  const horiz = R * Math.cos(pitch);
  const vert = R * Math.sin(pitch);

  const projectPt = (latDeg: number, lonDeg: number, brgDeg: number, distM: number) => {
    const angular = distM / 6371000;
    const brg = toRad(brgDeg);
    const lat1 = toRad(latDeg);
    const lon1 = toRad(lonDeg);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: toDeg(lat2), lng: toDeg(lon2) };
  };

  const capCenterLL = projectPt(lat, lng, heading, horiz);
  const capAlt = Math.max(2, mountAltM + vert);

  const halfW = R * Math.tan(hFov / 2);
  const vFovRad = 2 * Math.atan(Math.tan(hFov / 2) / 1.7777777778); // 16:9
  const halfH = R * Math.tan(vFovRad / 2);

  const upVert = Math.cos(pitch) * halfH;
  const upHoriz = -Math.sin(pitch) * halfH;

  const capL = projectPt(capCenterLL.lat, capCenterLL.lng, heading - 90, halfW);
  const capR = projectPt(capCenterLL.lat, capCenterLL.lng, heading + 90, halfW);

  const corner = (base: { lat: number; lng: number }, sign: number) => {
    const ll = projectPt(base.lat, base.lng, heading, sign * upHoriz);
    return Cesium.Cartesian3.fromDegrees(ll.lng, ll.lat, Math.max(1, capAlt + sign * upVert));
  };

  const mountPt = Cesium.Cartesian3.fromDegrees(lng, lat, mountAltM);
  const tl = corner(capL, 1);
  const tr = corner(capR, 1);
  const br = corner(capR, -1);
  const bl = corner(capL, -1);

  return {
    mountPt,
    tl, tr, br, bl,
    rays: [
      [mountPt, tl],
      [mountPt, tr],
      [mountPt, br],
      [mountPt, bl],
    ],
    farCap: [tl, tr, br, bl, tl],
  };
}

export type CockpitCameraAngle = 'FIRST_PERSON' | 'CHASE' | 'DOWNWARD_RECON';

interface CesiumGodsEyeGlobeProps {
  cctvCameras: GeointCctvCamera[];
  flights: GeointFlight[];
  satellites: GeointSatellite[];
  subseaCables: GeointSubseaCable[];
  vessels: GeointVessel[];
  activeLayers: Record<GeointLayerType, boolean>;
  selectedCamera: GeointCctvCamera | null;
  selectedFlight: GeointFlight | null;
  targetIpMarker?: TargetIpMarker | null;
  highlightedBoundary?: HighlightedBoundary | null;
  isCockpitMode?: boolean;
  cockpitCamAngle?: CockpitCameraAngle;
  onSelectCamera: (cam: GeointCctvCamera | null) => void;
  onSelectFlight: (flt: GeointFlight | null) => void;
  onSelectSatellite?: (sat: GeointSatellite | null) => void;
  onSelectVessel?: (ves: GeointVessel | null) => void;
  onOpenCctvModal?: (cam: GeointCctvCamera) => void;
  // Earthquakes Layer Props
  earthquakes?: GeointEarthquake[];
  selectedEarthquake?: GeointEarthquake | null;
  onSelectEarthquake?: (eq: GeointEarthquake | null) => void;
  // Cinematic Orbit & Solar Controls
  isOrbiting?: boolean;
  onToggleOrbit?: () => void;
  solarTimeHours?: number;
  onChangeSolarTime?: (hours: number) => void;
  // Controlled 3D Mesh Engine Props
  tilesetMode?: TilesetEngineMode;
  googleApiKey?: string;
  cesiumIonToken?: string;
  showEngineModal?: boolean;
  onCloseEngineModal?: () => void;
  onSaveCredentials?: (mode: TilesetEngineMode, gKey: string, cToken: string) => void;
}

export const CesiumGodsEyeGlobe: React.FC<CesiumGodsEyeGlobeProps> = ({
  cctvCameras,
  flights,
  satellites,
  subseaCables,
  vessels,
  earthquakes = [],
  activeLayers,
  selectedCamera,
  selectedFlight,
  selectedEarthquake,
  targetIpMarker,
  highlightedBoundary,
  isCockpitMode = false,
  cockpitCamAngle = 'FIRST_PERSON',
  isOrbiting = false,
  onToggleOrbit,
  solarTimeHours = 14,
  onChangeSolarTime,
  onSelectCamera,
  onSelectFlight,
  onSelectSatellite,
  onSelectVessel,
  onSelectEarthquake,
  onOpenCctvModal,
  tilesetMode: propTilesetMode,
  googleApiKey: propGoogleKey,
  cesiumIonToken: propCesiumToken,
  showEngineModal: propShowModal,
  onCloseEngineModal,
  onSaveCredentials,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const currentTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null);

  // Mutable refs to prevent stale closure in Cesium event handlers
  const cctvCamerasRef = useRef(cctvCameras);
  cctvCamerasRef.current = cctvCameras;
  const flightsRef = useRef(flights);
  flightsRef.current = flights;
  const satellitesRef = useRef(satellites);
  satellitesRef.current = satellites;
  const vesselsRef = useRef(vessels);
  vesselsRef.current = vessels;
  const earthquakesRef = useRef(earthquakes);
  earthquakesRef.current = earthquakes;
  const onSelectCameraRef = useRef(onSelectCamera);
  onSelectCameraRef.current = onSelectCamera;
  const onSelectFlightRef = useRef(onSelectFlight);
  onSelectFlightRef.current = onSelectFlight;
  const onSelectSatelliteRef = useRef(onSelectSatellite);
  onSelectSatelliteRef.current = onSelectSatellite;
  const onSelectVesselRef = useRef(onSelectVessel);
  onSelectVesselRef.current = onSelectVessel;
  const onSelectEarthquakeRef = useRef(onSelectEarthquake);
  onSelectEarthquakeRef.current = onSelectEarthquake;
  const onOpenCctvModalRef = useRef(onOpenCctvModal);
  onOpenCctvModalRef.current = onOpenCctvModal;

  const [isCesiumReady, setIsCesiumReady] = useState(false);
  const [cameraAltitudeKm, setCameraAltitudeKm] = useState<number>(15000);

  // Local fallback state if not controlled from parent
  const [localTilesetMode, setLocalTilesetMode] = useState<TilesetEngineMode>(() => {
    return (localStorage.getItem('geoint_tileset_mode') as TilesetEngineMode) || 'SATELLITE';
  });
  const [localGoogleKey, setLocalGoogleKey] = useState<string>(() => {
    return localStorage.getItem('geoint_google_3d_key') || '';
  });
  const [localCesiumToken, setLocalCesiumToken] = useState<string>(() => {
    return localStorage.getItem('geoint_cesium_ion_token') || '';
  });
  const [localShowModal, setLocalShowModal] = useState(false);

  // Resolved active engine values
  const tilesetMode = propTilesetMode !== undefined ? propTilesetMode : localTilesetMode;
  const googleApiKey = propGoogleKey !== undefined ? propGoogleKey : localGoogleKey;
  const cesiumIonToken = propCesiumToken !== undefined ? propCesiumToken : localCesiumToken;
  const showEngineModal = propShowModal !== undefined ? propShowModal : localShowModal;

  const [isLoadingTileset, setIsLoadingTileset] = useState(false);
  const [tilesetStatusMessage, setTilesetStatusMessage] = useState<string>('Ready');

  // ----------------------------------------------------
  // 1. INITIALIZE CESIUM 3D VIEWER (PHOTOREALISTIC EARTH)
  // ----------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    try {
      // Set Ion access token if present
      if (cesiumIonToken) {
        Cesium.Ion.defaultAccessToken = cesiumIonToken;
      } else {
        Cesium.Ion.defaultAccessToken = '';
      }

      const viewer = new Cesium.Viewer(containerRef.current, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        navigationInstructionsInitiallyVisible: false,
        scene3DOnly: true,
        shouldAnimate: true,
        requestRenderMode: false,
      });

      // Atmospheric and Globe Visual Polish
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.atmosphereLightIntensity = 3.0;
      viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050b14');
      viewer.scene.backgroundColor = Cesium.Color.BLACK;

      // Add High-Resolution Photorealistic Satellite Imagery (Esri World Imagery - Keyless)
      Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        { enablePickFeatures: false }
      )
        .then((provider) => {
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.addImageryProvider(provider);
        })
        .catch((err) => {
          console.warn('Cesium: Falling back to OpenStreetMap imagery', err);
          const osm = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://a.tile.openstreetmap.org/',
          });
          viewer.imageryLayers.addImageryProvider(osm);
        });

      // Default initial camera: Orbital spy perspective over Algiers & Mediterranean
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(3.0588, 36.7538, 2800000),
        orientation: {
          heading: Cesium.Math.toRadians(0),
          pitch: Cesium.Math.toRadians(-55),
          roll: 0,
        },
      });

      // Camera height tracking for HUD
      viewer.camera.changed.addEventListener(() => {
        const heightM = viewer.camera.positionCartographic.height;
        setCameraAltitudeKm(Math.round(heightM / 1000));
      });

      // Screen space click handler for entity picking
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const pickedObject = viewer.scene.pick(click.position);
        if (Cesium.defined(pickedObject) && pickedObject.id) {
          const entity = pickedObject.id;
          const entityName = entity.name || '';
          const entityId = entity.id || '';

          if (entityName.startsWith('CAM:') || entityName.startsWith('VIEWSHED:') || entityId.startsWith('cctv-') || entityId.startsWith('viewshed-')) {
            const camId = entityId.replace('cctv-', '').replace('viewshed-', '');
            const found = cctvCamerasRef.current.find((c) => c.id === camId);
            if (found) {
              onSelectCameraRef.current(found);
              if (onOpenCctvModalRef.current) {
                onOpenCctvModalRef.current(found);
              }
            }
          } else if (entityName.startsWith('FLT:') || entityId.startsWith('flt-')) {
            const fltId = entityId.replace('flt-', '');
            const found = flightsRef.current.find((f) => f.id === fltId);
            if (found) onSelectFlightRef.current(found);
          } else if (entityName.startsWith('SAT:') || entityId.startsWith('sat-')) {
            const satId = entityId.replace('sat-', '');
            const found = satellitesRef.current.find((s) => s.id === satId);
            if (found && onSelectSatelliteRef.current) onSelectSatelliteRef.current(found);
          } else if (entityName.startsWith('VES:') || entityId.startsWith('ves-')) {
            const vesId = entityId.replace('ves-', '');
            const found = vesselsRef.current.find((v) => v.id === vesId);
            if (found && onSelectVesselRef.current) onSelectVesselRef.current(found);
          } else if (entityName.startsWith('EQ:') || entityId.startsWith('eq-')) {
            const eqId = entityId.replace('eq-ring-', '').replace('eq-', '');
            const found = earthquakesRef.current.find((e) => e.id === eqId);
            if (found && onSelectEarthquakeRef.current) onSelectEarthquakeRef.current(found);
          }
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      viewerRef.current = viewer;
      setIsCesiumReady(true);
    } catch (err) {
      console.error('Failed to initialize Cesium 3D Globe:', err);
    }

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Keyboard Shortcut: Press 'O' to toggle Cinematic Orbit Director
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        if (onToggleOrbit) onToggleOrbit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggleOrbit]);

  // ----------------------------------------------------
  // 2. DYNAMIC 3D MESH TILESET LOADER (GOOGLE 3D / OSM 3D)
  // ----------------------------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isCesiumReady) return;

    let isMounted = true;

    const applyTileset = async () => {
      // Remove any existing 3D tileset primitive
      if (currentTilesetRef.current) {
        viewer.scene.primitives.remove(currentTilesetRef.current);
        currentTilesetRef.current = null;
      }

      if (tilesetMode === 'SATELLITE') {
        setTilesetStatusMessage('Esri High-Res Satellite active (keyless)');
        return;
      }

      setIsLoadingTileset(true);
      setTilesetStatusMessage('Loading 3D mesh geometry...');

      try {
        if (tilesetMode === 'GOOGLE_3D') {
          if (!googleApiKey && !cesiumIonToken) {
            setTilesetStatusMessage('Requires Google Maps API Key or Cesium Ion Token');
            setIsLoadingTileset(false);
            return;
          }

          if (cesiumIonToken) {
            Cesium.Ion.defaultAccessToken = cesiumIonToken;
          }

          const options = googleApiKey 
            ? { key: googleApiKey, onlyUsingWithGoogleGeocoder: true as const } 
            : { onlyUsingWithGoogleGeocoder: true as const };

          const tileset = await Cesium.createGooglePhotorealistic3DTileset(options);
          
          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return;

          viewer.scene.primitives.add(tileset);
          currentTilesetRef.current = tileset;
          setTilesetStatusMessage('Google Photorealistic 3D Tiles active');
        } else if (tilesetMode === 'OSM_3D') {
          if (cesiumIonToken) {
            Cesium.Ion.defaultAccessToken = cesiumIonToken;
          }

          const osmTileset = await Cesium.createOsmBuildingsAsync({
            defaultColor: Cesium.Color.fromCssColorString('#38bdf8'),
          });

          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return;

          viewer.scene.primitives.add(osmTileset);
          currentTilesetRef.current = osmTileset;
          setTilesetStatusMessage('OpenStreetMap 3D Buildings active');
        }
      } catch (err: any) {
        console.error('Cesium 3D Tileset loading error:', err);
        setTilesetStatusMessage(`Tileset load error: ${err.message || 'Check credentials'}`);
      } finally {
        if (isMounted) {
          setIsLoadingTileset(false);
        }
      }
    };

    applyTileset();

    return () => {
      isMounted = false;
    };
  }, [tilesetMode, googleApiKey, cesiumIonToken, isCesiumReady]);

  // Save Settings to LocalStorage
  const handleSaveCredentials = (mode: TilesetEngineMode, gKey: string, cToken: string) => {
    if (onSaveCredentials) {
      onSaveCredentials(mode, gKey, cToken);
    } else {
      setLocalTilesetMode(mode);
      setLocalGoogleKey(gKey);
      setLocalCesiumToken(cToken);
      localStorage.setItem('geoint_tileset_mode', mode);
      localStorage.setItem('geoint_google_3d_key', gKey);
      localStorage.setItem('geoint_cesium_ion_token', cToken);
      setLocalShowModal(false);
    }
  };

  // ----------------------------------------------------
  // 3. RENDER 3D SPATIAL ENTITIES (CCTV, FLIGHTS, SATS, CABLES)
  // ----------------------------------------------------
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isCesiumReady) return;

    viewer.entities.removeAll();

    // --- A. CCTV CAMERAS & 3D VIEWSHED CONES ---
    if (activeLayers.cctv) {
      cctvCameras.forEach((cam) => {
        const isSelected = selectedCamera?.id === cam.id;
        const camPos = Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, cam.altitudeM + 5);

        // 1. Camera Ground Pin & Label
        viewer.entities.add({
          id: `cctv-${cam.id}`,
          name: `CAM: ${cam.name}`,
          position: camPos,
          point: {
            pixelSize: isSelected ? 14 : 10,
            color: isSelected ? Cesium.Color.CYAN : Cesium.Color.fromCssColorString('#00f0ff'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          },
          label: {
            text: `📹 ${cam.name.split('—')[0]}`,
            font: '10px monospace',
            fillColor: Cesium.Color.WHITE,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            showBackground: true,
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            pixelOffset: new Cesium.Cartesian2(12, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000),
          },
        });

        // 2. 3D Viewshed Frustum Footprint (Illuminated Arc on Ground)
        const footprint = calculateViewshedFootprint(
          cam.lat,
          cam.lng,
          cam.headingDeg,
          cam.fovDeg,
          cam.rangeM
        );
        const polygonDegrees: number[] = [];
        footprint.forEach(([lng, lat]) => {
          polygonDegrees.push(lng, lat);
        });

        viewer.entities.add({
          id: `viewshed-${cam.id}`,
          name: `VIEWSHED: ${cam.name}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(polygonDegrees),
            material: isSelected
              ? Cesium.Color.CYAN.withAlpha(0.35)
              : Cesium.Color.CYAN.withAlpha(0.18),
            outline: true,
            outlineColor: Cesium.Color.CYAN,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });

        // 3. Pitched Frustum Pyramid 3D Wireframe (Bilawal Sidhu v2 parity)
        if (isSelected || activeLayers.cctv) {
          const frustum = computeFrustumPyramid(
            cam.lat,
            cam.lng,
            cam.altitudeM || 25,
            cam.headingDeg,
            cam.pitchDeg || -18,
            cam.fovDeg || 70,
            cam.rangeM || 350
          );

          // Far cap rectangle
          viewer.entities.add({
            id: `frustum-cap-${cam.id}`,
            name: `FRUSTUM CAP: ${cam.name}`,
            polyline: {
              positions: frustum.farCap,
              width: isSelected ? 3.5 : 1.5,
              material: isSelected
                ? new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.45,
                    color: Cesium.Color.fromCssColorString('#00f0ff'),
                  })
                : Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.55),
            },
          });

          // 4 corner rays from apex (camera mount)
          frustum.rays.forEach((ray, rIdx) => {
            viewer.entities.add({
              id: `frustum-ray-${cam.id}-${rIdx}`,
              name: `FRUSTUM RAY: ${cam.name} #${rIdx}`,
              polyline: {
                positions: ray,
                width: isSelected ? 2.5 : 1.2,
                material: isSelected
                  ? new Cesium.PolylineGlowMaterialProperty({
                      glowPower: 0.35,
                      color: Cesium.Color.fromCssColorString('#00f0ff'),
                    })
                  : Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.4),
              },
            });
          });
        }
      });
    }

    // --- B. ADS-B FLIGHTS (TRUE 3D ALTITUDE + TRAILS) ---
    if (activeLayers.flights) {
      flights.forEach((flt) => {
        const isSelected = selectedFlight?.id === flt.id;
        const altMeters = flt.altitudeFt * 0.3048;
        const fltPos = Cesium.Cartesian3.fromDegrees(flt.lng, flt.lat, altMeters);
        const groundPos = Cesium.Cartesian3.fromDegrees(flt.lng, flt.lat, 0);

        // 1. Aircraft 3D Marker
        const hideOwnship = isCockpitMode && isSelected && cockpitCamAngle !== 'CHASE';
        viewer.entities.add({
          id: `flt-${flt.id}`,
          show: !hideOwnship,
          name: `FLT: ${flt.callsign} (${flt.aircraftType})`,
          position: fltPos,
          point: {
            pixelSize: isSelected ? 16 : 11,
            color: flt.isMilitary
              ? Cesium.Color.CRIMSON
              : isSelected
              ? Cesium.Color.CHARTREUSE
              : Cesium.Color.LIME,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: `✈ ${flt.callsign} | FL${Math.round(flt.altitudeFt / 100)}`,
            font: 'bold 11px monospace',
            fillColor: flt.isMilitary ? Cesium.Color.CRIMSON : Cesium.Color.WHITE,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
            showBackground: true,
            pixelOffset: new Cesium.Cartesian2(14, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000),
          },
        });

        // 2. Altitude Drop-Line to Ground Surface
        viewer.entities.add({
          id: `flt-dropline-${flt.id}`,
          show: !(isCockpitMode && isSelected),
          polyline: {
            positions: [fltPos, groundPos],
            width: 1.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: flt.isMilitary
                ? Cesium.Color.CRIMSON.withAlpha(0.6)
                : Cesium.Color.LIME.withAlpha(0.5),
              dashLength: 8.0,
            }),
          },
        });
      });
    }

    // --- C. SATELLITES (ORBITAL RINGS & SENSORS) ---
    if (activeLayers.satellites) {
      satellites.forEach((sat) => {
        const satAltMeters = sat.altitudeKm * 1000;
        const satPos = Cesium.Cartesian3.fromDegrees(sat.lng, sat.lat, satAltMeters);

        // 1. Satellite Spacecraft Marker
        viewer.entities.add({
          id: `sat-${sat.id}`,
          name: `SAT: ${sat.name}`,
          position: satPos,
          point: {
            pixelSize: 14,
            color: Cesium.Color.MEDIUMPURPLE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: `🛰️ ${sat.name} [${sat.altitudeKm} KM]`,
            font: '10px monospace',
            fillColor: Cesium.Color.VIOLET,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.8),
            showBackground: true,
            pixelOffset: new Cesium.Cartesian2(12, 0),
          },
        });

        // 2. Orbital Path Polyline Ring
        if (sat.orbitPath && sat.orbitPath.length > 1) {
          const orbitPositions = sat.orbitPath.map(([lat, lng]) =>
            Cesium.Cartesian3.fromDegrees(lng, lat, satAltMeters)
          );
          viewer.entities.add({
            polyline: {
              positions: orbitPositions,
              width: 2,
              material: Cesium.Color.MAGENTA.withAlpha(0.6),
            },
          });
        }
      });
    }

    // --- D. SUBSEA FIBER OPTIC CABLES ---
    if (activeLayers.cables) {
      subseaCables.forEach((cable) => {
        const cablePositions = cable.coordinates.map(([lat, lng]) =>
          Cesium.Cartesian3.fromDegrees(lng, lat, 0)
        );

        viewer.entities.add({
          name: `CABLE: ${cable.name}`,
          polyline: {
            positions: cablePositions,
            width: 3.5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.35,
              color: Cesium.Color.DEEPSKYBLUE,
            }),
            clampToGround: true,
          },
        });

        // Landing Station Nodes
        cable.landingPoints.forEach((lp) => {
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lp.lng, lp.lat, 0),
            point: {
              pixelSize: 8,
              color: Cesium.Color.DEEPSKYBLUE,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1.5,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            label: {
              text: `⚓ ${lp.name}`,
              font: '9px monospace',
              fillColor: Cesium.Color.LIGHTCYAN,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.7),
              showBackground: true,
              pixelOffset: new Cesium.Cartesian2(10, 0),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1000000),
            },
          });
        });
      });
    }

    // --- E. MARITIME AIS VESSELS ---
    if (activeLayers.maritime) {
      vessels.forEach((ves) => {
        const vesPos = Cesium.Cartesian3.fromDegrees(ves.lng, ves.lat, 0);

        viewer.entities.add({
          id: `ves-${ves.id}`,
          name: `VES: ${ves.name}`,
          position: vesPos,
          point: {
            pixelSize: 9,
            color: Cesium.Color.DODGERBLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1.5,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: `🚢 ${ves.name} (${ves.speedKts} KTS)`,
            font: '9px monospace',
            fillColor: Cesium.Color.SKYBLUE,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.75),
            showBackground: true,
            pixelOffset: new Cesium.Cartesian2(10, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 800000),
          },
        });
      });
    }

    // --- E2. LIVE USGS EARTHQUAKES LAYER ---
    if (activeLayers.earthquakes && earthquakes && earthquakes.length > 0) {
      earthquakes.forEach((eq) => {
        const isSelected = selectedEarthquake?.id === eq.id;
        const color = eq.mag >= 6.0
          ? Cesium.Color.RED
          : eq.mag >= 4.5
          ? Cesium.Color.DARKORANGE
          : Cesium.Color.GOLD;

        const radiusM = Math.max(30000, Math.pow(2, eq.mag) * 8000);

        // 1. Seismic Epicenter Point
        viewer.entities.add({
          id: `eq-${eq.id}`,
          name: `EQ: ${eq.place} (M${eq.mag.toFixed(1)})`,
          position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, 0),
          point: {
            pixelSize: isSelected ? 18 : Math.max(8, Math.min(22, eq.mag * 3)),
            color: color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: `⚡ M${eq.mag.toFixed(1)} | ${eq.place}`,
            font: 'bold 10px monospace',
            fillColor: color,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.85),
            showBackground: true,
            pixelOffset: new Cesium.Cartesian2(12, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 4000000),
          },
        });

        // 2. Magnitude Shockwave Ring (Circle outline on terrain)
        viewer.entities.add({
          id: `eq-ring-${eq.id}`,
          position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, 0),
          ellipse: {
            semiMajorAxis: radiusM,
            semiMinorAxis: radiusM,
            material: color.withAlpha(0.12),
            outline: true,
            outlineColor: color.withAlpha(0.6),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      });
    }

    // --- F. TARGET IP MARKER & SURVEILLANCE CORRELATION VECTOR ---
    if (targetIpMarker) {
      const targetPos = Cesium.Cartesian3.fromDegrees(targetIpMarker.lng, targetIpMarker.lat, 10);

      // 1. Target Pin Beacon
      viewer.entities.add({
        id: `target-ip-${targetIpMarker.ip}`,
        name: `TARGET IP: ${targetIpMarker.ip}`,
        position: targetPos,
        point: {
          pixelSize: 20,
          color: Cesium.Color.fromCssColorString('#f43f5e'),
          outlineColor: Cesium.Color.YELLOW,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
        label: {
          text: `🎯 TARGET IP: ${targetIpMarker.ip}\n📍 ${targetIpMarker.city ? targetIpMarker.city + ', ' : ''}${targetIpMarker.country}\n🌐 ISP: ${targetIpMarker.isp}${targetIpMarker.distanceKm !== undefined ? `\n⚡ NEAREST SENSOR: ${targetIpMarker.distanceKm} KM` : ''}`,
          font: 'bold 11px monospace',
          fillColor: Cesium.Color.YELLOW,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.85),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -60),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3000000),
        },
      });

      // 2. Correlation Vector Polyline to Closest CCTV Camera
      if (targetIpMarker.closestCamId) {
        const closestCam = cctvCameras.find(c => c.id === targetIpMarker.closestCamId);
        if (closestCam) {
          const camPos = Cesium.Cartesian3.fromDegrees(closestCam.lng, closestCam.lat, closestCam.altitudeM + 5);

          viewer.entities.add({
            id: `vector-target-${targetIpMarker.ip}`,
            name: `CORRELATION VECTOR: ${targetIpMarker.ip} -> ${closestCam.name}`,
            polyline: {
              positions: [targetPos, camPos],
              width: 4,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.5,
                color: Cesium.Color.YELLOW,
              }),
            },
          });

          // Midpoint distance badge
          const midLat = (targetIpMarker.lat + closestCam.lat) / 2;
          const midLng = (targetIpMarker.lng + closestCam.lng) / 2;
          viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(midLng, midLat, 80),
            label: {
              text: `⚡ VECTOR: ${targetIpMarker.distanceKm} KM (BRG ${targetIpMarker.bearingDeg}°)`,
              font: 'bold 10px monospace',
              fillColor: Cesium.Color.CYAN,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.85),
              showBackground: true,
              horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1000000),
            }
          });
        }
      }
    }

    // --- G. HIGHLIGHTED BOUNDARY (WILAYA / COUNTRY / CITY / DISTRICT) ---
    if (highlightedBoundary) {
      const { name, name_ar, type, code, center, bbox, geojson } = highlightedBoundary;

      // 1. Center Target Beacon & Holographic HUD Tag
      viewer.entities.add({
        id: 'boundary-center-beacon',
        name: `BOUNDARY: ${name}`,
        position: Cesium.Cartesian3.fromDegrees(center[0], center[1], 150),
        point: {
          pixelSize: 18,
          color: Cesium.Color.fromCssColorString('#00f0ff'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2.5,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
        label: {
          text: `🎯 TARGET BOUNDARY: ${name.toUpperCase()} ${name_ar ? `[${name_ar}]` : ''}\n🌐 SECTOR: ${type.toUpperCase()}${code ? ` | CODE: ${code}` : ''}`,
          font: 'bold 12px monospace',
          fillColor: Cesium.Color.fromCssColorString('#00f0ff'),
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.85),
          showBackground: true,
          pixelOffset: new Cesium.Cartesian2(0, -45),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        },
      });

      // 2. Render Perimeter Glowing Polygons from GeoJSON
      if (geojson) {
        let rings: [number, number][][] = [];
        if (geojson.type === 'Polygon') {
          rings = geojson.coordinates;
        } else if (geojson.type === 'MultiPolygon') {
          rings = geojson.coordinates.map((poly: any) => poly[0]);
        }

        rings.forEach((ring, rIdx) => {
          const flatDegrees: number[] = [];
          ring.forEach(([lng, lat]) => {
            flatDegrees.push(lng, lat);
          });

          if (flatDegrees.length >= 6) {
            // Glowing Perimeter Polyline Outline
            viewer.entities.add({
              id: `boundary-glow-line-${rIdx}`,
              name: `PERIMETER OUTLINE: ${name}`,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
                width: 4.5,
                material: new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.5,
                  color: Cesium.Color.fromCssColorString('#00f0ff'),
                }),
                clampToGround: true,
              },
            });

            // Translucent Boundary Volume Fill
            viewer.entities.add({
              id: `boundary-polygon-fill-${rIdx}`,
              name: `PERIMETER ZONE: ${name}`,
              polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(flatDegrees),
                material: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.12),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
            });
          }
        });
      } else if (bbox) {
        // Fallback: Rectangle box if geometry wasn't polygon
        const [south, west, north, east] = bbox;
        viewer.entities.add({
          id: 'boundary-bbox-rect',
          name: `PERIMETER BBOX: ${name}`,
          rectangle: {
            coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
            material: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.1),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#00f0ff'),
            outlineWidth: 3,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
      }
    }
  }, [
    isCesiumReady,
    cctvCameras,
    flights,
    satellites,
    subseaCables,
    vessels,
    earthquakes,
    activeLayers,
    selectedCamera,
    selectedFlight,
    selectedEarthquake,
    targetIpMarker,
    highlightedBoundary,
    isCockpitMode,
    cockpitCamAngle,
  ]);

  // ----------------------------------------------------
  // CINEMATIC 360° ORBIT DIRECTOR ENGINE
  // ----------------------------------------------------
  useEffect(() => {
    if (!viewerRef.current || !isCesiumReady || !isOrbiting) return;
    const viewer = viewerRef.current;
    const scene = viewer.scene;

    let targetCartesian: Cesium.Cartesian3;

    if (selectedFlight) {
      targetCartesian = Cesium.Cartesian3.fromDegrees(
        selectedFlight.lng,
        selectedFlight.lat,
        selectedFlight.altitudeFt * 0.3048
      );
    } else if (selectedCamera) {
      targetCartesian = Cesium.Cartesian3.fromDegrees(
        selectedCamera.lng,
        selectedCamera.lat,
        selectedCamera.altitudeM
      );
    } else if (targetIpMarker) {
      targetCartesian = Cesium.Cartesian3.fromDegrees(
        targetIpMarker.lng,
        targetIpMarker.lat,
        10
      );
    } else {
      // Raycast center of viewport to globe
      const canvas = viewer.scene.canvas;
      const windowPosition = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
      const ray = viewer.camera.getPickRay(windowPosition);
      const hit = ray ? scene.globe.pick(ray, scene) : null;
      targetCartesian = hit || Cesium.Cartesian3.fromDegrees(3.0588, 36.7538, 0);
    }

    const camPos = viewer.camera.positionWC;
    const initialRange = Math.max(350, Cesium.Cartesian3.distance(camPos, targetCartesian));
    let heading = viewer.camera.heading;
    const pitch = viewer.camera.pitch;
    let lastTime = performance.now();

    const orbitTick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // 6 degrees per second smooth cinematic rotation
      heading += Cesium.Math.toRadians(6 * dt);

      viewer.camera.lookAt(
        targetCartesian,
        new Cesium.HeadingPitchRange(heading, pitch, initialRange)
      );
    };

    const removeListener = scene.preUpdate.addEventListener(orbitTick);

    return () => {
      removeListener();
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    };
  }, [isOrbiting, selectedFlight?.id, selectedCamera?.id, targetIpMarker?.ip, isCesiumReady]);

  // ----------------------------------------------------
  // SOLAR TERMINATOR & REAL-TIME SUN POSITION ENGINE
  // ----------------------------------------------------
  useEffect(() => {
    if (!viewerRef.current || !isCesiumReady || solarTimeHours === undefined) return;
    const viewer = viewerRef.current;
    const hours = Math.floor(solarTimeHours);
    const minutes = Math.floor((solarTimeHours - hours) * 60);
    const d = new Date();
    d.setUTCHours(hours, minutes, 0, 0);
    const julianDate = Cesium.JulianDate.fromDate(d);
    viewer.clock.currentTime = julianDate;
    viewer.scene.globe.enableLighting = true;
  }, [solarTimeHours, isCesiumReady]);

  // Automated Camera FlyTo when Target IP is Correlated
  useEffect(() => {
    if (!targetIpMarker || !viewerRef.current || !isCesiumReady) return;
    const viewer = viewerRef.current;

    const dist = targetIpMarker.distanceKm || 5;
    const altM = Math.max(2500, Math.min(250000, dist * 1200));

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(targetIpMarker.lng, targetIpMarker.lat, altM),
      orientation: {
        heading: Cesium.Math.toRadians(targetIpMarker.bearingDeg || 0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
      duration: 2.4,
    });
  }, [targetIpMarker?.ip, targetIpMarker?.lat, targetIpMarker?.lng, isCesiumReady]);

  // Automated Camera FlyTo when Boundary is Highlighted
  useEffect(() => {
    if (!highlightedBoundary || !viewerRef.current || !isCesiumReady) return;
    const viewer = viewerRef.current;

    if (highlightedBoundary.bbox) {
      const [south, west, north, east] = highlightedBoundary.bbox;
      viewer.camera.flyTo({
        destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
        duration: 2.5,
      });
    } else {
      const isCountry = highlightedBoundary.type === 'country';
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          highlightedBoundary.center[0],
          highlightedBoundary.center[1],
          isCountry ? 2000000 : 45000
        ),
        orientation: {
          heading: 0,
          pitch: Cesium.Math.toRadians(isCountry ? -85 : -45),
          roll: 0,
        },
        duration: 2.5,
      });
    }
  }, [highlightedBoundary, isCesiumReady]);

  // ----------------------------------------------------
  // REAL-TIME COCKPIT FLIGHT TRACKING & CAMERA CONTROLLER
  // ----------------------------------------------------
  useEffect(() => {
    if (!isCockpitMode || !selectedFlight || !viewerRef.current || !isCesiumReady) return;
    const viewer = viewerRef.current;
    const scene = viewer.scene;

    // Temporarily disable standard mouse camera manipulation so it doesn't fight flight vector
    const controller = scene.screenSpaceCameraController;
    const prevEnableInputs = controller.enableInputs;
    controller.enableInputs = false;

    let currentLat = selectedFlight.lat;
    let currentLng = selectedFlight.lng;
    let currentAltM = Math.max(150, selectedFlight.altitudeFt * 0.3048);
    const headingDeg = selectedFlight.heading || 0;
    const headingRad = Cesium.Math.toRadians(headingDeg);
    const speedMps = Math.max(80, (selectedFlight.groundSpeedKts * 1852) / 3600);

    let lastTime = performance.now();

    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;

    // Geodesic forward displacement along true heading
    const projectGeo = (latDeg: number, lonDeg: number, brgDeg: number, distM: number) => {
      const angular = distM / 6371000;
      const brg = toRad(brgDeg);
      const lat1 = toRad(latDeg);
      const lon1 = toRad(lonDeg);
      const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(brg)
      );
      const lon2 = lon1 + Math.atan2(
        Math.sin(brg) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
      );
      return { lat: toDeg(lat2), lng: toDeg(lon2) };
    };

    const updateFlightCamera = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Advance aircraft position along heading vector
      const stepDistM = speedMps * dt;
      const nextPos = projectGeo(currentLat, currentLng, headingDeg, stepDistM);
      currentLat = nextPos.lat;
      currentLng = nextPos.lng;

      // Update ownship 3D entity position if present in viewer
      const fltEntity = viewer.entities.getById(`flt-${selectedFlight.id}`);
      if (fltEntity) {
        if (cockpitCamAngle === 'CHASE') {
          fltEntity.show = true;
          fltEntity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAltM)
          );
        } else {
          fltEntity.show = false;
        }
      }

      if (cockpitCamAngle === 'FIRST_PERSON') {
        // First person pilot seat: at cockpit nose looking forward with slight downward angle (-6 deg)
        const nosePos = projectGeo(currentLat, currentLng, headingDeg, 14);
        const camPos = Cesium.Cartesian3.fromDegrees(nosePos.lng, nosePos.lat, currentAltM + 2.5);
        viewer.camera.setView({
          destination: camPos,
          orientation: {
            heading: headingRad,
            pitch: Cesium.Math.toRadians(-6),
            roll: 0,
          },
        });
      } else if (cockpitCamAngle === 'CHASE') {
        // Third-person trailing chase cam: 80m behind aircraft and 26m above looking forward-down
        const chasePosLL = projectGeo(currentLat, currentLng, (headingDeg + 180) % 360, 80);
        const camPos = Cesium.Cartesian3.fromDegrees(chasePosLL.lng, chasePosLL.lat, currentAltM + 26);
        viewer.camera.setView({
          destination: camPos,
          orientation: {
            heading: headingRad,
            pitch: Cesium.Math.toRadians(-14),
            roll: 0,
          },
        });
      } else if (cockpitCamAngle === 'DOWNWARD_RECON') {
        // Downward Nadir Recon Camera: looking straight down (-88 deg) at high-res terrain streaming beneath
        const camPos = Cesium.Cartesian3.fromDegrees(currentLng, currentLat, currentAltM);
        viewer.camera.setView({
          destination: camPos,
          orientation: {
            heading: headingRad,
            pitch: Cesium.Math.toRadians(-88),
            roll: 0,
          },
        });
      }
    };

    // Execute first frame immediately
    updateFlightCamera();

    // Hook onto Cesium's render loop (preUpdate) for 60 FPS stutter-free synchrony
    const removeListener = scene.preUpdate.addEventListener(updateFlightCamera);

    return () => {
      removeListener();
      if (viewer && !viewer.isDestroyed()) {
        controller.enableInputs = prevEnableInputs;
        const fltEntity = viewer.entities.getById(`flt-${selectedFlight.id}`);
        if (fltEntity) fltEntity.show = true;
      }
    };
  }, [isCockpitMode, selectedFlight?.id, cockpitCamAngle, isCesiumReady]);

  // ----------------------------------------------------
  // 4. CINEMATIC 3D CAMERA DIVES & PRESETS
  // ----------------------------------------------------
  const flyToTarget = (lat: number, lng: number, heightM: number, pitchDeg: number = -45, headingDeg: number = 0) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, heightM),
      orientation: {
        heading: Cesium.Math.toRadians(headingDeg),
        pitch: Cesium.Math.toRadians(pitchDeg),
        roll: 0,
      },
      duration: 2.2,
    });
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none font-mono">
      {/* Real Cesium 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full relative" />

      {/* Top Left: Cinematic Orbital Dives Ribbon */}
      {!isCockpitMode && (
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-1.5 text-[10px] font-mono pointer-events-auto max-w-[90vw]">
          {/* Orbit Director Toggle */}
          <button
            onClick={() => onToggleOrbit && onToggleOrbit()}
            className={`px-2.5 py-1.5 rounded-lg border font-bold transition-all flex items-center gap-1.5 shadow ${
              isOrbiting
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse'
                : 'bg-black/80 hover:bg-cyan-950 border-cyan-500/50 text-cyan-300'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 ${isOrbiting ? 'animate-spin' : 'text-cyan-400'}`} />
            <span>{isOrbiting ? 'ORBIT ACTIVE (360°)' : 'ORBIT DIRECTOR [O]'}</span>
          </button>

          {/* Solar Terminator & Sun Slider */}
          <div className="px-2.5 py-1.5 rounded-lg bg-black/85 border border-cyan-500/50 text-cyan-300 flex items-center gap-2 shadow">
            <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[9px] font-bold">SOLAR UTC:</span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.5"
              value={solarTimeHours}
              onChange={(e) => onChangeSolarTime && onChangeSolarTime(parseFloat(e.target.value))}
              className="w-16 h-1.5 accent-cyan-400 bg-slate-800 rounded cursor-pointer"
            />
            <span className="text-[9px] font-bold text-amber-300 w-9">
              {String(Math.floor(solarTimeHours)).padStart(2, '0')}:
              {String(Math.floor((solarTimeHours % 1) * 60)).padStart(2, '0')}
            </span>
          </div>

          {/* Tactical Bookmarks */}
          <button
            onClick={() => flyToTarget(36.7538, 3.0588, 1400, -32, 25)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold transition-all shadow flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>🇩🇿 ALGIERS (1.4 KM)</span>
          </button>

          <button
            onClick={() => flyToTarget(40.7128, -74.0060, 1400, -30, 45)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇺🇸 NYC MANHATTAN</span>
          </button>

          <button
            onClick={() => flyToTarget(51.5007, -0.1246, 1200, -28, 350)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇬🇧 LONDON</span>
          </button>

          <button
            onClick={() => flyToTarget(48.8584, 2.2945, 900, -28, 120)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇫🇷 PARIS EIFFEL</span>
          </button>

          <button
            onClick={() => flyToTarget(35.6595, 139.7005, 1100, -35, 210)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇯🇵 TOKYO SHIBUYA</span>
          </button>

          <button
            onClick={() => flyToTarget(25.1972, 55.2744, 1500, -35, 180)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇦🇪 DUBAI</span>
          </button>

          <button
            onClick={() => flyToTarget(30.2682, -97.7428, 1200, -25, 185)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <span>🇺🇸 AUSTIN</span>
          </button>

          <button
            onClick={() => flyToTarget(28.0, 5.0, 18000000, -89, 0)}
            className="px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 transition-all shadow flex items-center gap-1.5"
          >
            <Satellite className="w-3.5 h-3.5 text-purple-400" />
            <span>GLOBAL ORBIT</span>
          </button>
        </div>
      )}

      {/* 3D Mesh Engine Provider Modal */}
      {showEngineModal && (
        <EngineSettingsModal
          initialMode={tilesetMode}
          initialGoogleKey={googleApiKey}
          initialCesiumToken={cesiumIonToken}
          isLoading={isLoadingTileset}
          statusMessage={tilesetStatusMessage}
          onClose={() => {
            if (onCloseEngineModal) onCloseEngineModal();
            else setLocalShowModal(false);
          }}
          onSave={(mode, gKey, cToken) => {
            if (onSaveCredentials) {
              onSaveCredentials(mode, gKey, cToken);
            } else {
              setLocalTilesetMode(mode);
              setLocalGoogleKey(gKey);
              setLocalCesiumToken(cToken);
              localStorage.setItem('geoint_tileset_mode', mode);
              localStorage.setItem('geoint_google_3d_key', gKey);
              localStorage.setItem('geoint_cesium_ion_token', cToken);
              setLocalShowModal(false);
            }
          }}
        />
      )}

      {/* Bottom Right: Sensor Altitude & Telemetry Readout */}
      {!isCockpitMode && (
        <div className="absolute bottom-4 left-4 z-20 bg-black/85 border border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-[10px] space-y-1 text-slate-300 pointer-events-none backdrop-blur-md max-w-sm">
          <div className="flex items-center gap-2 font-bold text-cyan-300">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>PHOTOREALISTIC 3D ORBITAL ENGINE</span>
          </div>
          <div className="text-slate-400">
            SENSOR ALTITUDE: <span className="text-white font-bold">{cameraAltitudeKm.toLocaleString()} KM</span> MSL
          </div>
          <div className="text-slate-400 flex items-center gap-1.5">
            <span>ACTIVE 3D MESH:</span>
            <span className={`font-bold ${
              tilesetMode === 'GOOGLE_3D'
                ? 'text-amber-400'
                : tilesetMode === 'OSM_3D'
                ? 'text-sky-400'
                : 'text-emerald-400'
            }`}>
              {tilesetMode === 'GOOGLE_3D'
                ? 'GOOGLE 3D PHOTOGRAMMETRY'
                : tilesetMode === 'OSM_3D'
                ? 'OSM 3D GEOMETRY'
                : 'ESRI WORLD IMAGERY'}
            </span>
          </div>
          <div className="text-slate-500 text-[9px]">
            STATUS: {tilesetStatusMessage}
          </div>
          <div className="text-slate-500 text-[9px]">
            CESIUMJS 3D GL ENGINE ACTIVE • 60 FPS
          </div>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------
// 5. ENGINE SETTINGS & CREDENTIALS MODAL COMPONENT
// ----------------------------------------------------
interface EngineSettingsModalProps {
  initialMode: TilesetEngineMode;
  initialGoogleKey: string;
  initialCesiumToken: string;
  isLoading: boolean;
  statusMessage: string;
  onClose: () => void;
  onSave: (mode: TilesetEngineMode, googleKey: string, cesiumToken: string) => void;
}

const EngineSettingsModal: React.FC<EngineSettingsModalProps> = ({
  initialMode,
  initialGoogleKey,
  initialCesiumToken,
  isLoading,
  statusMessage,
  onClose,
  onSave,
}) => {
  const [mode, setMode] = useState<TilesetEngineMode>(initialMode);
  const [googleKey, setGoogleKey] = useState<string>(initialGoogleKey);
  const [cesiumToken, setCesiumToken] = useState<string>(initialCesiumToken);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="w-full max-w-xl bg-[#090d16] border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cyan-900/60 bg-cyan-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                3D PHOTOGRAMMETRY & TILESET PROVIDER
              </h2>
              <p className="text-[10px] text-cyan-400/80">
                Configure Google Photorealistic 3D Tiles vs OpenStreetMap vs Satellite
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-slate-300 space-y-1 text-[11px] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300">
              <Info className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>HOW ORBITAL 3D GEOINT & PHOTOREALISTIC VIEWSHEDS WORK</span>
            </div>
            <p className="text-slate-400 text-[10px]">
              In Bilawal Sidhu's viral video, the globe looks like a 3D movie because it streams{' '}
              <span className="text-amber-300 font-bold">Google Photorealistic 3D Tiles</span>. In that mode, every
              skyscraper, bridge, and building is an actual 3D textured mesh. Without a key, Cesium falls back to
              flat 2D satellite photos.
            </p>
          </div>

          {/* Engine Selector Cards */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              Select 3D Mesh Engine Provider
            </label>
            
            <div className="grid grid-cols-1 gap-2">
              {/* Option 1: Google Photorealistic 3D Tiles */}
              <button
                type="button"
                onClick={() => setMode('GOOGLE_3D')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                  mode === 'GOOGLE_3D'
                    ? 'bg-amber-950/40 border-amber-500/80 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                    : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2 text-white">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>GOOGLE PHOTOREALISTIC 3D TILES (THE VIRAL VIDEO)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Real 3D textured photogrammetric meshes for 2,500+ cities worldwide. You can fly between buildings.
                    Requires Google Maps API Key or Cesium Ion Token.
                  </p>
                </div>
                {mode === 'GOOGLE_3D' && <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
              </button>

              {/* Option 2: OpenStreetMap 3D Buildings */}
              <button
                type="button"
                onClick={() => setMode('OSM_3D')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                  mode === 'OSM_3D'
                    ? 'bg-sky-950/40 border-sky-500/80 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                    : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2 text-white">
                    <Building2 className="w-4 h-4 text-sky-400" />
                    <span>OPENSTREETMAP 3D BUILDINGS</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Extruded 3D building geometry worldwide. Outlines and heights for millions of buildings.
                  </p>
                </div>
                {mode === 'OSM_3D' && <Check className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />}
              </button>

              {/* Option 3: Esri Satellite Imagery */}
              <button
                type="button"
                onClick={() => setMode('SATELLITE')}
                className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                  mode === 'SATELLITE'
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                    : 'bg-black/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="font-bold flex items-center gap-2 text-white">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span>ESRI WORLD IMAGERY (KEYLESS SATELLITE DEFAULT)</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    High-resolution global satellite photography draped over the Earth sphere. Instant, keyless, zero configuration.
                  </p>
                </div>
                {mode === 'SATELLITE' && <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              </button>
            </div>
          </div>

          {/* Credentials Inputs */}
          {mode === 'GOOGLE_3D' && (
            <div className="space-y-3 p-3.5 rounded-xl bg-black/60 border border-amber-500/30">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5 mb-1">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Google Maps API Key (Map Tiles API enabled)</span>
                </label>
                <input
                  type="text"
                  value={googleKey}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-700 focus:border-amber-400 text-amber-200 text-xs font-mono outline-none"
                />
                <p className="text-[9px] text-slate-500 mt-1">
                  Obtained free in Google Cloud Console with "Map Tiles API" enabled.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5 mb-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Or Cesium Ion Default Access Token (Optional)</span>
                </label>
                <input
                  type="text"
                  value={cesiumToken}
                  onChange={(e) => setCesiumToken(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 rounded-lg bg-[#050811] border border-slate-700 focus:border-cyan-400 text-cyan-200 text-xs font-mono outline-none"
                />
                <p className="text-[9px] text-slate-500 mt-1">
                  Cesium Ion accounts are 100% free at cesium.com/ion and grant access to Asset 2275207.
                </p>
              </div>
            </div>
          )}

          {/* Status readout */}
          <div className="text-[10px] text-slate-400 flex items-center justify-between">
            <span>Status: {statusMessage}</span>
            {isLoading && (
              <span className="flex items-center gap-1.5 text-amber-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading Tileset...</span>
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-cyan-900/60 bg-black/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(mode, googleKey, cesiumToken)}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Engine Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CesiumGodsEyeGlobe;
