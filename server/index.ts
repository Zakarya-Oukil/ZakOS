import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import chokidar from 'chokidar';
import { vaultService } from './vault';
import { 
  AGENT_PROFILES, 
  AVAILABLE_MODELS, 
  getApiKey, 
  setApiKey, 
  getExpLabsApiKey,
  setExpLabsApiKey,
  streamAgentResponse, 
  getCombinedModels, 
  streamOllamaResponse,
  RoutingMode
} from './agent';
import { projectService } from './projectService';
import { githubService } from './githubService';
import { scraperService } from './scraperService';
import { handleSshWebSocketConnection } from './sshBridge';
import { jarvisService } from './jarvisService';
import { mountAgentRoutes } from './agents/routes';
import { handlePtyConnection, isTrustedLocalRequest, mountTerminalRoutes } from './terminal/pty';
import { mountOsSettingsRoutes } from './osSettings';
import { mountProjectRoutes } from './projects/routes';
import { mountWorkflowRoutes } from './workflows/routes';
import { mountAuditRoutes } from './audit';
import { mountApprovalRoutes } from './agents/approvalRoutes';
import { mountContextRoutes } from './agents/contextRoutes';
import { mountHomeRoutes } from './home';
import { mountGitRoutes } from './git/routes';
import { mountDevRoutes } from './dev/routes';
import { mountBrainRoutes } from './brain/routes';
import { mountSkillRoutes } from './skills/routes';
import { mountScheduleRoutes } from './automations/routes';
import { startScheduler } from './automations/scheduler';
import { mountOsGate, mountOsRoutes } from './os';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: '*' }));
app.use(
  express.json({
    limit: '10mb',
    // Webhook signatures are computed over the exact bytes that were sent.
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }),
);
mountOsGate(app);

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Active WebSocket clients set
const clients = new Set<WebSocket>();

wss.on('connection', (ws, req) => {
  // Terminal sockets carry raw shell traffic: keep them out of the JSON broadcast set.
  if ((req.url || '').startsWith('/ws/pty')) {
    handlePtyConnection(ws, req);
    return;
  }
  clients.add(ws);
  const url = req.url || '';
  console.log(`[WS] Client connected (path: ${url}). Active clients: ${clients.size}`);

  // Route directly to SSH bridge if connecting to /ws/ssh
  if (url.startsWith('/ws/ssh')) {
    handleSshWebSocketConnection(ws);
  }

  // Also support messages on default socket
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.type?.startsWith('ssh:')) {
        // Forwarded to SSH bridge handler
        handleSshWebSocketConnection(ws);
      }
    } catch (e) {}
  });

  // Send initial sync event
  ws.send(JSON.stringify({ type: 'connected', time: new Date().toISOString() }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected. Active clients: ${clients.size}`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err);
    clients.delete(ws);
  });
});

function broadcast(data: any) {
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// Connect project service to live WebSocket broadcast
projectService.setBroadcastCallback(broadcast);

// Agent bridge: real CLI agent sessions (Claude Code, Hermes)
mountAgentRoutes(app, broadcast);
mountOsSettingsRoutes(app);
mountProjectRoutes(app);
mountWorkflowRoutes(app, broadcast);
mountAuditRoutes(app);
mountApprovalRoutes(app, broadcast);
mountContextRoutes(app);
mountHomeRoutes(app);
mountGitRoutes(app);
mountDevRoutes(app);
mountBrainRoutes(app);
mountSkillRoutes(app);
mountTerminalRoutes(app);
mountScheduleRoutes(app, broadcast);
mountOsRoutes(app);
startScheduler(broadcast);

// ==========================================
// REST API ROUTES
// ==========================================

// The vault holds private notes and these routes can write and delete files, so they answer only
// this machine (loopback peer, localhost origin), like the terminal does.
app.use('/api/vault', (req: Request, res: Response, next: NextFunction) => {
  if (!isTrustedLocalRequest(req)) return res.status(403).json({ success: false, error: 'Local access only' });
  next();
});

// 1. Vault Overview & Telemetry
app.get('/api/vault/overview', (req: Request, res: Response) => {
  try {
    const stats = vaultService.getTelemetryStats();
    const projects = vaultService.getProjectsKanban();
    const recentNotes = vaultService.getAllNotes()
      .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
      .slice(0, 10);

    res.json({
      success: true,
      stats,
      projects,
      recentNotes,
      vaultPath: vaultService.getVaultPath(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. All Notes List
app.get('/api/vault/notes', (req: Request, res: Response) => {
  try {
    const notes = vaultService.getAllNotes();
    res.json({ success: true, count: notes.length, notes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Single Note details
app.get('/api/vault/note', (req: Request, res: Response) => {
  try {
    const notePath = req.query.path as string;
    const noteId = req.query.id as string;

    if (!notePath && !noteId) {
      return res.status(400).json({ success: false, error: 'Missing path or id parameter' });
    }

    const note = notePath
      ? vaultService.getNoteByRelativePath(notePath)
      : vaultService.getNoteById(noteId);

    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    res.json({ success: true, note });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Save / Create / Update Note
app.post('/api/vault/note', async (req: Request, res: Response) => {
  try {
    const { path: notePath, content, frontmatter } = req.body;

    if (!notePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Missing path or content' });
    }

    const savedNote = await vaultService.saveNote(notePath, content, frontmatter);
    
    // Broadcast live change to all connected dashboards
    broadcast({
      type: 'note:saved',
      note: savedNote,
      timestamp: Date.now(),
    });

    res.json({ success: true, note: savedNote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Delete Note
app.delete('/api/vault/note', async (req: Request, res: Response) => {
  try {
    const { path: notePath } = req.body;
    if (!notePath) {
      return res.status(400).json({ success: false, error: 'Missing path' });
    }

    const deleted = await vaultService.deleteNote(notePath);
    
    broadcast({
      type: 'note:deleted',
      path: notePath,
      timestamp: Date.now(),
    });

    res.json({ success: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Force-Directed Graph Data
app.get('/api/vault/graph', (req: Request, res: Response) => {
  try {
    const graphData = vaultService.getGraphData();
    res.json({ success: true, graph: graphData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Commands Matrix
app.get('/api/vault/commands', (req: Request, res: Response) => {
  try {
    const commands = vaultService.getCommands();
    res.json({ success: true, count: commands.length, commands });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Projects Kanban
app.get('/api/vault/projects', (req: Request, res: Response) => {
  try {
    const projects = vaultService.getProjectsKanban();
    res.json({ success: true, projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Quick Daily Note Creator
app.post('/api/vault/daily', async (req: Request, res: Response) => {
  try {
    const { priorities } = req.body;
    const dailyNote = await vaultService.createDailyNote(priorities);

    broadcast({
      type: 'daily:created',
      note: dailyNote,
      timestamp: Date.now(),
    });

    res.json({ success: true, note: dailyNote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. AI Agent Profiles & Models
app.get('/api/agent/profiles', (req: Request, res: Response) => {
  res.json({ success: true, profiles: Object.values(AGENT_PROFILES) });
});

app.get('/api/agent/models', async (req: Request, res: Response) => {
  try {
    const models = await getCombinedModels();
    res.json({ success: true, models });
  } catch (error: any) {
    res.json({ success: true, models: AVAILABLE_MODELS });
  }
});

// Alias: GET /api/models
app.get('/api/models', async (req: Request, res: Response) => {
  try {
    const models = await getCombinedModels();
    res.json({ success: true, models });
  } catch (error: any) {
    res.json({ success: true, models: AVAILABLE_MODELS });
  }
});

// 11. API Key Management
app.get('/api/settings/key', (req: Request, res: Response) => {
  const googleKey = getApiKey();
  const explabsKey = getExpLabsApiKey();
  const hasExpLabs = explabsKey.length > 5;
  const hasGoogle = googleKey.length > 5;
  const hasKey = hasExpLabs || hasGoogle;
  const maskedKey = hasExpLabs 
    ? `${explabsKey.slice(0, 8)}...${explabsKey.slice(-4)}`
    : (hasGoogle ? `${googleKey.slice(0, 6)}...${googleKey.slice(-4)}` : '');
  
  res.json({ 
    success: true, 
    hasKey, 
    maskedKey,
    hasExpLabs,
    maskedExpLabsKey: hasExpLabs ? `${explabsKey.slice(0, 8)}...${explabsKey.slice(-4)}` : '',
    hasGoogle,
    maskedGoogleKey: hasGoogle ? `${googleKey.slice(0, 6)}...${googleKey.slice(-4)}` : ''
  });
});

app.post('/api/settings/key', (req: Request, res: Response) => {
  try {
    const { key, provider } = req.body;
    if (typeof key === 'string' && key.trim()) {
      if (key.startsWith('xpl_') || provider === 'explabs') {
        setExpLabsApiKey(key.trim());
      } else {
        setApiKey(key.trim());
      }
      res.json({ success: true, message: 'API key saved successfully' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid key' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. Hybrid AI Agent Chat Stream (SSE)
app.post(['/api/agent/chat', '/api/agent-chat'], async (req: Request, res: Response) => {
  const { 
    agentId, 
    agent, 
    message, 
    prompt, 
    history = [], 
    modelId, 
    routingMode = 'hybrid_fallback' 
  } = req.body;

  const targetAgent = agentId || agent || 'coding';
  const targetPrompt = message || prompt || '';

  if (!targetPrompt) {
    return res.status(400).json({ success: false, error: 'Missing message or prompt' });
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const fullResponse = await streamAgentResponse(
      targetAgent,
      targetPrompt,
      history,
      modelId,
      (chunk: string) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
      routingMode as RoutingMode
    );

    res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[Agent Stream Error]:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Direct Local Model Execution (Ollama)
app.post('/api/local-model', async (req: Request, res: Response) => {
  const { model = 'deepseek-coder-v2:latest', prompt, history = [] } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Missing prompt' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const fullResponse = await streamOllamaResponse(
      model,
      prompt,
      'You are a high-performance local AI model running under Zak_OS.',
      history,
      (chunk: string) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ done: true, fullResponse })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// 13. Scrapy Project & Web Scraper / Threat Intelligence Endpoints
app.post('/api/scraper/crawl', async (req: Request, res: Response) => {
  try {
    const { url, spider = 'zakos' } = req.body;
    const items = await scraperService.crawl(spider, url);
    res.json({ success: true, items });
  } catch (error: any) {
    console.error('[Scraper Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scraper/analyze', async (req: Request, res: Response) => {
  try {
    const { item } = req.body;
    if (!item) {
      return res.status(400).json({ success: false, error: 'Missing scraped item' });
    }
    const analysis = await scraperService.analyzeWithGpt6Astra(item);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('[Analysis Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/scraper/news', async (req: Request, res: Response) => {
  try {
    const spider = (req.query.spider as string) || 'cve_feed';
    const items = await scraperService.crawl(spider);
    res.json({ success: true, items });
  } catch (error: any) {
    console.error('[News Scraper Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scraper/analyze-item', async (req: Request, res: Response) => {
  try {
    const { item } = req.body;
    if (!item) {
      return res.status(400).json({ success: false, error: 'Missing item' });
    }
    const briefing = await scraperService.analyzeCybersecItem(item);
    res.json({ success: true, briefing });
  } catch (error: any) {
    console.error('[Item Analysis Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 12.5. JARVIS MASTER INTELLIGENCE & HUD API
// ==========================================

// Get real-time system hardware telemetry
app.get('/api/jarvis/telemetry', async (req: Request, res: Response) => {
  try {
    const report = await jarvisService.getTelemetry();
    res.json({ success: true, telemetry: report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Launch Windows PC applications, Obsidian, tools
app.post('/api/jarvis/exec-app', async (req: Request, res: Response) => {
  try {
    const { app: appName, args } = req.body;
    if (!appName) {
      return res.status(400).json({ success: false, error: 'Missing app name' });
    }
    const result = await jarvisService.executePcApp(appName, args);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Live atmospheric weather via Open-Meteo
app.get('/api/jarvis/weather', async (req: Request, res: Response) => {
  try {
    const city = req.query.city as string;
    const weather = await jarvisService.getWeather(city);
    res.json(weather);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fast intent parser for HUD modal actions
app.post('/api/jarvis/intent', (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Missing prompt' });
    }
    const action = jarvisService.parseIntent(prompt);
    res.json({ success: true, action });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 13. GEOINT & SPATIAL INTELLIGENCE ENDPOINTS
// ==========================================

let _cachedAdsbPayload: any = null;
let _cachedAdsbTime = 0;
const ADSB_CACHE_TTL = 12000; // 12 seconds cache to prevent upstream rate-limiting

app.get('/api/geoint/adsb', async (req: Request, res: Response) => {
  const now = Date.now();
  if (_cachedAdsbPayload && (now - _cachedAdsbTime) < ADSB_CACHE_TTL) {
    return res.json({ success: true, source: 'cache', count: _cachedAdsbPayload.length, flights: _cachedAdsbPayload });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const response = await fetch('https://api.adsb.lol/v2/mil', {
      signal: controller.signal,
      headers: { 'User-Agent': 'ZakOS-GodsEye/2.1 (Intelligence Console)' }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data: any = await response.json();
      const acList = data.ac || [];
      const normalized = acList
        .filter((a: any) => typeof a.lat === 'number' && typeof a.lon === 'number' && !isNaN(a.lat) && !isNaN(a.lon))
        .map((a: any, idx: number) => {
          const callsign = (a.flight || a.hex || `MIL-${idx}`).trim();
          const alt = Math.round(Number(a.alt_baro || a.alt_geom || 25000));
          const speed = Math.round(Number(a.gs || 350));
          const heading = Math.round(Number(a.track || 0));
          const squawk = a.squawk ? String(a.squawk) : '1200';
          const typeDesc = a.t || a.desc || 'MILITARY RECON / PATROL';
          return {
            id: a.hex ? `adsb-${a.hex}` : `adsb-${idx}`,
            callsign,
            aircraftType: typeDesc,
            lat: a.lat,
            lng: a.lon,
            altitudeFt: alt,
            groundSpeedKts: speed,
            heading,
            squawk,
            origin: 'AIR DEFENSE SECTOR',
            destination: 'AIR PATROL ROUTE',
            isMilitary: true
          };
        });

      if (normalized.length > 0) {
        _cachedAdsbPayload = normalized;
        _cachedAdsbTime = now;
        return res.json({ success: true, source: 'live', count: normalized.length, flights: normalized });
      }
    }
  } catch (err: any) {
    console.warn('[GEOINT ADS-B Fetch Warning]:', err.message);
  }

  // Fallback: If cache exists (even stale), return it
  if (_cachedAdsbPayload && _cachedAdsbPayload.length > 0) {
    return res.json({ success: true, source: 'stale_cache', count: _cachedAdsbPayload.length, flights: _cachedAdsbPayload });
  }

  // Otherwise return empty array with baseline fallback flag
  res.json({ success: true, source: 'baseline', count: 0, flights: [] });
});

let _cachedEarthquakes: any = null;
let _cachedEarthquakesTime = 0;
const EARTHQUAKE_CACHE_TTL = 60000; // 60 seconds

app.get('/api/geoint/earthquakes', async (req: Request, res: Response) => {
  const now = Date.now();
  if (_cachedEarthquakes && (now - _cachedEarthquakesTime) < EARTHQUAKE_CACHE_TTL) {
    return res.json({ success: true, source: 'cache', count: _cachedEarthquakes.length, earthquakes: _cachedEarthquakes });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const geojson: any = await response.json();
      const features = geojson.features || [];
      const earthquakes = features.map((f: any) => ({
        id: f.id || `eq-${Math.random()}`,
        place: f.properties?.place || 'Unknown Epicenter',
        mag: Number(f.properties?.mag || 0),
        time: f.properties?.time || Date.now(),
        url: f.properties?.url,
        tsunami: f.properties?.tsunami || 0,
        alert: f.properties?.alert || 'green',
        lat: f.geometry?.coordinates?.[1] || 0,
        lng: f.geometry?.coordinates?.[0] || 0,
        depthKm: Math.round(Number(f.geometry?.coordinates?.[2] || 10))
      }));

      _cachedEarthquakes = earthquakes;
      _cachedEarthquakesTime = now;
      return res.json({ success: true, source: 'live_usgs', count: earthquakes.length, earthquakes });
    }
  } catch (err: any) {
    console.warn('[USGS Earthquake Error]:', err.message);
  }

  if (_cachedEarthquakes) {
    return res.json({ success: true, source: 'stale_cache', count: _cachedEarthquakes.length, earthquakes: _cachedEarthquakes });
  }

  res.json({ success: true, source: 'empty', count: 0, earthquakes: [] });
});

// ==========================================
// 14. CYBER OPERATIONS COMMAND & ADMIN ENDPOINTS
// ==========================================

interface CyberDaemon {
  id: string;
  name: string;
  service: string;
  port?: number;
  status: 'RUNNING' | 'STANDBY' | 'STOPPED' | 'ERROR';
  uptimeSeconds: number;
  lastPing: string;
  description: string;
}

const CYBER_DAEMONS: CyberDaemon[] = [
  { id: 'daemon-spider', name: 'Recon Spider Daemon', service: 'spider_engine', port: 4000, status: 'RUNNING', uptimeSeconds: 14200, lastPing: 'JUST NOW', description: 'Continuous target crawler, certificate miner and header auditor' },
  { id: 'daemon-cve', name: 'Threat Intel CVE Stream', service: 'cve_triage', port: 4000, status: 'RUNNING', uptimeSeconds: 9840, lastPing: 'JUST NOW', description: 'NVD & exploit feed ingestion pipeline with AI CVSS scoring' },
  { id: 'daemon-geoint', name: 'Spatial ADS-B Telemetry Streamer', service: 'adsb_telemetry', port: 4000, status: 'RUNNING', uptimeSeconds: 5200, lastPing: 'JUST NOW', description: 'Real-time aircraft transponder and orbital satellite propagator' },
  { id: 'daemon-listener', name: 'Reverse Shell Handler Daemon', service: 'listener_core', port: 4444, status: 'RUNNING', uptimeSeconds: 3100, lastPing: 'JUST NOW', description: 'Multi-threaded reverse TCP and encrypted TTY session manager' },
  { id: 'daemon-proxy', name: 'Anonymizer & Proxychains Rotator', service: 'proxy_rotator', port: 9050, status: 'STANDBY', uptimeSeconds: 0, lastPing: 'IDLE', description: 'Circuit routing and IP evasion layer for offensive scans' }
];

interface CyberListener {
  id: string;
  name: string;
  protocol: 'TCP' | 'HTTP' | 'HTTPS' | 'DNS' | 'ENCRYPTED_TTY';
  port: number;
  engine: 'netcat' | 'pwncat' | 'msfconsole' | 'socat';
  status: 'LISTENING' | 'ACTIVE' | 'STANDBY';
  sessions: number;
  boundInterface: string;
  connectedTarget?: string;
  createdAt: string;
}

let CYBER_LISTENERS: CyberListener[] = [
  { id: 'lst-4444', name: 'Pwncat Auto-Pty Handler', protocol: 'ENCRYPTED_TTY', port: 4444, engine: 'pwncat', status: 'ACTIVE', sessions: 1, boundInterface: '0.0.0.0', connectedTarget: '192.168.100.51 (WINSERVER-02)', createdAt: '2026-09-14 14:15:00' },
  { id: 'lst-9001', name: 'Rlwrap Netcat Raw TTY', protocol: 'TCP', port: 9001, engine: 'netcat', status: 'LISTENING', sessions: 0, boundInterface: '0.0.0.0', createdAt: '2026-09-14 15:30:20' },
  { id: 'lst-4433', name: 'MSF Multi/Handler (HTTPS)', protocol: 'HTTPS', port: 4433, engine: 'msfconsole', status: 'STANDBY', sessions: 0, boundInterface: '192.168.100.5', createdAt: '2026-09-14 16:00:10' }
];

const OPSEC_AUDIT_LOGS: Array<{ id: string; time: string; level: 'INFO' | 'WARN' | 'CRITICAL' | 'ALERT'; module: string; message: string }> = [
  { id: 'log-1', time: new Date(Date.now() - 360000).toLocaleTimeString(), level: 'INFO', module: 'DAEMON', message: 'Cyber daemon subsystem initialized with 4 active services' },
  { id: 'log-2', time: new Date(Date.now() - 240000).toLocaleTimeString(), level: 'ALERT', module: 'LISTENER', message: 'Inbound Reverse Shell connection received on Port 4444 from 192.168.100.51' },
  { id: 'log-3', time: new Date(Date.now() - 120000).toLocaleTimeString(), level: 'INFO', module: 'GEOINT', message: 'ADS-B real-time military transponder feed synchronized' },
  { id: 'log-4', time: new Date(Date.now() - 40000).toLocaleTimeString(), level: 'WARN', module: 'SCANNER', message: 'Target 192.168.100.52 initiated ICMP echo responses with TTL=64 (Linux)' }
];

app.get('/api/cyber/daemons', (req: Request, res: Response) => {
  res.json({ success: true, daemons: CYBER_DAEMONS });
});

app.post('/api/cyber/daemons/toggle', (req: Request, res: Response) => {
  const id = req.body.id || req.body.daemonId;
  const action = req.body.action;
  const target = CYBER_DAEMONS.find(d => d.id === id);
  if (target) {
    if (action === 'start') {
      target.status = 'RUNNING';
      target.uptimeSeconds = 1;
    } else if (action === 'stop') {
      target.status = 'STANDBY';
    } else if (action === 'restart') {
      target.status = 'RUNNING';
      target.uptimeSeconds = 1;
    } else {
      target.status = target.status === 'RUNNING' ? 'STANDBY' : 'RUNNING';
      if (target.status === 'RUNNING') target.uptimeSeconds = 1;
    }
    OPSEC_AUDIT_LOGS.unshift({
      id: `log-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      level: 'INFO',
      module: 'DAEMON',
      message: `Daemon ${target.name} state transitioned to ${target.status}`
    });
    return res.json({ success: true, daemon: target });
  }
  res.status(404).json({ success: false, error: 'Daemon not found' });
});

app.get('/api/cyber/listeners', (req: Request, res: Response) => {
  res.json({ success: true, listeners: CYBER_LISTENERS });
});

app.post('/api/cyber/listeners/create', (req: Request, res: Response) => {
  const { name, port, engine, protocol } = req.body;
  if (!port) return res.status(400).json({ success: false, error: 'Missing port' });

  const newListener: CyberListener = {
    id: `lst-${port}-${Date.now().toString().slice(-4)}`,
    name: name || `Listener :${port}`,
    port: Number(port),
    protocol: protocol || 'TCP',
    engine: engine || 'netcat',
    status: 'LISTENING',
    sessions: 0,
    boundInterface: '0.0.0.0',
    createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
  };

  CYBER_LISTENERS.unshift(newListener);
  OPSEC_AUDIT_LOGS.unshift({
    id: `log-${Date.now()}`,
    time: new Date().toLocaleTimeString(),
    level: 'INFO',
    module: 'LISTENER',
    message: `Spawned ${newListener.engine.toUpperCase()} listener on ${newListener.boundInterface}:${newListener.port} (${newListener.protocol})`
  });

  res.json({ success: true, listener: newListener });
});

app.delete('/api/cyber/listeners/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLen = CYBER_LISTENERS.length;
  CYBER_LISTENERS = CYBER_LISTENERS.filter(l => l.id !== id);
  if (CYBER_LISTENERS.length < initialLen) {
    OPSEC_AUDIT_LOGS.unshift({
      id: `log-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      level: 'WARN',
      module: 'LISTENER',
      message: `Terminated listener ID ${id}`
    });
    return res.json({ success: true, message: 'Listener deleted' });
  }
  res.status(404).json({ success: false, error: 'Listener not found' });
});

app.get('/api/cyber/audit-logs', (req: Request, res: Response) => {
  res.json({ success: true, logs: OPSEC_AUDIT_LOGS.slice(0, 50) });
});

// 15. Terminal Execution & Background Daemon Server Endpoints
app.post('/api/project/terminal/exec', async (req: Request, res: Response) => {
  try {
    const { command, cwd = process.cwd() } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: 'Missing command' });
    }
    const result = await projectService.executeTerminalCommand(command, cwd);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/server/start', (req: Request, res: Response) => {
  try {
    const { command, cwd = process.cwd(), name } = req.body;
    if (!command) {
      return res.status(400).json({ success: false, error: 'Missing command' });
    }
    const serverInfo = projectService.startBackgroundServer(command, cwd, name);
    res.json({ success: true, server: serverInfo });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/server/stop', (req: Request, res: Response) => {
  try {
    const { pid } = req.body;
    if (!pid) {
      return res.status(400).json({ success: false, error: 'Missing pid' });
    }
    const success = projectService.stopBackgroundServer(Number(pid));
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project/server/list', (req: Request, res: Response) => {
  try {
    const servers = projectService.getActiveServers();
    res.json({ success: true, servers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project/server/logs', (req: Request, res: Response) => {
  try {
    const pid = req.query.pid ? Number(req.query.pid) : undefined;
    const servers = projectService.getActiveServers();
    if (pid) {
      const target = servers.find((s) => s.pid === pid);
      return res.json({ success: true, logs: target?.logs || [] });
    }
    const allLogs = servers.map((s) => ({ pid: s.pid, name: s.name, url: s.url, logs: s.logs }));
    res.json({ success: true, allLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. Project IDE & Filesystem Endpoints
app.get('/api/project/list', (req: Request, res: Response) => {
  try {
    const projects = projectService.getProjects();
    res.json({ success: true, projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/workspace/add', async (req: Request, res: Response) => {
  try {
    const { folderPath, customName, category = 'General', autoScanWithAi = true } = req.body;
    if (!folderPath) {
      return res.status(400).json({ success: false, error: 'Missing folderPath' });
    }
    const project = await projectService.addWorkspace(folderPath, customName, category, autoScanWithAi);
    res.json({ success: true, project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/project/workspace/remove', (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Missing id' });
    }
    const success = projectService.removeWorkspace(id);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/workspace/scan', async (req: Request, res: Response) => {
  try {
    const { projectPath, projectId, modelId = 'gemini-3.7-flash' } = req.body;
    const projects = projectService.getProjects();
    const proj = projects.find((p) => p.id === projectId || p.path === projectPath);
    if (!proj) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    const vaultNotePath = await projectService.scanAndSyncProjectToVault(proj, modelId);
    res.json({ success: true, vaultNotePath });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project/workspace/state', (req: Request, res: Response) => {
  try {
    const state = projectService.getIdeState();
    res.json({ success: true, state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/workspace/state', (req: Request, res: Response) => {
  try {
    const { state } = req.body;
    if (state) {
      projectService.saveIdeState(state);
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, error: 'Missing state' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project/tree', (req: Request, res: Response) => {
  try {
    const dirPath = (req.query.path as string) || process.cwd();
    const tree = projectService.getDirectoryTree(dirPath);
    res.json({ success: true, tree });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/project/file', (req: Request, res: Response) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Missing path parameter' });
    }
    const file = projectService.readFile(filePath);
    res.json({ success: true, file });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

app.post('/api/project/file', (req: Request, res: Response) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: 'Missing path or content' });
    }
    const result = projectService.writeFile(filePath, content);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/create', (req: Request, res: Response) => {
  try {
    const { path: targetPath, type, initialContent = '' } = req.body;
    if (!targetPath || !type) {
      return res.status(400).json({ success: false, error: 'Missing path or type' });
    }
    const success = projectService.createItem(targetPath, type, initialContent);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/project/file', (req: Request, res: Response) => {
  try {
    const { path: targetPath } = req.body;
    if (!targetPath) {
      return res.status(400).json({ success: false, error: 'Missing path' });
    }
    const success = projectService.deleteItem(targetPath);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/project/run', async (req: Request, res: Response) => {
  try {
    const { language = 'python', code, filePath } = req.body;
    if (!code && !filePath) {
      return res.status(400).json({ success: false, error: 'Missing code or filePath' });
    }
    const result = await projectService.runCode(language, code, filePath);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// 14. GITHUB CLOUD INTEGRATION ENDPOINTS
// ==========================================

// Authenticated user profile
app.get('/api/github/user', async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-github-token'] as string) || undefined;
    const user = await githubService.getUser(token);
    res.json({ success: true, user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// User repositories list
app.get('/api/github/repos', async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-github-token'] as string) || undefined;
    const repos = await githubService.getRepos(token);
    res.json({ success: true, count: repos.length, repos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Specific repository details
app.get('/api/github/repo', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo query parameters' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const repoData = await githubService.getRepo(owner, repo, token);
    res.json({ success: true, repo: repoData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Repository branches
app.get('/api/github/branches', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo query parameters' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const branches = await githubService.getBranches(owner, repo, token);
    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Repository Git Tree (file hierarchy)
app.get('/api/github/tree', async (req: Request, res: Response) => {
  try {
    const { owner, repo, branch = 'main' } = req.query as { owner: string; repo: string; branch?: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo query parameters' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const tree = await githubService.getTree(owner, repo, branch, token);
    res.json({ success: true, tree });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Single file content (formatted UTF-8 or base64)
app.get('/api/github/file', async (req: Request, res: Response) => {
  try {
    const { owner, repo, path: filePath, branch } = req.query as {
      owner: string;
      repo: string;
      path: string;
      branch?: string;
    };
    if (!owner || !repo || !filePath) {
      return res.status(400).json({ success: false, error: 'Missing owner, repo, or path parameter' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const file = await githubService.getFile(owner, repo, filePath, branch, token);
    res.json({ success: true, file });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Commit history
app.get('/api/github/commits', async (req: Request, res: Response) => {
  try {
    const { owner, repo, branch, per_page } = req.query as {
      owner: string;
      repo: string;
      branch?: string;
      per_page?: string;
    };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo parameter' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const commits = await githubService.getCommits(owner, repo, branch, per_page ? Number(per_page) : 30, token);
    res.json({ success: true, count: commits.length, commits });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Contributors
app.get('/api/github/contributors', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo parameter' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const contributors = await githubService.getContributors(owner, repo, token);
    res.json({ success: true, contributors });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// README preview content
app.get('/api/github/readme', async (req: Request, res: Response) => {
  try {
    const { owner, repo, branch } = req.query as { owner: string; repo: string; branch?: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo parameter' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const readme = await githubService.getReadme(owner, repo, branch, token);
    res.json({ success: true, readme });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Language stats
app.get('/api/github/languages', async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.query as { owner: string; repo: string };
    if (!owner || !repo) {
      return res.status(400).json({ success: false, error: 'Missing owner or repo parameter' });
    }
    const token = (req.headers['x-github-token'] as string) || undefined;
    const languages = await githubService.getLanguages(owner, repo, token);
    res.json({ success: true, languages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set / Update Token
app.post('/api/github/token', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (typeof token === 'string' && token.trim()) {
      githubService.setToken(token.trim());
      res.json({ success: true, message: 'GitHub token updated' });
    } else {
      res.status(400).json({ success: false, error: 'Invalid token' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// CHOKIDAR FILE WATCHER & INITIALIZATION
// ==========================================

async function startServer() {
  const vaultPath = vaultService.getVaultPath();
  console.log(`[Zak_OS] Initializing vault scan at: ${vaultPath}`);
  
  await vaultService.reindex();

  // Watch for external Obsidian changes
  const watcher = chokidar.watch(vaultPath, {
    ignored: /(^|[\/\\])\..|node_modules/,
    persistent: true,
    ignoreInitial: true,
    depth: 10,
  });

  let debounceTimer: NodeJS.Timeout | null = null;

  const handleFsChange = (event: string, filePath: string) => {
    if (!filePath.endsWith('.md')) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log(`[Chokidar] Vault change detected (${event}): ${path.basename(filePath)}`);
      await vaultService.reindex();
      broadcast({
        type: 'vault:updated',
        event,
        filePath,
        timestamp: Date.now(),
      });
    }, 400);
  };

  watcher
    .on('add', (p) => handleFsChange('add', p))
    .on('change', (p) => handleFsChange('change', p))
    .on('unlink', (p) => handleFsChange('unlink', p));

  server.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Zak_OS Backend Server Online`);
    console.log(`📡 REST API & WebSockets running on: http://127.0.0.1:${PORT}`);
    console.log(`🏛 Connected to Obsidian Vault: ${vaultPath}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('[Zak_OS] Failed to start server:', err);
});
