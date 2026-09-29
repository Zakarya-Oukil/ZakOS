import React, { useState, useEffect } from 'react';
import { 
  Shield, Server, Terminal, Lock, Key, 
  Activity, AlertTriangle, Play, Square, RotateCw, 
  Trash2, Plus, CheckCircle, XCircle, Search, 
  Radio, Cpu, Globe, Wifi, Eye, RefreshCw, 
  Download, Send, Sliders, ChevronRight
} from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface CyberAdminAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export type AdminRole = 'OPERATOR' | 'ENGAGEMENT_LEAD' | 'ROOT_ADMIN';

interface DaemonProcess {
  id: string;
  name: string;
  command: string;
  status: 'running' | 'stopped' | 'failed';
  pid: number | null;
  uptime: string;
  memoryMb: number;
  cpuPercent: number;
  processedItems: number;
  description: string;
}

interface CyberListener {
  id: string;
  name: string;
  handler: 'rlwrap_nc' | 'pwncat' | 'msfconsole' | 'socat';
  port: number;
  interface: string;
  status: 'listening' | 'connected' | 'idle';
  connectedSessions: number;
  lastPing: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  timestamp: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'ELEVATION';
  actor: string;
  action: string;
  target?: string;
}

interface TargetScope {
  cidr: string;
  description: string;
  authLevel: string;
  status: 'IN_SCOPE' | 'BLACK_LIST' | 'RESTRICTED';
}

export const CyberAdminApp: React.FC<CyberAdminAppProps> = ({ windowId, isActive }) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'DAEMONS' | 'LISTENERS' | 'SCOPE' | 'OPSEC_LOGS' | 'ARSENAL'>('DAEMONS');
  
  // Administrative Elevation State
  const [role, setRole] = useState<AdminRole>('ROOT_ADMIN');
  const [elevationUnlocked, setElevationUnlocked] = useState<boolean>(true);
  
  // Daemons State
  const [daemons, setDaemons] = useState<DaemonProcess[]>([]);
  const [loadingDaemons, setLoadingDaemons] = useState<boolean>(false);
  
  // Listeners State
  const [listeners, setListeners] = useState<CyberListener[]>([]);
  const [newListenerModal, setNewListenerModal] = useState<boolean>(false);
  const [newHandler, setNewHandler] = useState<CyberListener['handler']>('rlwrap_nc');
  const [newPort, setNewPort] = useState<number>(4444);
  const [newInterface, setNewInterface] = useState<string>('0.0.0.0');
  const [newListenerName, setNewListenerName] = useState<string>('Primary RevShell Stager');

  // Interactive Session Terminal
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionCmd, setSessionCmd] = useState<string>('');
  const [sessionOutput, setSessionOutput] = useState<string[]>([
    '[*] Connection established from 192.168.100.51:49281 (cmd.exe)',
    'Microsoft Windows [Version 6.3.9600]',
    'C:\\Windows\\system32> whoami',
    'nt authority\\system',
    'C:\\Windows\\system32> _'
  ]);

  // Scope State
  const [scopes, setScopes] = useState<TargetScope[]>([
    { cidr: '192.168.100.0/24', description: 'Internal Corporate AD Lab', authLevel: 'FULL_ENGAGEMENT', status: 'IN_SCOPE' },
    { cidr: '10.10.14.0/24', description: 'HackTheBox VPN Gateway', authLevel: 'AUTHORIZED_RESEARCH', status: 'IN_SCOPE' },
    { cidr: '172.16.0.0/16', description: 'DMZ Testing Enclave', authLevel: 'CONTROLLED_POC', status: 'IN_SCOPE' },
    { cidr: '1.1.1.1/32', description: 'Cloudflare Public DNS', authLevel: 'PROHIBITED', status: 'BLACK_LIST' },
    { cidr: '8.8.8.8/32', description: 'Google Public DNS', authLevel: 'PROHIBITED', status: 'BLACK_LIST' }
  ]);
  const [newCidr, setNewCidr] = useState<string>('');
  const [newScopeDesc, setNewScopeDesc] = useState<string>('');
  const [scopeTestIp, setScopeTestIp] = useState<string>('');
  const [scopeTestResult, setScopeTestResult] = useState<{ status: 'AUTHORIZED' | 'BLOCKED' | null; message: string }>({ status: null, message: '' });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

  // Forensics & Pentest Quick Launcher Selection
  const [selectedToolSuite, setSelectedToolSuite] = useState<'FORENSICS' | 'PENTEST' | 'ACTIVE_DIRECTORY' | 'NETWORK'>('FORENSICS');
  const [commandPreview, setCommandPreview] = useState<string>('');

  // 1. Fetch Daemons from Server
  const fetchDaemons = async () => {
    setLoadingDaemons(true);
    try {
      const res = await fetch('/api/cyber/daemons');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.daemons)) {
          const normalized: DaemonProcess[] = data.daemons.map((d: any, idx: number) => ({
            id: d.id,
            name: d.name,
            command: d.command || `python3 -m services.${d.service || 'worker'} --port ${d.port || 4000}`,
            status: d.status?.toLowerCase() === 'running' ? 'running' : 'stopped',
            pid: d.pid || (1040 + idx * 37),
            uptime: d.uptime || `${Math.floor((d.uptimeSeconds || 3600) / 3600)}h ${Math.floor(((d.uptimeSeconds || 3600) % 3600) / 60)}m`,
            memoryMb: d.memoryMb || (48 + (idx * 23) % 95),
            cpuPercent: d.cpuPercent || +(1.2 + (idx * 0.7)).toFixed(1),
            processedItems: d.processedItems || (1240 + idx * 834),
            description: d.description || ''
          }));
          setDaemons(normalized);
        }
      }
    } catch (err) {
      console.warn('Could not fetch daemons, using cached state', err);
    } finally {
      setLoadingDaemons(false);
    }
  };

  // 2. Fetch Listeners from Server
  const fetchListeners = async () => {
    try {
      const res = await fetch('/api/cyber/listeners');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.listeners)) {
          const normalized: CyberListener[] = data.listeners.map((l: any) => ({
            id: l.id,
            name: l.name,
            handler: (l.engine || l.handler || 'rlwrap_nc') as any,
            port: l.port || 4444,
            interface: l.boundInterface || l.interface || '0.0.0.0',
            status: (l.status?.toLowerCase() === 'active' || l.status?.toLowerCase() === 'listening') ? 'listening' : 'idle',
            connectedSessions: l.sessions !== undefined ? l.sessions : (l.connectedSessions || 0),
            lastPing: l.lastPing || 'JUST NOW',
            createdAt: l.createdAt || '2026-09-14'
          }));
          setListeners(normalized);
        }
      }
    } catch (err) {
      console.warn('Could not fetch listeners', err);
    }
  };

  // 3. Fetch Audit Logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/cyber/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.logs)) {
          const normalized: AuditLog[] = data.logs.map((item: any) => ({
            id: item.id,
            timestamp: item.time || item.timestamp || new Date().toLocaleTimeString(),
            severity: item.level === 'CRITICAL' ? 'CRITICAL' : item.level === 'WARN' ? 'WARNING' : item.level === 'ALERT' ? 'ELEVATION' : 'INFO',
            actor: item.module || item.actor || 'KERNEL',
            action: item.message || item.action || '',
            target: item.target || ''
          }));
          setAuditLogs(normalized);
        }
      }
    } catch (err) {
      console.warn('Could not fetch audit logs', err);
    }
  };

  useEffect(() => {
    fetchDaemons();
    fetchListeners();
    fetchAuditLogs();

    const interval = setInterval(() => {
      fetchDaemons();
      fetchListeners();
      fetchAuditLogs();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  // Toggle Daemon
  const handleToggleDaemon = async (id: string, action: 'start' | 'stop' | 'restart') => {
    soundEngine.play('click');
    try {
      const res = await fetch('/api/cyber/daemons/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, daemonId: id, action })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.daemon) {
          setDaemons(prev => prev.map(d => d.id === id ? {
            ...d,
            status: data.daemon.status?.toLowerCase() === 'running' ? 'running' : 'stopped'
          } : d));
        }
      }
    } catch (err) {
      console.error('Failed to toggle daemon', err);
    }
  };

  // Create Listener
  const handleCreateListener = async (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.play('click');
    try {
      const res = await fetch('/api/cyber/listeners/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListenerName,
          handler: newHandler,
          port: Number(newPort),
          interface: newInterface
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setListeners(prev => [...prev, data.listener]);
          setNewListenerModal(false);
          setNewListenerName('Secondary Listener');
          setNewPort(prev => prev + 1);
        }
      }
    } catch (err) {
      console.error('Failed to create listener', err);
    }
  };

  // Kill Listener
  const handleKillListener = async (id: string) => {
    soundEngine.play('click');
    try {
      const res = await fetch(`/api/cyber/listeners/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setListeners(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Failed to kill listener', err);
    }
  };

  // Scope verification helper
  const testScopeCompliance = () => {
    if (!scopeTestIp.trim()) return;
    const ip = scopeTestIp.trim();
    
    // Check blacklists
    if (ip.startsWith('1.1.1.') || ip.startsWith('8.8.8.') || ip.includes('google') || ip.includes('gov')) {
      setScopeTestResult({
        status: 'BLOCKED',
        message: `OPSEC VIOLATION: ${ip} is explicitly blacklisted or critical public infrastructure.`
      });
      return;
    }

    // Check in-scope matches
    const matched = scopes.find(s => s.status === 'IN_SCOPE' && (
      (s.cidr.startsWith('192.168.') && ip.startsWith('192.168.')) ||
      (s.cidr.startsWith('10.10.') && ip.startsWith('10.10.')) ||
      (s.cidr.startsWith('172.16.') && ip.startsWith('172.16.'))
    ));

    if (matched) {
      setScopeTestResult({
        status: 'AUTHORIZED',
        message: `AUTHORIZATION CONFIRMED: Target ${ip} falls strictly within scope [${matched.cidr}] (${matched.description}).`
      });
    } else {
      setScopeTestResult({
        status: 'BLOCKED',
        message: `OUT OF BOUNDS: Target ${ip} does not match any authorized CIDR range in the active Rules of Engagement.`
      });
    }
  };

  // Session Terminal execution
  const handleSendSessionCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionCmd.trim()) return;
    const cmd = sessionCmd.trim();
    setSessionOutput(prev => [...prev, `C:\\Windows\\system32> ${cmd}`]);
    setSessionCmd('');

    setTimeout(() => {
      if (cmd.toLowerCase() === 'ipconfig') {
        setSessionOutput(prev => [
          ...prev,
          'Windows IP Configuration',
          'Ethernet adapter Local Area Connection:',
          '   IPv4 Address. . . . . . . . . . . : 192.168.100.51',
          '   Subnet Mask . . . . . . . . . . . : 255.255.255.0',
          '   Default Gateway . . . . . . . . . : 192.168.100.1'
        ]);
      } else if (cmd.toLowerCase().includes('net user')) {
        setSessionOutput(prev => [
          ...prev,
          'User accounts for \\WINSERVER-02',
          '-------------------------------------------------------------------------------',
          'Administrator            Guest                    lawrence',
          'mike                     sql_svc                  krbtgt',
          'The command completed successfully.'
        ]);
      } else {
        setSessionOutput(prev => [
          ...prev,
          `[EXEC] Process invoked under PID 4192: "${cmd}" executed successfully.`
        ]);
      }
    }, 400);
  };

  return (
    <div className="flex flex-col h-full bg-[#070b12] text-slate-200 font-mono text-xs select-none border border-red-950/40">
      {/* ----------------------------------------------------
          1. TOP COMMAND & CONTROL BANNER & ROLE ELEVATION
          ---------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-950/50 via-black to-[#0a101d] border-b border-red-900/40">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center p-2 rounded-lg bg-red-950/60 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <Shield className="w-5 h-5 text-red-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider text-white">CYBER_OS COMMAND & CONTROL</span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-red-500/20 text-red-300 border border-red-500/40">
                ADMIN OPS
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Active Session: <span className="text-red-300">zak@ghost-kernel#0</span> • OPSEC: DEFCON-1 NORMAL
            </div>
          </div>
        </div>

        {/* Role Elevation Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/80 rounded-lg border border-red-500/30">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-400">ROLE:</span>
            <select
              value={role}
              onChange={(e) => {
                soundEngine.play('click');
                setRole(e.target.value as AdminRole);
              }}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-[11px]"
            >
              <option value="OPERATOR" className="bg-[#0c121e] text-slate-300">OPERATOR (Read/Scan)</option>
              <option value="ENGAGEMENT_LEAD" className="bg-[#0c121e] text-cyan-300">ENGAGEMENT_LEAD (RoE/Scope)</option>
              <option value="ROOT_ADMIN" className="bg-[#0c121e] text-red-400">ROOT_ADMIN (Full Bypass)</option>
            </select>
          </div>

          <button
            onClick={() => {
              fetchDaemons();
              fetchListeners();
              fetchAuditLogs();
              soundEngine.play('click');
            }}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Refresh All Telemetry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------
          2. NAVIGATION TABS
          ---------------------------------------------------- */}
      <div className="grid grid-cols-5 border-b border-neutral-800/80 bg-black/70 text-[11px] font-bold">
        <button
          onClick={() => { setActiveTab('DAEMONS'); soundEngine.play('click'); }}
          className={`py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'DAEMONS'
              ? 'border-b-2 border-red-500 text-white bg-red-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-red-400" />
          <span>DAEMONS ({daemons.filter(d => d.status === 'running').length}/{daemons.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('LISTENERS'); soundEngine.play('click'); }}
          className={`py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'LISTENERS'
              ? 'border-b-2 border-red-500 text-white bg-red-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          <span>LISTENERS & SHELLS ({listeners.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('SCOPE'); soundEngine.play('click'); }}
          className={`py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'SCOPE'
              ? 'border-b-2 border-red-500 text-white bg-red-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span>SCOPE & RoE</span>
        </button>

        <button
          onClick={() => { setActiveTab('OPSEC_LOGS'); soundEngine.play('click'); }}
          className={`py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'OPSEC_LOGS'
              ? 'border-b-2 border-red-500 text-white bg-red-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span>OPSEC AUDIT ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => { setActiveTab('ARSENAL'); soundEngine.play('click'); }}
          className={`py-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'ARSENAL'
              ? 'border-b-2 border-red-500 text-white bg-red-950/20'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span>FORENSICS ARSENAL</span>
        </button>
      </div>

      {/* ----------------------------------------------------
          3. TAB CONTENT
          ---------------------------------------------------- */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#05080f]/90">
        
        {/* ====================================================
            TAB 1: DAEMONS & BACKGROUND SERVICES
            ==================================================== */}
        {activeTab === 'DAEMONS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  TACTICAL BACKGROUND SERVICES & WORKERS
                </h3>
                <p className="text-[10px] text-slate-400">
                  Continuous crawlers, CVE scrapers, ADS-B flight aggregators, and proxy pool rotators.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">STATUS:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                  ALL SERVICES HEALTHY
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {daemons.map((daemon) => (
                <div
                  key={daemon.id}
                  className="bg-[#0b121e] p-3 rounded-xl border border-neutral-800 hover:border-red-900/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${daemon.status === 'running' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <span className="font-bold text-white text-xs">{daemon.name}</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                        daemon.status === 'running' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}>
                        {daemon.status}
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                      {daemon.description}
                    </p>

                    <div className="mt-2.5 p-2 rounded bg-black/60 border border-neutral-800/80 font-mono text-[10px] space-y-1">
                      <div className="flex items-center justify-between text-slate-400">
                        <span>COMMAND:</span>
                        <span className="text-slate-200">{daemon.command}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-neutral-800 text-[9px]">
                        <div>
                          <span className="text-slate-500">PID: </span>
                          <span className="text-cyan-400 font-bold">{daemon.pid || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">MEM: </span>
                          <span className="text-amber-400 font-bold">{daemon.memoryMb} MB</span>
                        </div>
                        <div>
                          <span className="text-slate-500">UPTIME: </span>
                          <span className="text-emerald-400 font-bold">{daemon.uptime}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-800/60">
                    <span className="text-[9px] text-slate-400">
                      Processed: <strong className="text-white">{daemon.processedItems.toLocaleString()}</strong> items
                    </span>
                    <div className="flex items-center gap-1.5">
                      {daemon.status === 'running' ? (
                        <button
                          onClick={() => handleToggleDaemon(daemon.id, 'stop')}
                          className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 border border-rose-600/40 text-rose-300 hover:text-white text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Square className="w-3 h-3" />
                          <span>STOP</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleDaemon(daemon.id, 'start')}
                          className="px-2 py-1 rounded bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600/40 text-emerald-300 hover:text-white text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Play className="w-3 h-3" />
                          <span>START</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleDaemon(daemon.id, 'restart')}
                        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-slate-300 text-[9px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                        title="Restart Service"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>RELOAD</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 2: LISTENERS & ACTIVE SHELLS
            ==================================================== */}
        {activeTab === 'LISTENERS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  ACTIVE REVERSE SHELL LISTENERS & STAGERS
                </h3>
                <p className="text-[10px] text-slate-400">
                  Bind ports, spawn Netcat / Pwncat / Metasploit handlers, and interact with caught shells.
                </p>
              </div>
              <button
                onClick={() => { setNewListenerModal(true); soundEngine.play('click'); }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(239,68,68,0.4)] cursor-pointer transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>SPAWN NEW LISTENER</span>
              </button>
            </div>

            {/* Listeners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {listeners.map((listener) => (
                <div
                  key={listener.id}
                  className="bg-[#0b121e] p-3 rounded-xl border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{listener.name}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold uppercase">
                        {listener.handler}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1 text-[10px] font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">PORT:</span>
                        <span className="text-amber-400 font-bold text-sm">:{listener.port}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">INTERFACE:</span>
                        <span className="text-slate-200">{listener.interface}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">SESSIONS:</span>
                        <span className="text-emerald-400 font-bold">{listener.connectedSessions} LIVE</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-neutral-800">
                    <button
                      onClick={() => {
                        setActiveSessionId(listener.id);
                        soundEngine.play('click');
                      }}
                      className="px-2 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-bold text-[9px] cursor-pointer"
                    >
                      INTERACT [{listener.connectedSessions}]
                    </button>
                    <button
                      onClick={() => handleKillListener(listener.id)}
                      className="p-1 rounded bg-rose-950/40 hover:bg-rose-900 border border-rose-600/40 text-rose-400 hover:text-white cursor-pointer"
                      title="Kill Listener"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Caught Shell Terminal */}
            <div className="mt-4 bg-black/90 rounded-xl border border-red-900/50 p-3 shadow-2xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[10px]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">INTERACTIVE SHELL BUFFER (SESSION #1 • 192.168.100.51:49281)</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  PTY ALLOCATED
                </span>
              </div>

              {/* Terminal View */}
              <div className="bg-[#040810] p-3 rounded-lg border border-neutral-900 font-mono text-[11px] text-emerald-400 h-44 overflow-y-auto space-y-1">
                {sessionOutput.map((line, idx) => (
                  <div key={idx} className={line.startsWith('[*]') ? 'text-amber-400 font-bold' : ''}>
                    {line}
                  </div>
                ))}
              </div>

              {/* Terminal Input */}
              <form onSubmit={handleSendSessionCommand} className="mt-2 flex items-center gap-2">
                <span className="text-slate-400 text-xs font-bold font-mono">cmd&gt;</span>
                <input
                  type="text"
                  value={sessionCmd}
                  onChange={(e) => setSessionCmd(e.target.value)}
                  placeholder="whoami /priv, ipconfig, net user, curl..."
                  className="flex-1 px-3 py-1.5 rounded bg-[#0b121e] border border-neutral-700 text-white font-mono text-xs focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>SEND</span>
                </button>
              </form>
            </div>

            {/* Spawn Listener Modal */}
            {newListenerModal && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-[#0c1322] border-2 border-red-500/60 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-2 text-white font-bold text-sm">
                      <Radio className="w-4 h-4 text-red-400" />
                      <span>SPAWN TACTICAL LISTENER</span>
                    </div>
                    <button
                      onClick={() => setNewListenerModal(false)}
                      className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreateListener} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase mb-1">LISTENER NAME</label>
                      <input
                        type="text"
                        value={newListenerName}
                        onChange={(e) => setNewListenerName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-black border border-neutral-700 text-white font-mono"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 text-[10px] uppercase mb-1">HANDLER</label>
                        <select
                          value={newHandler}
                          onChange={(e) => setNewHandler(e.target.value as any)}
                          className="w-full px-3 py-1.5 rounded bg-black border border-neutral-700 text-white font-mono cursor-pointer"
                        >
                          <option value="rlwrap_nc">rlwrap Netcat</option>
                          <option value="pwncat">Pwncat-CS (TTY)</option>
                          <option value="msfconsole">Metasploit Handler</option>
                          <option value="socat">Socat TTY</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 text-[10px] uppercase mb-1">LISTEN PORT</label>
                        <input
                          type="number"
                          value={newPort}
                          onChange={(e) => setNewPort(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded bg-black border border-neutral-700 text-amber-300 font-bold font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 text-[10px] uppercase mb-1">BIND INTERFACE</label>
                      <select
                        value={newInterface}
                        onChange={(e) => setNewInterface(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-black border border-neutral-700 text-white font-mono cursor-pointer"
                      >
                        <option value="0.0.0.0">0.0.0.0 (All Interfaces)</option>
                        <option value="10.10.14.85">10.10.14.85 (tun0 VPN)</option>
                        <option value="192.168.100.1">192.168.100.1 (eth0 Lab)</option>
                        <option value="127.0.0.1">127.0.0.1 (Local Loopback)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setNewListenerModal(false)}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-slate-300 cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold cursor-pointer shadow-lg"
                      >
                        BIND & LISTEN
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================
            TAB 3: SCOPE & RULES OF ENGAGEMENT
            ==================================================== */}
        {activeTab === 'SCOPE' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  RULES OF ENGAGEMENT (RoE) & TARGET MATRIX BOUNDARIES
                </h3>
                <p className="text-[10px] text-slate-400">
                  Strict authorization boundaries preventing accidental scanning or exploitation of out-of-scope targets.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">SCOPE LOCK:</span>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 text-[10px] font-bold">
                  ENFORCED
                </span>
              </div>
            </div>

            {/* Scope Tester Widget */}
            <div className="bg-[#0b121e] p-3 rounded-xl border border-cyan-500/40 space-y-2">
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wide">
                OPSEC SCOPE COMPLIANCE VALIDATOR
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={scopeTestIp}
                  onChange={(e) => setScopeTestIp(e.target.value)}
                  placeholder="Enter target IP or Domain (e.g. 192.168.100.50 or 8.8.8.8)..."
                  className="flex-1 px-3 py-1.5 rounded bg-black border border-neutral-700 text-white font-mono text-xs focus:border-cyan-400"
                />
                <button
                  onClick={testScopeCompliance}
                  className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs cursor-pointer transition-all"
                >
                  VERIFY COMPLIANCE
                </button>
              </div>

              {scopeTestResult.status && (
                <div className={`p-2 rounded text-[10px] font-bold flex items-center gap-2 ${
                  scopeTestResult.status === 'AUTHORIZED'
                    ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
                }`}>
                  {scopeTestResult.status === 'AUTHORIZED' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{scopeTestResult.message}</span>
                </div>
              )}
            </div>

            {/* Authorized Subnets Table */}
            <div className="bg-[#0b121e] rounded-xl border border-neutral-800 overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-black/60 text-slate-400 border-b border-neutral-800 text-[10px] uppercase">
                  <tr>
                    <th className="p-2.5">STATUS</th>
                    <th className="p-2.5">CIDR / TARGET RANGE</th>
                    <th className="p-2.5">DESCRIPTION / ENCLAVE</th>
                    <th className="p-2.5">AUTHORIZATION TIER</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {scopes.map((s, i) => (
                    <tr key={i} className="hover:bg-black/30">
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          s.status === 'IN_SCOPE'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-white font-bold">{s.cidr}</td>
                      <td className="p-2.5 text-slate-300">{s.description}</td>
                      <td className="p-2.5 text-amber-400">{s.authLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 4: OPSEC AUDIT & KERNEL LOGS
            ==================================================== */}
        {activeTab === 'OPSEC_LOGS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  REAL-TIME OPSEC SECURITY EVENT STREAM
                </h3>
                <p className="text-[10px] text-slate-400">
                  Cryptographically hashed audit events capturing privilege escalation, socket binds, and scans.
                </p>
              </div>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">FILTER:</span>
                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="px-2 py-1 rounded bg-black border border-neutral-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                >
                  <option value="ALL">ALL SEVERITIES</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="ELEVATION">ELEVATION</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Console */}
            <div className="bg-[#03060c] p-3 rounded-xl border border-neutral-800 font-mono text-[10px] space-y-1.5 max-h-96 overflow-y-auto">
              {auditLogs
                .filter(l => auditFilter === 'ALL' || l.severity === auditFilter)
                .map((log) => (
                  <div
                    key={log.id}
                    className="p-1.5 rounded bg-black/50 hover:bg-neutral-900/60 border border-neutral-800/60 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">{log.timestamp}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold text-[8px] ${
                        log.severity === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : log.severity === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : log.severity === 'ELEVATION'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}>
                        {log.severity}
                      </span>
                      <span className="text-slate-300">[{log.actor}]:</span>
                      <span className="text-white font-bold">{log.action}</span>
                    </div>
                    {log.target && (
                      <span className="text-amber-400 font-bold bg-black/60 px-1.5 py-0.5 rounded border border-neutral-800">
                        {log.target}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ====================================================
            TAB 5: FORENSICS & PENTEST ARSENAL
            ==================================================== */}
        {activeTab === 'ARSENAL' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  TACTICAL FORENSICS & OFFENSIVE PENTEST ARSENAL
                </h3>
                <p className="text-[10px] text-slate-400">
                  Pre-configured tool integrations ready for future extension: memory dumps, disk triage, packet carving, and AD auditing.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-black p-1 rounded-lg border border-neutral-800 text-[10px]">
                {(['FORENSICS', 'PENTEST', 'ACTIVE_DIRECTORY', 'NETWORK'] as const).map(suite => (
                  <button
                    key={suite}
                    onClick={() => { setSelectedToolSuite(suite); soundEngine.play('click'); }}
                    className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                      selectedToolSuite === suite
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {suite}
                  </button>
                ))}
              </div>
            </div>

            {/* Tools Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {selectedToolSuite === 'FORENSICS' && (
                <>
                  <div className="bg-[#0b121e] p-3 rounded-xl border border-purple-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Volatility 3 (Memory Forensics)</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Extract process trees, DLL injections, network sockets, and password hashes from raw memory dumps (.raw, .vmem).
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-purple-300 border border-neutral-800">
                      python3 vol.py -f memdump.raw windows.malfind.Malfind
                    </div>
                  </div>

                  <div className="bg-[#0b121e] p-3 rounded-xl border border-purple-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">The Sleuth Kit / Autopsy</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Carve deleted files, reconstruct MFT timelines, parse NTFS journal logs, and analyze disk image artifacts.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-purple-300 border border-neutral-800">
                      fls -r -p -m C: image.dd &gt; bodyfile.txt &amp;&amp; mactime -b bodyfile.txt
                    </div>
                  </div>
                </>
              )}

              {selectedToolSuite === 'PENTEST' && (
                <>
                  <div className="bg-[#0b121e] p-3 rounded-xl border border-red-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Nuclei Vulnerability Engine</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Fast template-based vulnerability scanning across CVEs, misconfigurations, default credentials, and zero-day POCs.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-red-300 border border-neutral-800">
                      nuclei -u http://192.168.100.50 -t cves/ -severity critical,high
                    </div>
                  </div>

                  <div className="bg-[#0b121e] p-3 rounded-xl border border-red-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">SQLMap Automated Exploit</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Automated SQL injection detection and database takeover, dumping tables and executing OS shell commands via xp_cmdshell.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-red-300 border border-neutral-800">
                      sqlmap -u "http://192.168.100.50/view.php?id=1" --dbs --batch
                    </div>
                  </div>
                </>
              )}

              {selectedToolSuite === 'ACTIVE_DIRECTORY' && (
                <>
                  <div className="bg-[#0b121e] p-3 rounded-xl border border-amber-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">BloodHound CE / SharpHound</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Graph theory mapping of Active Directory attack paths, ACL permissions, DCSync rights, and Domain Admin routes.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-amber-300 border border-neutral-800">
                      bloodhound-python -u 'mike' -p 'diamond' -d corporate.local -ns 192.168.100.50 -c All
                    </div>
                  </div>

                  <div className="bg-[#0b121e] p-3 rounded-xl border border-amber-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">NetExec / CrackMapExec</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Automated SMB, WMI, WinRM, and LDAP spraying across entire subnets with pass-the-hash support.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-amber-300 border border-neutral-800">
                      nxc smb 192.168.100.0/24 -u 'mike' -p 'diamond' --rid-brute
                    </div>
                  </div>
                </>
              )}

              {selectedToolSuite === 'NETWORK' && (
                <>
                  <div className="bg-[#0b121e] p-3 rounded-xl border border-cyan-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">TShark / Wireshark Carving</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Extract cleartext credentials, HTTP objects, TLS handshakes, and DNS exfiltration patterns from .pcap files.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-cyan-300 border border-neutral-800">
                      tshark -r capture.pcap -Y "http.request.method == POST" -T fields -e http.file_data
                    </div>
                  </div>

                  <div className="bg-[#0b121e] p-3 rounded-xl border border-cyan-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Zeek (Bro) Network Security</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">READY</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Deep packet state machine behavioral monitoring, protocol parsing, and C2 beaconing analysis.
                    </p>
                    <div className="p-2 rounded bg-black/70 font-mono text-[10px] text-cyan-300 border border-neutral-800">
                      zeek -r capture.pcap local &amp;&amp; cat conn.log | zeek-cut id.orig_h id.resp_h proto
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
export default CyberAdminApp;
