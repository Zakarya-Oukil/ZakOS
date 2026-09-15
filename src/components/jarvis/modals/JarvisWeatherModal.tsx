import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CloudRain, Sun, Cloud, Wind, Droplets, X, Search, Compass, Thermometer } from 'lucide-react';
import { jarvisApi, WeatherData } from '../../../services/jarvisApi';

interface JarvisWeatherModalProps {
  initialCity?: string;
  onClose: () => void;
}

export const JarvisWeatherModal: React.FC<JarvisWeatherModalProps> = ({ initialCity = '', onClose }) => {
  const [cityInput, setCityInput] = useState<string>(initialCity);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchWeather = async (targetCity?: string) => {
    setLoading(true);
    try {
      const data = await jarvisApi.getWeather(targetCity || undefined);
      setWeather(data);
    } catch (err) {
      console.error('Weather error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather(initialCity);
  }, [initialCity]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      fetchWeather(cityInput.trim());
    }
  };

  const getWeatherIcon = (code?: number) => {
    if (code === undefined) return <Sun className="h-8 w-8 text-amber-400" />;
    if (code === 0) return <Sun className="h-8 w-8 text-amber-400" />;
    if (code >= 1 && code <= 3) return <Cloud className="h-8 w-8 text-sky-300" />;
    if (code >= 51 && code <= 67) return <CloudRain className="h-8 w-8 text-blue-400" />;
    if (code >= 80 && code <= 82) return <CloudRain className="h-8 w-8 text-blue-500" />;
    return <Cloud className="h-8 w-8 text-zinc-300" />;
  };

  const getWeatherDesc = (code?: number) => {
    if (code === undefined) return 'Stable Atmosphere';
    if (code === 0) return 'Clear Skies & Optimal Visibility';
    if (code === 1 || code === 2) return 'Mainly Clear with Scattered Clouds';
    if (code === 3) return 'Overcast Atmosphere';
    if (code >= 51 && code <= 67) return 'Light to Moderate Precipitation';
    if (code >= 71 && code <= 77) return 'Snow Flurries';
    if (code >= 95) return 'Severe Thunderstorm Activity';
    return 'Stable Atmosphere';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full max-w-lg rounded-2xl border border-white/15 bg-[#07090e]/90 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.15)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
            <Compass className="h-4 w-4 animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS Atmospheric Radar
            </h3>
            <p className="text-[11px] text-zinc-400">Global Meteorological & Satellite Feeds</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* City Search Bar */}
      <form onSubmit={handleSearch} className="mt-3.5 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Search sector (e.g. Algiers, London, Paris, Tokyo)..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-xs text-white placeholder-zinc-500 focus:border-sky-400/50 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl border border-sky-500/30 bg-sky-500/20 px-3 py-1.5 text-xs font-medium text-sky-300 transition-colors hover:bg-sky-500/30"
        >
          Query
        </button>
      </form>

      {loading ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500/20 border-t-sky-400" />
          <span className="font-mono text-xs text-zinc-400">Syncing satellite telemetry...</span>
        </div>
      ) : weather ? (
        <div className="mt-4 space-y-4">
          {/* Main Weather Card */}
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-sky-950/30 to-blue-950/20 p-4">
            <div>
              <div className="text-xs font-medium text-sky-300">{weather.city}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tracking-tight text-white">
                  {Math.round(weather.current.temperature_2m ?? 20)}°C
                </span>
                <span className="text-xs text-zinc-400">
                  Feels like {Math.round(weather.current.apparent_temperature ?? 20)}°C
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-300">
                {getWeatherDesc(weather.current.weather_code)}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center">
              {getWeatherIcon(weather.current.weather_code)}
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
              <Droplets className="mx-auto mb-1 h-3.5 w-3.5 text-sky-400" />
              <div className="text-[10px] text-zinc-400">Humidity</div>
              <div className="mt-0.5 font-mono font-semibold text-zinc-200">
                {weather.current.relative_humidity_2m ?? 50}%
              </div>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
              <Wind className="mx-auto mb-1 h-3.5 w-3.5 text-teal-400" />
              <div className="text-[10px] text-zinc-400">Wind Velocity</div>
              <div className="mt-0.5 font-mono font-semibold text-zinc-200">
                {weather.current.wind_speed_10m ?? 10} km/h
              </div>
            </div>

            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
              <Thermometer className="mx-auto mb-1 h-3.5 w-3.5 text-amber-400" />
              <div className="text-[10px] text-zinc-400">Precipitation</div>
              <div className="mt-0.5 font-mono font-semibold text-zinc-200">
                {weather.current.precipitation ?? 0} mm
              </div>
            </div>
          </div>

          {/* Daily Forecast Strip */}
          {weather.daily && weather.daily.time && (
            <div className="rounded-xl border border-white/5 bg-black/20 p-2.5">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                5-Day Horizon
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px]">
                {weather.daily.time.slice(0, 5).map((t, idx) => {
                  const dayName = new Date(t).toLocaleDateString('en-US', { weekday: 'short' });
                  const maxTemp = weather.daily?.temperature_2m_max?.[idx] ?? 22;
                  const minTemp = weather.daily?.temperature_2m_min?.[idx] ?? 14;
                  return (
                    <div key={idx} className="rounded border border-white/5 bg-white/[0.02] p-1.5">
                      <div className="font-semibold text-zinc-300">{dayName}</div>
                      <div className="mt-1 text-zinc-100">{Math.round(maxTemp)}°</div>
                      <div className="text-[9px] text-zinc-500">{Math.round(minTemp)}°</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
};
