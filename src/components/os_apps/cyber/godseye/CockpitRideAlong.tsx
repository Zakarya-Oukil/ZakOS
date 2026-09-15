import React, { useState, useEffect } from 'react';
import { 
  Compass, Radio, Crosshair, ArrowLeft, 
  Wind, Shield, AlertTriangle, Activity, 
  Eye, Zap, RefreshCw, Gauge, Plane
} from 'lucide-react';
import { GeointFlight } from '@/types/geoint';

export type CockpitCameraAngle = 'FIRST_PERSON' | 'CHASE' | 'DOWNWARD_RECON';

interface CockpitRideAlongProps {
  flight: GeointFlight;
  onExit: () => void;
  cockpitCamAngle?: CockpitCameraAngle;
  onAngleChange?: (angle: CockpitCameraAngle) => void;
  allFlights?: GeointFlight[];
  onSelectFlight?: (flight: GeointFlight) => void;
}

export const CockpitRideAlong: React.FC<CockpitRideAlongProps> = ({
  flight,
  onExit,
  cockpitCamAngle = 'FIRST_PERSON',
  onAngleChange,
  allFlights = [],
  onSelectFlight
}) => {
  const [bankAngle, setBankAngle] = useState<number>(0);
  const [pitchAngle, setPitchAngle] = useState<number>(2.5);
  const [airspeed, setAirspeed] = useState<number>(flight.groundSpeedKts);
  const [altitude, setAltitude] = useState<number>(flight.altitudeFt);
  const [radarSweepDeg, setRadarSweepDeg] = useState<number>(0);
  const [showNearbyRoster, setShowNearbyRoster] = useState<boolean>(true);

  // Dynamic nearby aircraft proximity calculations
  const nearbyFlights = React.useMemo(() => {
    if (!allFlights || allFlights.length === 0) return [];
    return allFlights
      .filter(f => f.id !== flight.id)
      .map(f => {
        // Approximate distance in nautical miles (1 deg lat ~ 60 NM)
        const dLat = (f.lat - flight.lat) * 60;
        const dLng = (f.lng - flight.lng) * 60 * Math.cos((flight.lat * Math.PI) / 180);
        const distNm = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
        const altDelta = f.altitudeFt - flight.altitudeFt;
        return {
          flight: f,
          distNm,
          altDeltaStr: altDelta >= 0 ? `+${Math.round(altDelta / 100)}` : `${Math.round(altDelta / 100)}`,
          relX: Math.max(-0.85, Math.min(0.85, dLng / 60)),
          relY: Math.max(-0.85, Math.min(0.85, -dLat / 60))
        };
      })
      .sort((a, b) => a.distNm - b.distNm)
      .slice(0, 6);
  }, [allFlights, flight]);

  // Dynamic radar targets from real nearby traffic, fallback to simulated if none in range
  const radarTargets = React.useMemo(() => {
    if (nearbyFlights.length > 0) {
      return nearbyFlights.map(item => ({
        id: item.flight.id,
        x: item.relX,
        y: item.relY,
        label: item.flight.callsign || item.flight.aircraftType || 'BOGEY',
        altDelta: item.altDeltaStr,
        flight: item.flight
      }));
    }
    return [
      { id: 'sim-1', x: 0.25, y: -0.35, label: 'AFR1145', altDelta: '+30' },
      { id: 'sim-2', x: -0.4, y: 0.15, label: 'NATO01', altDelta: '-30' },
      { id: 'sim-3', x: 0.65, y: 0.45, label: 'BAW245', altDelta: '+50' }
    ];
  }, [nearbyFlights]);

  // Subtle flight physics simulation: banking, slight turbulence, pitch variation
  useEffect(() => {
    let t = 0;
    const interval = setInterval(() => {
      t += 0.05;
      // Gentle banking roll between -8 and +8 degrees
      const newBank = Math.sin(t * 0.4) * 6 + Math.sin(t * 1.1) * 2;
      // Gentle pitch variation between 1.0 and 4.0 degrees
      const newPitch = 2.5 + Math.sin(t * 0.7) * 1.5;
      // Speed fluctuation
      const newSpeed = flight.groundSpeedKts + Math.round(Math.sin(t * 0.8) * 4);
      // Altitude micro drift
      const newAlt = flight.altitudeFt + Math.round(Math.sin(t * 0.3) * 60);

      setBankAngle(newBank);
      setPitchAngle(newPitch);
      setAirspeed(newSpeed);
      setAltitude(newAlt);
      setRadarSweepDeg(prev => (prev + 4) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, [flight]);

  // Mach number calculation
  const machNumber = (airspeed / 573).toFixed(2);

  return (
    <div className="relative w-full h-full bg-transparent overflow-hidden font-mono select-none text-cyan-300 pointer-events-none">
      {/* ----------------------------------------------------
          1. FORWARD COCKPIT CANOPY & HORIZON LAYER
          ---------------------------------------------------- */}
      <div 
        className="absolute inset-0 transition-transform duration-75 flex items-center justify-center pointer-events-none"
        style={{
          transform: `rotate(${bankAngle}deg) translateY(${pitchAngle * 6}px)`
        }}
      >
        {/* Dynamic Sky / Ground Transparent Tint (Shows real Cesium Earth behind!) */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/15 via-transparent to-black/35 pointer-events-none" />

        {/* 3D Artificial Horizon Line */}
        <div className="w-[200%] h-[2px] bg-cyan-400/80 shadow-[0_0_15px_#00f0ff] relative flex items-center justify-center">
          {/* Horizon Center Gap */}
          <div className="w-16 h-2 bg-transparent" />
          <div className="absolute left-1/4 -top-5 text-[10px] text-cyan-400/70 tracking-wider font-bold">PITCH LEVEL</div>
          <div className="absolute right-1/4 -top-5 text-[10px] text-cyan-400/70 tracking-wider font-bold">HORIZON REF</div>
        </div>

        {/* Pitch Ladder Rungs (+10, +20, -10, -20) */}
        <div className="absolute flex flex-col items-center gap-16 pointer-events-none">
          {/* +20 deg Climb */}
          <div className="w-32 flex items-center justify-between border-t-2 border-cyan-400/50 text-[9px] px-1 font-bold">
            <span>20</span>
            <span className="w-8 h-[1px] bg-cyan-400/20" />
            <span>20</span>
          </div>

          {/* +10 deg Climb */}
          <div className="w-44 flex items-center justify-between border-t-2 border-cyan-400/70 text-[10px] px-1 font-bold">
            <span>10</span>
            <span className="w-16 h-[1px] bg-cyan-400/30" />
            <span>10</span>
          </div>

          {/* Spacer for Horizon */}
          <div className="h-6" />

          {/* -10 deg Dive */}
          <div className="w-44 flex items-center justify-between border-b-2 border-dashed border-cyan-400/70 text-[10px] px-1 font-bold">
            <span>-10</span>
            <span className="w-16 h-[1px] bg-cyan-400/30" />
            <span>-10</span>
          </div>

          {/* -20 deg Dive */}
          <div className="w-32 flex items-center justify-between border-b-2 border-dashed border-cyan-400/50 text-[9px] px-1 font-bold">
            <span>-20</span>
            <span className="w-8 h-[1px] bg-cyan-400/20" />
            <span>-20</span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          2. COCKPIT CANOPY FRAME VIGNETTE & HEAD-UP DISPLAY GLASS
          ---------------------------------------------------- */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.7)] border-[6px] border-[#080d15]/60" />

      {/* ----------------------------------------------------
          3. FIXED BORESIGHT & FLIGHT PATH VECTOR (FPV)
          ---------------------------------------------------- */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {/* Fixed Aircraft Waterline Boresight */}
        <div className="relative flex items-center justify-center">
          <div className="w-3 h-3 border border-cyan-400/80 rounded-full" />
          <div className="absolute w-6 h-[2px] bg-cyan-400 -left-6 shadow-[0_0_8px_#00f0ff]" />
          <div className="absolute w-6 h-[2px] bg-cyan-400 -right-6 shadow-[0_0_8px_#00f0ff]" />
          <div className="absolute h-3 w-[2px] bg-cyan-400 -top-4 shadow-[0_0_8px_#00f0ff]" />
        </div>

        {/* Dynamic Flight Path Vector (FPV Bird) */}
        <div 
          className="absolute transition-transform duration-100 flex items-center justify-center text-emerald-400"
          style={{
            transform: `translate(${bankAngle * -3}px, ${(pitchAngle - 2) * -5}px)`
          }}
        >
          <div className="w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_10px_#10b981]">
            <div className="w-1 h-1 bg-emerald-400 rounded-full" />
          </div>
          <div className="absolute w-5 h-[2px] bg-emerald-400 -left-5 shadow-[0_0_8px_#10b981]" />
          <div className="absolute w-5 h-[2px] bg-emerald-400 -right-5 shadow-[0_0_8px_#10b981]" />
          <div className="absolute h-3 w-[2px] bg-emerald-400 -top-3 shadow-[0_0_8px_#10b981]" />
        </div>
      </div>

      {/* ----------------------------------------------------
          4. TOP HEADER & COMPASS HEADING TAPE + ANGLE CONTROLS
          ---------------------------------------------------- */}
      <div className="absolute top-4 inset-x-4 z-20 flex items-start justify-between">
        {/* Left: Egress Cockpit Button + Perspective Mode Selector */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={onExit}
            className="px-3 py-1.5 rounded-lg bg-black/85 hover:bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>EGRESS COCKPIT</span>
          </button>

          {/* Perspective Angle Switcher */}
          <div className="flex items-center bg-black/85 p-1 rounded-lg border border-cyan-500/40 text-[11px] font-bold">
            <button
              onClick={() => onAngleChange?.('FIRST_PERSON')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                cockpitCamAngle === 'FIRST_PERSON'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_#00f0ff]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>COCKPIT 1ST PERSON</span>
            </button>

            <button
              onClick={() => onAngleChange?.('CHASE')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                cockpitCamAngle === 'CHASE'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_#00f0ff]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>CHASE 3RD PERSON</span>
            </button>

            <button
              onClick={() => onAngleChange?.('DOWNWARD_RECON')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1.5 ${
                cockpitCamAngle === 'DOWNWARD_RECON'
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_#00f0ff]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>NADIR RECON</span>
            </button>
          </div>
        </div>

        {/* Center: Compass Heading Tape */}
        <div className="flex flex-col items-center bg-black/85 px-6 py-1.5 rounded-xl border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
          <div className="text-[10px] text-slate-400 tracking-widest font-mono uppercase">MAGNETIC HEADING</div>
          <div className="flex items-center gap-4 text-xs font-bold font-mono">
            <span className="opacity-40">{((flight.heading - 20 + 360) % 360).toString().padStart(3, '0')}°</span>
            <span className="opacity-70">{((flight.heading - 10 + 360) % 360).toString().padStart(3, '0')}°</span>
            <span className="text-white text-sm border-b-2 border-cyan-400 px-2 shadow-[0_0_10px_#00f0ff]">
              {flight.heading.toString().padStart(3, '0')}° HDG
            </span>
            <span className="opacity-70">{((flight.heading + 10) % 360).toString().padStart(3, '0')}°</span>
            <span className="opacity-40">{((flight.heading + 20) % 360).toString().padStart(3, '0')}°</span>
          </div>
        </div>

        {/* Right: Transponder & Mode Status & Nearby Contacts Roster */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="text-right bg-black/85 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-[10px] space-y-0.5 shadow-lg">
            <div className="flex items-center justify-end gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400">RIDE-ALONG TELEMETRY LOCK</span>
            </div>
            <div className="text-slate-300">CALLSIGN: <span className="text-white font-bold">{flight.callsign}</span></div>
            <div className="text-slate-400">SQUAWK: <span className="text-amber-400 font-bold">{flight.squawk}</span> | IFF: MODE-4</div>
          </div>

          {/* Collapsible Airspace Nearby Contacts List */}
          {nearbyFlights.length > 0 && (
            <div className="bg-black/90 rounded-lg border border-cyan-500/40 p-2 w-64 text-[10px] shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-cyan-500/30 pb-1 mb-1.5 font-bold text-cyan-300">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  <span>AIRSPACE CONTACTS ({nearbyFlights.length})</span>
                </div>
                <button
                  onClick={() => setShowNearbyRoster(!showNearbyRoster)}
                  className="text-[9px] text-cyan-400 hover:text-white px-1 border border-cyan-500/30 rounded"
                >
                  {showNearbyRoster ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              {showNearbyRoster && (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {nearbyFlights.map(({ flight: targetF, distNm, altDeltaStr }) => (
                    <div
                      key={targetF.id}
                      className="flex items-center justify-between p-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/40 transition-all text-[9px]"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Plane className="w-2.5 h-2.5 text-cyan-400" />
                          {targetF.callsign || targetF.aircraftType}
                        </span>
                        <span className="text-[8px] text-slate-400">
                          {distNm} NM • FL{Math.round(targetF.altitudeFt / 100)} ({altDeltaStr})
                        </span>
                      </div>
                      {onSelectFlight && (
                        <button
                          onClick={() => onSelectFlight(targetF)}
                          className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold border border-cyan-500/50 text-[8px] transition-all cursor-pointer"
                          title="Jump to this aircraft's cockpit"
                        >
                          RIDE
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------------------------------
          5. LEFT SPEED TAPE (AIRSPEED INDICATOR)
          ---------------------------------------------------- */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
        <div className="bg-black/80 border-2 border-cyan-500/50 rounded-lg p-2.5 shadow-[0_0_20px_rgba(6,182,212,0.25)] flex flex-col items-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">IAS KTS</div>
          <div className="text-xl font-black text-white px-2 py-1 bg-cyan-950/60 rounded border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            {airspeed}
          </div>
          <div className="text-[10px] text-cyan-300 font-bold mt-1.5">
            M {machNumber}
          </div>

          {/* Speed Scale Ticks */}
          <div className="mt-2 space-y-2 text-[9px] text-slate-500 font-mono text-center">
            <div>{airspeed + 40} —</div>
            <div>{airspeed + 20} —</div>
            <div className="text-cyan-400 font-bold">► {airspeed} ◄</div>
            <div>{airspeed - 20} —</div>
            <div>{airspeed - 40} —</div>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          6. RIGHT ALTITUDE TAPE (BAROMETRIC ALTIMETER)
          ---------------------------------------------------- */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
        <div className="bg-black/80 border-2 border-cyan-500/50 rounded-lg p-2.5 shadow-[0_0_20px_rgba(6,182,212,0.25)] flex flex-col items-center">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">ALT FT</div>
          <div className="text-xl font-black text-white px-2 py-1 bg-cyan-950/60 rounded border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            {altitude.toLocaleString()}
          </div>
          <div className="text-[9px] text-cyan-300 font-bold mt-1.5">
            29.92 INHG
          </div>

          {/* Altitude Scale Ticks */}
          <div className="mt-2 space-y-2 text-[9px] text-slate-500 font-mono text-center">
            <div>— {(altitude + 500).toLocaleString()}</div>
            <div>— {(altitude + 200).toLocaleString()}</div>
            <div className="text-cyan-400 font-bold">◄ {altitude.toLocaleString()} ►</div>
            <div>— {(altitude - 200).toLocaleString()}</div>
            <div>— {(altitude - 500).toLocaleString()}</div>
          </div>

          <div className="mt-2 pt-1 border-t border-slate-800 text-[9px] text-emerald-400">
            VSI: +1200 FPM
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------
          7. BOTTOM TACTICAL RADAR SCANNER & FLIGHT DOSSIER
          ---------------------------------------------------- */}
      <div className="absolute bottom-4 inset-x-4 z-20 flex items-end justify-between">
        {/* Left: Aircraft Performance & Autopilot Status */}
        <div className="bg-black/80 p-3 rounded-xl border border-cyan-500/30 text-xs space-y-1.5 max-w-sm">
          <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
            <Plane className="w-4 h-4 text-cyan-400" />
            <span>{flight.aircraftType}</span>
          </div>
          <div className="text-[10px] text-slate-300">
            OPERATOR: <span className="text-white font-bold">{flight.airline || 'Military Aviation Group'}</span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-2">
            <span>ROUTE: {flight.origin || 'ORIGIN'} ➔ {flight.destination || 'DESTINATION'}</span>
          </div>
          <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800 text-[9px]">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
              AP1 / LNAV / VNAV
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              TCAS II ONLINE
            </span>
            {flight.isMilitary && (
              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                TACTICAL LINK-16
              </span>
            )}
          </div>
        </div>

        {/* Center: Tactical Airspace Radar Scope (TWS) */}
        <div className="relative w-44 h-44 bg-black/90 rounded-full border-2 border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.3)] overflow-hidden flex items-center justify-center">
          {/* Radar Distance Rings */}
          <div className="absolute inset-4 rounded-full border border-cyan-500/20" />
          <div className="absolute inset-10 rounded-full border border-cyan-500/25" />
          <div className="absolute inset-16 rounded-full border border-cyan-500/30" />
          
          {/* Crosshairs */}
          <div className="absolute w-full h-[1px] bg-cyan-500/30" />
          <div className="absolute h-full w-[1px] bg-cyan-500/30" />

          {/* Sweeping Ray */}
          <div 
            className="absolute inset-0 origin-center pointer-events-none"
            style={{ transform: `rotate(${radarSweepDeg}deg)` }}
          >
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent to-cyan-400/40" />
          </div>

          {/* Center Ownship Dot */}
          <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981] z-10" />

          {/* Nearby Radar Target Bogeys */}
          {radarTargets.map((tgt) => (
            <div
              key={tgt.id}
              className="absolute z-10 flex flex-col items-center pointer-events-none"
              style={{
                transform: `translate(${tgt.x * 70}px, ${tgt.y * 70}px)`
              }}
            >
              <div className="w-2 h-2 bg-amber-400 rounded-sm shadow-[0_0_6px_#f59e0b]" />
              <span className="text-[7px] font-bold text-amber-300 whitespace-nowrap bg-black/80 px-0.5 rounded">
                {tgt.label} {tgt.altDelta}
              </span>
            </div>
          ))}

          <div className="absolute bottom-1 text-[8px] text-cyan-400/70 font-bold">
            RADAR 40 NM
          </div>
        </div>

        {/* Right: Bank Angle Roll Indicator */}
        <div className="bg-black/80 p-3 rounded-xl border border-cyan-500/30 text-xs text-right space-y-1 font-mono">
          <div className="text-[10px] text-slate-400 uppercase">FLIGHT DYNAMICS</div>
          <div className="text-sm font-bold text-cyan-300">
            BANK: <span className="text-white">{bankAngle > 0 ? `+${bankAngle.toFixed(1)}° R` : `${bankAngle.toFixed(1)}° L`}</span>
          </div>
          <div className="text-xs text-cyan-400">
            PITCH: <span className="text-white">+{pitchAngle.toFixed(1)}°</span>
          </div>
          <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-800">
            GPS: {flight.lat.toFixed(4)}°N, {flight.lng.toFixed(4)}°E
          </div>
        </div>
      </div>
    </div>
  );
};
export default CockpitRideAlong;
