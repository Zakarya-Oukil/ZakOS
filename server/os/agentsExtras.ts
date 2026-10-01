import { randomUUID } from 'node:crypto';
import type { Express, Request, Response } from 'express';
import { audit } from '../audit';
import * as store from '../agents/store';
import { isRunning } from '../agents/runner';
import { fail, handle, kvGet, kvSet, localOnly, osdb, str } from './common';
import { isTrust } from '../agents/settings';

/** Session extras: forking a conversation, and what a session has cost so far. */
const forkKey = (sessionId: string) => `fork.parent.${sessionId}`;

/** The Claude session this one was forked from, until its first message creates the fork. */
export const pendingFork = (sessionId: string): string | null => kvGet<string | null>(forkKey(sessionId), null);
export const modelFor = (sessionId: string): string | undefined => kvGet<string | null>(`session.model.${sessionId}`, null) ?? undefined;
export const clearFork = (sessionId: string) => kvSet(forkKey(sessionId), null);

export function mountAgentExtras(app: Express) {
  app.use('/api/agents-x', localOnly);

  /**
   * Starts a new session that carries on from this one. The history is copied so it reads the same, and the first
   * message resumes the original Claude conversation with `--fork-session`, so the two then diverge independently.
   */
  app.post('/api/agents-x/sessions/:id/fork', handle((req, res) => {
    const src = store.getSession(String(req.params.id));
    if (!src) return fail(res, 404, 'Session not found');
    if (src.agent !== 'claude') return fail(res, 409, 'Only Claude Code sessions can be forked');
    if (!src.cli_session_id) return fail(res, 409, 'This session has no conversation to fork yet. Send a message first.');
    if (isRunning(src.id)) return fail(res, 409, 'Wait for the run to finish before forking');
    const id = randomUUID();
    const copy = store.createSession(id, src.agent, `Fork of ${src.title}`.slice(0, 80), src.cwd, src.trust);
    for (const m of store.listMessages(src.id)) store.appendMessage(id, m.role, m.event);
    store.setCliSessionId(id, src.cli_session_id);
    kvSet(forkKey(id), src.cli_session_id);
    audit('session-fork', 'owner', `Forked ${src.title}`, { sessionId: id });
    res.status(201).json({ success: true, session: copy });
  }));

  /** Tokens and cost for one session, from the usage rows Claude reported. */
  app.get('/api/agents-x/sessions/:id/usage', (req: Request, res: Response) => {
    const row = osdb
      .prepare('SELECT COALESCE(SUM(cost_usd),0) AS cost, COALESCE(SUM(input),0) AS input, COALESCE(SUM(output),0) AS output, COALESCE(SUM(cache_read),0) AS cacheRead, COUNT(*) AS runs FROM usage WHERE session_id = ?')
      .get(String(req.params.id));
    res.json({ success: true, usage: row });
  });

  // ---- search across every conversation ---------------------------------------------------------
  app.get('/api/agents-x/search', handle((req: Request, res: Response) => {
    const q = (str(req.query.q, 100) ?? '').trim();
    if (q.length < 2) return res.json({ success: true, hits: [] });
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = osdb
      .prepare(
        `SELECT m.session_id AS id, s.title, s.agent, s.cwd, s.updated, m.role, m.event_json AS ev
         FROM messages m JOIN sessions s ON s.id = m.session_id
         WHERE m.event_json LIKE ? ESCAPE '\\' AND m.role IN ('user','agent')
         ORDER BY s.updated DESC LIMIT 60`,
      )
      .all(like) as Array<{ id: string; title: string; agent: string; cwd: string; updated: number; role: string; ev: string }>;
    const seen = new Set<string>();
    const hits: Array<{ id: string; title: string; agent: string; cwd: string; updated: number; snippet: string }> = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      let text = '';
      try {
        const e = JSON.parse(r.ev) as { text?: string; delta?: string };
        text = e.text ?? e.delta ?? '';
      } catch {
        continue;
      }
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) continue;
      seen.add(r.id);
      hits.push({ id: r.id, title: r.title, agent: r.agent, cwd: r.cwd, updated: r.updated, snippet: text.slice(Math.max(0, i - 50), i + q.length + 80).replace(/\s+/g, ' ') });
      if (hits.length >= 25) break;
    }
    res.json({ success: true, hits });
  }));

  // ---- permissions and model per session ---------------------------------------------------------
  app.put('/api/agents-x/sessions/:id/trust', handle((req: Request, res: Response) => {
    const s = store.getSession(String(req.params.id));
    if (!s) return fail(res, 404, 'Session not found');
    const trust = req.body?.trust;
    if (trust !== null && !isTrust(trust)) return fail(res, 400, 'Unknown permission level');
    if (trust === 'full' && req.body?.confirmFull !== true) return fail(res, 400, 'Confirm before giving a session full permissions');
    osdb.prepare('UPDATE sessions SET trust = ? WHERE id = ?').run(trust, s.id);
    audit('session-trust', 'owner', `Permissions for ${s.title}: ${trust ?? 'follow the project'}`, { sessionId: s.id });
    res.json({ success: true });
  }));

  app.put('/api/agents-x/sessions/:id/model', handle((req: Request, res: Response) => {
    const s = store.getSession(String(req.params.id));
    if (!s) return fail(res, 404, 'Session not found');
    const model = str(req.body?.model, 60)?.trim() ?? '';
    if (model && !/^[a-z0-9][a-z0-9.\-\[\]]{0,60}$/i.test(model)) return fail(res, 400, 'That does not look like a model name');
    kvSet(`session.model.${s.id}`, model || null);
    res.json({ success: true });
  }));

  app.get('/api/agents-x/sessions/:id/settings', (req: Request, res: Response) => {
    const s = store.getSession(String(req.params.id));
    res.json({ success: true, trust: s?.trust ?? null, model: modelFor(String(req.params.id)) ?? '' });
  });

  // ---- session templates ----------------------------------------------------------------------------
  interface SessionTemplate { id: string; name: string; agent: string; prompt: string; trust: string | null; model: string }
  const TKEY = 'session.templates';
  app.get('/api/agents-x/templates', (_req: Request, res: Response) => res.json({ success: true, templates: kvGet<SessionTemplate[]>(TKEY, []) }));
  app.post('/api/agents-x/templates', handle((req: Request, res: Response) => {
    const name = (str(req.body?.name, 60) ?? '').trim();
    const prompt = (str(req.body?.prompt, 4000) ?? '').trim();
    if (!name || !prompt) return fail(res, 400, 'A template needs a name and a first prompt');
    const agent = ['claude', 'hermes', 'antigravity'].includes(req.body?.agent) ? req.body.agent : 'claude';
    const trust = req.body?.trust === null || req.body?.trust === undefined ? null : isTrust(req.body.trust) && req.body.trust !== 'full' ? req.body.trust : null;
    const list = kvGet<SessionTemplate[]>(TKEY, []);
    if (list.length >= 40) return fail(res, 409, 'That is enough templates. Delete one first.');
    const t: SessionTemplate = { id: randomUUID(), name, agent, prompt, trust, model: (str(req.body?.model, 60) ?? '').trim() };
    kvSet(TKEY, [...list, t]);
    res.status(201).json({ success: true, template: t });
  }));
  app.delete('/api/agents-x/templates/:id', handle((req: Request, res: Response) => {
    kvSet(TKEY, kvGet<SessionTemplate[]>(TKEY, []).filter((t) => t.id !== req.params.id));
    res.json({ success: true });
  }));
}
