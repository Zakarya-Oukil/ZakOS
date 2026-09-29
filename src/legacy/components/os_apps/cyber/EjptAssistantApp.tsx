import React, { useState } from 'react';
import { HelpCircle, CheckCircle, Search, FileText, ArrowUpRight } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface EjptAssistantAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface QaEntry {
  id: number;
  q: string;
  a: string;
  evidence: string;
}

export const EjptAssistantApp: React.FC<EjptAssistantAppProps> = () => {
  const [query, setQuery] = useState('');

  const questions: QaEntry[] = [
    { id: 1, q: "Which Linux distribution is running on the server hosting the Drupal site?", a: "Ubuntu", evidence: "Host 192.168.100.52 runs Ubuntu 20.04.3 LTS (Kernel 5.13.0-1021-aws)." },
    { id: 2, q: "What services does Syntex provide to companies?", a: "custom build workflows / custom workflow solutions", evidence: "Discovered in Drupal site header and mission statement under Services." },
    { id: 3, q: "What time does a working day start at Syntex?", a: "09:00 / 9:00 AM", evidence: "Operating hours on Syntex Dynamics about page specify 09:00 start time." },
    { id: 4, q: "What is the email of the admin user on the Drupal site?", a: "admin@syntex.com", evidence: "Queried Drupal database users table where uid = 1." },
    { id: 5, q: "What version of Drupal is running on the Drupal site?", a: "7.57", evidence: "Extracted from CHANGELOG.txt at http://192.168.100.52/drupal/." },
    { id: 6, q: "What is the IP address of the host vulnerable to an SSH brute-force attack?", a: "192.168.100.52", evidence: "Allows password authentication over SSH (unlike .67 which enforces public-key auth)." },
    { id: 7, q: "How many systems on target network have FTP servers with anonymous access enabled?", a: "2", evidence: "192.168.100.51 (Microsoft ftpd) and 192.168.100.52 (vsftpd 3.0.3)." },
    { id: 8, q: "What is the IP address of host running FTP server containing updates.txt?", a: "192.168.100.52", evidence: "Retrieved updates.txt from anonymous FTP root on 192.168.100.52." },
    { id: 9, q: "What type of vulnerability can be exploited on the Drupal site?", a: "RCE", evidence: "Drupalgeddon2 (CVE-2018-7600) is an Unauthenticated Form API Remote Code Execution." },
    { id: 10, q: "What type of vulnerability can elevate privileges on Linux host running Drupal?", a: "Vulnerable Service", evidence: "OpenSMTPD 6.6.1p1 local privilege escalation via CVE-2020-7247." },
    { id: 11, q: "Which Metasploit module exploits the vulnerability on Drupal site?", a: "exploit/unix/webapp/drupal_drupalgeddon2", evidence: "Metasploit framework exploit module targeting Drupal 7.x/8.x Form API RCE." },
    { id: 12, q: "Which MSF module can obtain an elevated reverse shell on WINSERVER-02?", a: "exploit/windows/misc/hta_server", evidence: "Delivers an HTA payload executed via mshta.exe through cmdasp.aspx." },
    { id: 13, q: "What is the CIDR network range of the internal network?", a: "192.168.0.0/24", evidence: "Internal subnet route identified on the dual-homed interface." },
    { id: 14, q: "Which meterpreter command can add a network route?", a: "route", evidence: "The Meterpreter 'route add <subnet> <mask> <session>' command." },
    { id: 15, q: "Which host can be used as a pivot point to access internal network?", a: "WINSERVER-02", evidence: "Compromised via WebDAV / web shell (192.168.100.51)." },
    { id: 16, q: "What is the password of Administrator user on WINSERVER-03?", a: "swordfish", evidence: "Authenticated and verified via SMB/RDP on 192.168.100.55." },
    { id: 17, q: "What is the password of user account mary on WINSERVER-03?", a: "hotmama", evidence: "Cracked credential for local account mary on WINSERVER-03." },
    { id: 18, q: "What is the password for user mike on WINSERVER-01?", a: "diamond", evidence: "Cracked SMB credential for WINSERVER-01\\mike (192.168.100.50)." },
    { id: 19, q: "Which host in DMZ can be exploited via command injection?", a: "WINSERVER-02", evidence: "Hosts cmdasp.aspx allowing direct arbitrary OS command execution." },
    { id: 20, q: "What is the CVSS V3.x score for Drupalgeddon2 vulnerability?", a: "9.8", evidence: "NVD CVSS v3.0 Base Score: 9.8 CRITICAL." },
    { id: 21, q: "What web server contains a file called todo.txt?", a: "WEBSERVER-01", evidence: "Internal host WEBSERVER-01 in 192.168.0.0/24." },
    { id: 22, q: "How many user accounts exist on the Drupal site?", a: "4", evidence: "admin (1), auditor (2), dbadmin (3), Vincenzo (4)." },
    { id: 23, q: "Which version of WordPress is running on WINSERVER-01?", a: "5.9.3", evidence: "Extracted from readme.html and generator meta tag on 192.168.100.50." },
    { id: 24, q: "Which WordPress config file contains database connection settings?", a: "wp-config.php", evidence: "Defines DB_NAME, DB_USER, DB_PASSWORD, and DB_HOST." },
    { id: 25, q: "What is the MySQL root password on the Drupal host?", a: "syntex0421", evidence: "Cracked from MySQL root hash *7C695400AEECFFAD9251CB1CF2DC6CE8A143FCE9." },
    { id: 26, q: "Excluding built-in Guest, how many user accounts on WINSERVER-01?", a: "4", evidence: "Administrator, mike, vince, admin." },
    { id: 27, q: "What host in DMZ runs a web server with WebDAV enabled?", a: "192.168.100.51", evidence: "WINSERVER-02 runs Microsoft IIS 8.5 with active WebDAV." },
    { id: 28, q: "Which host contains a user account called lawrence?", a: "WINSERVER-02", evidence: "Enumerated via net user on 192.168.100.51." },
    { id: 29, q: "Excluding Admin, guest, services, how many user accounts on WINSERVER-03?", a: "1", evidence: "Only user account is mary." },
    { id: 30, q: "The server hosting Drupal contains /home/auditor/flag.txt. Value?", a: "2678f01e488e432fa0a64431b54df635", evidence: "Retrieved from /home/auditor/flag.txt on 192.168.100.52." },
    { id: 31, q: "How many HotFixes are installed on WINSERVER-01?", a: "245", evidence: "(Get-HotFix).Count returns 245 installed patches." },
    { id: 32, q: "What is value of C:\\Users\\Administrator\\flag.txt in WINSERVER-03?", a: "2ebff64df4bf470eacb0895c64f73765", evidence: "Retrieved from C:\\Users\\Administrator\\flag.txt on 192.168.100.55." }
  ];

  const filtered = questions.filter(item => 
    item.q.toLowerCase().includes(query.toLowerCase()) || 
    item.a.toLowerCase().includes(query.toLowerCase()) ||
    item.evidence.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col p-4 bg-[#0a060e] text-zinc-200 font-sans">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono font-bold text-white uppercase">eJPT / Lab Assessment Q&A Engine</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">{questions.length} Verified Solutions</span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 mb-3 focus-within:border-red-500/50">
        <Search className="w-4 h-4 text-red-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search question, concept, or target answer..."
          className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.map((item) => (
          <div key={item.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-red-500/30 transition-all">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-mono text-[10px]">
                  {item.id}
                </span>
                <span>{item.q}</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-xs font-mono text-emerald-300 font-bold mb-1.5 select-all">
              ✓ {item.a}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              <span className="text-zinc-500">Evidence:</span> {item.evidence}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
