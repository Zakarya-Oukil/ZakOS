import React, { useState } from 'react';
import { Send, Globe, Play, CheckCircle, Clock, Copy, Plus, Trash2, Code2, Sliders, Check } from 'lucide-react';
import { soundEngine } from '../../../services/soundEffects';

interface ApiLabAppProps {
  windowId: string;
  isActive: boolean;
  onClose: () => void;
}

interface KeyVal {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export const ApiLabApp: React.FC<ApiLabAppProps> = () => {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET');
  const [url, setUrl] = useState('http://localhost:4000/api/vault/overview');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'history'>('headers');
  const [headers, setHeaders] = useState<KeyVal[]>([
    { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
    { id: '2', key: 'Accept', value: 'application/json', enabled: true }
  ]);
  const [queryParams, setQueryParams] = useState<KeyVal[]>([
    { id: '1', key: 'limit', value: '50', enabled: true }
  ]);
  const [bodyContent, setBodyContent] = useState<string>('{\n  "query": "pentest notes",\n  "includeSubfolders": true\n}');
  const [response, setResponse] = useState<string>('{\n  "status": "online",\n  "version": "2.0.0",\n  "vault": {\n    "indexedNotes": 155,\n    "path": "C:\\\\Users\\\\Zakar\\\\Documents\\\\Obsidian\\\\My_Vault"\n  }\n}');
  const [statusCode, setStatusCode] = useState<number>(200);
  const [responseTime, setResponseTime] = useState<number>(18);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSend = async () => {
    soundEngine.playClick();
    setIsLoading(true);
    const start = performance.now();
    try {
      const activeHeaders: Record<string, string> = {};
      headers.filter(h => h.enabled && h.key).forEach(h => {
        activeHeaders[h.key] = h.value;
      });

      const options: RequestInit = {
        method,
        headers: activeHeaders
      };

      if (['POST', 'PUT', 'PATCH'].includes(method) && bodyContent.trim()) {
        options.body = bodyContent;
      }

      const res = await fetch(url, options);
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

  const handleCopy = () => {
    soundEngine.playClick();
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col p-4 bg-[#080d0a] text-zinc-200 font-sans">
      {/* Method & URL Bar */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10 font-mono text-xs">
        <select
          value={method}
          onChange={(e) => {
            soundEngine.playClick();
            setMethod(e.target.value as any);
          }}
          className={`bg-black/80 border rounded-xl px-3 py-2 font-bold focus:outline-none ${
            method === 'GET' ? 'text-emerald-400 border-emerald-500/30' :
            method === 'POST' ? 'text-cyan-400 border-cyan-500/30' :
            method === 'PUT' ? 'text-amber-400 border-amber-500/30' :
            'text-red-400 border-red-500/30'
          }`}
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
        </select>

        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-white/10 focus-within:border-emerald-500">
          <Globe className="w-4 h-4 text-emerald-400" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full bg-transparent text-xs text-white focus:outline-none font-mono"
            placeholder="https://api.example.com/v1/..."
          />
        </div>

        <button
          onClick={handleSend}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-40"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Sending...' : 'Send'}</span>
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-white/5 font-mono text-xs">
        {(['headers', 'params', 'body'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              soundEngine.playClick();
              setActiveTab(tab);
            }}
            className={`px-3 py-1 rounded-lg uppercase tracking-wider text-[11px] font-bold transition-all ${
              activeTab === tab ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Request Configuration Body */}
      <div className="h-28 mb-3 overflow-y-auto bg-black/40 rounded-xl border border-white/10 p-2 font-mono text-xs">
        {activeTab === 'headers' && (
          <div className="space-y-1.5">
            {headers.map(h => (
              <div key={h.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => setHeaders(headers.map(item => item.id === h.id ? { ...item, key: e.target.value } : item))}
                  placeholder="Key"
                  className="w-1/3 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => setHeaders(headers.map(item => item.id === h.id ? { ...item, value: e.target.value } : item))}
                  placeholder="Value"
                  className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
                />
                <button
                  onClick={() => setHeaders(headers.filter(item => item.id !== h.id))}
                  className="text-zinc-600 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setHeaders([...headers, { id: Date.now().toString(), key: '', value: '', enabled: true }])}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"
            >
              <Plus className="w-3 h-3" /> Add Header
            </button>
          </div>
        )}

        {activeTab === 'params' && (
          <div className="space-y-1.5">
            {queryParams.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={p.key}
                  onChange={(e) => setQueryParams(queryParams.map(item => item.id === p.id ? { ...item, key: e.target.value } : item))}
                  placeholder="Parameter"
                  className="w-1/3 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
                />
                <input
                  type="text"
                  value={p.value}
                  onChange={(e) => setQueryParams(queryParams.map(item => item.id === p.id ? { ...item, value: e.target.value } : item))}
                  placeholder="Value"
                  className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
                />
                <button
                  onClick={() => setQueryParams(queryParams.filter(item => item.id !== p.id))}
                  className="text-zinc-600 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setQueryParams([...queryParams, { id: Date.now().toString(), key: '', value: '', enabled: true }])}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"
            >
              <Plus className="w-3 h-3" /> Add Query Parameter
            </button>
          </div>
        )}

        {activeTab === 'body' && (
          <textarea
            value={bodyContent}
            onChange={(e) => setBodyContent(e.target.value)}
            className="w-full h-full bg-transparent text-emerald-300 focus:outline-none resize-none font-mono text-xs"
            placeholder="JSON Request Body..."
          />
        )}
      </div>

      {/* Response Status Banner */}
      <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 font-mono text-[11px] mb-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusCode >= 200 && statusCode < 300 ? 'bg-emerald-400' : 'bg-red-400'}`} />
            Status: <strong className={statusCode >= 200 && statusCode < 300 ? 'text-emerald-400' : 'text-red-400'}>{statusCode}</strong>
          </span>
          <span>Time: <strong className="text-cyan-400">{responseTime} ms</strong></span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Response Viewer */}
      <div className="flex-1 overflow-auto rounded-xl bg-black/80 border border-white/10 p-3 font-mono text-xs text-emerald-300 select-all whitespace-pre-wrap">
        {response}
      </div>
    </div>
  );
};

