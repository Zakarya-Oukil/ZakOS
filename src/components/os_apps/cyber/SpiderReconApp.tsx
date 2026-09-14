import React, { useState } from 'react';
import { Globe, Play, Square, Download, Shield, Terminal, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface SpiderReconAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface DiscoveredEndpoint {
  url: string;
  status: number;
  type: string;
  size: string;
  paramCount: number;
}

export const SpiderReconApp: React.FC<SpiderReconAppProps> = () => {
  const [targetUrl, setTargetUrl] = useState('http://192.168.100.52/drupal/');
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [endpoints, setEndpoints] = useState<DiscoveredEndpoint[]>([
    { url: '/drupal/CHANGELOG.txt', status: 200, type: 'Documentation', size: '112 KB', paramCount: 0 },
    { url: '/drupal/sites/default/settings.php', status: 403, type: 'Configuration', size: '0 B', paramCount: 0 },
    { url: '/drupal/user/login', status: 200, type: 'Auth Endpoint', size: '14.2 KB', paramCount: 3 },
    { url: '/drupal/admin', status: 403, type: 'Administrative', size: '1.2 KB', paramCount: 1 },
    { url: '/drupal/cron.php', status: 200, type: 'Cron Service', size: '48 B', paramCount: 1 }
  ]);

  const handleStartCrawl = () => {
    soundEngine.playClick();
    setIsScanning(true);
    setProgress(15);
    
    setTimeout(() => {
      setProgress(55);
      soundEngine.playCyberPing();
    }, 800);

    setTimeout(() => {
      setProgress(100);
      setIsScanning(false);
      soundEngine.playCyberPing();
      setEndpoints(prev => [
        ...prev,
        { url: '/drupal/modules/system/system.module', status: 200, type: 'Core Module', size: '84 KB', paramCount: 2 },
        { url: '/drupal/?q=user/password', status: 200, type: 'Password Reset', size: '12 KB', paramCount: 2 }
      ]);
    }, 1600);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080c14] text-zinc-200 font-sans">
      {/* Top Controls Bar */}
      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-white/10">
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 focus-within:border-red-500/50">
          <Globe className="w-4 h-4 text-red-400" />
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="Target URL / IP..."
            className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-zinc-500">Depth:</span>
          <select 
            value={crawlDepth} 
            onChange={(e) => setCrawlDepth(Number(e.target.value))}
            className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value={1}>1 (Quick)</option>
            <option value={3}>3 (Standard)</option>
            <option value={5}>5 (Aggressive Deep)</option>
          </select>
        </div>

        <button
          onClick={isScanning ? () => setIsScanning(false) : handleStartCrawl}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-mono font-bold tracking-wider transition-all ${
            isScanning 
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse' 
              : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
          }`}
        >
          {isScanning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isScanning ? 'STOP CRAWL' : 'START SPIDER'}
        </button>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className="w-full bg-white/5 h-1.5 rounded-full mb-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-red-500 to-amber-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Target Insights Overview */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono">
          <div className="text-[10px] text-zinc-500 uppercase">Tech Detected</div>
          <div className="text-xs font-bold text-red-400 mt-0.5">Drupal 7.57 / Apache</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono">
          <div className="text-[10px] text-zinc-500 uppercase">Endpoints Found</div>
          <div className="text-xs font-bold text-white mt-0.5">{endpoints.length} Routes</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono">
          <div className="text-[10px] text-zinc-500 uppercase">Vulnerable Points</div>
          <div className="text-xs font-bold text-amber-400 mt-0.5">2 Critical (CVE-2018-7600)</div>
        </div>
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 font-mono">
          <div className="text-[10px] text-zinc-500 uppercase">Crawl State</div>
          <div className="text-xs font-bold text-emerald-400 mt-0.5">Active Listener</div>
        </div>
      </div>

      {/* Endpoints Table */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/40">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-white/5 text-zinc-400 text-[10px] uppercase border-b border-white/10 sticky top-0">
            <tr>
              <th className="p-2.5">Endpoint URL</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5">Classification</th>
              <th className="p-2.5">Size</th>
              <th className="p-2.5">Params</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {endpoints.map((ep, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="p-2.5 font-bold text-white flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  {ep.url}
                </td>
                <td className="p-2.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    ep.status === 200 ? 'bg-emerald-500/20 text-emerald-400' :
                    ep.status === 403 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {ep.status}
                  </span>
                </td>
                <td className="p-2.5 text-zinc-400">{ep.type}</td>
                <td className="p-2.5 text-zinc-500">{ep.size}</td>
                <td className="p-2.5 text-cyan-400">{ep.paramCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
