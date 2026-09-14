import React, { useState } from 'react';
import { Globe, Play, Square, Download, Shield, Terminal, CheckCircle2, AlertCircle, FileText, Server, Network, Database, Check } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';
import { api } from '../../../services/api';

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

interface PortResult {
  port: number;
  service: string;
  state: 'open' | 'filtered' | 'closed';
  version: string;
}

export const SpiderReconApp: React.FC<SpiderReconAppProps> = () => {
  const [target, setTarget] = useState('192.168.100.52');
  const [activeTab, setActiveTab] = useState<'spider' | 'dns' | 'ports' | 'export'>('spider');
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exported, setExported] = useState(false);

  const [endpoints, setEndpoints] = useState<DiscoveredEndpoint[]>([
    { url: '/drupal/CHANGELOG.txt', status: 200, type: 'Documentation (Drupal 7.54)', size: '112 KB', paramCount: 0 },
    { url: '/drupal/sites/default/settings.php', status: 403, type: 'DB Config / Credentials', size: '0 B', paramCount: 0 },
    { url: '/drupal/user/login', status: 200, type: 'Admin Auth Endpoint', size: '14.2 KB', paramCount: 3 },
    { url: '/drupal/admin', status: 403, type: 'Administrative Portal', size: '1.2 KB', paramCount: 1 },
    { url: '/drupal/cron.php', status: 200, type: 'Cron Service Trigger', size: '48 B', paramCount: 1 },
    { url: '/drupal/modules/system/system.module', status: 200, type: 'Core CMS Module', size: '84 KB', paramCount: 2 }
  ]);

  const [ports, setPorts] = useState<PortResult[]>([
    { port: 22, service: 'SSH', state: 'open', version: 'OpenSSH 7.9p1 Debian 10+deb10u2' },
    { port: 25, service: 'SMTP', state: 'open', version: 'OpenSMTPD 6.6.1p1 (CVE-2020-7247 Vulnerable)' },
    { port: 80, service: 'HTTP', state: 'open', version: 'Apache httpd 2.4.38 ((Debian))' },
    { port: 445, service: 'SMB', state: 'open', version: 'Samba smbd 4.9.5-Debian' },
    { port: 3306, service: 'MySQL', state: 'open', version: 'MariaDB 10.3.34' }
  ]);

  const [dnsRecords] = useState([
    { type: 'A', name: 'target.lab', value: '192.168.100.52', ttl: '300s' },
    { type: 'CNAME', name: 'drupal.target.lab', value: 'target.lab', ttl: '300s' },
    { type: 'MX', name: 'mail.target.lab', value: '10 mail.target.lab (192.168.100.52)', ttl: '300s' },
    { type: 'TXT', name: '_dmarc.target.lab', value: 'v=DMARC1; p=none; sp=none', ttl: '300s' }
  ]);

  const handleStartScan = () => {
    soundEngine.playClick();
    setIsScanning(true);
    setProgress(10);

    setTimeout(() => {
      setProgress(45);
      soundEngine.playCyberPing();
    }, 600);

    setTimeout(() => {
      setProgress(85);
    }, 1200);

    setTimeout(() => {
      setProgress(100);
      setIsScanning(false);
      soundEngine.playCyberPing();
      setEndpoints(prev => [
        ...prev,
        { url: '/drupal/?q=user/password', status: 200, type: 'Password Reset Fuzz Target', size: '12 KB', paramCount: 2 },
        { url: '/robots.txt', status: 200, type: 'Robots Disallow Rules', size: '1.4 KB', paramCount: 0 }
      ]);
    }, 1800);
  };

  const handleExportToVault = async () => {
    soundEngine.playClick();
    const markdown = `# Spider Recon Dossier: ${target}
**Generated on**: ${new Date().toISOString()}  
**Target IP**: \`${target}\`  
**Tags**: #pentest #recon #spider #ejpt

## 🌐 Discovered Web Endpoints
| Endpoint | Status | Classification | Size |
| :--- | :--- | :--- | :--- |
${endpoints.map(e => `| \`${e.url}\` | **${e.status}** | ${e.type} | ${e.size} |`).join('\n')}

## 🚪 Open Ports & Service Fingerprints
| Port | Service | State | Version Banner |
| :--- | :--- | :--- | :--- |
${ports.map(p => `| \`${p.port}\` | **${p.service}** | ${p.state} | \`${p.version}\` |`).join('\n')}

## 📡 DNS Reconnaissance
| Type | Record Name | Value | TTL |
| :--- | :--- | :--- | :--- |
${dnsRecords.map(d => `| **${d.type}** | \`${d.name}\` | \`${d.value}\` | ${d.ttl} |`).join('\n')}
`;

    try {
      await api.saveNote(`Cyber/Recon_${target.replace(/[^a-zA-Z0-9]/g, '_')}.md`, markdown, {
        target,
        type: 'recon-dossier',
        tags: ['pentest', 'recon', 'spider', 'ejpt']
      });
      setExported(true);
      soundEngine.playCyberPing();
      setTimeout(() => setExported(false), 3000);
    } catch (err) {
      console.error('Failed to export recon note:', err);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080c14] text-zinc-200 font-sans">
      {/* Target & Scanner Input Bar */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10 font-mono text-xs">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-white/10 focus-within:border-red-500">
          <Globe className="w-4 h-4 text-red-400" />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target IP / Domain / Subnet..."
            className="w-full bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-500">Depth:</span>
          <select
            value={crawlDepth}
            onChange={(e) => setCrawlDepth(Number(e.target.value))}
            className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-zinc-300 font-bold focus:outline-none"
          >
            <option value={1}>1 (Fast)</option>
            <option value={3}>3 (Standard)</option>
            <option value={5}>5 (Deep Spider)</option>
          </select>
        </div>

        <button
          onClick={isScanning ? () => setIsScanning(false) : handleStartScan}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all ${
            isScanning
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse'
              : 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
          }`}
        >
          {isScanning ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isScanning ? 'STOPPING...' : 'LAUNCH SPIDER'}</span>
        </button>

        <button
          onClick={handleExportToVault}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold transition-all"
        >
          {exported ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
          <span>{exported ? 'Saved to Vault!' : 'Export Dossier'}</span>
        </button>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className="w-full bg-white/5 h-1.5 rounded-full mb-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/5 font-mono text-xs">
        <button
          onClick={() => { soundEngine.playClick(); setActiveTab('spider'); }}
          className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-all ${
            activeTab === 'spider' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Web Spider ({endpoints.length})
        </button>
        <button
          onClick={() => { soundEngine.playClick(); setActiveTab('ports'); }}
          className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-all ${
            activeTab === 'ports' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Port Map ({ports.length})
        </button>
        <button
          onClick={() => { soundEngine.playClick(); setActiveTab('dns'); }}
          className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-all ${
            activeTab === 'dns' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          DNS Records ({dnsRecords.length})
        </button>
      </div>

      {/* Tab Content Display */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs custom-scrollbar">
        {activeTab === 'spider' && (
          <div className="space-y-1.5">
            {endpoints.map((ep, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    ep.status === 200 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    ep.status === 403 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {ep.status}
                  </span>
                  <div>
                    <div className="text-white font-bold">{ep.url}</div>
                    <div className="text-[10px] text-zinc-500">{ep.type}</div>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-400 font-mono">
                  <span>{ep.size}</span>
                  {ep.paramCount > 0 && <span className="ml-2 text-cyan-400">({ep.paramCount} params)</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ports' && (
          <div className="space-y-1.5">
            {ports.map((p, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-center py-1 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                    {p.port}
                  </span>
                  <div>
                    <div className="text-white font-bold">{p.service}</div>
                    <div className="text-[10px] text-zinc-400">{p.version}</div>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {p.state}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'dns' && (
          <div className="space-y-1.5">
            {dnsRecords.map((d, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-14 text-center py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/20">
                    {d.type}
                  </span>
                  <div>
                    <div className="text-white font-bold">{d.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">{d.value}</div>
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500">{d.ttl}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
