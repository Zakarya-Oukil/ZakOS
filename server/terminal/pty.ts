import type { IncomingMessage } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn as spawnPty, type IPty } from 'node-pty';
import type { WebSocket } from 'ws';

const REPO_ROOT = process.cwd();
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

const MAX_INPUT = 64 * 1024;

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

export function handlePtyConnection(ws: WebSocket, req: IncomingMessage): void {
  if (!isTrustedLocalRequest(req)) {
    ws.close(1008, 'Forbidden');
    return;
  }

  const url = new URL(req.url ?? '', 'http://localhost');
  const requested = url.searchParams.get('cwd');
  const cwd = requested ? path.resolve(requested) : REPO_ROOT;
  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    ws.send(JSON.stringify({ type: 'error', message: `Folder not found: ${cwd}` }));
    ws.close(1008, 'Bad cwd');
    return;
  }

  const cols = Math.min(500, Math.max(20, Number(url.searchParams.get('cols')) || 100));
  const rows = Math.min(200, Math.max(5, Number(url.searchParams.get('rows')) || 30));

  let term: IPty;
  try {
    const { file, args } = shellCommand();
    term = spawnPty(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: process.env as Record<string, string>,
    });
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : String(err) }));
    ws.close(1011, 'Spawn failed');
    return;
  }

  ws.send(JSON.stringify({ type: 'ready', cwd, pid: term.pid }));

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'output', data }));
  });
  term.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      ws.close(1000, 'Shell exited');
    }
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'input' && typeof msg.data === 'string' && msg.data.length <= MAX_INPUT) {
        term.write(msg.data);
      } else if (msg.type === 'resize') {
        const c = Math.min(500, Math.max(20, Number(msg.cols) || 0));
        const r = Math.min(200, Math.max(5, Number(msg.rows) || 0));
        if (c && r) term.resize(c, r);
      }
    } catch {
      /* ignore malformed frames */
    }
  });

  const cleanup = () => {
    try {
      term.kill();
    } catch {
      /* already gone */
    }
  };
  ws.on('close', cleanup);
  ws.on('error', cleanup);
}
