import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import type { NextFunction, Request, Response } from 'express';
import { isTrustedLocalRequest } from '../terminal/pty';

export const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

/** Same database file as the sessions store; WAL mode lets both connections write. */
export const osdb = new DatabaseSync(path.join(dataDir, 'zakos.db'));
osdb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function kvGet<T>(key: string, fallback: T): T {
  const row = osdb.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function kvSet(key: string, value: unknown): void {
  osdb.prepare('INSERT INTO kv(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
}

/** These routes can run commands or touch files, so they answer only this machine. */
export function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

export const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
export const str = (v: unknown, max = 5000): string | undefined => (typeof v === 'string' ? v.slice(0, max) : undefined);

/** Runs a program without a shell, so arguments can never be interpreted as commands. */
export function run(file: string, args: string[], opts: { cwd?: string; timeout?: number } = {}): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { cwd: opts.cwd, timeout: opts.timeout ?? 15_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024, shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(file) }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? (err ? err.message : '')) });
    });
  });
}

/** Wraps a handler so thrown Errors become a JSON 400 instead of an HTML 500. */
export const handle = (fn: (req: Request, res: Response) => unknown | Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (!res.headersSent) fail(res, 400, err instanceof Error ? err.message : String(err));
  }
};
