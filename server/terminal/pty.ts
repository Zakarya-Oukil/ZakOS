import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, NextFunction, Request, Response } from 'express';
import { spawn as spawnPty, type IPty } from 'node-pty';
import type { WebSocket } from 'ws';

const REPO_ROOT = process.cwd();
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const MAX_INPUT = 64 * 1024;
/** Output kept per shell so a reattached tab shows what it missed. */
const MAX_BUFFER = 256 * 1024;
const MAX_SESSIONS = 12;

/**
 * Local-only guard shared by every endpoint that runs commands or touches arbitrary folders.
 *
 * A shell over WebSocket is remote code execution for whoever can open it, and the API server
 * listens on every interface. So this endpoint accepts only loopback peers, and only pages
 * served from a localhost origin (which stops other websites from driving it via the browser).
 */
export function isTrustedLocalRequest(req: IncomingMessage): boolean {
  const peer = req.socket.remoteAddress ?? '';
  if (!LOOPBACK.has(peer)) return false;
  const origin = req.headers.origin;
  // Non-browser local clients send no Origin; browsers always do.
  return origin === undefined || LOCAL_ORIGIN.test(origin);
}

function shellCommand(): { file: string; args: string[] } {
  if (process.platform === 'win32') return { file: 'powershell.exe', args: ['-NoLogo'] };
  return { file: process.env.SHELL || '/bin/bash', args: [] };
}

interface Session {
  id: string;
  title: string;
  cwd: string;
  created: number;
  term: IPty;
  buffer: string;
  clients: Set<WebSocket>;
  /** Set once the shell has exited; the tab stays until the owner closes it. */
  exitCode?: number;
  /** Legacy one-off connections (no session id) die with their socket. */
  ephemeral: boolean;
}

const sessions = new Map<string, Session>();

const clampSize = (v: unknown, min: number, max: number, fallback: number) => Math.min(max, Math.max(min, Number(v) || fallback));

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function uniqueTitle(base: string): string {
  const taken = new Set([...sessions.values()].map((s) => s.title));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base} ${n}`)) return `${base} ${n}`;
}

function resolveCwd(requested: string | null | undefined): string {
  const cwd = requested ? path.resolve(requested) : REPO_ROOT;
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error(`Folder not found: ${cwd}`);
  return cwd;
}

function createSession(opts: { cwd?: string | null; title?: string; cols?: number; rows?: number; ephemeral?: boolean }): Session {
  if (sessions.size >= MAX_SESSIONS) throw new Error(`At most ${MAX_SESSIONS} terminals can be open. Close one first.`);
  const cwd = resolveCwd(opts.cwd);
  const { file, args } = shellCommand();
  const term = spawnPty(file, args, {
    name: 'xterm-256color',
    cols: clampSize(opts.cols, 20, 500, 100),
    rows: clampSize(opts.rows, 5, 200, 30),
    cwd,
    env: process.env as Record<string, string>,
  });
  const session: Session = {
    id: randomUUID(),
    title: uniqueTitle((opts.title?.trim() || path.basename(cwd) || 'Shell').slice(0, 40)),
    cwd,
    created: Date.now(),
    term,
    buffer: '',
    clients: new Set(),
    ephemeral: Boolean(opts.ephemeral),
  };
  term.onData((data) => {
    session.buffer += data;
    if (session.buffer.length > MAX_BUFFER) session.buffer = session.buffer.slice(-MAX_BUFFER);
    for (const c of session.clients) send(c, { type: 'output', data });
  });
  term.onExit(({ exitCode }) => {
    session.exitCode = exitCode;
    for (const c of session.clients) send(c, { type: 'exit', code: exitCode });
    if (session.ephemeral) {
      for (const c of session.clients) c.close(1000, 'Shell exited');
      sessions.delete(session.id);
    }
  });
  sessions.set(session.id, session);
  return session;
}

function destroy(id: string): boolean {
  const s = sessions.get(id);
  if (!s) return false;
  sessions.delete(id);
  for (const c of s.clients) c.close(1000, 'Terminal closed');
  try {
    s.term.kill();
  } catch {
    /* already gone */
  }
  return true;
}

const info = (s: Session) => ({ id: s.id, title: s.title, cwd: s.cwd, created: s.created, exitCode: s.exitCode ?? null });

// Shells are children of this server; do not leave them behind when it stops.
process.on('exit', () => {
  for (const s of sessions.values()) {
    try {
      s.term.kill();
    } catch {
      /* ignore */
    }
  }
});

function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

/** REST side of the terminals: list, open, rename and close. Output itself travels over the WebSocket. */
export function mountTerminalRoutes(app: Express) {
  app.use('/api/terminal', localOnly);

  app.get('/api/terminal/sessions', (_req: Request, res: Response) => {
    res.json({ success: true, sessions: [...sessions.values()].sort((a, b) => a.created - b.created).map(info) });
  });

  app.post('/api/terminal/sessions', (req: Request, res: Response) => {
    try {
      const cwd = typeof req.body?.cwd === 'string' && req.body.cwd.trim() ? req.body.cwd.trim() : null;
      const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
      res.status(201).json({ success: true, session: info(createSession({ cwd, title })) });
    } catch (err) {
      res.status(400).json({ success: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.patch('/api/terminal/sessions/:id', (req: Request, res: Response) => {
    const s = sessions.get(String(req.params.id));
    if (!s) return void res.status(404).json({ success: false, error: 'Terminal not found' });
    const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 40) : '';
    if (!title) return void res.status(400).json({ success: false, error: 'title is required' });
    s.title = title;
    res.json({ success: true, session: info(s) });
  });

  app.delete('/api/terminal/sessions/:id', (req: Request, res: Response) => {
    if (!destroy(String(req.params.id))) return void res.status(404).json({ success: false, error: 'Terminal not found' });
    res.json({ success: true });
  });
}

export function handlePtyConnection(ws: WebSocket, req: IncomingMessage): void {
  if (!isTrustedLocalRequest(req)) {
    ws.close(1008, 'Forbidden');
    return;
  }

  const url = new URL(req.url ?? '', 'http://localhost');
  const wanted = url.searchParams.get('session');
  let session: Session | undefined;

  if (wanted) {
    session = sessions.get(wanted);
    if (!session) {
      send(ws, { type: 'error', message: 'This terminal is gone. It may have been closed, or the server restarted.' });
      ws.close(1008, 'No such session');
      return;
    }
  } else {
    // Older clients open a bare socket and expect a throwaway shell.
    try {
      session = createSession({ cwd: url.searchParams.get('cwd'), cols: Number(url.searchParams.get('cols')), rows: Number(url.searchParams.get('rows')), ephemeral: true });
    } catch (err) {
      send(ws, { type: 'error', message: err instanceof Error ? err.message : String(err) });
      ws.close(1011, 'Spawn failed');
      return;
    }
  }

  const s = session;
  s.clients.add(ws);
  send(ws, { type: 'ready', id: s.id, cwd: s.cwd, pid: s.term.pid });
  if (s.buffer) send(ws, { type: 'output', data: s.buffer });
  if (s.exitCode !== undefined) send(ws, { type: 'exit', code: s.exitCode });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (s.exitCode !== undefined) return;
      if (msg.type === 'input' && typeof msg.data === 'string' && msg.data.length <= MAX_INPUT) {
        s.term.write(msg.data);
      } else if (msg.type === 'resize') {
        const c = clampSize(msg.cols, 20, 500, 0);
        const r = clampSize(msg.rows, 5, 200, 0);
        if (Number(msg.cols) && Number(msg.rows)) s.term.resize(c, r);
      }
    } catch {
      /* ignore malformed frames */
    }
  });

  const leave = () => {
    s.clients.delete(ws);
    // A persistent shell keeps running with nobody attached; only throwaway ones end here.
    if (s.ephemeral && s.clients.size === 0) destroy(s.id);
  };
  ws.on('close', leave);
  ws.on('error', leave);
}
