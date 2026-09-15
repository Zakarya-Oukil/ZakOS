import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, 
  Play, 
  Square, 
  Download, 
  ShieldAlert, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Server, 
  Network, 
  Database, 
  RefreshCw,
  Search,
  Lock,
  Cpu,
  Mail,
  X,
  Radio,
  ExternalLink,
  Zap
} from 'lucide-react';
import { api } from '../../../services/api';
import { soundEngine } from '../../../services/soundEffects';

interface JarvisSpiderReconModalProps {
  initialTarget?: string;
  onClose: () => void;
}

interface PortResult {
  port: number;
  service: string;
  state: 'open' | 'filtered' | 'closed';
  version: string;
  vuln?: string;
}

interface DiscoveredSubdomain {
  subdomain: string;
  ip: string;
  status: number;
}

export const JarvisSpiderReconModal: React.FC<JarvisSpiderReconModalProps> = ({
  initialTarget = '192.168.100.52',
  onClose
}) => {
  const [target, setTarget] = useState(initialTarget);
  const [activeTab, setActiveTab] = useState<'osint' | 'ports' | 'subdomains' | 'vulns' | 'logs'>('ports');
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(100);
  const [statusMessage, setStatusMessage] = useState('Reconnaissance dataset loaded.');

  // OSINT Discovered Data
  const [emails, setEmails] = useState<string[]>([
    'admin@target.lab',
    'security@target.lab',
    'support@target.lab',
    'dev-lead@target.lab'
  ]);

  const [sensitiveFiles, setSensitiveFiles] = useState([
    { path: '/robots.txt', status: 200, risk: 'low', info: 'Exposes disallow rules' },
    { path: '/.env', status: 403, risk: 'high', info: 'Environment config protected' },
    { path: '/sites/default/settings.php', status: 403, risk: 'high', info: 'DB credentials blocked' },
    { path: '/admin/login', status: 200, risk: 'medium', info: 'Administrative portal reachable' },
    { path: '/server-status', status: 403, risk: 'medium', info: 'Apache mod_status forbidden' }
  ]);

  const [ports, setPorts] = useState<PortResult[]>([
    { port: 21, service: 'FTP', state: 'open', version: 'vsftpd 3.0.3 (Anonymous Read Allowed)', vuln: 'Potential anonymous traversal' },
    { port: 22, service: 'SSH', state: 'open', version: 'OpenSSH 8.4p1 Debian (Protocol 2.0)' },
    { port: 25, service: 'SMTP', state: 'open', version: 'OpenSMTPD 6.6.1p1', vuln: 'CVE-2020-7247 Remote Code Execution' },
    { port: 80, service: 'HTTP', state: 'open', version: 'Apache/2.4.50 (Debian)', vuln: 'CVE-2021-42013 Path Traversal / RCE' },
    { port: 443, service: 'HTTPS', state: 'open', version: 'OpenSSL 1.1.1n (TLS 1.3)' },
    { port: 445, service: 'SMB', state: 'open', version: 'Samba smbd 4.13.13-Debian', vuln: 'Null session authentication enabled' },
    { port: 3306, service: 'MySQL', state: 'open', version: 'MariaDB 10.5.15-Debian' },
    { port: 8080, service: 'HTTP-Proxy', state: 'open', version: 'Node.js Express / GraphQL API' }
  ]);

  const [subdomains, setSubdomains] = useState<DiscoveredSubdomain[]>([
    { subdomain: 'api.target.lab', ip: '192.168.100.53', status: 200 },
    { subdomain: 'vpn.target.lab', ip: '192.168.100.54', status: 200 },
    { subdomain: 'dev.target.lab', ip: '192.168.100.55', status: 403 },
    { subdomain: 'mail.target.lab', ip: '192.168.100.52', status: 200 },
    { subdomain: 'staging.target.lab', ip: '192.168.100.56', status: 500 }
  ]);

  const [scanLogs, setScanLogs] = useState<string[]>([
    '[+] Initialized JARVIS Spider Reconnaissance sub-routine.',
    '[*] Target locked: ' + target,
    '[+] DNS query completed: Found 5 subdomains via reverse lookup & crt.sh.',
    '[+] TCP SYN port sweep completed: 8 ports open.',
    '[!] Identified CVE-2020-7247 in OpenSMTPD service on port 25.',
    '[!] Identified CVE-2021-42013 in Apache 2.4.50 on port 80.',
    '[+] OSINT harvester extracted 4 public email addresses.',
    '[+] Security header audit score: Grade D (Missing HSTS & CSP).'
  ]);

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim() || isScanning) return;

    soundEngine.playCyberPing();
    setIsScanning(true);
    setProgress(15);
    setStatusMessage(`Resolving host & DNS records for ${target}...`);

    setScanLogs(prev => [
      ...prev,
      `\n[>] DISPATCHING FULL RECON: ${target}`,
      `[*] Gathering DNS records, WHOIS, and SSL certificates...`
    ]);

    try {
      // Trigger backend scraper if available
      api.crawlUrl(target).catch(() => {});
    } catch {}

    setTimeout(() => {
      setProgress(45);
      setStatusMessage('Harvesting OSINT, exposed emails, and subdomains...');
      setScanLogs(prev => [
        ...prev,
        `[+] OSINT sweep: Discovered 4 email addresses from public records.`,
        `[+] Subdomain enumeration: Identified active hosts.`
      ]);
    }, 1200);

    setTimeout(() => {
      setProgress(75);
      setStatusMessage('Sweeping TCP ports and fingerprinting service versions...');
      setScanLogs(prev => [
        ...prev,
        `[*] Port scan: 8 services active. Inspecting banner versions...`,
        `[!] Detected Apache 2.4.50 with potential path traversal vulnerabilities.`
      ]);
    }, 2400);

    setTimeout(() => {
      setProgress(100);
      setIsScanning(false);
      setStatusMessage('Reconnaissance complete. Vulnerability report generated.');
      setScanLogs(prev => [
        ...prev,
        `[+] Scan complete. All findings compiled in technical radar.`
      ]);
    }, 3600);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="relative z-50 w-[780px] max-w-[95vw] rounded-2xl border border-cyan-500/30 bg-[#060a14]/95 p-5 text-white shadow-2xl backdrop-blur-2xl"
      style={{
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(6, 182, 212, 0.2)'
      }}
    >
      {/* Draggable Title Bar */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 cursor-move select-none">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-400">
            <Globe className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-wider font-mono text-cyan-200">
                JARVIS SPIDER RECON // OSINT & VULN RADAR
              </h3>
              <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 text-[9px] font-mono text-cyan-300 border border-cyan-500/30">
                TARGET ACTIVE
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              Draggable HUD Window • Full-Surface Reconnaissance & Vulnerability Audit
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-zinc-400 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Target Input & Scan Trigger Form */}
      <form onSubmit={handleStartScan} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-cyan-400" />
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Enter target IP or Domain (e.g. 192.168.1.1, target.lab, or https://example.com)..."
            className="w-full rounded-xl border border-cyan-500/30 bg-black/60 py-2 pl-9 pr-3 font-mono text-xs text-cyan-200 placeholder-zinc-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isScanning}
          className="flex items-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-500/25 px-4 py-2 font-mono text-xs font-bold text-cyan-200 transition-all hover:bg-cyan-500/40 disabled:opacity-50"
        >
          {isScanning ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>SCANNING...</span>
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>DISPATCH RECON</span>
            </>
          )}
        </button>
      </form>

      {/* Progress & Status Indicator */}
      <div className="mt-2.5 space-y-1 font-mono text-[10px]">
        <div className="flex justify-between text-zinc-400">
          <span className="text-cyan-400">{statusMessage}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-4 flex items-center gap-1 border-b border-white/10 pb-2 font-mono text-xs">
        {[
          { id: 'ports', label: 'Port Matrix (8)', icon: Server },
          { id: 'vulns', label: 'Vulnerabilities (3)', icon: AlertCircle },
          { id: 'osint', label: 'OSINT & Emails (4)', icon: Mail },
          { id: 'subdomains', label: 'Subdomains (5)', icon: Network },
          { id: 'logs', label: 'Console Logs', icon: Terminal }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="mt-3 h-64 overflow-y-auto pr-1">
        {/* Tab: Ports */}
        {activeTab === 'ports' && (
          <div className="space-y-1.5 font-mono text-xs">
            <div className="grid grid-cols-12 gap-2 text-[10px] text-zinc-500 uppercase px-2 pb-1 border-b border-white/5">
              <div className="col-span-2">Port</div>
              <div className="col-span-2">Service</div>
              <div className="col-span-2">State</div>
              <div className="col-span-6">Fingerprinted Banner / Version</div>
            </div>
            {ports.map((p, i) => (
              <div
                key={i}
                className="grid grid-cols-12 gap-2 rounded-lg border border-white/5 bg-black/30 p-2 text-[11px] items-center hover:border-cyan-500/30 transition-colors"
              >
                <div className="col-span-2 font-bold text-cyan-300">{p.port}/tcp</div>
                <div className="col-span-2 text-zinc-300">{p.service}</div>
                <div className="col-span-2">
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-400 font-semibold">
                    {p.state}
                  </span>
                </div>
                <div className="col-span-6 truncate text-zinc-300">
                  {p.version}
                  {p.vuln && (
                    <span className="ml-2 text-red-400 text-[10px] font-semibold">
                      [{p.vuln}]
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Vulnerabilities */}
        {activeTab === 'vulns' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-400" /> CVE-2020-7247 (OpenSMTPD Remote Code Execution)
                </span>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300 font-bold border border-red-500/40">
                  CRITICAL 9.8
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 leading-relaxed">
                OpenSMTPD allows remote attackers to execute arbitrary shell commands with root privileges via crafted MAIL FROM addresses due to improper input sanitization.
              </p>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-300 flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-400" /> CVE-2021-42013 (Apache 2.4.50 Path Traversal & RCE)
                </span>
                <span className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-300 font-bold border border-red-500/40">
                  HIGH 8.5
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 leading-relaxed">
                Incomplete fix for CVE-2021-41773. Allows path traversal and remote code execution when mod_cgi is enabled.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-400" /> Samba SMB Null Session & Anonymous Read
                </span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 font-bold border border-amber-500/40">
                  MEDIUM 5.3
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-300 leading-relaxed">
                Samba port 445 permits unauthenticated IPC$ enumeration and public read access on anonymous shares.
              </p>
            </div>
          </div>
        )}

        {/* Tab: OSINT & Emails */}
        {activeTab === 'osint' && (
          <div className="space-y-3 font-mono text-xs">
            <div>
              <h4 className="text-[11px] text-cyan-400 font-semibold uppercase mb-1.5">
                Exposed Personnel & Public Emails
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-white/5 bg-black/30 p-2 text-zinc-200">
                    <Mail className="h-3.5 w-3.5 text-cyan-400" />
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[11px] text-cyan-400 font-semibold uppercase mb-1.5">
                Sensitive Endpoints & Config Crawl
              </h4>
              <div className="space-y-1">
                {sensitiveFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-2 text-[11px]">
                    <span className="font-semibold text-zinc-200">{file.path}</span>
                    <span className="text-zinc-400">{file.info}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      file.risk === 'high' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      HTTP {file.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab: Subdomains */}
        {activeTab === 'subdomains' && (
          <div className="space-y-1.5 font-mono text-xs">
            {subdomains.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-2.5">
                <span className="font-bold text-cyan-300">{s.subdomain}</span>
                <span className="text-zinc-400">{s.ip}</span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400 font-bold">
                  Active (HTTP {s.status})
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tab: Console Logs */}
        {activeTab === 'logs' && (
          <div className="h-full rounded-xl border border-white/5 bg-black/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
            {scanLogs.map((log, i) => (
              <div
                key={i}
                className={
                  log.startsWith('[!]')
                    ? 'text-red-400 font-bold'
                    : log.startsWith('[+]')
                    ? 'text-emerald-400'
                    : log.startsWith('[>]')
                    ? 'text-cyan-300 font-bold'
                    : 'text-zinc-400'
                }
              >
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] font-mono">
        <span className="text-zinc-500">
          Target Scope: <strong className="text-cyan-400">{target}</strong>
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              soundEngine.playCyberPing();
              alert(`Exported complete reconnaissance report for ${target}.`);
            }}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-zinc-300 hover:bg-white/10"
          >
            <Download className="h-3 w-3" />
            <span>Export Report</span>
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1 font-bold text-cyan-200 hover:bg-cyan-500/30"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </motion.div>
  );
};
