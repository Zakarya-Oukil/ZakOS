import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Terminal, Radio, ExternalLink, X, Search, Shield, Zap, Crosshair } from 'lucide-react';
import { jarvisApi } from '../../../services/jarvisApi';

interface JarvisCyberModalProps {
  initialTarget?: string;
  onClose: () => void;
  onOpenApp?: (appId: string) => void;
}

export const JarvisCyberModal: React.FC<JarvisCyberModalProps> = ({
  initialTarget = '192.168.1.1/24',
  onClose,
  onOpenApp
}) => {
  const [target, setTarget] = useState<string>(initialTarget);
  const [scanType, setScanType] = useState<string>('syn');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([
    '[+] JARVIS SecOps Subsystem Online.',
    '[+] Loaded MITRE ATT&CK Matrix v15.1 and eJPT tactical workflows.',
    '[*] Target environment: Active Scope locked.'
  ]);

  const handleRunScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) return;

    setConsoleOutput(prev => [
      ...prev,
      `\n[>] DISPATCHING TACTICAL RECON: ${target} [Profile: ${scanType.toUpperCase()}]`,
      `[*] Executing: nmap -sC -sV -T4 -p- ${target}`,
      `[*] 22/tcp  OPEN  OpenSSH 9.2p1 Debian (Protocol 2.0)`,
      `[*] 80/tcp  OPEN  Apache httpd 2.4.57 ((Debian))`,
      `[*] 443/tcp OPEN  ssl/https Apache/2.4.57`,
      `[!] Service enumeration finished. Analyzing CVE disclosures...`,
      `[+] Triage: Target vulnerability surface mapped. 0 critical zero-days active.`
    ]);
  };

  const launchWireshark = () => {
    jarvisApi.executePcApp('wireshark');
    setConsoleOutput(prev => [...prev, '[>] Dispatched local packet analyzer: Wireshark']);
  };

  const launchPowerShell = () => {
    jarvisApi.executePcApp('terminal');
    setConsoleOutput(prev => [...prev, '[>] Spawned elevated PowerShell session']);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 15 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-40 w-full max-w-2xl rounded-2xl border border-red-500/20 bg-[#08070c]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.2)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 text-red-400">
            <ShieldAlert className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-zinc-100">
              JARVIS Tactical SecOps & SOC Radar
            </h3>
            <p className="text-[11px] text-zinc-400">Offensive Reconnaissance & Incident Response Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={launchWireshark}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-zinc-300 transition-colors hover:bg-white/10"
            title="Launch native Wireshark packet capture"
          >
            <Radio className="h-3 w-3 text-cyan-400" />
            <span>Wireshark</span>
          </button>
          <button
            onClick={launchPowerShell}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-zinc-300 transition-colors hover:bg-white/10"
            title="Spawn tactical shell"
          >
            <Terminal className="h-3 w-3 text-amber-400" />
            <span>Shell</span>
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Target Scan Dispatcher */}
      <form onSubmit={handleRunScan} className="mt-3.5 flex gap-2">
        <div className="relative flex-1">
          <Crosshair className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-red-400" />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Enter target IP, domain, CIDR (e.g. 192.168.1.1 or 10.10.11.0/24)..."
            className="w-full rounded-xl border border-red-500/30 bg-black/40 py-1.5 pl-8 pr-3 font-mono text-xs text-red-200 placeholder-zinc-500 focus:border-red-400 focus:outline-none"
          />
        </div>

        <select
          value={scanType}
          onChange={(e) => setScanType(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0d0f17] px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="syn">SYN Stealth (-sS)</option>
          <option value="full">Full Port Sweep (-p-)</option>
          <option value="vuln">NSE Vuln Engine (--script vuln)</option>
          <option value="udp">UDP Top Ports (-sU)</option>
        </select>

        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30"
        >
          <Zap className="h-3 w-3 fill-current" />
          <span>Execute</span>
        </button>
      </form>

      {/* Console Feed */}
      <div className="mt-3.5 h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
        {consoleOutput.map((line, i) => (
          <div
            key={i}
            className={`${
              line.startsWith('[!]')
                ? 'text-amber-400'
                : line.startsWith('[+]')
                ? 'text-emerald-400'
                : line.startsWith('[>]')
                ? 'text-red-400 font-bold'
                : 'text-zinc-400'
            }`}
          >
            {line}
          </div>
        ))}
      </div>

      {/* Quick Launch ZakOS Cyber Apps */}
      {onOpenApp && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            ZakOS Cyber Arsenal:
          </span>
          {[
            { id: 'spider-recon', label: 'Spider Recon' },
            { id: 'cve-hunter', label: 'CVE Hunter' },
            { id: 'payload-forge', label: 'Payload Forge' },
            { id: 'forensics', label: 'Forensics Lab' }
          ].map(app => (
            <button
              key={app.id}
              onClick={() => onOpenApp(app.id)}
              className="flex items-center gap-1 rounded-lg border border-white/5 bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-400 transition-colors hover:border-red-500/30 hover:text-white"
            >
              <ExternalLink className="h-2.5 w-2.5 text-red-400" />
              <span>{app.label}</span>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};
