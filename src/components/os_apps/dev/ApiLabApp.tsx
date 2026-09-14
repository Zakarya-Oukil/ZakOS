import React, { useState } from 'react';
import { Send, Globe, Play, CheckCircle, Clock, Copy } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface ApiLabAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

export const ApiLabApp: React.FC<ApiLabAppProps> = () => {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [url, setUrl] = useState('http://localhost:4000/api/overview');
  const [response, setResponse] = useState<string>('{\n  "status": "online",\n  "version": "2.0.0",\n  "modelRouter": {\n    "primary": "Gemini 2.5 Flash",\n    "fallback": "qwen2.5:14b",\n    "ollamaEndpoint": "http://localhost:11434"\n  },\n  "vault": {\n    "indexedNotes": 123,\n    "path": "C:\\\\Users\\\\Zakar\\\\Documents\\\\Obsidian\\\\My_Vault"\n  }\n}');
  const [statusCode, setStatusCode] = useState<number>(200);
  const [responseTime, setResponseTime] = useState<number>(34);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    soundEngine.playClick();
    setIsLoading(true);
    const start = performance.now();
    try {
      const res = await fetch(url, { method });
      const duration = Math.round(performance.now() - start);
      setStatusCode(res.status);
      setResponseTime(duration);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResponse(JSON.stringify(json, null, 2));
      } catch {
        setResponse(text);
      }
      soundEngine.playCyberPing();
    } catch (err: any) {
      setStatusCode(500);
      setResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080d0a] text-zinc-200 font-sans">
      {/* Request Header */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10 font-mono text-xs">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as any)}
          className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-2 text-emerald-400 font-bold focus:outline-none"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>

        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus-within:border-emerald-500/50">
          <Globe className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold transition-all shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Sending...' : 'Send'}</span>
        </button>
      </div>

      {/* Response Status Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 font-mono text-[11px] mb-3">
        <div className="flex items-center gap-3">
          <span>Status: <strong className="text-emerald-400">{statusCode} OK</strong></span>
          <span>Time: <strong className="text-cyan-400">{responseTime} ms</strong></span>
        </div>
        <span className="text-zinc-500">JSON Payload</span>
      </div>

      {/* Response Body */}
      <div className="flex-1 overflow-auto rounded-xl bg-black/60 border border-white/10 p-3.5 font-mono text-xs text-emerald-300 select-all whitespace-pre-wrap">
        {response}
      </div>
    </div>
  );
};
