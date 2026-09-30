import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAdapter, listAdapters } from './adapters';
import { restoreCheckpoint } from './checkpoint';
import { isRunning, SessionBusyError, sendMessage, stop, type Broadcast } from './runner';
import { audit } from '../audit';
import * as store from './store';
import { dropForSession } from './approvals';
import { buildPrompt, type AttachRef } from './context';
import { fileDiff, listChanges, revertFile, type Change } from './changes';
import { getSettings, updateSettings } from './settings';

const REPO_ROOT = process.cwd();
const ATTACH_KINDS = ['file', 'folder', 'note', 'graph', 'url', 'picked'];

const pid = (req: Request): string => String(req.params.id);

function fail(res: Response, status: number, message: string) {
  res.status(status).json({ success: false, error: message });
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function mountAgentRoutes(app: Express, broadcast: Broadcast) {
  app.get('/api/agents', async (_req: Request, res: Response) => {
    const agents = await Promise.all(
      listAdapters().map(async (a) => ({ id: a.id, label: a.label, ...(await a.detect()) }))
    );
    res.json({ success: true, agents });
  });

  app.get('/api/agents/settings', (_req: Request, res: Response) => {
    res.json({ success: true, settings: getSettings() });
  });

  app.put('/api/agents/settings', (req: Request, res: Response) => {
    try {
      res.json({ success: true, settings: updateSettings({ permissionMode: req.body?.permissionMode, hermesModel: req.body?.hermesModel }) });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/api/agents/sessions', (req: Request, res: Response) => {
    const sessions = store.listSessions(str(req.query.agent));
    res.json({ success: true, sessions: sessions.map((s) => ({ ...s, running: isRunning(s.id) })) });
  });

  app.post('/api/agents/sessions', (req: Request, res: Response) => {
    const agent = str(req.body?.agent);
    if (!agent || !getAdapter(agent)) return fail(res, 400, 'Unknown or missing agent');
    const cwd = path.resolve(str(req.body?.cwd) ?? REPO_ROOT);
    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      return fail(res, 400, 'cwd does not exist or is not a directory');
    }
    const title = str(req.body?.title) ?? 'New session';
    const session = store.createSession(randomUUID(), agent, title.slice(0, 120), cwd);
    res.status(201).json({ success: true, session });
  });

  app.get('/api/agents/sessions/:id', (req: Request, res: Response) => {
    const session = store.getSession(pid(req));
    if (!session) return fail(res, 404, 'Session not found');
    res.json({
      success: true,
      session: { ...session, running: isRunning(session.id) },
      messages: store.listMessages(session.id),
    });
  });

  app.patch('/api/agents/sessions/:id', (req: Request, res: Response) => {
    const title = str(req.body?.title);
    if (!title) return fail(res, 400, 'title is required');
    if (!store.getSession(pid(req))) return fail(res, 404, 'Session not found');
    store.renameSession(pid(req), title.slice(0, 120));
    res.json({ success: true, session: store.getSession(pid(req)) });
  });

  app.delete('/api/agents/sessions/:id', (req: Request, res: Response) => {
    if (!store.getSession(pid(req))) return fail(res, 404, 'Session not found');
    stop(pid(req));
    audit('session-delete', 'owner', `Deleted session ${store.getSession(pid(req))?.title ?? pid(req)}`, { sessionId: pid(req) });
    store.deleteSession(pid(req));
    dropForSession(pid(req));
    res.json({ success: true });
  });

  app.post('/api/agents/sessions/:id/message', async (req: Request, res: Response) => {
    const prompt = str(req.body?.prompt);
    if (!prompt) return fail(res, 400, 'prompt is required');
    if (!store.getSession(pid(req))) return fail(res, 404, 'Session not found');
    try {
      const raw = Array.isArray(req.body?.attachments) ? req.body.attachments : [];
      const refs: AttachRef[] = raw
        .filter((a: any) => a && typeof a.ref === 'string' && ATTACH_KINDS.includes(a.kind))
        .map((a: any) => ({ kind: a.kind, ref: a.ref }));
      if (refs.length === 0) {
        await sendMessage(pid(req), prompt, broadcast);
      } else {
        const built = await buildPrompt(store.getSession(pid(req))!.cwd, prompt, refs);
        await sendMessage(pid(req), prompt, broadcast, {}, {
          agentPrompt: built.prompt,
          attachments: built.items.map((i) => ({ kind: i.kind, label: i.label, truncated: i.truncated })),
        });
      }
      res.status(202).json({ success: true });
    } catch (err) {
      if (err instanceof SessionBusyError) return fail(res, 409, err.message);
      fail(res, 500, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/agents/sessions/:id/stop', (req: Request, res: Response) => {
    res.json({ success: true, stopped: stop(pid(req)) });
  });

  app.get('/api/agents/sessions/:id/checkpoints', (req: Request, res: Response) => {
    if (!store.getSession(pid(req))) return fail(res, 404, 'Session not found');
    res.json({ success: true, actions: store.listActions(pid(req)) });
  });

  app.post('/api/agents/sessions/:id/restore', async (req: Request, res: Response) => {
    const session = store.getSession(pid(req));
    if (!session) return fail(res, 404, 'Session not found');
    const ref = str(req.body?.ref);
    if (!ref) return fail(res, 400, 'ref is required');
    if (isRunning(session.id)) return fail(res, 409, 'Stop the running session first');
    try {
      await restoreCheckpoint(session.cwd, ref);
      store.logAction(session.id, 'restore', `Restored tracked files to ${ref}`, ref);
      audit('restore', 'owner', `Restored tracked files to ${ref}`, { sessionId: session.id, project: path.basename(session.cwd) });
      res.json({ success: true });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });
  /** The session and a checkpoint ref it really took, so a request cannot name an arbitrary commit. */
  const changeScope = (req: Request, res: Response): { cwd: string; ref: string; sessionId: string } | undefined => {
    const session = store.getSession(pid(req));
    if (!session) return void fail(res, 404, 'Session not found');
    const ref = str(req.query.ref) ?? str(req.body?.ref);
    if (!ref || !store.listActions(session.id).some((a) => a.checkpoint_ref === ref)) return void fail(res, 400, 'Unknown checkpoint');
    return { cwd: session.cwd, ref, sessionId: session.id };
  };

  /** Re-derives the change list so a file name from the client is only acted on if it really differs. */
  const findChange = async (scope: { cwd: string; ref: string }, file: unknown): Promise<Change | undefined> =>
    typeof file === 'string' ? (await listChanges(scope.cwd, scope.ref)).find((c) => c.file === file) : undefined;

  app.get('/api/agents/sessions/:id/changes', async (req: Request, res: Response) => {
    const scope = changeScope(req, res);
    if (!scope) return;
    try {
      res.json({ success: true, changes: await listChanges(scope.cwd, scope.ref) });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  app.get('/api/agents/sessions/:id/changes/diff', async (req: Request, res: Response) => {
    const scope = changeScope(req, res);
    if (!scope) return;
    try {
      const change = await findChange(scope, req.query.file);
      if (!change) return fail(res, 404, 'That file has no changes');
      res.json({ success: true, ...(await fileDiff(scope.cwd, scope.ref, change)) });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });

  app.post('/api/agents/sessions/:id/changes/revert', async (req: Request, res: Response) => {
    const scope = changeScope(req, res);
    if (!scope) return;
    if (isRunning(scope.sessionId)) return fail(res, 409, 'Stop the running session first');
    try {
      const change = await findChange(scope, req.body?.file);
      if (!change) return fail(res, 404, 'That file has no changes');
      await revertFile(scope.cwd, scope.ref, change);
      audit('revert-file', 'owner', `Reverted ${change.file} (${change.status}) to ${scope.ref.slice(0, 8)}`, { sessionId: scope.sessionId, project: path.basename(scope.cwd) });
      res.json({ success: true });
    } catch (err) {
      fail(res, 400, err instanceof Error ? err.message : String(err));
    }
  });
}
