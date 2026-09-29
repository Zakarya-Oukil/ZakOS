import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Server, 
  Terminal, 
  Lock, 
  Key, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  Plus, 
  Trash2, 
  Edit3, 
  Flag, 
  Check 
} from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface TargetMatrixAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface HostProfile {
  ip: string;
  hostname: string;
  os: string;
  ports: number[];
  services: string[];
  status: 'compromised' | 'vulnerable' | 'pivot' | 'hardened';
  flag?: string;
  creds?: string;
}

const DEFAULT_HOSTS: HostProfile[] = [
  {
    ip: '192.168.100.50',
    hostname: 'WINSERVER-01',
    os: 'Windows Server 2012 R2',
    ports: [80, 135, 139, 445, 3307, 3389, 5985],
    services: ['Apache 2.4.51 (PHP 7.4.26)', 'WordPress 5.9.3', 'MariaDB 10.6.5', 'SMBv1'],
    status: 'compromised',
    creds: 'WINSERVER-01\\mike:diamond'
  },
  {
    ip: '192.168.100.51',
    hostname: 'WINSERVER-02',
    os: 'Windows Server 2012 R2',
    ports: [21, 80, 135, 139, 445, 3389, 5985],
    services: ['Microsoft ftpd (Anonymous)', 'IIS 8.5 (WebDAV PUT)', 'cmdasp.aspx'],
    status: 'pivot',
    creds: 'lawrence (Local User)'
  },
  {
    ip: '192.168.100.52',
    hostname: 'ip-192-168-100-52',
    os: 'Ubuntu 20.04 LTS (5.13.0-1021-aws)',
    ports: [21, 22, 25, 80, 139, 445, 3306, 3389],
    services: ['Drupal 7.57 (Drupalgeddon2)', 'OpenSMTPD 6.6.1p1', 'MySQL 10.3.34', 'Samba'],
    status: 'compromised',
    flag: '2678f01e488e432fa0a64431b54df635',
    creds: 'drupal : syntex0421 | root : syntex0421'
  },
  {
    ip: '192.168.100.55',
    hostname: 'WINSERVER-03',
    os: 'Windows Server 2019 Datacenter',
    ports: [80, 135, 139, 445, 3389, 5985],
    services: ['IIS 10.0', 'Microsoft-DS SMB', 'Terminal Services'],
    status: 'compromised',
    flag: '2ebff64df4bf470eacb0895c64f73765',
    creds: 'Administrator:swordfish | mary:hotmama'
  },
  {
    ip: '192.168.100.63',
    hostname: 'EC2AMAZ-IK4QFED',
    os: 'Windows Server 2016',
    ports: [3389],
    services: ['RDP (Isolated)'],
    status: 'hardened'
  },
  {
    ip: '192.168.100.67',
    hostname: 'Ubuntu Bastion',
    os: 'Ubuntu 20.04 LTS',
    ports: [22],
    services: ['OpenSSH 8.2p1 (Publickey Auth Enforced)'],
    status: 'pivot'
  }
];

export const TargetMatrixApp: React.FC<TargetMatrixAppProps> = () => {
  const [hosts, setHosts] = useState<HostProfile[]>(() => {
    const saved = localStorage.getItem('zakos_target_matrix_v2');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return DEFAULT_HOSTS;
  });

  const [selectedHostIp, setSelectedHostIp] = useState<string>('192.168.100.52');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [newHostname, setNewHostname] = useState('');
  const [newOs, setNewOs] = useState('Ubuntu 22.04 LTS');
  const [newPorts, setNewPorts] = useState('80, 443, 22');
  const [newServices, setNewServices] = useState('Nginx, OpenSSH');
  const [newStatus, setNewStatus] = useState<'compromised' | 'vulnerable' | 'pivot' | 'hardened'>('vulnerable');
  const [newCreds, setNewCreds] = useState('');
  const [newFlag, setNewFlag] = useState('');

  useEffect(() => {
    localStorage.setItem('zakos_target_matrix_v2', JSON.stringify(hosts));
  }, [hosts]);

  const current = hosts.find(h => h.ip === selectedHostIp) || hosts[0];

  const handleAddHost = () => {
    if (!newIp.trim()) return;
    soundEngine.playClick();
    const portsArray = newPorts.split(',').map(p => Number(p.trim())).filter(p => !isNaN(p));
    const servicesArray = newServices.split(',').map(s => s.trim()).filter(Boolean);

    const newHost: HostProfile = {
      ip: newIp.trim(),
      hostname: newHostname.trim() || `HOST-${newIp.split('.').pop()}`,
      os: newOs.trim(),
      ports: portsArray,
      services: servicesArray,
      status: newStatus,
      creds: newCreds.trim() || undefined,
      flag: newFlag.trim() || undefined
    };

    setHosts(prev => [...prev, newHost]);
    setSelectedHostIp(newHost.ip);
    setIsAddModalOpen(false);
    setNewIp('');
    setNewHostname('');
    setNewCreds('');
    setNewFlag('');
  };

  const handleDeleteHost = (ip: string) => {
    soundEngine.playClick();
    setHosts(prev => prev.filter(h => h.ip !== ip));
    if (selectedHostIp === ip) {
      setSelectedHostIp(hosts[0]?.ip || '');
    }
  };

  const toggleHostStatus = (ip: string) => {
    soundEngine.playClick();
    const cycle: Record<HostProfile['status'], HostProfile['status']> = {
      vulnerable: 'compromised',
      compromised: 'pivot',
      pivot: 'hardened',
      hardened: 'vulnerable'
    };
    setHosts(prev => prev.map(h => h.ip === ip ? { ...h, status: cycle[h.status] } : h));
  };

  return (
    <div className="h-full min-h-0 flex flex-col p-4 bg-[#070a12] text-zinc-200 font-sans select-text">
      {/* Network Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            DMZ Matrix // Subnet Target Registry
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
            {hosts.filter(h => h.status === 'compromised').length} Compromised
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">
            {hosts.filter(h => h.status === 'pivot').length} Pivots
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold flex items-center gap-1 transition-all"
          >
            <Plus className="w-3 h-3" /> Add Host
          </button>
        </div>
      </div>

      {/* Main Split: Host List + Deep Host Dossier */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 overflow-hidden">
        {/* Left: Host List (5 cols) */}
        <div className="w-full md:w-5/12 min-h-0 flex flex-col overflow-y-auto space-y-2 pr-1 font-mono text-xs custom-scrollbar">
          {hosts.map(h => {
            const isSelected = h.ip === current?.ip;
            return (
              <div
                key={h.ip}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedHostIp(h.ip);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                    : 'bg-black/50 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      h.status === 'compromised' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]' :
                      h.status === 'pivot' ? 'bg-cyan-400' :
                      h.status === 'vulnerable' ? 'bg-amber-400' : 'bg-emerald-500'
                    }`} />
                    <span className="font-bold text-white text-xs">{h.ip}</span>
                  </div>
                  <span className={`text-[9px] uppercase px-2 py-0.5 rounded font-bold ${
                    h.status === 'compromised' ? 'bg-red-500/20 text-red-400' :
                    h.status === 'pivot' ? 'bg-cyan-500/20 text-cyan-400' :
                    h.status === 'vulnerable' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {h.status}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-400 truncate mb-1">
                  <span>{h.hostname}</span> • <span>{h.os}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>{h.ports.length} Open Ports</span>
                  {h.flag && <span className="text-amber-400 flex items-center gap-1 font-bold"><Flag className="w-3 h-3" /> Flag Captured</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Active Host Dossier (7 cols) */}
        {current && (
          <div className="w-full md:w-7/12 min-h-0 flex flex-col bg-black/60 border border-white/10 rounded-2xl p-4 overflow-y-auto custom-scrollbar font-mono text-xs">
            <div className="flex items-start justify-between pb-3 mb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold uppercase mb-1">
                  <Server className="w-3.5 h-3.5" />
                  <span>Target Dossier</span>
                </div>
                <h2 className="text-base font-bold text-white font-sans">{current.hostname} ({current.ip})</h2>
                <p className="text-xs text-zinc-400 mt-0.5">{current.os}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleHostStatus(current.ip)}
                  className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-200 text-[10px] font-bold transition-colors"
                >
                  Cycle Status
                </button>
                <button
                  onClick={() => handleDeleteHost(current.ip)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Ports & Services Matrix */}
            <div className="space-y-3 mb-4">
              <span className="text-xs text-zinc-400 uppercase font-bold tracking-wider">
                Open Services & Banners
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {current.services.map((svc, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <span className="text-zinc-200 text-[11px] truncate pr-2">{svc}</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold">
                      :{current.ports[idx] || 'TCP'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Credentials & Loot */}
            {current.creds && (
              <div className="p-3 rounded-xl bg-black/80 border border-cyan-500/30 mb-3 space-y-1">
                <span className="text-[10px] text-cyan-400 uppercase font-bold flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> Harvested Credentials:
                </span>
                <code className="text-white text-xs block font-mono">{current.creds}</code>
              </div>
            )}

            {/* CTF Flag Captured */}
            {current.flag && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <span className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5" /> CTF Proof / Flag Token:
                </span>
                <code className="text-amber-300 text-xs block font-mono select-all">{current.flag}</code>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add Target Host */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0f0914] border border-red-500/40 p-5 space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-red-400" /> Register Subnet Target
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase block mb-1">Target IP</label>
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    placeholder="192.168.100.X"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase block mb-1">Hostname</label>
                  <input
                    type="text"
                    value={newHostname}
                    onChange={(e) => setNewHostname(e.target.value)}
                    placeholder="e.g. TARGET-SRV"
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Operating System</label>
                <input
                  type="text"
                  value={newOs}
                  onChange={(e) => setNewOs(e.target.value)}
                  placeholder="Ubuntu 22.04 / Windows Server"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500 font-sans"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Open Ports (comma-separated)</label>
                <input
                  type="text"
                  value={newPorts}
                  onChange={(e) => setNewPorts(e.target.value)}
                  placeholder="80, 443, 22"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Services / Banners</label>
                <input
                  type="text"
                  value={newServices}
                  onChange={(e) => setNewServices(e.target.value)}
                  placeholder="Apache, OpenSSH"
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 uppercase block mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="vulnerable">Vulnerable</option>
                  <option value="compromised">Compromised</option>
                  <option value="pivot">Pivot</option>
                  <option value="hardened">Hardened</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-zinc-400 hover:text-white font-mono text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleAddHost}
                className="px-4 py-1.5 rounded-xl bg-red-500 hover:bg-red-400 text-black font-bold font-mono text-xs shadow-[0_0_12px_rgba(239,68,68,0.4)]"
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
