import React, { useState } from 'react';
import { Search, ShieldAlert, Terminal, Copy, Check, ExternalLink } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface CveHunterAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface CveEntry {
  cve: string;
  name: string;
  cvss: string;
  affected: string;
  module: string;
  description: string;
}

export const CveHunterApp: React.FC<CveHunterAppProps> = () => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cves: CveEntry[] = [
    {
      cve: 'CVE-2018-7600',
      name: 'Drupalgeddon2 Form API RCE',
      cvss: '9.8 CRITICAL',
      affected: 'Drupal 7.x (< 7.58), 8.x (< 8.5.1)',
      module: 'exploit/unix/webapp/drupal_drupalgeddon2',
      description: 'Unauthenticated remote code execution flaw in Drupal core AJAX/Form API via render arrays.'
    },
    {
      cve: 'CVE-2020-7247',
      name: 'OpenSMTPD Local / Remote Code Execution',
      cvss: '9.8 CRITICAL',
      affected: 'OpenSMTPD 6.6.1p1 and earlier',
      module: 'exploit/linux/smtp/opensmtpd_mail_from_rce',
      description: 'Improper input validation in OpenSMTPD allowing shell command execution via crafted MAIL FROM address.'
    },
    {
      cve: 'MS17-010',
      name: 'EternalBlue SMB Remote Code Execution',
      cvss: '9.3 HIGH',
      affected: 'Windows Server 2008 / 2012 / 7',
      module: 'exploit/windows/smb/ms17_010_eternalblue',
      description: 'SMBv1 buffer overflow vulnerability allowing SYSTEM-level execution.'
    },
    {
      cve: 'WebDAV-PUT',
      name: 'Microsoft IIS WebDAV Arbitrary File Upload',
      cvss: '8.8 HIGH',
      affected: 'IIS 6.0 / 7.5 / 8.5 with active WebDAV',
      module: 'auxiliary/scanner/http/webdav_scanner',
      description: 'Misconfigured HTTP methods (PUT, MOVE) permitting direct upload and execution of ASP/ASPX web shells.'
    }
  ];

  const filtered = cves.filter(c => 
    c.cve.toLowerCase().includes(query.toLowerCase()) || 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.affected.toLowerCase().includes(query.toLowerCase())
  );

  const handleCopy = (cve: string, module: string) => {
    soundEngine.playClick();
    navigator.clipboard.writeText(`use ${module}`);
    setCopiedId(cve);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#0a0710] text-zinc-200 font-sans">
      {/* Search Header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 mb-3 focus-within:border-red-500/50">
        <Search className="w-4 h-4 text-red-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CVEs, Exploits, Metasploit modules..."
          className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
        />
      </div>

      {/* CVE Feed */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.map((item) => (
          <div key={item.cve} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <span className="font-mono text-xs font-bold text-white">{item.cve}</span>
                <span className="text-xs font-medium text-zinc-300">- {item.name}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-red-500/20 text-red-400">
                {item.cvss}
              </span>
            </div>

            <p className="text-xs text-zinc-400 mb-2 leading-relaxed">{item.description}</p>

            <div className="flex items-center justify-between p-2 rounded-lg bg-black/50 border border-white/5 font-mono text-[11px]">
              <span className="text-cyan-300 truncate mr-2">{item.module}</span>
              <button
                onClick={() => handleCopy(item.cve, item.module)}
                className="flex items-center gap-1 text-[10px] font-bold text-red-400 hover:text-white transition-colors"
              >
                {copiedId === item.cve ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === item.cve ? 'COPIED' : 'USE MODULE'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
