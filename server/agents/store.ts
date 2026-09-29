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
  CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent, updated DESC);
  CREATE INDEX IF NOT EXISTS idx_actions_session ON actions(session_id, ts DESC);
`);

// A server restart leaves no live child processes, so any "running" row is stale.
db.prepare(`UPDATE sessions SET status = 'idle' WHERE status = 'running'`).run();

const q = {
  insertSession: db.prepare(
    `INSERT INTO sessions (id, agent, title, cwd, cli_session_id, status, created, updated)
     VALUES (?, ?, ?, ?, NULL, 'idle', ?, ?)`
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

export function createSession(id: string, agent: string, title: string, cwd: string): SessionRow {
  const now = Date.now();
  q.insertSession.run(id, agent, title, cwd, now, now);
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
