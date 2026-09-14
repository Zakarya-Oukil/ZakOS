import React, { useState } from 'react';
import { Shield, Server, Terminal, Lock, Key, ArrowRight, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
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

export const TargetMatrixApp: React.FC<TargetMatrixAppProps> = () => {
  const [selectedHost, setSelectedHost] = useState<string>('192.168.100.52');

  const hosts: HostProfile[] = [
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

  const current = hosts.find(h => h.ip === selectedHost) || hosts[0];

  return (
    <div className="h-full flex flex-col p-4 bg-[#070a12] text-zinc-200 font-sans">
      {/* Network Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            DMZ Matrix // Subnet: 192.168.100.0/24
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">4 Windows</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">2 Linux</span>
          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold">1 Gateway (.67)</span>
        </div>
      </div>

      {/* Main Split: Host Grid (Left) & Host Dossier Details (Right) */}
      <div className="flex-1 grid grid-cols-12 gap-3 overflow-hidden">
        {/* Host Cards Grid */}
        <div className="col-span-5 space-y-2 overflow-y-auto pr-1">
          {hosts.map((h) => {
            const isSel = h.ip === selectedHost;
            return (
              <button
                key={h.ip}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedHost(h.ip);
                }}
                className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                  isSel
                    ? 'bg-red-500/15 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-white">{h.ip}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono font-bold ${
                    h.status === 'compromised' ? 'bg-red-500/20 text-red-400' :
                    h.status === 'pivot' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-zinc-700 text-zinc-300'
                  }`}>
                    {h.status}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate font-mono">{h.hostname} ({h.os.split(' ')[0]})</div>
              </button>
            );
          })}
        </div>

        {/* Selected Host Dossier */}
        <div className="col-span-7 flex flex-col rounded-xl bg-black/40 border border-white/10 p-3.5 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
            <div>
              <div className="text-sm font-bold text-white font-mono">{current.ip}</div>
              <div className="text-xs text-zinc-400 font-mono">{current.hostname} - {current.os}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 block uppercase font-mono">Open TCP Ports</span>
              <span className="text-xs font-bold text-cyan-400 font-mono">{current.ports.length} Ports</span>
            </div>
          </div>

          {/* Exposed Services */}
          <div className="mb-3">
            <span className="text-[10px] text-zinc-400 uppercase font-mono font-bold block mb-1.5">Exposed Services</span>
            <div className="flex flex-wrap gap-1.5">
              {current.services.map((s, idx) => (
                <span key={idx} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[11px] font-mono text-zinc-300">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Credential Artifacts */}
          {current.creds && (
            <div className="mb-3 p-2.5 rounded-lg bg-red-950/20 border border-red-500/30">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 font-mono mb-1">
                <Key className="w-3.5 h-3.5" />
                <span>Recovered Credentials</span>
              </div>
              <div className="font-mono text-xs text-zinc-200 bg-black/50 p-2 rounded border border-white/5 select-all">
                {current.creds}
              </div>
            </div>
          )}

          {/* Flag Artifact */}
          {current.flag && (
            <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 font-mono mb-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Proof of Compromise (Flag)</span>
              </div>
              <div className="font-mono text-xs text-emerald-300 bg-black/50 p-2 rounded border border-white/5 select-all">
                {current.flag}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
