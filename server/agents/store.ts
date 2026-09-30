import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentEvent } from './adapters/types';

export interface SessionRow {
  id: string;
  agent: string;
  title: string;
  cwd: string;
  cli_session_id: string | null;
  /** Trust level fixed at creation (workflow workers); null means resolve from the project at run time. */
  trust: string | null;
  status: 'idle' | 'running' | 'error';
  created: number;
  updated: number;
}

export interface MessageRow {
  session_id: string;
  seq: number;
  role: 'user' | 'agent';
  event: AgentEvent | { type: 'user'; text: string };
  ts: number;
}

export interface ActionRow {
  id: number;
  session_id: string;
  ts: number;
  kind: string;
  detail: string;
  checkpoint_ref: string | null;
}

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'zakos.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    cwd TEXT NOT NULL,
    cli_session_id TEXT,
    status TEXT NOT NULL DEFAULT 'idle',
    created INTEGER NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    event_json TEXT NOT NULL,
    ts INTEGER NOT NULL,
    PRIMARY KEY (session_id, seq)
  );
  CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    detail TEXT NOT NULL,
    checkpoint_ref TEXT
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail TEXT NOT NULL,
    session_id TEXT,
    run_id TEXT,
    project TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_kind ON audit(kind, ts DESC);
  CREATE TABLE IF NOT EXISTS usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    agent TEXT NOT NULL,
    session_id TEXT,
    input INTEGER NOT NULL,
    output INTEGER NOT NULL,
    cache_read INTEGER NOT NULL,
    cache_write INTEGER NOT NULL,
    cost_usd REAL NOT NULL,
    model TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage(agent, ts DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent, updated DESC);
  CREATE INDEX IF NOT EXISTS idx_actions_session ON actions(session_id, ts DESC);
`);

// Older databases predate the trust column.
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN trust TEXT`);
} catch {
  /* column already exists */
}

// A server restart leaves no live child processes, so any "running" row is stale.
db.prepare(`UPDATE sessions SET status = 'idle' WHERE status = 'running'`).run();

const q = {
  insertSession: db.prepare(
    `INSERT INTO sessions (id, agent, title, cwd, cli_session_id, status, created, updated, trust)
     VALUES (?, ?, ?, ?, NULL, 'idle', ?, ?, ?)`
  ),
  getSession: db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  listAll: db.prepare(`SELECT * FROM sessions ORDER BY updated DESC`),
  listByAgent: db.prepare(`SELECT * FROM sessions WHERE agent = ? ORDER BY updated DESC`),
  rename: db.prepare(`UPDATE sessions SET title = ?, updated = ? WHERE id = ?`),
  setStatus: db.prepare(`UPDATE sessions SET status = ?, updated = ? WHERE id = ?`),
  setCliSession: db.prepare(`UPDATE sessions SET cli_session_id = ?, updated = ? WHERE id = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE id = ?`),
  deleteMessages: db.prepare(`DELETE FROM messages WHERE session_id = ?`),
  deleteActions: db.prepare(`DELETE FROM actions WHERE session_id = ?`),
  nextSeq: db.prepare(`SELECT COALESCE(MAX(seq), -1) + 1 AS n FROM messages WHERE session_id = ?`),
  insertMessage: db.prepare(
    `INSERT INTO messages (session_id, seq, role, event_json, ts) VALUES (?, ?, ?, ?, ?)`
  ),
  listMessages: db.prepare(`SELECT * FROM messages WHERE session_id = ? ORDER BY seq ASC`),
  insertAction: db.prepare(
    `INSERT INTO actions (session_id, ts, kind, detail, checkpoint_ref) VALUES (?, ?, ?, ?, ?)`
  ),
  listActions: db.prepare(`SELECT * FROM actions WHERE session_id = ? ORDER BY ts DESC, id DESC`),
};

export function createSession(id: string, agent: string, title: string, cwd: string, trust: string | null = null): SessionRow {
  const now = Date.now();
  q.insertSession.run(id, agent, title, cwd, now, now, trust);
  return getSession(id)!;
}

export function getSession(id: string): SessionRow | null {
  return (q.getSession.get(id) as unknown as SessionRow) ?? null;
}

export function listSessions(agent?: string): SessionRow[] {
  const rows = agent ? q.listByAgent.all(agent) : q.listAll.all();
  return rows as unknown as SessionRow[];
}

export function renameSession(id: string, title: string): void {
  q.rename.run(title, Date.now(), id);
}

export function setSessionStatus(id: string, status: SessionRow['status']): void {
  q.setStatus.run(status, Date.now(), id);
}

export function setCliSessionId(id: string, cliSessionId: string): void {
  q.setCliSession.run(cliSessionId, Date.now(), id);
}

export function deleteSession(id: string): void {
  q.deleteMessages.run(id);
  q.deleteActions.run(id);
  q.deleteSession.run(id);
}

export function appendMessage(
  sessionId: string,
  role: MessageRow['role'],
  event: MessageRow['event']
): MessageRow {
  const seq = (q.nextSeq.get(sessionId) as unknown as { n: number }).n;
  const ts = Date.now();
  q.insertMessage.run(sessionId, seq, role, JSON.stringify(event), ts);
  return { session_id: sessionId, seq, role, event, ts };
}

export function listMessages(sessionId: string): MessageRow[] {
  const rows = q.listMessages.all(sessionId) as unknown as Array<{
    session_id: string;
    seq: number;
    role: MessageRow['role'];
    event_json: string;
    ts: number;
  }>;
  return rows.map((r) => ({
    session_id: r.session_id,
    seq: r.seq,
    role: r.role,
    event: JSON.parse(r.event_json),
    ts: r.ts,
  }));
}

export function logAction(
  sessionId: string,
  kind: string,
  detail: string,
  checkpointRef: string | null = null
): void {
  q.insertAction.run(sessionId, Date.now(), kind, detail, checkpointRef);
}

export function listActions(sessionId: string): ActionRow[] {
  return q.listActions.all(sessionId) as unknown as ActionRow[];
}

// ---- audit log -----------------------------------------------------------------------------------

export interface AuditRow {
  id: number;
  ts: number;
  kind: string;
  actor: string;
  detail: string;
  session_id: string | null;
  run_id: string | null;
  project: string | null;
}

const auditInsert = db.prepare(
  `INSERT INTO audit (ts, kind, actor, detail, session_id, run_id, project) VALUES (?, ?, ?, ?, ?, ?, ?)`
);

export function insertAudit(row: Omit<AuditRow, 'id' | 'ts'>): void {
  auditInsert.run(Date.now(), row.kind, row.actor, row.detail, row.session_id, row.run_id, row.project);
}

/** Newest first. `before` is an id cursor; `q` matches detail, actor and project. */
export function queryAudit(opts: { kind?: string; q?: string; before?: number; limit: number }): AuditRow[] {
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (opts.kind) {
    where.push('kind = ?');
    args.push(opts.kind);
  }
  if (opts.q) {
    where.push(`(detail LIKE ? ESCAPE '\\' OR actor LIKE ? ESCAPE '\\' OR project LIKE ? ESCAPE '\\')`);
    const like = `%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    args.push(like, like, like);
  }
  if (opts.before) {
    where.push('id < ?');
    args.push(opts.before);
  }
  const sql = `SELECT * FROM audit ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ?`;
  return db.prepare(sql).all(...args, opts.limit) as unknown as AuditRow[];
}

export function auditKinds(): string[] {
  return (db.prepare(`SELECT DISTINCT kind FROM audit ORDER BY kind`).all() as unknown as Array<{ kind: string }>).map((r) => r.kind);
}

// ---- usage -----------------------------------------------------------------------------------

export interface UsageRow {
  agent: string;
  session_id: string | null;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  cost_usd: number;
  model: string | null;
}

const usageInsert = db.prepare(
  `INSERT INTO usage (ts, agent, session_id, input, output, cache_read, cache_write, cost_usd, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

export function insertUsage(row: UsageRow): void {
  usageInsert.run(Date.now(), row.agent, row.session_id, row.input, row.output, row.cache_read, row.cache_write, row.cost_usd, row.model);
}

export interface UsageTotals {
  runs: number;
  tokens: number;
  costUsd: number;
}

/** Totals for one agent since `since` (ms). Runs are counted from prompts, so agents that report no usage still have a count. */
export function usageSince(agent: string, since: number): UsageTotals {
  const u = db
    .prepare(`SELECT COALESCE(SUM(input + output + cache_read + cache_write), 0) AS tokens, COALESCE(SUM(cost_usd), 0) AS cost FROM usage WHERE agent = ? AND ts >= ?`)
    .get(agent, since) as unknown as { tokens: number; cost: number };
  const r = db
    .prepare(`SELECT COUNT(*) AS n FROM audit WHERE kind = 'prompt' AND actor = ? AND ts >= ?`)
    .get(agent, since) as unknown as { n: number };
  return { runs: r.n, tokens: u.tokens, costUsd: u.cost };
}

/** When usage tracking first recorded anything for this agent; earlier runs have no token data. */
export function usageTrackedSince(agent: string): number | null {
  const r = db.prepare(`SELECT MIN(ts) AS t FROM usage WHERE agent = ?`).get(agent) as unknown as { t: number | null };
  return r.t;
}
