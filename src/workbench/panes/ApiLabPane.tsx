import React, { useState } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { Send, Globe, Search, Play, CheckCircle, AlertCircle, Clock, Copy } from 'lucide-react';

interface ApiLabPaneProps {
  theme: ProfileThemeTokens;
}

interface PublicApiPreset {
  id: string;
  name: string;
  category: string;
  method: 'GET' | 'POST';
  url: string;
  auth: 'None' | 'ApiKey';
  description: string;
}

const PUBLIC_API_PRESETS: PublicApiPreset[] = [
  {
    id: 'adsb',
    name: 'Military ADS-B Flight Stream',
    category: 'Security / Intel',
    method: 'GET',
    url: '/api/geoint/adsb',
    auth: 'None',
    description: 'Real-time military transponder telemetry stream via ADS-B Exchange proxy.',
  },
  {
    id: 'usgs',
    name: 'USGS Real-Time Earthquakes',
    category: 'Geoint / Science',
    method: 'GET',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
    auth: 'None',
    description: 'Worldwide M1.0+ seismic telemetry updated every minute.',
  },
  {
    id: 'daemons',
    name: 'CyberOS Background Daemons',
    category: 'ZakOS Internal',
    method: 'GET',
    url: '/api/cyber/daemons',
    auth: 'None',
    description: 'Internal C2 daemon process manager and process telemetry.',
  },
  {
    id: 'listeners',
    name: 'Active Reverse Shell Listeners',
    category: 'ZakOS Internal',
    method: 'GET',
    url: '/api/cyber/listeners',
    auth: 'None',
    description: 'Active socket handlers and reverse shell listener status.',
  },
  {
    id: 'coingecko',
    name: 'CoinGecko Crypto Simple Price',
    category: 'Finance / Web3',
    method: 'GET',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd',
    auth: 'None',
    description: 'Live cryptocurrency market rates.',
  },
  {
    id: 'ipapi',
    name: 'IP Geolocation & ASN Lookup',
    category: 'Reconnaissance',
    method: 'GET',
    url: 'https://ipapi.co/json/',
    auth: 'None',
    description: 'Client public IP, autonomous system number, and city coordinates.',
  },
];

export const ApiLabPane: React.FC<ApiLabPaneProps> = ({ theme }) => {
  const [url, setUrl] = useState<string>(PUBLIC_API_PRESETS[0].url);
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [responseJson, setResponseJson] = useState<string>('// Click SEND REQUEST or select an API preset to execute');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const executeRequest = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus(null);
    setLatencyMs(null);

    const start = performance.now();
    try {
      const res = await fetch(url, { method });
      const elapsed = Math.round(performance.now() - start);
      setStatus(res.status);
      setLatencyMs(elapsed);

      const data = await res.json().catch(() => ({ message: 'Non-JSON response received' }));
      setResponseJson(JSON.stringify(data, null, 2));
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      setStatus(0);
      setLatencyMs(elapsed);
      setResponseJson(JSON.stringify({ error: err.message || 'Network fetch failed (CORS or server offline)' }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: PublicApiPreset) => {
    setUrl(preset.url);
    setMethod(preset.method);
  };

  const filteredPresets = PUBLIC_API_PRESETS.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full font-mono text-xs overflow-hidden select-none">
      {/* Left Presets Catalog (Public APIs directory) */}
      <div
        className="w-60 h-full border-r flex flex-col shrink-0"
        style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}
      >
        <div className="p-2 border-b space-y-1.5" style={{ borderColor: theme.borderPrimary }}>
          <div className="flex items-center gap-1.5 font-bold text-white text-[11px]">
            <Globe className="w-3.5 h-3.5 text-yellow-500" />
            <span>PUBLIC APIS DIRECTORY</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter APIs..."
              className="w-full px-2 py-1 rounded bg-black border border-neutral-700 text-[10px] text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/40">
          {filteredPresets.map((preset) => (
            <div
              key={preset.id}
              onClick={() => loadPreset(preset)}
              className="p-2 cursor-pointer hover:bg-black/30 transition-colors space-y-0.5"
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold text-white truncate">{preset.name}</span>
                <span className="px-1 py-0.2 rounded bg-yellow-950/60 text-yellow-400 text-[8px] border border-yellow-800/40 font-bold">
                  {preset.method}
                </span>
              </div>
              <p className="text-[9px] text-neutral-400 truncate">{preset.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Request & Response Console */}
      <div className="flex-1 h-full flex flex-col overflow-hidden" style={{ backgroundColor: theme.bgPanel }}>
        {/* Request Input Bar */}
        <div
          className="p-2 border-b flex items-center gap-2"
          style={{ backgroundColor: theme.bgSecondary, borderColor: theme.borderPrimary }}
        >
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="px-2 py-1 rounded bg-black border border-neutral-700 text-yellow-400 font-bold text-xs cursor-pointer"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="flex-1 px-3 py-1 rounded bg-black border border-neutral-700 text-white font-mono text-xs focus:outline-none"
          />

          <button
            onClick={executeRequest}
            disabled={loading}
            className="px-4 py-1 rounded bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{loading ? 'FETCHING...' : 'SEND'}</span>
          </button>
        </div>

        {/* Response Status Ribbon */}
        <div
          className="px-3 py-1 border-b flex items-center justify-between text-[10px]"
          style={{ backgroundColor: theme.bgPrimary, borderColor: theme.borderPrimary }}
        >
          <div className="flex items-center gap-3">
            <span className="text-neutral-500">STATUS:</span>
            {status !== null ? (
              <span className={`font-bold ${status >= 200 && status < 300 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {status === 0 ? 'CONNECTION FAILED' : `${status} ${status === 200 ? 'OK' : ''}`}
              </span>
            ) : (
              <span className="text-neutral-500">—</span>
            )}

            {latencyMs !== null && (
              <span className="text-neutral-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-neutral-500" />
                <span>{latencyMs} ms</span>
              </span>
            )}
          </div>

          <button
            onClick={() => navigator.clipboard.writeText(responseJson)}
            className="flex items-center gap-1 text-neutral-400 hover:text-white cursor-pointer"
            title="Copy Response Body"
          >
            <Copy className="w-3 h-3" />
            <span>COPY</span>
          </button>
        </div>

        {/* Response JSON Inspector */}
        <div className="flex-1 w-full h-full p-3 overflow-y-auto bg-[#020408]">
          <pre className="text-[11px] leading-relaxed text-slate-300 font-mono whitespace-pre-wrap">
            {responseJson}
          </pre>
        </div>
      </div>
    </div>
  );
};
