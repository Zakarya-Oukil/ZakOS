import path from 'node:path';
import type { Express, NextFunction, Request, Response } from 'express';
import { listAdapters } from '../agents/adapters';
import * as store from '../agents/store';
import { audit } from '../audit';
import { isTrustedLocalRequest } from '../terminal/pty';
import { askVault } from './ask';
import { capture, getBrainSettings, updateBrainSettings } from './capture';
import { diffGraphs, listSnapshots } from './graphdiff';
import { searchNotes } from './search';

function localOnly(req: Request, res: Response, next: NextFunction) {
  if (!isTrustedLocalRequest(req)) {
    res.status(403).json({ success: false, error: 'Local access only' });
    return;
  }
  next();
}

const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

let asking = false;

export function mountBrainRoutes(app: Express) {
  app.use('/api/brain', localOnly);

  app.get('/api/brain/search', (req: Request, res: Response) => {
    const q = str(req.query.q)?.slice(0, 200);
    if (!q) return res.json({ success: true, hits: [] });
    res.json({ success: true, hits: searchNotes(q, Math.min(50, Math.max(1, Number(req.query.limit) || 20))) });
  });

  /** One answer at a time: each one is a real agent run, so a double click must not start two. */
  app.post('/api/brain/ask', async (req: Request, res: Response) => {
    const question = str(req.body?.question)?.slice(0, 1000);
    if (!question) return fail(res, 400, 'Ask a question first');
    const agent = str(req.body?.agent) ?? 'claude';
    if (!listAdapters().some((a) => a.id === agent)) return fail(res, 400, 'Unknown agent');
    if (asking) return fail(res, 409, 'Another question is still being answered');
    asking = true;
    try {
      res.json({ success: true, ...(await askVault(question, agent)) });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    } finally {
      asking = false;
    }
  });

  app.get('/api/brain/settings', (_req: Request, res: Response) => {
    res.json({ success: true, settings: getBrainSettings() });
  });

  app.put('/api/brain/settings', (req: Request, res: Response) => {
    const settings = updateBrainSettings({ autoCapture: req.body?.autoCapture });
    audit('brain-settings', 'owner', `Auto-capture ${settings.autoCapture ? 'on' : 'off'}`);
    res.json({ success: true, settings });
  });

  /** Saves the latest exchange of one session into the vault, on request. */
  app.post('/api/brain/capture', async (req: Request, res: Response) => {
    const session = store.getSession(String(req.body?.sessionId ?? ''));
    if (!session) return fail(res, 404, 'Session not found');
    const messages = store.listMessages(session.id);
    let at = -1;
    messages.forEach((m, i) => m.role === 'user' && (at = i));
    if (at < 0) return fail(res, 409, 'This session has no prompt to capture yet');
    const prompt = (messages[at].event as { text?: string }).text ?? '';
    const answer = messages
      .slice(at + 1)
      .filter((m) => m.event.type === 'text')
      .map((m) => (m.event as { delta: string }).delta)
      .join('');
    try {
      const note = await capture({ agent: session.agent, project: path.basename(session.cwd), title: session.title, prompt, answer: answer || '(no text reply)', ts: Date.now() });
      audit('brain-capture', 'owner', `Captured ${session.title} to ${note}`, { sessionId: session.id });
      res.json({ success: true, note });
    } catch (err) {
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/api/brain/graph/:projectId/snapshots', (req: Request, res: Response) => {
    try {
      res.json({ success: true, snapshots: listSnapshots(String(req.params.projectId)) });
    } catch (err) {
      fail(res, 404, err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/api/brain/graph/:projectId/diff', (req: Request, res: Response) => {
    try {
      res.json({ success: true, diff: diffGraphs(String(req.params.projectId), String(req.query.from ?? ''), String(req.query.to ?? 'current')) });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });
}
